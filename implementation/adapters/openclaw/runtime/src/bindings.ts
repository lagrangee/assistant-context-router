import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { parseSimpleYaml } from "../../../../core/src/lib/simple-yaml.ts";
import type {
  MainSessionBinding,
  MainSessionResolution,
  ProjectSessionBinding,
  RuntimeBindingsConfig,
  RouterConfig,
} from "../../../../core/src/types.ts";

export const DEFAULT_RUNTIME_BINDINGS_PATH_ENV = "ACR_RUNTIME_BINDINGS_PATH";
export const DEFAULT_RUNTIME_BINDINGS_FILENAME = "runtime-bindings.yaml";
export const DEFAULT_RUNTIME_BINDINGS_DIRNAME = "assistant-context-router";

export type RuntimeBindingsPathSource = "explicit" | "env" | "data_dir_default" | null;

export interface RuntimeBindingsLocation {
  path: string | null;
  source: RuntimeBindingsPathSource;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMainSessionBinding(value: unknown): MainSessionBinding | null {
  const record = asRecord(value);
  const bindingId =
    typeof record?.binding_id === "string" && record.binding_id.trim()
      ? record.binding_id.trim()
      : null;
  const runtimeKind =
    typeof record?.runtime_kind === "string" && record.runtime_kind.trim()
      ? record.runtime_kind.trim()
      : null;
  const canonicalSessionKey =
    typeof record?.canonical_session_key === "string" && record.canonical_session_key.trim()
      ? record.canonical_session_key.trim()
      : null;

  if (!bindingId || !runtimeKind || !canonicalSessionKey) {
    return null;
  }

  const metadata = asRecord(record.metadata);
  return {
    binding_id: bindingId,
    runtime_kind: runtimeKind,
    canonical_session_key: canonicalSessionKey,
    aliases: asStringArray(record.aliases),
    metadata: metadata ?? null,
  };
}

export function normalizeProjectSessionBinding(value: unknown): ProjectSessionBinding | null {
  const record = asRecord(value);
  const runtimeKind =
    typeof record?.runtime_kind === "string" && record.runtime_kind.trim()
      ? record.runtime_kind.trim()
      : null;
  const targetRef =
    typeof record?.target_ref === "string" && record.target_ref.trim()
      ? record.target_ref.trim()
      : null;

  if (!runtimeKind || !targetRef) {
    return null;
  }

  return {
    runtime_kind: runtimeKind,
    target_ref: targetRef,
    metadata: asRecord(record.metadata) ?? null,
  };
}

export async function loadRuntimeBindingsConfig(
  configPath?: string,
  env?: NodeJS.ProcessEnv,
  dataDir?: string | null,
): Promise<RuntimeBindingsConfig> {
  const location = resolveRuntimeBindingsLocation({ configPath, env, dataDir });
  if (!location.path) {
    return {};
  }

  try {
    const raw = await readFile(location.path, "utf8");
    const parsed = parseSimpleYaml<Record<string, unknown>>(raw);
    const mainSessionsRaw = Array.isArray(parsed.main_sessions) ? parsed.main_sessions : [];
    return {
      main_sessions: mainSessionsRaw
        .map((item) => normalizeMainSessionBinding(item))
        .filter((item): item is MainSessionBinding => item !== null),
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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolvePluginOwnedBindingsRoot(dataDir?: string | null): string | null {
  const trimmed = asString(dataDir);
  if (!trimmed) {
    return null;
  }

  return path.basename(trimmed) === DEFAULT_RUNTIME_BINDINGS_DIRNAME
    ? trimmed
    : path.join(trimmed, DEFAULT_RUNTIME_BINDINGS_DIRNAME);
}

export function resolveDefaultRuntimeBindingsPathForDataDir(dataDir?: string | null): string | null {
  const root = resolvePluginOwnedBindingsRoot(dataDir);
  return root ? path.join(root, DEFAULT_RUNTIME_BINDINGS_FILENAME) : null;
}

export function resolveRuntimeBindingsLocation(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string | null;
} = {}): RuntimeBindingsLocation {
  const explicit = asString(input.configPath);
  if (explicit) {
    return {
      path: explicit,
      source: "explicit",
    };
  }

  const runtimeEnv = input.env ?? process.env;
  const envPath = asString(runtimeEnv[DEFAULT_RUNTIME_BINDINGS_PATH_ENV]);
  if (envPath) {
    return {
      path: envPath,
      source: "env",
    };
  }

  const defaultPath = resolveDefaultRuntimeBindingsPathForDataDir(input.dataDir);
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

export function renderRuntimeBindingsConfigYaml(input: {
  bindings: MainSessionBinding[];
}): string {
  const lines = ["main_sessions:"];

  for (const binding of input.bindings) {
    lines.push(
      `  - binding_id: ${binding.binding_id}`,
      `    runtime_kind: ${binding.runtime_kind}`,
      `    canonical_session_key: ${binding.canonical_session_key}`,
      `    aliases: ${binding.aliases.join(", ")}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function writeRuntimeBindingsConfigFile(input: {
  dataDir: string;
  configPath?: string | null;
  force?: boolean;
  bindings: MainSessionBinding[];
}): Promise<string> {
  const configPath =
    asString(input.configPath) ??
    resolveDefaultRuntimeBindingsPathForDataDir(input.dataDir);
  if (!configPath) {
    throw new Error("missing-runtime-bindings-write-path");
  }

  if (!input.force) {
    try {
      await readFile(configPath, "utf8");
      throw new Error(`runtime-bindings-config-exists:${configPath}`);
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
        error.message.startsWith("runtime-bindings-config-exists:")
      ) {
        throw error;
      } else if (error) {
        throw error;
      }
    }
  }

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, renderRuntimeBindingsConfigYaml({ bindings: input.bindings }), "utf8");
  return configPath;
}

export function resolveMainSessionBinding(
  sessionKey: string,
  config?: RuntimeBindingsConfig,
): MainSessionResolution {
  const trimmed = sessionKey.trim();
  const bindings = config?.main_sessions ?? [];

  for (const binding of bindings) {
    if (binding.canonical_session_key === trimmed) {
      return {
        binding,
        canonical_session_key: binding.canonical_session_key,
        alias_matched: binding.canonical_session_key,
      };
    }

    if (binding.aliases.includes(trimmed)) {
      return {
        binding,
        canonical_session_key: binding.canonical_session_key,
        alias_matched: trimmed,
      };
    }
  }

  return {
    binding: null,
    canonical_session_key: trimmed,
    alias_matched: null,
  };
}

export function mergeProjectSessionBinding(
  base: RouterConfig,
  override: RouterConfig,
): ProjectSessionBinding | null {
  return override.project_session_binding ?? base.project_session_binding ?? null;
}
