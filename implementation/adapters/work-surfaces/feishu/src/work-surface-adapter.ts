import type { WorkSurfaceProjectionSnapshot } from "../../../../core/src/types.ts";
import {
  DEFAULT_FEISHU_PROJECTS_FIELD_NAMES,
  DEFAULT_FEISHU_WORK_SURFACE_PROJECTION_FIELD_NAMES,
  DEFAULT_FEISHU_WORK_SURFACE_TABLE_NAMES,
  type FeishuProjectsFieldMap,
  type FeishuWorkSurfaceProjectionFieldMap,
  type FeishuWorkSurfaceTableNames,
} from "../../../feishu/src/config-host.ts";

import {
  createLarkCliBaseClient,
  type LarkCliBaseClientOptions,
  type LarkCliField,
  type LarkCliRecord,
  type LarkCliTable,
} from "./lark-cli-base.ts";

export interface FeishuWorkSurfaceAdapterConfig
  extends Pick<LarkCliBaseClientOptions, "baseToken" | "identity" | "cliBin" | "cwd" | "env"> {
  runner?: LarkCliBaseClientOptions["runner"];
  tableNames?: Partial<FeishuWorkSurfaceTableNames>;
  fieldNames?: {
    projection?: Partial<FeishuWorkSurfaceProjectionFieldMap>;
    projects?: Partial<FeishuProjectsFieldMap>;
  };
  relationWriteMode?: "record_id_array" | "record_ref_array";
}

export interface FeishuWorkSurfaceMetadata {
  projectionTable: LarkCliTable;
  projectsTable: LarkCliTable;
  projectionFields: Record<string, LarkCliField>;
  projectsFields: Record<string, LarkCliField>;
}

export interface FeishuProjectLookupResult {
  record_id: string;
  project_id: string;
  raw: LarkCliRecord;
}

export interface FeishuProjectionLookupResult {
  record_id: string;
  project_id: string;
  raw: LarkCliRecord;
}

export interface FeishuWorkSurfaceUpsertResult {
  operation: "created" | "updated";
  record_id: string | null;
  project_record_id: string;
  projection_record_id: string | null;
  fields: Record<string, unknown>;
}

export interface FeishuWorkSurfaceUpsertPlan {
  operation: "created" | "updated";
  project_id: string;
  project_record_id: string;
  projection_record_id: string | null;
  fields: Record<string, unknown>;
}

const REQUIRED_PROJECTION_FIELDS: Array<keyof FeishuWorkSurfaceProjectionFieldMap> = [
  "project_id",
  "project",
  "surface_status",
  "headline",
  "summary",
  "updated_at",
];

const OPTIONAL_PROJECTION_FIELDS: Array<keyof FeishuWorkSurfaceProjectionFieldMap> = [
  "trace_id",
  "run_id",
  "queue_ref",
  "artifact_label",
  "artifact_target",
  "signal_kind",
  "action_name",
  "workflow",
  "artifact_kind",
];

function toFeishuDatetime(value: string): number {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    throw new Error(`invalid-updated-at:${value}`);
  }
  return time;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeTextValue(value: string | null): string {
  return value ?? "";
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

function serializeRelationRecordIds(
  recordIds: string[],
  mode: FeishuWorkSurfaceAdapterConfig["relationWriteMode"],
): unknown[] {
  if (mode === "record_ref_array") {
    return recordIds.map((recordId) => ({ record_id: recordId }));
  }
  return recordIds;
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
    const nested = data as Record<string, unknown>;
    if (typeof nested.record_id === "string") {
      return nested.record_id;
    }

    const nestedRecordIdList = nested.record_id_list;
    if (Array.isArray(nestedRecordIdList) && typeof nestedRecordIdList[0] === "string") {
      return nestedRecordIdList[0];
    }

    const nestedRecord = nested.record;
    if (
      nestedRecord &&
      typeof nestedRecord === "object" &&
      typeof (nestedRecord as { record_id?: unknown }).record_id === "string"
    ) {
      return (nestedRecord as { record_id: string }).record_id;
    }

    if (nestedRecord && typeof nestedRecord === "object") {
      const nestedRecordPayload = nestedRecord as Record<string, unknown>;
      const nestedRecordIds = nestedRecordPayload.record_id_list;
      if (Array.isArray(nestedRecordIds) && typeof nestedRecordIds[0] === "string") {
        return nestedRecordIds[0];
      }
    }
  }

  return null;
}

export function createFeishuWorkSurfaceAdapter(config: FeishuWorkSurfaceAdapterConfig) {
  const tableNames = {
    ...DEFAULT_FEISHU_WORK_SURFACE_TABLE_NAMES,
    ...(config.tableNames ?? {}),
  };
  const projectionFieldNames: FeishuWorkSurfaceProjectionFieldMap = {
    ...DEFAULT_FEISHU_WORK_SURFACE_PROJECTION_FIELD_NAMES,
    ...(config.fieldNames?.projection ?? {}),
  };
  const projectsFieldNames: FeishuProjectsFieldMap = {
    ...DEFAULT_FEISHU_PROJECTS_FIELD_NAMES,
    ...(config.fieldNames?.projects ?? {}),
  };

  const client = createLarkCliBaseClient({
    baseToken: config.baseToken,
    identity: config.identity,
    cliBin: config.cliBin,
    cwd: config.cwd,
    env: config.env,
    runner: config.runner,
  });

  let metadataPromise: Promise<FeishuWorkSurfaceMetadata> | null = null;

  async function inspectMetadata(): Promise<FeishuWorkSurfaceMetadata> {
    if (!metadataPromise) {
      metadataPromise = (async () => {
        const tables = await client.listTables();
        const projectionTable = findTable(tables, tableNames.projection);
        const projectsTable = findTable(tables, tableNames.projects);

        if (!projectionTable) {
          throw new Error(`missing-feishu-table:projection:${tableNames.projection}`);
        }
        if (!projectsTable) {
          throw new Error(`missing-feishu-table:projects:${tableNames.projects}`);
        }

        const [projectionFields, projectsFields] = await Promise.all([
          client.listFields(projectionTable.table_id),
          client.listFields(projectsTable.table_id),
        ]);

        const projectionFieldsByName = indexFieldsByName(projectionFields);
        const projectsFieldsByName = indexFieldsByName(projectsFields);

        requireFields(
          projectionFieldsByName,
          REQUIRED_PROJECTION_FIELDS.map((key) => projectionFieldNames[key]),
          "projection",
        );
        requireFields(
          projectsFieldsByName,
          [projectsFieldNames.project_id],
          "projects",
        );

        return {
          projectionTable,
          projectsTable,
          projectionFields: projectionFieldsByName,
          projectsFields: projectsFieldsByName,
        };
      })();
    }

    return metadataPromise;
  }

  async function findProjectRecord(projectId: string): Promise<FeishuProjectLookupResult | null> {
    const metadata = await inspectMetadata();
    const records = await client.listRecords(metadata.projectsTable.table_id);
    const fieldName = projectsFieldNames.project_id;
    const match =
      records.find((record) => asString(getRecordFieldValue(record, fieldName)) === projectId) ?? null;

    if (!match) {
      return null;
    }

    return {
      record_id: match.record_id,
      project_id: projectId,
      raw: match,
    };
  }

  async function findProjectionRecord(
    projectId: string,
  ): Promise<FeishuProjectionLookupResult | null> {
    const metadata = await inspectMetadata();
    const records = await client.listRecords(metadata.projectionTable.table_id);
    const fieldName = projectionFieldNames.project_id;
    const match =
      records.find((record) => asString(getRecordFieldValue(record, fieldName)) === projectId) ?? null;

    if (!match) {
      return null;
    }

    return {
      record_id: match.record_id,
      project_id: projectId,
      raw: match,
    };
  }

  async function buildProjectionFields(input: {
    snapshot: WorkSurfaceProjectionSnapshot;
    projectRecordId: string;
  }): Promise<Record<string, unknown>> {
    const metadata = await inspectMetadata();
    const fields: Record<string, unknown> = {
      [projectionFieldNames.project_id]: input.snapshot.project_id,
      [projectionFieldNames.project]: serializeRelationRecordIds(
        [input.projectRecordId],
        config.relationWriteMode ?? "record_id_array",
      ),
      [projectionFieldNames.surface_status]: input.snapshot.surface_status,
      [projectionFieldNames.headline]: input.snapshot.headline,
      [projectionFieldNames.summary]: normalizeTextValue(input.snapshot.summary),
      [projectionFieldNames.updated_at]: toFeishuDatetime(input.snapshot.updated_at),
    };

    const optionalValues: Partial<Record<keyof FeishuWorkSurfaceProjectionFieldMap, unknown>> = {
      trace_id: normalizeTextValue(input.snapshot.trace_id),
      run_id: normalizeTextValue(input.snapshot.run_id),
      queue_ref: normalizeTextValue(input.snapshot.queue_ref),
      artifact_label: normalizeTextValue(input.snapshot.artifact_ref?.label ?? null),
      artifact_target: normalizeTextValue(input.snapshot.artifact_ref?.target ?? null),
      signal_kind: input.snapshot.signal_kind,
      action_name: normalizeTextValue(input.snapshot.action_name),
      workflow: normalizeTextValue(input.snapshot.workflow),
      artifact_kind: normalizeTextValue(input.snapshot.artifact_ref?.kind ?? null),
    };

    for (const key of OPTIONAL_PROJECTION_FIELDS) {
      const fieldName = projectionFieldNames[key];
      if (!(fieldName in metadata.projectionFields)) {
        continue;
      }
      fields[fieldName] = optionalValues[key] ?? "";
    }

    return fields;
  }

  async function planSnapshotUpsert(
    snapshot: WorkSurfaceProjectionSnapshot,
  ): Promise<FeishuWorkSurfaceUpsertPlan> {
    await inspectMetadata();
    const projectRecord = await findProjectRecord(snapshot.project_id);
    if (!projectRecord) {
      throw new Error(`missing-project-record:${snapshot.project_id}`);
    }

    const existingProjection = await findProjectionRecord(snapshot.project_id);
    const fields = await buildProjectionFields({
      snapshot,
      projectRecordId: projectRecord.record_id,
    });

    return {
      operation: existingProjection ? "updated" : "created",
      project_id: snapshot.project_id,
      project_record_id: projectRecord.record_id,
      projection_record_id: existingProjection?.record_id ?? null,
      fields,
    };
  }

  return {
    inspectMetadata,
    findProjectRecord,
    findProjectionRecord,
    buildProjectionFields,
    planSnapshotUpsert,
    async upsertSnapshot(
      snapshot: WorkSurfaceProjectionSnapshot,
    ): Promise<FeishuWorkSurfaceUpsertResult> {
      const metadata = await inspectMetadata();
      const plan = await planSnapshotUpsert(snapshot);

      const raw = await client.upsertRecord({
        tableIdOrName: metadata.projectionTable.table_id,
        recordId: plan.projection_record_id,
        fields: plan.fields,
      });

      return {
        operation: plan.operation,
        record_id: extractRecordIdFromUpsertPayload(raw) ?? plan.projection_record_id ?? null,
        project_record_id: plan.project_record_id,
        projection_record_id: plan.projection_record_id,
        fields: plan.fields,
      };
    },
  };
}
