import path from "node:path";
import process from "node:process";

import {
  DEFAULT_FEISHU_PROJECTS_FIELD_NAMES,
  DEFAULT_FEISHU_WORK_SURFACE_TABLE_NAMES,
  type FeishuIdentity,
  type FeishuProjectsFieldMap,
  resolveFeishuWorkSurfaceBinding,
} from "./config-host.ts";
import {
  createLarkCliBaseClient,
  type LarkCliBaseClientOptions,
  type LarkCliField,
  type LarkCliRecord,
  type LarkCliTable,
} from "../../work-surfaces/feishu/src/lark-cli-base.ts";
import { getProjectById, loadProjectDefinition } from "../../../core/src/projects/registry.ts";

export interface FeishuProjectCatalogAdapterConfig
  extends Pick<LarkCliBaseClientOptions, "baseToken" | "identity" | "cliBin" | "cwd" | "env"> {
  runner?: LarkCliBaseClientOptions["runner"];
  tableName?: string;
  fieldNames?: Partial<FeishuProjectsFieldMap>;
}

export interface FeishuProjectCatalogMetadata {
  projectsTable: LarkCliTable;
  projectsFields: Record<string, LarkCliField>;
}

export interface FeishuProjectCatalogLocalRecord {
  project_id: string;
  project_name: string;
  source_path: string;
  objective: string;
  cadence: string;
}

export interface FeishuProjectCatalogPlan {
  operation: "created" | "updated" | "noop";
  project_id: string;
  project_record_id: string | null;
  fields: Record<string, unknown>;
  skipped_fields: string[];
  local: FeishuProjectCatalogLocalRecord;
}

export interface FeishuProjectCatalogApplyResult {
  operation: "created" | "updated" | "noop";
  record_id: string | null;
  fields: Record<string, unknown>;
}

export interface FeishuProjectCatalogSyncOptions
  extends Pick<
    FeishuProjectCatalogAdapterConfig,
    "baseToken" | "identity" | "cliBin" | "cwd" | "env" | "runner" | "tableName" | "fieldNames"
  > {
  registryPath: string;
  projectId: string;
  dataDir?: string;
  apply?: boolean;
}

export interface FeishuProjectCatalogSyncResult {
  mode: "dry_run" | "apply";
  project_id: string;
  plan: FeishuProjectCatalogPlan;
  result?: FeishuProjectCatalogApplyResult;
}

const REQUIRED_PROJECT_FIELDS: Array<keyof FeishuProjectsFieldMap> = [
  "project_id",
  "project_name",
  "source_path",
  "objective",
  "cadence",
  "archived",
];

const DEFERRED_PROJECT_FIELDS = [
  "Owner",
  "类型",
  "状态",
  "复盘节奏",
  "工作方式",
  "项目截止时间",
];

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "";
    }
    if (typeof value[0] === "string") {
      return String(value[0]).trim();
    }
  }
  return "";
}

function indexFieldsByName(fields: LarkCliField[]): Record<string, LarkCliField> {
  return Object.fromEntries(
    fields
      .filter((field) => typeof field.field_name === "string" && field.field_name.trim() !== "")
      .map((field) => [field.field_name, field]),
  );
}

function findTable(tables: LarkCliTable[], target: string): LarkCliTable | null {
  return tables.find((table) => table.table_id === target || table.name === target) ?? null;
}

function requireFields(
  fieldsByName: Record<string, LarkCliField>,
  fieldNames: string[],
  context: string,
): void {
  const missing = fieldNames.filter((fieldName) => !(fieldName in fieldsByName));
  if (missing.length > 0) {
    throw new Error(`missing-feishu-fields:${context}:${missing.join(",")}`);
  }
}

function getRecordFieldValue(record: LarkCliRecord, fieldName: string): unknown {
  return record.fields?.[fieldName];
}

function extractRecordIdFromUpsertPayload(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.record_id === "string") {
    return payload.record_id;
  }

  const recordIdList = payload.record_id_list;
  if (Array.isArray(recordIdList) && typeof recordIdList[0] === "string") {
    return recordIdList[0];
  }

  const record = payload.record;
  if (record && typeof record === "object") {
    const recordPayload = record as Record<string, unknown>;
    if (typeof recordPayload.record_id === "string") {
      return recordPayload.record_id;
    }
    const nestedRecordIdList = recordPayload.record_id_list;
    if (Array.isArray(nestedRecordIdList) && typeof nestedRecordIdList[0] === "string") {
      return nestedRecordIdList[0];
    }
  }

  const data = payload.data;
  if (data && typeof data === "object") {
    const dataPayload = data as Record<string, unknown>;
    if (typeof dataPayload.record_id === "string") {
      return dataPayload.record_id;
    }
    const nestedRecordIdList = dataPayload.record_id_list;
    if (Array.isArray(nestedRecordIdList) && typeof nestedRecordIdList[0] === "string") {
      return nestedRecordIdList[0];
    }
  }

  return null;
}

function buildSourcePath(file: string): string {
  const trimmed = file.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/^\.?\//, "");
  return normalized.startsWith("projects/") ? normalized : `projects/${normalized}`;
}

async function buildLocalCatalogRecord(input: {
  registryPath: string;
  projectId: string;
}): Promise<FeishuProjectCatalogLocalRecord> {
  const entry = await getProjectById(input.registryPath, input.projectId);
  if (!entry) {
    throw new Error(`unknown-project-id:${input.projectId}`);
  }

  const definition = await loadProjectDefinition(entry);
  const definitionProjectId = asString(definition.project_id);
  if (!definitionProjectId) {
    throw new Error(`missing-project-catalog-definition-project-id:${entry.project_id}`);
  }
  if (definitionProjectId !== entry.project_id) {
    throw new Error(`project-catalog-project-id-mismatch:${entry.project_id}:${definitionProjectId}`);
  }

  const definitionTitle = asString(definition.title)?.trim();
  const definitionOwner = asString(definition.owner)?.trim();
  const definitionStatus = asString(definition.status)?.trim();
  const registryTitle = entry.title?.trim() ?? "";
  const registryOwner = entry.owner?.trim() ?? "";
  const registryStatus = entry.status?.trim() ?? "";

  if (definitionTitle && registryTitle && definitionTitle !== registryTitle) {
    throw new Error(`reconcile-required:project-title-drift:${entry.project_id}`);
  }
  if (definitionOwner && registryOwner && definitionOwner !== registryOwner) {
    throw new Error(`reconcile-required:project-owner-drift:${entry.project_id}`);
  }
  if (definitionStatus && registryStatus && definitionStatus !== registryStatus) {
    throw new Error(`reconcile-required:project-status-drift:${entry.project_id}`);
  }

  if (!entry.title?.trim()) {
    throw new Error(`missing-project-catalog-title:${entry.project_id}`);
  }
  if (!entry.file?.trim()) {
    throw new Error(`missing-project-catalog-file:${entry.project_id}`);
  }
  if (!entry.cadence?.trim()) {
    throw new Error(`missing-project-catalog-cadence:${entry.project_id}`);
  }

  const objective = asString(definition.objective)?.trim();
  if (!objective) {
    throw new Error(`missing-project-catalog-objective:${entry.project_id}`);
  }

  return {
    project_id: entry.project_id,
    project_name: entry.title.trim(),
    source_path: buildSourcePath(entry.file),
    objective,
    cadence: entry.cadence.trim(),
  };
}

export function createFeishuProjectCatalogAdapter(config: FeishuProjectCatalogAdapterConfig) {
  const tableName = config.tableName ?? DEFAULT_FEISHU_WORK_SURFACE_TABLE_NAMES.projects;
  const fieldNames: FeishuProjectsFieldMap = {
    ...DEFAULT_FEISHU_PROJECTS_FIELD_NAMES,
    ...(config.fieldNames ?? {}),
  };
  const client = createLarkCliBaseClient({
    baseToken: config.baseToken,
    identity: config.identity,
    cliBin: config.cliBin,
    cwd: config.cwd,
    env: config.env,
    runner: config.runner,
  });

  let metadataPromise: Promise<FeishuProjectCatalogMetadata> | null = null;

  async function inspectMetadata(): Promise<FeishuProjectCatalogMetadata> {
    if (!metadataPromise) {
      metadataPromise = (async () => {
        const tables = await client.listTables();
        const projectsTable = findTable(tables, tableName);
        if (!projectsTable) {
          throw new Error(`missing-feishu-table:projects:${tableName}`);
        }

        const projectsFields = await client.listFields(projectsTable.table_id);
        const projectsFieldsByName = indexFieldsByName(projectsFields);
        requireFields(
          projectsFieldsByName,
          REQUIRED_PROJECT_FIELDS.map((key) => fieldNames[key]),
          "projects",
        );

        return {
          projectsTable,
          projectsFields: projectsFieldsByName,
        };
      })();
    }

    return metadataPromise;
  }

  async function findProjectRow(projectId: string): Promise<LarkCliRecord | null> {
    const metadata = await inspectMetadata();
    const records = await client.listRecords(metadata.projectsTable.table_id, 1000);
    const matches = records.filter(
      (record) => normalizeTextValue(getRecordFieldValue(record, fieldNames.project_id)) === projectId,
    );

    if (matches.length > 1) {
      throw new Error(`reconcile-required:duplicate-project-record:${projectId}`);
    }

    return matches[0] ?? null;
  }

  async function planProjectSync(input: {
    registryPath: string;
    projectId: string;
  }): Promise<FeishuProjectCatalogPlan> {
    await inspectMetadata();
    const local = await buildLocalCatalogRecord(input);
    const existing = await findProjectRow(local.project_id);
    const fields: Record<string, unknown> = {
      [fieldNames.project_id]: local.project_id,
      [fieldNames.project_name]: local.project_name,
      [fieldNames.source_path]: local.source_path,
      [fieldNames.objective]: local.objective,
      [fieldNames.cadence]: local.cadence,
    };

    if (!existing) {
      fields[fieldNames.archived] = false;
      return {
        operation: "created",
        project_id: local.project_id,
        project_record_id: null,
        fields,
        skipped_fields: [...DEFERRED_PROJECT_FIELDS],
        local,
      };
    }

    const sameWritableFields =
      normalizeTextValue(getRecordFieldValue(existing, fieldNames.project_id)) === local.project_id &&
      normalizeTextValue(getRecordFieldValue(existing, fieldNames.project_name)) === local.project_name &&
      normalizeTextValue(getRecordFieldValue(existing, fieldNames.source_path)) === local.source_path &&
      normalizeTextValue(getRecordFieldValue(existing, fieldNames.objective)) === local.objective &&
      normalizeTextValue(getRecordFieldValue(existing, fieldNames.cadence)) === local.cadence;

    return {
      operation: sameWritableFields ? "noop" : "updated",
      project_id: local.project_id,
      project_record_id: existing.record_id,
      fields,
      skipped_fields: [...DEFERRED_PROJECT_FIELDS, fieldNames.archived],
      local,
    };
  }

  async function applyProjectSync(plan: FeishuProjectCatalogPlan): Promise<FeishuProjectCatalogApplyResult> {
    const metadata = await inspectMetadata();
    if (plan.operation === "noop") {
      return {
        operation: "noop",
        record_id: plan.project_record_id,
        fields: plan.fields,
      };
    }

    const result = await client.upsertRecord({
      tableIdOrName: metadata.projectsTable.table_id,
      recordId: plan.project_record_id,
      fields: plan.fields,
    });

    return {
      operation: plan.operation,
      record_id: extractRecordIdFromUpsertPayload(result) ?? plan.project_record_id,
      fields: plan.fields,
    };
  }

  return {
    inspectMetadata,
    planProjectSync,
    applyProjectSync,
  };
}

export async function resolveDefaultFeishuProjectCatalogSyncOptions(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string;
  baseToken?: string | null;
  identity?: FeishuIdentity;
} = {}): Promise<
  Pick<FeishuProjectCatalogAdapterConfig, "baseToken" | "identity" | "tableName" | "fieldNames">
> {
  const binding = await resolveFeishuWorkSurfaceBinding({
    configPath: input.configPath,
    env: input.env,
    dataDir: input.dataDir,
    baseToken: input.baseToken,
    identity: input.identity,
  });

  return {
    baseToken: binding.baseToken,
    identity: binding.identity,
    tableName: binding.tableNames.projects,
    fieldNames: binding.fieldNames.projects,
  };
}

export async function runFeishuProjectCatalogSync(
  options: FeishuProjectCatalogSyncOptions,
): Promise<FeishuProjectCatalogSyncResult> {
  const adapter = createFeishuProjectCatalogAdapter({
    baseToken: options.baseToken,
    identity: options.identity,
    cliBin: options.cliBin,
    cwd: options.cwd,
    env: options.env,
    runner: options.runner,
    tableName: options.tableName,
    fieldNames: options.fieldNames,
  });
  const plan = await adapter.planProjectSync({
    registryPath: options.registryPath,
    projectId: options.projectId,
  });

  if (!options.apply) {
    return {
      mode: "dry_run",
      project_id: options.projectId,
      plan,
    };
  }

  const result = await adapter.applyProjectSync(plan);
  return {
    mode: "apply",
    project_id: options.projectId,
    plan,
    result,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const projectIdIndex = argv.indexOf("--project-id");
  const projectId = projectIdIndex >= 0 ? argv[projectIdIndex + 1] : null;
  const registryPathIndex = argv.indexOf("--registry-path");
  const registryPath = registryPathIndex >= 0 ? argv[registryPathIndex + 1] : null;
  const apply = argv.includes("--apply");

  if (!projectId || !registryPath) {
    throw new Error("missing-required-flags:--project-id,--registry-path");
  }

  const binding = await resolveDefaultFeishuProjectCatalogSyncOptions();
  const result = await runFeishuProjectCatalogSync({
    projectId,
    registryPath,
    apply,
    ...binding,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
