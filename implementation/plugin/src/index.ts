import { buildMissingSessionKeyMessage, handleProjectCommand, resolveSessionKeyFromCommandContext } from "./commands/project.ts";
import { handleProjectsCommand } from "./commands/projects.ts";
import { handleSaveCommand } from "./commands/save.ts";
import { createBeforePromptBuildHook } from "./hooks/before-prompt-build.ts";
import { createSessionProjectStore } from "./state/session-project-store.ts";
import type { CommandContextLike } from "./types.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface PluginApiLike {
  config?: {
    registryPath?: string;
    dataDir?: string;
  };
  pluginConfig?: {
    registryPath?: string;
    dataDir?: string;
  };
  runtime?: {
    state?: {
      resolveStateDir?: () => string;
    };
  };
  logger?: {
    debug?: (message: string) => void;
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
  registerCommand?: (command: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: CommandContextLike) => Promise<{ text: string }>;
  }) => void;
  on?: (
    eventName: "before_prompt_build" | "before_dispatch",
    handler: (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>,
    options?: { priority?: number },
  ) => void;
}

function parseProjectId(rawArgs: string | undefined): string {
  return (rawArgs ?? "").trim();
}

function parseProjectsQuery(rawArgs: string | undefined): string | undefined {
  const query = (rawArgs ?? "").trim();
  return query || undefined;
}

function parseSaveArgs(rawArgs: string | undefined): { mode: "draft" | "apply" | "cancel" | "dry-run" } {
  const text = (rawArgs ?? "").trim();
  if (text === "apply") {
    return { mode: "apply" };
  }
  if (text === "cancel") {
    return { mode: "cancel" };
  }
  return {
    mode: text === "--dry-run" || text === "-n" ? "dry-run" : "draft",
  };
}

function debugLog(api: PluginApiLike, message: string): void {
  api.logger?.info?.(`[assistant-context-router] ${message}`);
}

function resolveDefaultRegistryPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../../../../../index.yaml");
}

function pickTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSlashLikeText(rawText: string): string {
  let text = rawText.trim();

  // Some surfaces prepend a lightweight timestamp/metainfo wrapper before the
  // actual user input, e.g. `[Sat ...] /project foo`. Strip those wrappers so
  // slash commands can still be recognized by before_dispatch.
  while (text.startsWith("[")) {
    const closeIndex = text.indexOf("]");
    if (closeIndex === -1) {
      break;
    }
    const remainder = text.slice(closeIndex + 1).trimStart();
    if (!remainder) {
      break;
    }
    text = remainder;
  }

  return text;
}

function resolveMessageText(event: Record<string, unknown>, ctx?: unknown): string {
  const messageRecord =
    event.message && typeof event.message === "object"
      ? (event.message as Record<string, unknown>)
      : null;
  const payloadRecord =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : null;
  const ctxRecord = ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>) : null;

  const candidates = [
    event.text,
    event.body,
    event.content,
    event.input,
    event.rawText,
    event.commandBody,
    typeof event.message === "string" ? event.message : undefined,
    messageRecord?.text,
    messageRecord?.body,
    messageRecord?.content,
    payloadRecord?.text,
    payloadRecord?.body,
    payloadRecord?.content,
    ctxRecord?.text,
    ctxRecord?.body,
    ctxRecord?.content,
    ctxRecord?.input,
    ctxRecord?.commandBody,
  ];

  for (const value of candidates) {
    const text = pickTrimmedString(value);
      if (text) {
      return normalizeSlashLikeText(text);
    }
  }
  return "";
}

function resolveSessionKeyFromEvent(event: Record<string, unknown>, ctx?: unknown): string | null {
  const eventSession =
    (typeof event.sessionKey === "string" && event.sessionKey.trim()) ||
    (event.session && typeof event.session === "object" && event.session !== null
      ? ((typeof (event.session as Record<string, unknown>).sessionKey === "string" &&
          ((event.session as Record<string, unknown>).sessionKey as string).trim()) ||
        (typeof (event.session as Record<string, unknown>).key === "string" &&
          ((event.session as Record<string, unknown>).key as string).trim()))
      : null);
  if (eventSession) {
    return eventSession;
  }

  if (ctx && typeof ctx === "object") {
    const commandCtx = ctx as CommandContextLike;
    return resolveSessionKeyFromCommandContext(commandCtx);
  }

  return null;
}

async function handleSlashLikeInput(input: {
  text: string;
  sessionKey: string | null;
  registryPath: string;
  store: ReturnType<typeof createSessionProjectStore>;
}): Promise<string | null> {
  const text = input.text.trim();
  if (text === "/projects" || text.startsWith("/projects ")) {
    const query = text.slice("/projects".length).trim() || undefined;
    const result = await handleProjectsCommand({
      registryPath: input.registryPath,
      query,
    });
    return result.content;
  }

  if (text.startsWith("/project")) {
    const projectId = text.slice("/project".length).trim();
    if (!projectId) {
      return "Usage: /project <project_id>";
    }
    if (!input.sessionKey) {
      return buildMissingSessionKeyMessage(projectId);
    }
    const result = await handleProjectCommand({
      registryPath: input.registryPath,
      projectId,
      sessionKey: input.sessionKey,
      store: input.store,
    });
    return result.content;
  }

  if (text === "/save" || text.startsWith("/save ")) {
    if (!input.sessionKey) {
      return buildMissingSessionKeyMessage();
    }

    const args = text.slice("/save".length).trim();
    const parsed = parseSaveArgs(args);

    const result = await handleSaveCommand({
      sessionKey: input.sessionKey,
      registryPath: input.registryPath,
      store: input.store,
      mode: parsed.mode,
    });
    return result.content;
  }

  return null;
}

export function createAssistantContextRouterPlugin(input: {
  registryPath: string;
  dataDir?: string;
}) {
  return {
    id: "assistant-context-router",
    name: "Assistant Context Router",
    async register(api: PluginApiLike) {
      const resolvedDataDir =
        input.dataDir ?? api.config?.dataDir ?? api.runtime?.state?.resolveStateDir?.();
      const store = createSessionProjectStore({ dataDir: resolvedDataDir });
      debugLog(
        api,
        `register start registryPath=${input.registryPath} dataDir=${resolvedDataDir ?? "default"}`,
      );

      api.registerCommand?.({
        name: "projects",
        description: "List known projects from the project registry",
        acceptsArgs: true,
        requireAuth: true,
        handler: async (ctx) => {
          const query = parseProjectsQuery(ctx.args);
          debugLog(api, `projects command invoked query=${query ?? "<empty>"}`);
          const result = await handleProjectsCommand({
            registryPath: input.registryPath,
            query,
          });
          return { text: result.content };
        },
      });

      api.registerCommand?.({
        name: "project",
        description: "Switch the current session into a project context",
        acceptsArgs: true,
        requireAuth: true,
        handler: async (ctx) => {
          const projectId = parseProjectId(ctx.args);
          debugLog(
            api,
            `project command invoked projectId=${projectId || "<empty>"} channel=${ctx.channel ?? ctx.channelId ?? "unknown"}`,
          );
          if (!projectId) {
            return { text: "Usage: /project <project_id>" };
          }

          const sessionKey = resolveSessionKeyFromCommandContext(ctx);
          debugLog(
            api,
            `project command session resolution sessionKey=${sessionKey ?? "missing"}`,
          );
          if (!sessionKey) {
            return { text: buildMissingSessionKeyMessage(projectId) };
          }

          const result = await handleProjectCommand({
            registryPath: input.registryPath,
            projectId,
            sessionKey,
            store,
          });
          return { text: result.content };
        },
      });

      api.registerCommand?.({
        name: "save",
        description: "Save the current project state into project docs",
        acceptsArgs: true,
        requireAuth: true,
        handler: async (ctx) => {
          const sessionKey = resolveSessionKeyFromCommandContext(ctx as never);
          if (!sessionKey) {
            return { text: buildMissingSessionKeyMessage() };
          }

          const parsed = parseSaveArgs(ctx.args);

          const result = await handleSaveCommand({
            sessionKey,
            registryPath: input.registryPath,
            store,
            mode: parsed.mode,
          });
          return { text: result.content };
        },
      });

      api.on?.(
        "before_dispatch",
        async (event, ctx) => {
          const text = resolveMessageText(event, ctx);
          const sessionKey = resolveSessionKeyFromEvent(event, ctx);
          debugLog(
            api,
            `before_dispatch text=${JSON.stringify(text.slice(0, 120))} sessionKey=${sessionKey ?? "missing"}`,
          );
          const response = await handleSlashLikeInput({
            text,
            sessionKey,
            registryPath: input.registryPath,
            store,
          });
          if (!response) {
            debugLog(api, "before_dispatch no slash-like match");
            return {};
          }
          debugLog(api, `before_dispatch handled slash-like input sessionKey=${sessionKey ?? "missing"}`);
          return {
            handled: true,
            text: response,
          };
        },
        { priority: 50 },
      );

      api.on?.(
        "before_prompt_build",
        async (event, ctx) =>
          {
            const result = await createBeforePromptBuildHook({
              registryPath: input.registryPath,
              store,
            })(event, ctx);
            debugLog(
              api,
              `before_prompt_build result=${result.prependSystemContext ? "prependSystemContext" : "empty"}`,
            );
            return result;
          },
        { priority: 10 },
      );
      debugLog(api, "register complete commands=projects,project,save hooks=before_dispatch,before_prompt_build");
    },
  };
}

const plugin = {
  id: "assistant-context-router",
  name: "Assistant Context Router",
  async register(api: PluginApiLike) {
    const registryPath =
      api.pluginConfig?.registryPath ??
      api.config?.registryPath ??
      resolveDefaultRegistryPath();
    const runtimePlugin = createAssistantContextRouterPlugin({
      registryPath,
      dataDir: api.pluginConfig?.dataDir ?? api.config?.dataDir,
    });
    await runtimePlugin.register(api);
  },
};

export default plugin;
