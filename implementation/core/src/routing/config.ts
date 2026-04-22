import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseSimpleYaml } from "../lib/simple-yaml.ts";
import type {
  ProjectRegistryEntry,
  RouterConfig,
  TaskBugAcceptanceMode,
  TaskBugCompletionNotifyMode,
} from "../types.ts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeTargetKind(value: unknown): "service" | "project_session" | undefined {
  return value === "service" || value === "project_session" ? value : undefined;
}

function normalizeWorkflow(value: unknown): "general" | "dispatch" | "review" | null | undefined {
  return value === "general" || value === "dispatch" || value === "review" || value === null
    ? (value as "general" | "dispatch" | "review" | null)
    : undefined;
}

function normalizeAcceptanceMode(value: unknown): TaskBugAcceptanceMode | undefined {
  return value === "manual_acceptance" || value === "agent_can_finalize"
    ? value
    : undefined;
}

function normalizeCompletionNotifyMode(
  value: unknown,
): TaskBugCompletionNotifyMode | undefined {
  return value === "dm_on_completion_boundary" || value === "no_dm_on_completion_boundary"
    ? value
    : undefined;
}

function normalizeProjectSessionBinding(value: unknown): RouterConfig["project_session_binding"] {
  return normalizeRuntimeBinding(value);
}

function normalizeServiceBinding(value: unknown): RouterConfig["service_binding"] {
  return normalizeRuntimeBinding(value);
}

function normalizeTaskBugPolicy(value: unknown): RouterConfig["task_bug_policy"] {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const defaults = asRecord(record.defaults);
  if (!defaults) {
    return null;
  }

  const acceptanceMode = normalizeAcceptanceMode(defaults.acceptance_mode);
  const completionNotifyMode = normalizeCompletionNotifyMode(
    defaults.completion_notify_mode,
  );

  if (!acceptanceMode && !completionNotifyMode) {
    return null;
  }

  return {
    defaults: {
      acceptance_mode: acceptanceMode ?? null,
      completion_notify_mode: completionNotifyMode ?? null,
    },
  };
}

function normalizeRuntimeBinding(value: unknown): {
  runtime_kind: string;
  target_ref: string;
  metadata?: Record<string, unknown> | null;
} | null {
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

export async function loadRouterConfig(configPath?: string): Promise<RouterConfig> {
  if (!configPath) {
    return {};
  }

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = parseSimpleYaml<Record<string, unknown>>(raw);
    const actionsRecord = asRecord(parsed.actions);
    const actions = actionsRecord
      ? Object.fromEntries(
          Object.entries(actionsRecord).map(([actionName, value]) => {
            const item = asRecord(value);
            return [
              actionName,
              {
                target_kind: normalizeTargetKind(item?.target_kind),
                workflow: normalizeWorkflow(item?.workflow) ?? null,
                requires_resolved_project:
                  typeof item?.requires_resolved_project === "boolean"
                    ? item.requires_resolved_project
                    : true,
              },
            ];
          }),
        )
      : undefined;

    return {
      actions,
      service_binding: normalizeServiceBinding(parsed.service_binding),
      project_session_binding: normalizeProjectSessionBinding(parsed.project_session_binding),
      task_bug_policy: normalizeTaskBugPolicy(parsed.task_bug_policy),
    };
  } catch {
    return {};
  }
}

export async function loadProjectRouterConfig(
  entry: ProjectRegistryEntry,
): Promise<RouterConfig> {
  const candidates = [
    path.join(entry.project_root, "router.yaml"),
    path.join(entry.project_root, "router.yml"),
    path.join(entry.project_root, "project-router.yaml"),
    path.join(entry.project_root, "project-router.yml"),
  ];

  for (const configPath of candidates) {
    const config = await loadRouterConfig(configPath);
    if (
      (config.actions && Object.keys(config.actions).length > 0) ||
      config.service_binding ||
      config.project_session_binding ||
      config.task_bug_policy
    ) {
      return config;
    }
  }

  return {};
}

export function mergeRouterConfigs(
  base: RouterConfig,
  override: RouterConfig,
): RouterConfig {
  return {
    actions: {
      ...(base.actions ?? {}),
      ...(override.actions ?? {}),
    },
    service_binding:
      override.service_binding ?? base.service_binding ?? null,
    project_session_binding:
      override.project_session_binding ?? base.project_session_binding ?? null,
    task_bug_policy: {
      defaults: {
        acceptance_mode:
          override.task_bug_policy?.defaults?.acceptance_mode ??
          base.task_bug_policy?.defaults?.acceptance_mode ??
          null,
        completion_notify_mode:
          override.task_bug_policy?.defaults?.completion_notify_mode ??
          base.task_bug_policy?.defaults?.completion_notify_mode ??
          null,
      },
    },
  };
}
