import { buildMissingSessionKeyMessage, handleProjectCommand, resolveSessionKeyFromCommandContext } from "./commands/project.ts";
import { handleProjectsCommand } from "./commands/projects.ts";
import { createBeforePromptBuildHook } from "./hooks/before-prompt-build.ts";
import { createSessionProjectStore } from "./state/session-project-store.ts";
import type { CommandContextLike } from "./types.ts";

interface PluginApiLike {
  runtime?: {
    state?: {
      resolveStateDir?: () => string;
    };
  };
  registerCommand?: (command: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: CommandContextLike) => Promise<{ text: string }>;
  }) => void;
  on?: (
    eventName: "before_prompt_build",
    handler: (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>,
    options?: { priority?: number },
  ) => void;
}

function parseProjectId(rawArgs: string | undefined): string {
  return (rawArgs ?? "").trim();
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
        input.dataDir ?? api.runtime?.state?.resolveStateDir?.();
      const store = createSessionProjectStore({ dataDir: resolvedDataDir });

      api.registerCommand?.({
        name: "projects",
        description: "List known projects from the project registry",
        acceptsArgs: false,
        requireAuth: true,
        handler: async () => {
          const result = await handleProjectsCommand({
            registryPath: input.registryPath,
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
          if (!projectId) {
            return { text: "Usage: /project <project_id>" };
          }

          const sessionKey = resolveSessionKeyFromCommandContext(ctx);
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

      api.on?.(
        "before_prompt_build",
        async (event, ctx) =>
          createBeforePromptBuildHook({
            registryPath: input.registryPath,
            store,
          })(event, ctx),
        { priority: 10 },
      );
    },
  };
}

export default createAssistantContextRouterPlugin;
