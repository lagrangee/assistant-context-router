import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { parseSimpleYaml } from "../../../../core/src/lib/simple-yaml.ts";
import type {
  ChannelType,
  ReplyMode,
  ReplyTargetKind,
  ReplyVisibility,
  WorkflowBindingsConfig,
  WorkflowFamily,
  WorkflowSurfaceBindingConfig,
  WorkflowSurfaceReplyTargetBinding,
} from "../../../../core/src/types.ts";

export const DEFAULT_WORKFLOW_BINDINGS_PATH_ENV = "ACR_WORKFLOW_BINDINGS_PATH";
export const DEFAULT_WORKFLOW_BINDINGS_FILENAME = "workflow-bindings.yaml";
export const DEFAULT_WORKFLOW_BINDINGS_DIRNAME = "assistant-context-router";

export type WorkflowBindingsPathSource = "explicit" | "env" | "data_dir_default" | null;

export interface WorkflowBindingsLocation {
  path: string | null;
  source: WorkflowBindingsPathSource;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asChannelType(value: unknown): ChannelType | undefined {
  return value === "tui" ||
    value === "wechat" ||
    value === "feishu" ||
    value === "discord" ||
    value === "unknown"
    ? value
    : undefined;
}

function asReplyTargetKind(value: unknown): ReplyTargetKind | undefined {
  return value === "channel" ||
    value === "main_session" ||
    value === "project_session" ||
    value === "silent_log"
    ? value
    : undefined;
}

function asReplyVisibility(value: unknown): ReplyVisibility | undefined {
  return value === "human_facing" || value === "system_facing" ? value : undefined;
}

function asReplyMode(value: unknown): ReplyMode | undefined {
  return value === "direct" || value === "escalate" || value === "silent_log" ? value : undefined;
}

function normalizeWorkflowSurfaceReplyTargetBinding(
  value: unknown,
): WorkflowSurfaceReplyTargetBinding | null {
  const record = asRecord(value);
  const channelType = asChannelType(record?.channel_type);
  const targetKind = asReplyTargetKind(record?.target_kind);
  const targetId = asString(record?.target_id);
  const visibility = asReplyVisibility(record?.visibility);
  const replyMode = asReplyMode(record?.reply_mode);

  if (!channelType || !targetKind || !targetId || !visibility || !replyMode) {
    return null;
  }

  return {
    channel_type: channelType,
    target_kind: targetKind,
    target_id: targetId,
    visibility,
    reply_mode: replyMode,
  };
}

function normalizeWorkflowSurfaceBindingConfig(value: unknown): WorkflowSurfaceBindingConfig | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return {
    default_reply_target: normalizeWorkflowSurfaceReplyTargetBinding(record.default_reply_target),
  };
}

function resolvePluginOwnedBindingsRoot(dataDir?: string | null): string | null {
  const trimmed = asString(dataDir);
  if (!trimmed) {
    return null;
  }

  return path.basename(trimmed) === DEFAULT_WORKFLOW_BINDINGS_DIRNAME
    ? trimmed
    : path.join(trimmed, DEFAULT_WORKFLOW_BINDINGS_DIRNAME);
}

export function resolveDefaultWorkflowBindingsPathForDataDir(dataDir?: string | null): string | null {
  const root = resolvePluginOwnedBindingsRoot(dataDir);
  return root ? path.join(root, DEFAULT_WORKFLOW_BINDINGS_FILENAME) : null;
}

export function resolveWorkflowBindingsLocation(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string | null;
} = {}): WorkflowBindingsLocation {
  const explicit = asString(input.configPath);
  if (explicit) {
    return {
      path: explicit,
      source: "explicit",
    };
  }

  const runtimeEnv = input.env ?? process.env;
  const envPath = asString(runtimeEnv[DEFAULT_WORKFLOW_BINDINGS_PATH_ENV]);
  if (envPath) {
    return {
      path: envPath,
      source: "env",
    };
  }

  const defaultPath = resolveDefaultWorkflowBindingsPathForDataDir(input.dataDir);
  if (defaultPath) {
    return {
      path: defaultPath,
      source: "data_dir_default",
    };
  }

  return {
    path: null,
    source: null,
  };
}

export async function loadWorkflowBindingsConfig(
  configPath?: string | null,
  env?: NodeJS.ProcessEnv,
  dataDir?: string | null,
): Promise<WorkflowBindingsConfig> {
  const location = resolveWorkflowBindingsLocation({ configPath, env, dataDir });
  if (!location.path) {
    return {};
  }

  try {
    const raw = await readFile(location.path, "utf8");
    const parsed = parseSimpleYaml<Record<string, unknown>>(raw);
    return {
      general: normalizeWorkflowSurfaceBindingConfig(parsed.general),
      dispatch: normalizeWorkflowSurfaceBindingConfig(parsed.dispatch),
      review: normalizeWorkflowSurfaceBindingConfig(parsed.review),
    };
  } catch (error) {
    if (
      location.source === "data_dir_default" &&
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }
    return {};
  }
}

export function resolveWorkflowDefaultReplyTarget(input: {
  workflow: WorkflowFamily | null | undefined;
  config?: WorkflowBindingsConfig | null;
}): WorkflowSurfaceReplyTargetBinding | null {
  const workflow = input.workflow ?? null;
  if (!input.config) {
    return null;
  }

  const workflowBinding =
    (workflow === "dispatch" ? input.config.dispatch
      : workflow === "review" ? input.config.review
      : input.config.general) ?? null;

  return workflowBinding?.default_reply_target ?? input.config.general?.default_reply_target ?? null;
}

function renderSurface(lines: string[], name: string, binding?: WorkflowSurfaceBindingConfig | null): void {
  if (!binding?.default_reply_target) {
    return;
  }

  lines.push(
    `${name}:`,
    "  default_reply_target:",
    `    channel_type: ${binding.default_reply_target.channel_type}`,
    `    target_kind: ${binding.default_reply_target.target_kind}`,
    `    target_id: ${binding.default_reply_target.target_id}`,
    `    visibility: ${binding.default_reply_target.visibility}`,
    `    reply_mode: ${binding.default_reply_target.reply_mode}`,
  );
}

export function renderWorkflowBindingsConfigYaml(config: WorkflowBindingsConfig): string {
  const lines: string[] = [];
  renderSurface(lines, "general", config.general);
  renderSurface(lines, "dispatch", config.dispatch);
  renderSurface(lines, "review", config.review);
  return `${lines.join("\n")}\n`;
}

export async function writeWorkflowBindingsConfigFile(input: {
  dataDir: string;
  configPath?: string | null;
  force?: boolean;
  config: WorkflowBindingsConfig;
}): Promise<string> {
  const configPath =
    asString(input.configPath) ??
    resolveDefaultWorkflowBindingsPathForDataDir(input.dataDir);
  if (!configPath) {
    throw new Error("missing-workflow-bindings-write-path");
  }

  if (!input.force) {
    try {
      await readFile(configPath, "utf8");
      throw new Error(`workflow-bindings-config-exists:${configPath}`);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        // continue
      } else if (
        error instanceof Error &&
        error.message.startsWith("workflow-bindings-config-exists:")
      ) {
        throw error;
      } else if (error) {
        throw error;
      }
    }
  }

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, renderWorkflowBindingsConfigYaml(input.config), "utf8");
  return configPath;
}
