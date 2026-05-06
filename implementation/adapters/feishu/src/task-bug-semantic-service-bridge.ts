import type {
  InternalServiceRequest,
  ServiceBinding,
  ServiceBridgeAdapter,
  ServiceResult,
  WorkSurfaceOrigin,
} from "../../../core/src/types.ts";
import {
  createExecutionEnvelope,
  extractWorkSurfaceOperations,
  type ExecutionEnvelope,
  type WorkSurfaceOperation,
} from "../../../harness/src/index.ts";
import {
  createLarkCliBaseClient,
  type LarkCliBaseClientOptions,
  type LarkCliField,
  type LarkCliRecord,
  type LarkCliTable,
} from "../../work-surfaces/feishu/src/lark-cli-base.ts";

export type FeishuTaskBugSemanticKind = "task" | "bug";

export interface FeishuTaskBugSemanticTableNames {
  tasks: string;
  bugs: string;
}

export interface FeishuSemanticTaskFieldMap {
  title: string;
  dod: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  assignee: string;
  project: string;
  acceptance_mode: string;
  completion_notify_mode: string;
  next_action: string;
}

export interface FeishuSemanticBugFieldMap {
  description: string;
  reproduction: string;
  expected: string;
  actual: string;
  status: string;
  priority: string;
  assignee: string;
  verifier: string;
  project: string;
  acceptance_mode: string;
  completion_notify_mode: string;
  next_action: string;
}

export interface FeishuTaskBugSemanticTarget {
  kind: FeishuTaskBugSemanticKind;
  record_id: string;
}

export interface FeishuTaskBugExecutionContext {
  kind: FeishuTaskBugSemanticKind;
  record_id: string;
  status: string | null;
  headline: string | null;
  project: string | null;
  priority: string | null;
  assignee: string | null;
  acceptance_mode: string | null;
  completion_notify_mode: string | null;
  next_action: string | null;
  business_fields: Record<string, string | null>;
  adapter_facts?: Record<string, unknown>;
  work_surface_origin?: WorkSurfaceOrigin | null;
  raw_fields: Record<string, unknown>;
}

export interface FeishuWorkSurfaceRecordFact {
  kind: FeishuTaskBugSemanticKind;
  record_id: string;
  headline: string | null;
  status: string | null;
  project: string | null;
  project_relation_ids: string[];
  dependency_record_ids: string[];
  current_step: string | null;
  step_result: string | null;
  next_action: string | null;
  execution_summary: string | null;
}

export interface FeishuWorkSurfaceFieldFact {
  field_name: string;
  field_id: string | null;
  role?: string;
  type: unknown;
  options?: string[];
}

export interface FeishuWorkSurfaceTableManifest {
  kind: FeishuTaskBugSemanticKind;
  table_id: string;
  table_name: string;
  aliases: string[];
  field_roles: Record<string, string>;
}

export interface FeishuWorkSurfaceNavigationManifest {
  source: FeishuWorkSurfaceRecordFact;
  tables: FeishuWorkSurfaceTableManifest[];
  source_table_schema: {
    table_id: string;
    table_name: string;
    fields: FeishuWorkSurfaceFieldFact[];
  };
  query_recipes: string[];
}

export interface FeishuTaskBugSemanticExecutorInput {
  binding: ServiceBinding;
  request: InternalServiceRequest;
  contexts: FeishuTaskBugExecutionContext[];
  execution_envelope: ExecutionEnvelope;
}

export type FeishuTaskBugSemanticExecutor = (
  input: FeishuTaskBugSemanticExecutorInput,
) => Promise<ServiceResult>;

export interface FeishuTaskBugSemanticClientConfig {
  baseToken: string;
  identity?: LarkCliBaseClientOptions["identity"];
}

export interface FeishuTaskBugSemanticServiceBridgeConfig
  extends Pick<LarkCliBaseClientOptions, "cliBin" | "cwd" | "env" | "runner"> {
  baseToken?: string | null;
  identity?: LarkCliBaseClientOptions["identity"];
  resolveClientConfig?: () => Promise<FeishuTaskBugSemanticClientConfig>;
  tableNames?: Partial<FeishuTaskBugSemanticTableNames>;
  fieldNames?: {
    task?: Partial<FeishuSemanticTaskFieldMap>;
    bug?: Partial<FeishuSemanticBugFieldMap>;
  };
  configHostPath?: string | null;
  resolveProjectRoot?: (projectId: string) => string | null | Promise<string | null>;
  executor?: FeishuTaskBugSemanticExecutor;
}

const DEFAULT_TABLE_NAMES: FeishuTaskBugSemanticTableNames = {
  tasks: "Tasks",
  bugs: "Bugs",
};

const DEFAULT_TASK_FIELD_NAMES: FeishuSemanticTaskFieldMap = {
  title: "任务",
  dod: "DoD",
  description: "描述",
  status: "状态",
  priority: "优先级",
  due_date: "截止时间",
  assignee: "任务执行人",
  project: "所属项目",
  acceptance_mode: "ACR验收模式",
  completion_notify_mode: "ACR完成提醒",
  next_action: "next_action",
};

const DEFAULT_BUG_FIELD_NAMES: FeishuSemanticBugFieldMap = {
  description: "描述",
  reproduction: "复现方式",
  expected: "预期结果",
  actual: "实际结果",
  status: "状态",
  priority: "优先级",
  assignee: "Assignee",
  verifier: "验证人",
  project: "所属项目",
  acceptance_mode: "ACR验收模式",
  completion_notify_mode: "ACR完成提醒",
  next_action: "next_action",
};

const WORK_SURFACE_SUPPORT_FIELD_NAMES = {
  dependency: "依赖任务",
  current_step: "current_step",
  step_result: "step_result",
  execution_summary: "执行摘要",
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeTextValue(item))
      .filter((item) => item.length > 0)
      .join(", ");
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return "";
  }

  for (const key of [
    "text",
    "name",
    "title",
    "value",
    "display_name",
    "email",
    "id",
    "record_id",
  ]) {
    const text = normalizeTextValue(objectValue[key]);
    if (text) {
      return text;
    }
  }

  return "";
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = normalizeTextValue(value);
    if (text) {
      return text;
    }
  }
  return null;
}

function getField(
  fields: Record<string, unknown>,
  fieldName: string,
): string | null {
  return pickString(fields[fieldName]);
}

function collectRecordIds(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.flatMap((item) => collectRecordIds(item))),
    );
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return [];
  }

  const candidates = [
    objectValue.id,
    objectValue.record_id,
    objectValue.recordId,
    objectValue.value,
  ];

  return candidates
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function fieldOptions(field: LarkCliField | null): string[] | undefined {
  if (!field) {
    return undefined;
  }

  const directOptions = Array.isArray(field.options) ? field.options : null;
  const propertyOptions = Array.isArray(field.property?.options)
    ? field.property.options
    : null;
  const options = directOptions ?? propertyOptions;
  if (!options) {
    return undefined;
  }

  const names = options
    .map((option) => pickString(asObject(option)?.name, asObject(option)?.text, option))
    .filter((option): option is string => !!option);

  return names.length > 0 ? names : undefined;
}

function valuesMatch(actual: unknown, expected: unknown): boolean {
  return normalizeTextValue(actual) === normalizeTextValue(expected);
}

function formatOperationTarget(operation: WorkSurfaceOperation): string {
  return [
    operation.source_system,
    operation.table_id ?? operation.table_name ?? "unknown-table",
    operation.record_id,
  ].join(":");
}

function unsupportedSideEffectResult(input: {
  result: ServiceResult;
  reason: string;
  errors: string[];
}): ServiceResult {
  return {
    ...input.result,
    status: "needs_escalation",
    result_kind: "needs_escalation",
    work_surface_action: "blocked",
    summary: `Semantic complete boundary side effects failed: ${input.errors.join("; ")}`,
    reply_payload: null,
    needs_escalation: true,
    escalation_reason: input.reason,
    trace_patch: {
      ...(input.result.trace_patch ?? {}),
      side_effect_contract: "failed",
      side_effect_errors: input.errors,
    },
  };
}

async function createSemanticLarkCliClient(
  config: FeishuTaskBugSemanticServiceBridgeConfig,
) {
  const clientConfig = await resolveClientConfig(config);
  return createLarkCliBaseClient({
    baseToken: clientConfig.baseToken,
    identity: clientConfig.identity,
    cliBin: config.cliBin,
    cwd: config.cwd,
    env: config.env,
    runner: config.runner,
  });
}

async function applyAndVerifyWorkSurfaceOperations(input: {
  config: FeishuTaskBugSemanticServiceBridgeConfig;
  operations: WorkSurfaceOperation[];
}): Promise<{ ok: true; applied: Array<Record<string, unknown>> } | { ok: false; errors: string[] }> {
  const client = await createSemanticLarkCliClient(input.config);
  const errors: string[] = [];
  const applied: Array<Record<string, unknown>> = [];

  for (const operation of input.operations) {
    if (operation.source_system !== "feishu_base") {
      errors.push(
        `unsupported-source:${formatOperationTarget(operation)}`,
      );
      continue;
    }

    const tableIdOrName = operation.table_id ?? operation.table_name;
    if (!tableIdOrName) {
      errors.push(`missing-table:${formatOperationTarget(operation)}`);
      continue;
    }

    const fields = await client.listFields(tableIdOrName);
    const fieldsByName = new Map(fields.map((field) => [field.field_name, field]));
    const operationErrors: string[] = [];

    for (const [fieldName, value] of Object.entries(operation.set_fields)) {
      const field = fieldsByName.get(fieldName);
      if (!field) {
        operationErrors.push(`missing-field:${formatOperationTarget(operation)}:${fieldName}`);
        continue;
      }
      const options = fieldOptions(field);
      const normalizedValue = normalizeTextValue(value);
      if (options && options.length > 0 && normalizedValue && !options.includes(normalizedValue)) {
        operationErrors.push(
          `missing-option:${formatOperationTarget(operation)}:${fieldName}=${normalizedValue}`,
        );
      }
    }

    if (operationErrors.length > 0) {
      errors.push(...operationErrors);
      continue;
    }

    await client.upsertRecord({
      tableIdOrName,
      recordId: operation.record_id,
      fields: operation.set_fields,
    });

    const updatedRecord = await client.getRecord(tableIdOrName, operation.record_id);
    if (!updatedRecord) {
      errors.push(`postcondition-record-missing:${formatOperationTarget(operation)}`);
      continue;
    }

    for (const [fieldName, expectedValue] of Object.entries(operation.verify_fields)) {
      if (!valuesMatch(updatedRecord.fields[fieldName], expectedValue)) {
        errors.push(
          `postcondition-mismatch:${formatOperationTarget(operation)}:${fieldName}`,
        );
      }
    }

    applied.push({
      source_system: operation.source_system,
      table_id: operation.table_id,
      table_name: operation.table_name,
      record_id: operation.record_id,
      set_fields: operation.set_fields,
      verify_fields: operation.verify_fields,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, applied };
}

async function applySideEffectsIfNeeded(input: {
  request: InternalServiceRequest;
  result: ServiceResult;
  config: FeishuTaskBugSemanticServiceBridgeConfig;
}): Promise<ServiceResult> {
  if (
    input.request.action_name !== "complete" ||
    input.result.status !== "ok" ||
    input.result.work_surface_action !== "complete"
  ) {
    return input.result;
  }

  const operations = extractWorkSurfaceOperations(input.request.parameters);
  if (operations.length === 0) {
    return input.result;
  }

  const applied = await applyAndVerifyWorkSurfaceOperations({
    config: input.config,
    operations,
  });

  if (!applied.ok) {
    return unsupportedSideEffectResult({
      result: input.result,
      reason: "semantic_side_effect_verification_failed",
      errors: applied.errors,
    });
  }

  return {
    ...input.result,
    trace_patch: {
      ...(input.result.trace_patch ?? {}),
      side_effect_contract: "applied_and_verified",
      side_effect_operations: applied.applied,
    },
  };
}

function findFieldByName(fields: LarkCliField[], fieldName: string): LarkCliField | null {
  return fields.find((field) => field.field_name === fieldName) ?? null;
}

function compactFieldFact(
  fields: LarkCliField[],
  fieldName: string,
  role?: string,
): FeishuWorkSurfaceFieldFact | null {
  const field = findFieldByName(fields, fieldName);
  if (!field) {
    return null;
  }

  const fact: FeishuWorkSurfaceFieldFact = {
    field_name: field.field_name,
    field_id: field.field_id ?? null,
    ...(role ? { role } : {}),
    type: field.type ?? null,
  };
  const options = fieldOptions(field);
  if (options) {
    fact.options = options;
  }
  return fact;
}

function findTable(tables: LarkCliTable[], target: string): LarkCliTable | null {
  return tables.find((table) => table.table_id === target || table.name === target) ?? null;
}

export function resolveFeishuTaskBugSemanticTargets(
  parameters: Record<string, unknown> | null,
): FeishuTaskBugSemanticTarget[] {
  if (!parameters) {
    return [];
  }

  const taskRecordId = pickString(parameters.task_record_id, parameters.taskRecordId);
  const bugRecordId = pickString(parameters.bug_record_id, parameters.bugRecordId);
  const targets: FeishuTaskBugSemanticTarget[] = [];

  if (taskRecordId) {
    targets.push({ kind: "task", record_id: taskRecordId });
  }
  if (bugRecordId) {
    targets.push({ kind: "bug", record_id: bugRecordId });
  }

  return targets;
}

function compactWorkSurfaceRecordFact(input: {
  kind: FeishuTaskBugSemanticKind;
  record: LarkCliRecord;
  headlineFieldNames: string[];
  statusFieldName: string;
  projectFieldName: string;
  nextActionFieldName: string;
}): FeishuWorkSurfaceRecordFact {
  const fields = input.record.fields ?? {};
  const headline = pickString(
    ...input.headlineFieldNames.map((fieldName) => fields[fieldName]),
  );

  return {
    kind: input.kind,
    record_id: input.record.record_id,
    headline,
    status: getField(fields, input.statusFieldName),
    project: getField(fields, input.projectFieldName),
    project_relation_ids: collectRecordIds(fields[input.projectFieldName]),
    dependency_record_ids: collectRecordIds(
      fields[WORK_SURFACE_SUPPORT_FIELD_NAMES.dependency],
    ),
    current_step: getField(fields, WORK_SURFACE_SUPPORT_FIELD_NAMES.current_step),
    step_result: getField(fields, WORK_SURFACE_SUPPORT_FIELD_NAMES.step_result),
    next_action: getField(fields, input.nextActionFieldName),
    execution_summary: getField(
      fields,
      WORK_SURFACE_SUPPORT_FIELD_NAMES.execution_summary,
    ),
  };
}

function buildTableManifest(input: {
  kind: FeishuTaskBugSemanticKind;
  table: LarkCliTable;
  fieldRoles: Record<string, string>;
}): FeishuWorkSurfaceTableManifest {
  return {
    kind: input.kind,
    table_id: input.table.table_id,
    table_name: input.table.name,
    aliases:
      input.kind === "task"
        ? ["task", "tasks", "todo", "doing", "pending"]
        : ["bug", "bugs", "issue", "issues", "fixing"],
    field_roles: input.fieldRoles,
  };
}

function buildWorkSurfaceNavigationManifest(input: {
  kind: FeishuTaskBugSemanticKind;
  sourceRecord: LarkCliRecord;
  fields: LarkCliField[];
  table: LarkCliTable;
  tasksTable: LarkCliTable;
  bugsTable: LarkCliTable;
  taskFieldNames: FeishuSemanticTaskFieldMap;
  bugFieldNames: FeishuSemanticBugFieldMap;
  headlineFieldNames: string[];
  statusFieldName: string;
  projectFieldName: string;
  priorityFieldName: string;
  nextActionFieldName: string;
}): FeishuWorkSurfaceNavigationManifest {
  const source = compactWorkSurfaceRecordFact({
    kind: input.kind,
    record: input.sourceRecord,
    headlineFieldNames: input.headlineFieldNames,
    statusFieldName: input.statusFieldName,
    projectFieldName: input.projectFieldName,
    nextActionFieldName: input.nextActionFieldName,
  });

  const fieldRoles = [
    ["title", input.headlineFieldNames[0]],
    ["status", input.statusFieldName],
    ["project", input.projectFieldName],
    ["priority", input.priorityFieldName],
    ["next_action", input.nextActionFieldName],
    ["dependency", WORK_SURFACE_SUPPORT_FIELD_NAMES.dependency],
    ["current_step", WORK_SURFACE_SUPPORT_FIELD_NAMES.current_step],
    ["step_result", WORK_SURFACE_SUPPORT_FIELD_NAMES.step_result],
    ["execution_summary", WORK_SURFACE_SUPPORT_FIELD_NAMES.execution_summary],
  ].filter((entry): entry is [string, string] => !!entry[1]);
  const fields = fieldRoles
    .map(([role, fieldName]) => compactFieldFact(input.fields, fieldName, role))
    .filter((field): field is FeishuWorkSurfaceFieldFact => field !== null);

  return {
    source,
    tables: [
      buildTableManifest({
        kind: "task",
        table: input.tasksTable,
        fieldRoles: {
          title: input.taskFieldNames.title,
          status: input.taskFieldNames.status,
          project: input.taskFieldNames.project,
          assignee: input.taskFieldNames.assignee,
          acceptance_mode: input.taskFieldNames.acceptance_mode,
          completion_notify_mode: input.taskFieldNames.completion_notify_mode,
          next_action: input.taskFieldNames.next_action,
        },
      }),
      buildTableManifest({
        kind: "bug",
        table: input.bugsTable,
        fieldRoles: {
          title: input.bugFieldNames.description,
          status: input.bugFieldNames.status,
          project: input.bugFieldNames.project,
          assignee: input.bugFieldNames.assignee,
          verifier: input.bugFieldNames.verifier,
          acceptance_mode: input.bugFieldNames.acceptance_mode,
          completion_notify_mode: input.bugFieldNames.completion_notify_mode,
          next_action: input.bugFieldNames.next_action,
        },
      }),
    ],
    source_table_schema: {
      table_id: input.table.table_id,
      table_name: input.table.name,
      fields,
    },
    query_recipes: [
      "Treat board labels such as Todo/Pending/Doing/Reviewing as status field values or views, not table names.",
      "When a request references other work items by title/status, choose the table from the surface table catalog, then query records with selected fields only.",
      "Filter by the source project relation when project_relation_ids are available.",
      "For writes, first confirm the target status value exists in the live source_table_schema or by reading the target table field schema.",
      "If missing_context is emitted, include evidence listing the table, fields, and filters that were queried.",
    ],
  };
}

function buildTaskContext(
  record: LarkCliRecord,
  fieldNames: FeishuSemanticTaskFieldMap,
  origin: WorkSurfaceOrigin,
  adapterFacts?: Record<string, unknown>,
): FeishuTaskBugExecutionContext {
  const fields = record.fields ?? {};
  const businessFields = {
    title: getField(fields, fieldNames.title),
    dod: getField(fields, fieldNames.dod),
    description: getField(fields, fieldNames.description),
    due_date: getField(fields, fieldNames.due_date),
  };

  return {
    kind: "task",
    record_id: record.record_id,
    status: getField(fields, fieldNames.status),
    headline: pickString(businessFields.title, businessFields.description),
    project: getField(fields, fieldNames.project),
    priority: getField(fields, fieldNames.priority),
    assignee: getField(fields, fieldNames.assignee),
    acceptance_mode: getField(fields, fieldNames.acceptance_mode),
    completion_notify_mode: getField(fields, fieldNames.completion_notify_mode),
    next_action: getField(fields, fieldNames.next_action),
    business_fields: businessFields,
    adapter_facts: adapterFacts,
    work_surface_origin: origin,
    raw_fields: fields,
  };
}

function buildBugContext(
  record: LarkCliRecord,
  fieldNames: FeishuSemanticBugFieldMap,
  origin: WorkSurfaceOrigin,
  adapterFacts?: Record<string, unknown>,
): FeishuTaskBugExecutionContext {
  const fields = record.fields ?? {};
  const businessFields = {
    description: getField(fields, fieldNames.description),
    reproduction: getField(fields, fieldNames.reproduction),
    expected: getField(fields, fieldNames.expected),
    actual: getField(fields, fieldNames.actual),
    verifier: getField(fields, fieldNames.verifier),
  };

  return {
    kind: "bug",
    record_id: record.record_id,
    status: getField(fields, fieldNames.status),
    headline: pickString(businessFields.description, businessFields.reproduction),
    project: getField(fields, fieldNames.project),
    priority: getField(fields, fieldNames.priority),
    assignee: getField(fields, fieldNames.assignee),
    acceptance_mode: getField(fields, fieldNames.acceptance_mode),
    completion_notify_mode: getField(fields, fieldNames.completion_notify_mode),
    next_action: getField(fields, fieldNames.next_action),
    business_fields: businessFields,
    adapter_facts: adapterFacts,
    work_surface_origin: origin,
    raw_fields: fields,
  };
}

function buildWorkSurfaceOrigin(input: {
  table: LarkCliTable;
  recordId: string;
  identity?: LarkCliBaseClientOptions["identity"];
  configHostPath?: string | null;
}): WorkSurfaceOrigin {
  return {
    source_system: "feishu_base",
    surface_kind: "project_management",
    adapter: "feishu_task_bug_semantic",
    identity: input.identity ?? "bot",
    config_path: input.configHostPath ?? null,
    base_ref: input.configHostPath ? "feishu_adapter_config" : "configured_base",
    table_id: input.table.table_id,
    table_name: input.table.name,
    record_id: input.recordId,
  };
}

async function resolveClientConfig(
  config: FeishuTaskBugSemanticServiceBridgeConfig,
): Promise<FeishuTaskBugSemanticClientConfig> {
  if (typeof config.baseToken === "string" && config.baseToken.trim()) {
    return {
      baseToken: config.baseToken,
      identity: config.identity,
    };
  }

  const resolved = await config.resolveClientConfig?.();
  if (typeof resolved?.baseToken === "string" && resolved.baseToken.trim()) {
    return resolved;
  }

  throw new Error("missing-feishu-task-bug-semantic-client-config");
}

export async function loadFeishuTaskBugExecutionContexts(input: {
  request: InternalServiceRequest;
  config: FeishuTaskBugSemanticServiceBridgeConfig;
}): Promise<FeishuTaskBugExecutionContext[]> {
  const targets = resolveFeishuTaskBugSemanticTargets(input.request.parameters);
  if (targets.length === 0) {
    return [];
  }

  const clientConfig = await resolveClientConfig(input.config);
  const tableNames = {
    ...DEFAULT_TABLE_NAMES,
    ...(input.config.tableNames ?? {}),
  };
  const taskFieldNames = {
    ...DEFAULT_TASK_FIELD_NAMES,
    ...(input.config.fieldNames?.task ?? {}),
  };
  const bugFieldNames = {
    ...DEFAULT_BUG_FIELD_NAMES,
    ...(input.config.fieldNames?.bug ?? {}),
  };
  const client = createLarkCliBaseClient({
    baseToken: clientConfig.baseToken,
    identity: clientConfig.identity,
    cliBin: input.config.cliBin,
    cwd: input.config.cwd,
    env: input.config.env,
    runner: input.config.runner,
  });
  const tables = await client.listTables();
  const tasksTable = findTable(tables, tableNames.tasks);
  const bugsTable = findTable(tables, tableNames.bugs);

  if (!tasksTable) {
    throw new Error(`missing-feishu-table:tasks:${tableNames.tasks}`);
  }
  if (!bugsTable) {
    throw new Error(`missing-feishu-table:bugs:${tableNames.bugs}`);
  }

  const contexts: FeishuTaskBugExecutionContext[] = [];

  for (const target of targets) {
    const table = target.kind === "task" ? tasksTable : bugsTable;
    const record = await client.getRecord(table.table_id, target.record_id);
    if (!record) {
      throw new Error(`missing-feishu-task-bug-record:${target.kind}:${target.record_id}`);
    }
    const fields = await client.listFields(table.table_id);
    const origin = buildWorkSurfaceOrigin({
      table,
      recordId: record.record_id,
      identity: clientConfig.identity,
      configHostPath: input.config.configHostPath,
    });
    const navigationManifest =
      target.kind === "task"
        ? buildWorkSurfaceNavigationManifest({
            kind: target.kind,
            sourceRecord: record,
            fields,
            table,
            tasksTable,
            bugsTable,
            taskFieldNames,
            bugFieldNames,
            headlineFieldNames: [
              taskFieldNames.title,
              taskFieldNames.description,
              taskFieldNames.dod,
            ],
            statusFieldName: taskFieldNames.status,
            projectFieldName: taskFieldNames.project,
            priorityFieldName: taskFieldNames.priority,
            nextActionFieldName: taskFieldNames.next_action,
          })
        : buildWorkSurfaceNavigationManifest({
            kind: target.kind,
            sourceRecord: record,
            fields,
            table,
            tasksTable,
            bugsTable,
            taskFieldNames,
            bugFieldNames,
            headlineFieldNames: [
              bugFieldNames.description,
              bugFieldNames.reproduction,
              bugFieldNames.actual,
            ],
            statusFieldName: bugFieldNames.status,
            projectFieldName: bugFieldNames.project,
            priorityFieldName: bugFieldNames.priority,
            nextActionFieldName: bugFieldNames.next_action,
          });
    const adapterFacts = {
      work_surface_navigation_manifest: navigationManifest,
    };
    contexts.push(
      target.kind === "task"
        ? buildTaskContext(record, taskFieldNames, origin, adapterFacts)
        : buildBugContext(record, bugFieldNames, origin, adapterFacts),
    );
  }

  return contexts;
}

function summarizeContext(context: FeishuTaskBugExecutionContext): Record<string, unknown> {
  const navigationManifest = asObject(
    context.adapter_facts?.work_surface_navigation_manifest,
  );
  const tables = Array.isArray(navigationManifest?.tables)
    ? navigationManifest.tables
    : [];
  const schema = asObject(navigationManifest?.source_table_schema);
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];

  return {
    kind: context.kind,
    record_id: context.record_id,
    status: context.status,
    headline: context.headline,
    project: context.project,
    priority: context.priority,
    assignee: context.assignee,
    work_surface_origin: context.work_surface_origin,
    work_surface_navigation_manifest: navigationManifest
      ? {
          table_count: tables.length,
          source_table: schema?.table_name ?? null,
          source_field_count: fields.length,
        }
      : null,
    business_fields_present: Object.fromEntries(
      Object.entries(context.business_fields).map(([key, value]) => [key, !!value]),
    ),
  };
}

function toExecutionWorkItem(context: FeishuTaskBugExecutionContext) {
  return {
    kind: context.kind,
    record_id: context.record_id,
    status: context.status,
    headline: context.headline,
    project: context.project,
    priority: context.priority,
    assignee: context.assignee,
    acceptance_mode: context.acceptance_mode,
    completion_notify_mode: context.completion_notify_mode,
    next_action: context.next_action,
    business_fields: context.business_fields,
    work_surface_origin: context.work_surface_origin ?? null,
  };
}

export function buildFeishuTaskBugExecutionEnvelope(input: {
  request: InternalServiceRequest;
  contexts: FeishuTaskBugExecutionContext[];
  projectRoot?: string | null;
}): ExecutionEnvelope {
  const navigationManifests = input.contexts
    .map((context) => context.adapter_facts?.work_surface_navigation_manifest)
    .filter((manifest): manifest is FeishuWorkSurfaceNavigationManifest => !!manifest);

  return createExecutionEnvelope({
    project_id: input.request.resolved_project_id,
    project_root: input.projectRoot ?? null,
    action_name: input.request.action_name,
    workflow: input.request.workflow,
    trace_id: input.request.trace_id,
    message_id: null,
    work_items: input.contexts.map(toExecutionWorkItem),
    adapter_facts: {
      source: "external work-surface semantic context",
      adapter: "feishu_task_bug_semantic",
      pending_semantic_execution: true,
      original_parameters: input.request.parameters ?? {},
      ...(navigationManifests.length === 1
        ? { work_surface_navigation_manifest: navigationManifests[0] }
        : {}),
      ...(navigationManifests.length > 1
        ? { work_surface_navigation_manifests: navigationManifests }
        : {}),
    },
    boundary_requirements: {
      allowed_actions: ["complete", "review", "blocked"],
      require_record_id: true,
      require_summary: true,
      require_evidence: true,
      bug_fix_result_values: ["Fixed", "Won't fix", "Can't rep"],
    },
  });
}

function missingTargetResult(projectId: string): ServiceResult {
  return {
    status: "needs_escalation",
    result_kind: "needs_escalation",
    work_surface_action: "blocked",
    summary: `Semantic execution bridge could not find a Task/Bug row anchor for ${projectId}`,
    reply_payload: null,
    needs_escalation: true,
    escalation_reason: "semantic_bridge_missing_row_anchor",
    trace_patch: {
      bridge_adapter: "feishu_task_bug_semantic",
      semantic_context_loaded: false,
      reason: "missing_row_anchor",
    },
  };
}

function contextLoadFailedResult(error: unknown): ServiceResult {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    status: "needs_escalation",
    result_kind: "needs_escalation",
    work_surface_action: "blocked",
    summary: `Semantic execution context load failed: ${reason}`,
    reply_payload: null,
    needs_escalation: true,
    escalation_reason: `semantic_context_load_failed:${reason}`,
    trace_patch: {
      bridge_adapter: "feishu_task_bug_semantic",
      semantic_context_loaded: false,
      reason,
    },
  };
}

function executorFailedResult(error: unknown): ServiceResult {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    status: "error",
    result_kind: "rejected",
    work_surface_action: "blocked",
    summary: `Semantic executor failed: ${reason}`,
    reply_payload: null,
    needs_escalation: false,
    escalation_reason: null,
    trace_patch: {
      bridge_adapter: "feishu_task_bug_semantic",
      semantic_context_loaded: true,
      executor_failed: true,
      reason,
    },
  };
}

async function defaultExecutor(
  input: FeishuTaskBugSemanticExecutorInput,
): Promise<ServiceResult> {
  return {
    status: "needs_escalation",
    result_kind: "needs_escalation",
    work_surface_action: "blocked",
    summary: `Semantic context loaded for ${input.request.resolved_project_id}, but no executor is configured`,
    reply_payload: null,
    needs_escalation: true,
    escalation_reason: "semantic_executor_not_configured",
    trace_patch: {
      executor: "not_configured",
    },
  };
}

function attachBridgeTrace(
  result: ServiceResult,
  contexts: FeishuTaskBugExecutionContext[],
): ServiceResult {
  return {
    ...result,
    trace_patch: {
      ...(result.trace_patch ?? {}),
      bridge_adapter: "feishu_task_bug_semantic",
      semantic_context_loaded: true,
      semantic_context_count: contexts.length,
      semantic_contexts: contexts.map(summarizeContext),
    },
  };
}

export function createFeishuTaskBugSemanticServiceBridgeAdapter(
  config: FeishuTaskBugSemanticServiceBridgeConfig,
): ServiceBridgeAdapter {
  return async ({ binding, request }) => {
    const targets = resolveFeishuTaskBugSemanticTargets(request.parameters);
    if (targets.length === 0) {
      return missingTargetResult(request.resolved_project_id);
    }

    let contexts: FeishuTaskBugExecutionContext[];
    try {
      contexts = await loadFeishuTaskBugExecutionContexts({ request, config });
    } catch (error) {
      return contextLoadFailedResult(error);
    }

    try {
      const executor = config.executor ?? defaultExecutor;
      const projectRoot =
        (await config.resolveProjectRoot?.(request.resolved_project_id)) ?? null;
      const executionEnvelope = buildFeishuTaskBugExecutionEnvelope({
        request,
        contexts,
        projectRoot,
      });
      const result = await executor({
        binding,
        request,
        contexts,
        execution_envelope: executionEnvelope,
      });
      const resultWithSideEffects = await applySideEffectsIfNeeded({
        request,
        result,
        config,
      });
      return attachBridgeTrace(resultWithSideEffects, contexts);
    } catch (error) {
      return attachBridgeTrace(executorFailedResult(error), contexts);
    }
  };
}
