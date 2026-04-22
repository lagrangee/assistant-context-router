import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { parseSimpleYaml } from "../../../core/src/lib/simple-yaml.ts";

export const DEFAULT_FEISHU_CONFIG_PATH_ENV = "ACR_FEISHU_CONFIG_PATH";
export const DEFAULT_FEISHU_CONFIG_FILENAME = "feishu-adapter.yaml";
export const DEFAULT_FEISHU_CONFIG_DIRNAME = "assistant-context-router";
export const DEFAULT_FEISHU_WORK_SURFACE_BASE_TOKEN = "private config host";
export const DEFAULT_GOVERNANCE_CHANNEL_TYPE = "wechat";
export const DEFAULT_GOVERNANCE_TARGET_KIND = "dm";
export const DEFAULT_GOVERNANCE_TARGET_REF = "local:human_dm";
export const DEFAULT_GOVERNANCE_DELIVERY_MODE = "direct";

export interface FeishuWorkSurfaceProjectionFieldMap {
  project_id: string;
  project: string;
  surface_status: string;
  headline: string;
  summary: string;
  updated_at: string;
  trace_id: string;
  run_id: string;
  queue_ref: string;
  artifact_label: string;
  artifact_target: string;
  signal_kind: string;
  action_name: string;
  workflow: string;
  artifact_kind: string;
}

export interface FeishuProjectsFieldMap {
  project_id: string;
  project_name: string;
  source_path: string;
  objective: string;
  cadence: string;
  archived: string;
}

export interface FeishuWorkSurfaceTableNames {
  projection: string;
  projects: string;
}

export type FeishuIdentity = "bot" | "user";
export type FeishuRelationWriteMode = "record_id_array" | "record_ref_array";

export interface FeishuWorkSurfaceBinding {
  baseToken: string;
  identity: FeishuIdentity;
  tableNames: FeishuWorkSurfaceTableNames;
  fieldNames: {
    projection: FeishuWorkSurfaceProjectionFieldMap;
    projects: FeishuProjectsFieldMap;
  };
  relationWriteMode: FeishuRelationWriteMode;
}

export interface FeishuGovernanceDeliveryBinding {
  channel_type: string;
  target_kind: string;
  target_ref: string;
  delivery_mode: string;
}

interface RawFeishuWorkSurfaceConfig {
  base_token?: string;
  base_token_ref?: string;
  identity?: FeishuIdentity;
  table_binding?: Partial<FeishuWorkSurfaceTableNames>;
  field_binding?: {
    projection?: Partial<FeishuWorkSurfaceProjectionFieldMap>;
    projects?: Partial<FeishuProjectsFieldMap>;
  };
  relation_write_mode?: FeishuRelationWriteMode;
}

interface RawFeishuGovernanceTargetConfig {
  channel_type?: string;
  target_kind?: string;
  target_ref?: string;
  target_ref_ref?: string;
  delivery_mode?: string;
}

export interface FeishuAdapterConfigFile {
  work_surface?: RawFeishuWorkSurfaceConfig;
  governance?: {
    default_target?: RawFeishuGovernanceTargetConfig;
  };
}

export type FeishuConfigPathSource = "explicit" | "env" | "data_dir_default" | null;

export interface FeishuConfigLocation {
  path: string | null;
  source: FeishuConfigPathSource;
}

export interface FeishuAdapterConfigTemplateInput {
  workSurfaceBaseToken?: string | null;
  workSurfaceIdentity?: FeishuIdentity;
  workSurfaceTableNames?: Partial<FeishuWorkSurfaceTableNames>;
  workSurfaceFieldNames?: {
    projection?: Partial<FeishuWorkSurfaceProjectionFieldMap>;
    projects?: Partial<FeishuProjectsFieldMap>;
  };
  workSurfaceRelationWriteMode?: FeishuRelationWriteMode;
  governanceTarget?: Partial<FeishuGovernanceDeliveryBinding> | null;
}

export const DEFAULT_FEISHU_WORK_SURFACE_TABLE_NAMES: FeishuWorkSurfaceTableNames = {
  projection: "Work Surface Snapshots",
  projects: "Projects",
};

export const DEFAULT_FEISHU_WORK_SURFACE_PROJECTION_FIELD_NAMES: FeishuWorkSurfaceProjectionFieldMap = {
  project_id: "Project ID",
  project: "所属项目",
  surface_status: "状态",
  headline: "标题",
  summary: "摘要",
  updated_at: "更新时间",
  trace_id: "trace_id",
  run_id: "run_id",
  queue_ref: "queue_ref",
  artifact_label: "artifact_label",
  artifact_target: "artifact_target",
  signal_kind: "signal_kind",
  action_name: "action_name",
  workflow: "workflow",
  artifact_kind: "artifact_kind",
};

export const DEFAULT_FEISHU_PROJECTS_FIELD_NAMES: FeishuProjectsFieldMap = {
  project_id: "Project ID",
  project_name: "项目名称",
  source_path: "Source Path",
  objective: "目标",
  cadence: "Cadence",
  archived: "Archived",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asIdentity(value: unknown): FeishuIdentity | undefined {
  return value === "bot" || value === "user" ? value : undefined;
}

function asRelationWriteMode(value: unknown): FeishuRelationWriteMode | undefined {
  return value === "record_id_array" || value === "record_ref_array" ? value : undefined;
}

function resolvePluginOwnedConfigRoot(dataDir?: string | null): string | null {
  const trimmed = asString(dataDir);
  if (!trimmed) {
    return null;
  }

  return path.basename(trimmed) === DEFAULT_FEISHU_CONFIG_DIRNAME
    ? trimmed
    : path.join(trimmed, DEFAULT_FEISHU_CONFIG_DIRNAME);
}

function mergeDefined<T extends Record<string, unknown>>(base: T, override?: Partial<T>): T {
  if (!override) {
    return { ...base };
  }

  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(override).filter(([, value]) => value !== undefined),
    ),
  } as T;
}

function normalizeWorkSurfaceConfig(value: unknown): RawFeishuWorkSurfaceConfig | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const tableBinding = asRecord(record.table_binding);
  const fieldBinding = asRecord(record.field_binding);
  const projectionFields = asRecord(fieldBinding?.projection);
  const projectsFields = asRecord(fieldBinding?.projects);

  return {
    base_token: asString(record.base_token) ?? undefined,
    base_token_ref: asString(record.base_token_ref) ?? undefined,
    identity: asIdentity(record.identity),
    table_binding: tableBinding
      ? {
          projection: asString(tableBinding.projection) ?? undefined,
          projects: asString(tableBinding.projects) ?? undefined,
        }
      : undefined,
    field_binding:
      projectionFields || projectsFields
        ? {
            projection: projectionFields
              ? {
                  project_id: asString(projectionFields.project_id) ?? undefined,
                  project: asString(projectionFields.project) ?? undefined,
                  surface_status: asString(projectionFields.surface_status) ?? undefined,
                  headline: asString(projectionFields.headline) ?? undefined,
                  summary: asString(projectionFields.summary) ?? undefined,
                  updated_at: asString(projectionFields.updated_at) ?? undefined,
                  trace_id: asString(projectionFields.trace_id) ?? undefined,
                  run_id: asString(projectionFields.run_id) ?? undefined,
                  queue_ref: asString(projectionFields.queue_ref) ?? undefined,
                  artifact_label: asString(projectionFields.artifact_label) ?? undefined,
                  artifact_target: asString(projectionFields.artifact_target) ?? undefined,
                  signal_kind: asString(projectionFields.signal_kind) ?? undefined,
                  action_name: asString(projectionFields.action_name) ?? undefined,
                  workflow: asString(projectionFields.workflow) ?? undefined,
                  artifact_kind: asString(projectionFields.artifact_kind) ?? undefined,
                }
              : undefined,
            projects: projectsFields
              ? {
                  project_id: asString(projectsFields.project_id) ?? undefined,
                  project_name: asString(projectsFields.project_name) ?? undefined,
                  source_path: asString(projectsFields.source_path) ?? undefined,
                  objective: asString(projectsFields.objective) ?? undefined,
                  cadence: asString(projectsFields.cadence) ?? undefined,
                  archived: asString(projectsFields.archived) ?? undefined,
                }
              : undefined,
          }
        : undefined,
    relation_write_mode: asRelationWriteMode(record.relation_write_mode),
  };
}

function normalizeGovernanceTargetConfig(value: unknown): RawFeishuGovernanceTargetConfig | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return {
    channel_type: asString(record.channel_type) ?? undefined,
    target_kind: asString(record.target_kind) ?? undefined,
    target_ref: asString(record.target_ref) ?? undefined,
    target_ref_ref: asString(record.target_ref_ref) ?? undefined,
    delivery_mode: asString(record.delivery_mode) ?? undefined,
  };
}

export function normalizeFeishuAdapterConfig(value: unknown): FeishuAdapterConfigFile {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  const governance = asRecord(record.governance);
  return {
    work_surface: normalizeWorkSurfaceConfig(record.work_surface),
    governance: governance
      ? {
          default_target: normalizeGovernanceTargetConfig(governance.default_target),
        }
      : undefined,
  };
}

export function resolveFeishuConfigPath(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string | null;
} = {}): string | null {
  return resolveFeishuConfigLocation(input).path;
}

export function resolveDefaultFeishuConfigPathForDataDir(dataDir?: string | null): string | null {
  const root = resolvePluginOwnedConfigRoot(dataDir);
  return root ? path.join(root, DEFAULT_FEISHU_CONFIG_FILENAME) : null;
}

export function resolveFeishuConfigLocation(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string | null;
} = {}): FeishuConfigLocation {
  const explicit = asString(input.configPath);
  if (explicit) {
    return {
      path: explicit,
      source: "explicit",
    };
  }

  const env = input.env ?? process.env;
  const envPath = asString(env[DEFAULT_FEISHU_CONFIG_PATH_ENV]);
  if (envPath) {
    return {
      path: envPath,
      source: "env",
    };
  }

  const defaultPath = resolveDefaultFeishuConfigPathForDataDir(input.dataDir);
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

export async function loadFeishuAdapterConfig(
  configPath?: string | null,
  env?: NodeJS.ProcessEnv,
  dataDir?: string | null,
): Promise<FeishuAdapterConfigFile> {
  const location = resolveFeishuConfigLocation({ configPath, env, dataDir });
  if (!location.path) {
    return {};
  }

  try {
    const raw = await readFile(location.path, "utf8");
    return normalizeFeishuAdapterConfig(parseSimpleYaml<Record<string, unknown>>(raw));
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
    throw error;
  }
}

function readEnvRef(ref: string, env: NodeJS.ProcessEnv, context: string): string {
  if (!ref.startsWith("env:")) {
    throw new Error(`invalid-feishu-config-env-ref:${context}:${ref}`);
  }

  const envKey = ref.slice("env:".length).trim();
  if (!envKey) {
    throw new Error(`invalid-feishu-config-env-ref:${context}:${ref}`);
  }

  const value = asString(env[envKey]);
  if (!value) {
    throw new Error(`missing-feishu-config-env-ref:${context}:${envKey}`);
  }
  return value;
}

export async function resolveFeishuWorkSurfaceBinding(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string | null;
  baseToken?: string | null;
  identity?: FeishuIdentity;
  relationWriteMode?: FeishuRelationWriteMode;
} = {}): Promise<FeishuWorkSurfaceBinding> {
  const env = input.env ?? process.env;
  const config = await loadFeishuAdapterConfig(input.configPath, env, input.dataDir);
  const workSurface = config.work_surface;

  const baseToken =
    asString(input.baseToken) ??
    asString(env.FEISHU_BASE_TOKEN) ??
    asString(workSurface?.base_token) ??
    (workSurface?.base_token_ref
      ? readEnvRef(workSurface.base_token_ref, env, "work_surface.base_token_ref")
      : null) ??
    DEFAULT_FEISHU_WORK_SURFACE_BASE_TOKEN;

  return {
    baseToken,
    identity: input.identity ?? workSurface?.identity ?? "bot",
    tableNames: mergeDefined(
      DEFAULT_FEISHU_WORK_SURFACE_TABLE_NAMES,
      workSurface?.table_binding,
    ),
    fieldNames: {
      projection: mergeDefined(
        DEFAULT_FEISHU_WORK_SURFACE_PROJECTION_FIELD_NAMES,
        workSurface?.field_binding?.projection,
      ),
      projects: mergeDefined(
        DEFAULT_FEISHU_PROJECTS_FIELD_NAMES,
        workSurface?.field_binding?.projects,
      ),
    },
    relationWriteMode:
      input.relationWriteMode ??
      workSurface?.relation_write_mode ??
      "record_id_array",
  };
}

export async function resolveGovernanceDeliveryBinding(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string | null;
} = {}): Promise<FeishuGovernanceDeliveryBinding | null> {
  const env = input.env ?? process.env;
  const config = await loadFeishuAdapterConfig(input.configPath, env, input.dataDir);
  const defaultTarget = config.governance?.default_target;

  const targetRef =
    asString(env.ACR_GOVERNANCE_TARGET_REF) ??
    asString(defaultTarget?.target_ref) ??
    (defaultTarget?.target_ref_ref
      ? readEnvRef(defaultTarget.target_ref_ref, env, "governance.default_target.target_ref_ref")
      : null);

  if (!targetRef) {
    return null;
  }

  return {
    channel_type:
      asString(env.ACR_GOVERNANCE_CHANNEL_TYPE) ??
      asString(defaultTarget?.channel_type) ??
      "wechat",
    target_kind:
      asString(env.ACR_GOVERNANCE_TARGET_KIND) ??
      asString(defaultTarget?.target_kind) ??
      "dm",
    target_ref: targetRef,
    delivery_mode:
      asString(env.ACR_GOVERNANCE_DELIVERY_MODE) ??
      asString(defaultTarget?.delivery_mode) ??
      "direct",
  };
}

export function renderFeishuAdapterConfigYaml(
  input: FeishuAdapterConfigTemplateInput = {},
): string {
  const tableNames = mergeDefined(
    DEFAULT_FEISHU_WORK_SURFACE_TABLE_NAMES,
    input.workSurfaceTableNames,
  );
  const projectionFields = mergeDefined(
    DEFAULT_FEISHU_WORK_SURFACE_PROJECTION_FIELD_NAMES,
    input.workSurfaceFieldNames?.projection,
  );
  const projectsFields = mergeDefined(
    DEFAULT_FEISHU_PROJECTS_FIELD_NAMES,
    input.workSurfaceFieldNames?.projects,
  );

  const lines = [
    "work_surface:",
    `  base_token: ${asString(input.workSurfaceBaseToken) ?? DEFAULT_FEISHU_WORK_SURFACE_BASE_TOKEN}`,
    `  identity: ${input.workSurfaceIdentity ?? "bot"}`,
    "  table_binding:",
    `    projection: ${tableNames.projection}`,
    `    projects: ${tableNames.projects}`,
    "  field_binding:",
    "    projection:",
    `      project_id: ${projectionFields.project_id}`,
    `      project: ${projectionFields.project}`,
    `      surface_status: ${projectionFields.surface_status}`,
    `      headline: ${projectionFields.headline}`,
    `      summary: ${projectionFields.summary}`,
    `      updated_at: ${projectionFields.updated_at}`,
    `      trace_id: ${projectionFields.trace_id}`,
    `      run_id: ${projectionFields.run_id}`,
    `      queue_ref: ${projectionFields.queue_ref}`,
    `      artifact_label: ${projectionFields.artifact_label}`,
    `      artifact_target: ${projectionFields.artifact_target}`,
    `      signal_kind: ${projectionFields.signal_kind}`,
    `      action_name: ${projectionFields.action_name}`,
    `      workflow: ${projectionFields.workflow}`,
    `      artifact_kind: ${projectionFields.artifact_kind}`,
    "    projects:",
    `      project_id: ${projectsFields.project_id}`,
    `      project_name: ${projectsFields.project_name}`,
    `      source_path: ${projectsFields.source_path}`,
    `      objective: ${projectsFields.objective}`,
    `      cadence: ${projectsFields.cadence}`,
    `      archived: ${projectsFields.archived}`,
    `  relation_write_mode: ${input.workSurfaceRelationWriteMode ?? "record_id_array"}`,
  ];

  const governanceTarget = input.governanceTarget;
  if (governanceTarget && Object.values(governanceTarget).some((value) => value !== undefined && value !== null)) {
    lines.push(
      "governance:",
      "  default_target:",
      `    channel_type: ${governanceTarget.channel_type ?? DEFAULT_GOVERNANCE_CHANNEL_TYPE}`,
      `    target_kind: ${governanceTarget.target_kind ?? DEFAULT_GOVERNANCE_TARGET_KIND}`,
      `    target_ref: ${governanceTarget.target_ref ?? DEFAULT_GOVERNANCE_TARGET_REF}`,
      `    delivery_mode: ${governanceTarget.delivery_mode ?? DEFAULT_GOVERNANCE_DELIVERY_MODE}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function writeFeishuAdapterConfigFile(input: {
  dataDir: string;
  configPath?: string | null;
  force?: boolean;
  template?: FeishuAdapterConfigTemplateInput;
}): Promise<string> {
  const configPath =
    asString(input.configPath) ??
    resolveDefaultFeishuConfigPathForDataDir(input.dataDir);
  if (!configPath) {
    throw new Error("missing-feishu-config-write-path");
  }

  if (!input.force) {
    try {
      await readFile(configPath, "utf8");
      throw new Error(`feishu-config-exists:${configPath}`);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        // continue
      } else if (error instanceof Error && error.message.startsWith("feishu-config-exists:")) {
        throw error;
      } else if (error) {
        throw error;
      }
    }
  }

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, renderFeishuAdapterConfigYaml(input.template), "utf8");
  return configPath;
}
