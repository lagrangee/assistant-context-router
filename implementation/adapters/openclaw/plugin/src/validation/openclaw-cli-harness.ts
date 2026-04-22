import path from "node:path";

interface JsonRecord {
  [key: string]: unknown;
}

export interface ValidateOpenClawCliDefaults {
  cliBin: string;
  pluginPath: string;
  registryPath: string;
  defaultProjectRef: string;
  promptMessage: string;
  sessionId: string;
}

export interface ValidateOpenClawCliOptions {
  cliBin: string;
  pluginPath: string;
  registryPath: string;
  projectRef: string;
  promptMessage: string;
  sessionId: string;
  keepTemp: boolean;
  skipPromptBuild: boolean;
  model: string | null;
  gatewayPort: number | null;
}

export interface PatchOpenClawValidationConfigInput {
  config: JsonRecord;
  pluginPath: string;
  registryPath: string;
  dataDir: string;
  gatewayPort: number;
  model: string | null;
}

function usage(defaults: ValidateOpenClawCliDefaults): string {
  return [
    "Usage: node scripts/validate-openclaw-cli.ts [options]",
    "",
    "Options:",
    `  --cli-bin <path>          OpenClaw CLI binary (default: ${defaults.cliBin})`,
    `  --plugin-path <path>      Plugin root path (default: ${defaults.pluginPath})`,
    `  --registry-path <path>    Projects registry path (default: ${defaults.registryPath})`,
    `  --project-ref <id>        Project id/ref to switch into (default: ${defaults.defaultProjectRef})`,
    `  --session-id <id>         Explicit OpenClaw session id (default: ${defaults.sessionId})`,
    `  --prompt-message <text>   Follow-up message used to exercise before_prompt_build`,
    `                             (default: ${defaults.promptMessage})`,
    "  --model <provider/model>  Override agent model used for prompt-build validation",
    "  --gateway-port <port>     Fixed gateway port instead of an ephemeral loopback port",
    "  --skip-prompt-build       Only validate the slash-command/session-state path",
    "  --keep-temp               Keep the isolated temp OpenClaw root for debugging",
    "  --help                    Show this help",
  ].join("\n");
}

function requireFlagValue(argv: string[], index: number, flag: string): [string, number] {
  const value = argv[index + 1];
  if (!value || value.trim() === "") {
    throw new Error(`missing-required-flag:${flag}`);
  }
  return [value.trim(), index + 2];
}

function parsePort(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`invalid-port:${raw}`);
  }
  return value;
}

export function renderValidateOpenClawCliUsage(
  defaults: ValidateOpenClawCliDefaults,
): string {
  return usage(defaults);
}

export function parseValidateOpenClawCliArgs(
  argv: string[],
  defaults: ValidateOpenClawCliDefaults,
): ValidateOpenClawCliOptions {
  const options: ValidateOpenClawCliOptions = {
    cliBin: defaults.cliBin,
    pluginPath: defaults.pluginPath,
    registryPath: defaults.registryPath,
    projectRef: defaults.defaultProjectRef,
    promptMessage: defaults.promptMessage,
    sessionId: defaults.sessionId,
    keepTemp: false,
    skipPromptBuild: false,
    model: null,
    gatewayPort: null,
  };

  for (let index = 0; index < argv.length; ) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      throw new Error(`help-requested:${usage(defaults)}`);
    }
    if (token === "--keep-temp") {
      options.keepTemp = true;
      index += 1;
      continue;
    }
    if (token === "--skip-prompt-build") {
      options.skipPromptBuild = true;
      index += 1;
      continue;
    }
    if (token === "--cli-bin") {
      [options.cliBin, index] = requireFlagValue(argv, index, token);
      continue;
    }
    if (token === "--plugin-path") {
      [options.pluginPath, index] = requireFlagValue(argv, index, token);
      continue;
    }
    if (token === "--registry-path") {
      [options.registryPath, index] = requireFlagValue(argv, index, token);
      continue;
    }
    if (token === "--project-ref") {
      [options.projectRef, index] = requireFlagValue(argv, index, token);
      continue;
    }
    if (token === "--session-id") {
      [options.sessionId, index] = requireFlagValue(argv, index, token);
      continue;
    }
    if (token === "--prompt-message") {
      [options.promptMessage, index] = requireFlagValue(argv, index, token);
      continue;
    }
    if (token === "--model") {
      const [model, next] = requireFlagValue(argv, index, token);
      options.model = model;
      index = next;
      continue;
    }
    if (token === "--gateway-port") {
      const [rawPort, next] = requireFlagValue(argv, index, token);
      options.gatewayPort = parsePort(rawPort);
      index = next;
      continue;
    }
    throw new Error(`unknown-flag:${token}`);
  }

  return options;
}

function cloneRecord<T extends JsonRecord>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureRecord(parent: JsonRecord, key: string): JsonRecord {
  const current = parent[key];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current as JsonRecord;
  }
  const next: JsonRecord = {};
  parent[key] = next;
  return next;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.trim() === "") {
      continue;
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function patchOpenClawConfigForValidation(
  input: PatchOpenClawValidationConfigInput,
): JsonRecord {
  const next = cloneRecord(input.config);

  const gateway = ensureRecord(next, "gateway");
  gateway.port = input.gatewayPort;
  gateway.bind = "custom";
  gateway.customBindHost = "127.0.0.1";
  const controlUi = ensureRecord(gateway, "controlUi");
  controlUi.enabled = false;

  const agents = ensureRecord(next, "agents");
  const agentDefaults = ensureRecord(agents, "defaults");
  if (input.model) {
    agentDefaults.model = {
      primary: input.model,
    };
  }

  const plugins = ensureRecord(next, "plugins");
  plugins.allow = ["assistant-context-router"];

  const load = ensureRecord(plugins, "load");
  const currentPaths = Array.isArray(load.paths) ? load.paths : [];
  load.paths = uniqueStrings([...currentPaths, input.pluginPath]);

  const entries = ensureRecord(plugins, "entries");
  const assistantContextRouter = ensureRecord(entries, "assistant-context-router");
  assistantContextRouter.enabled = true;
  assistantContextRouter.hooks = {
    allowPromptInjection: true,
  };
  assistantContextRouter.config = {
    registryPath: input.registryPath,
    dataDir: input.dataDir,
  };

  return next;
}

export function sessionProjectStorePath(dataDir: string): string {
  return path.join(dataDir, "assistant-context-router", "session-project-store.json");
}

export function findSessionKeysForProject(
  rawState: string,
  projectId: string,
): string[] {
  try {
    const parsed = JSON.parse(rawState) as {
      sessions?: Record<string, { current_project_id?: string | null }>;
    };
    const sessions = parsed.sessions ?? {};
    return Object.entries(sessions)
      .filter(([, value]) => value?.current_project_id === projectId)
      .map(([sessionKey]) => sessionKey);
  } catch {
    return [];
  }
}
