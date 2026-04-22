import type {
  NormalizedEnvelope,
  RouterConfig,
  ServiceResult,
  TaskBugAcceptanceMode,
  TaskBugCompletionNotifyMode,
} from "../../../core/src/types.ts";
import {
  resolveFeishuWorkSurfaceBinding,
  type FeishuIdentity,
} from "./config-host.ts";
import {
  createLarkCliBaseClient,
  type LarkCliBaseClientOptions,
  type LarkCliField,
  type LarkCliRecord,
  type LarkCliTable,
} from "../../work-surfaces/feishu/src/lark-cli-base.ts";

export type FeishuTaskBugKind = "task" | "bug";

export interface FeishuTaskFieldMap {
  status: string;
  current_step: string;
  step_result: string;
  next_action: string;
  last_event_at: string;
  acceptance_mode: string;
  completion_notify_mode: string;
  started_at: string;
  execution_summary: string;
}

export interface FeishuBugFieldMap {
  status: string;
  current_step: string;
  step_result: string;
  next_action: string;
  last_event_at: string;
  acceptance_mode: string;
  completion_notify_mode: string;
  started_at: string;
  fix_result: string;
}

export interface FeishuTaskBugTableNames {
  tasks: string;
  bugs: string;
}

export interface FeishuTaskBugWritebackAdapterConfig
  extends Pick<LarkCliBaseClientOptions, "baseToken" | "identity" | "cliBin" | "cwd" | "env"> {
  runner?: LarkCliBaseClientOptions["runner"];
  tableNames?: Partial<FeishuTaskBugTableNames>;
  fieldNames?: {
    task?: Partial<FeishuTaskFieldMap>;
    bug?: Partial<FeishuBugFieldMap>;
  };
}

export interface ResolvedTaskBugPolicy {
  acceptance_mode: TaskBugAcceptanceMode;
  completion_notify_mode: TaskBugCompletionNotifyMode;
  acceptance_mode_source: "builtin_default" | "router_default" | "row_override";
  completion_notify_mode_source: "builtin_default" | "router_default" | "row_override";
  row_acceptance_mode: "inherit" | TaskBugAcceptanceMode;
  row_completion_notify_mode: "inherit" | TaskBugCompletionNotifyMode;
}

export interface FeishuTaskBugWritebackPlan {
  kind: FeishuTaskBugKind;
  record_id: string;
  operation: "updated" | "noop";
  reason: string;
  status_before: string | null;
  fields: Record<string, unknown>;
  policy: ResolvedTaskBugPolicy;
}

export interface FeishuTaskBugWritebackApplyResult {
  kind: FeishuTaskBugKind;
  record_id: string;
  operation: "updated" | "noop";
  applied_record_id: string | null;
  fields: Record<string, unknown>;
}

export interface FeishuTaskBugWritebackRunResult {
  mode: "dry_run" | "apply";
  plans: FeishuTaskBugWritebackPlan[];
  results?: FeishuTaskBugWritebackApplyResult[];
}

interface FeishuTaskBugMetadata {
  tasksTable: LarkCliTable;
  bugsTable: LarkCliTable;
  taskFields: Record<string, LarkCliField>;
  bugFields: Record<string, LarkCliField>;
}

interface FeishuTaskBugTarget {
  kind: FeishuTaskBugKind;
  record_id: string;
}

interface DerivedWritebackPatch {
  phase: "in_progress" | "review_boundary" | "resolution_boundary" | "error";
  status: string | null;
  current_step: string;
  step_result: string;
  next_action: string;
  summary: string | null;
  set_started_at_if_empty: boolean;
}

const BUILTIN_TASK_BUG_POLICY_DEFAULTS = {
  acceptance_mode: "manual_acceptance",
  completion_notify_mode: "no_dm_on_completion_boundary",
} satisfies {
  acceptance_mode: TaskBugAcceptanceMode;
  completion_notify_mode: TaskBugCompletionNotifyMode;
};

const DEFAULT_FEISHU_TASK_BUG_TABLE_NAMES: FeishuTaskBugTableNames = {
  tasks: "Tasks",
  bugs: "Bugs",
};

const DEFAULT_FEISHU_TASK_FIELD_NAMES: FeishuTaskFieldMap = {
  status: "状态",
  current_step: "current_step",
  step_result: "step_result",
  next_action: "next_action",
  last_event_at: "last_event_at",
  acceptance_mode: "ACR验收模式",
  completion_notify_mode: "ACR完成提醒",
  started_at: "ACR开始执行时间",
  execution_summary: "执行摘要",
};

const DEFAULT_FEISHU_BUG_FIELD_NAMES: FeishuBugFieldMap = {
  status: "状态",
  current_step: "current_step",
  step_result: "step_result",
  next_action: "next_action",
  last_event_at: "last_event_at",
  acceptance_mode: "ACR验收模式",
  completion_notify_mode: "ACR完成提醒",
  started_at: "ACR开始执行时间",
  fix_result: "修复结果",
};

const TASK_REQUIRED_FIELDS: Array<keyof FeishuTaskFieldMap> = [
  "status",
  "current_step",
  "step_result",
  "next_action",
  "last_event_at",
  "acceptance_mode",
  "completion_notify_mode",
  "started_at",
  "execution_summary",
];

const BUG_REQUIRED_FIELDS: Array<keyof FeishuBugFieldMap> = [
  "status",
  "current_step",
  "step_result",
  "next_action",
  "last_event_at",
  "acceptance_mode",
  "completion_notify_mode",
  "started_at",
  "fix_result",
];

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const picked = asString(value);
    if (picked) {
      return picked;
    }
  }
  return null;
}

function normalizeTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string") {
      return first.trim();
    }
    if (typeof first === "number" || typeof first === "boolean") {
      return String(first);
    }
  }
  return "";
}

function toFeishuDatetime(value: string): number {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    throw new Error(`invalid-feishu-task-bug-datetime:${value}`);
  }
  return time;
}

function truncateText(value: string | null, maxLength = 900): string | null {
  if (!value) {
    return null;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
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

function getSelectOptionNames(field: LarkCliField): Set<string> {
  const directOptions = Array.isArray(field.options) ? field.options : [];
  const property = asObject(field.property);
  const propertyOptions = Array.isArray(property?.options) ? property.options : [];
  const options = directOptions.length > 0 ? directOptions : propertyOptions;

  return new Set(
    options
      .map((option) => asObject(option))
      .map((option) => (typeof option?.name === "string" ? option.name.trim() : ""))
      .filter((name) => name !== ""),
  );
}

function validateSelectCoverage(input: {
  kind: FeishuTaskBugKind;
  fieldsByName: Record<string, LarkCliField>;
  nextFields: Record<string, unknown>;
}): void {
  const missing: string[] = [];

  for (const [fieldName, value] of Object.entries(input.nextFields)) {
    const field = input.fieldsByName[fieldName];
    if (!field) {
      continue;
    }

    const typeValue = typeof field.type === "string" ? field.type : null;
    if (typeValue !== "select") {
      continue;
    }

    const optionNames = getSelectOptionNames(field);
    const normalized = normalizeTextValue(value);
    if (!normalized || optionNames.size === 0 || optionNames.has(normalized)) {
      continue;
    }

    missing.push(`${fieldName}=${normalized}`);
  }

  if (missing.length > 0) {
    throw new Error(`missing-feishu-enum-options:${input.kind}:${missing.join(",")}`);
  }
}

function extractRecordIdFromUpsertPayload(value: unknown): string | null {
  const payload = asObject(value);
  if (!payload) {
    return null;
  }

  if (typeof payload.record_id === "string") {
    return payload.record_id;
  }

  if (Array.isArray(payload.record_id_list) && typeof payload.record_id_list[0] === "string") {
    return payload.record_id_list[0];
  }

  const recordPayload = asObject(payload.record);
  if (recordPayload) {
    if (typeof recordPayload.record_id === "string") {
      return recordPayload.record_id;
    }
    if (
      Array.isArray(recordPayload.record_id_list) &&
      typeof recordPayload.record_id_list[0] === "string"
    ) {
      return recordPayload.record_id_list[0];
    }
  }

  const dataPayload = asObject(payload.data);
  if (dataPayload) {
    if (typeof dataPayload.record_id === "string") {
      return dataPayload.record_id;
    }
    if (
      Array.isArray(dataPayload.record_id_list) &&
      typeof dataPayload.record_id_list[0] === "string"
    ) {
      return dataPayload.record_id_list[0];
    }
    const nestedRecord = asObject(dataPayload.record);
    if (nestedRecord && typeof nestedRecord.record_id === "string") {
      return nestedRecord.record_id;
    }
    if (
      nestedRecord &&
      Array.isArray(nestedRecord.record_id_list) &&
      typeof nestedRecord.record_id_list[0] === "string"
    ) {
      return nestedRecord.record_id_list[0];
    }
  }

  return null;
}

function normalizeAcceptanceOverride(
  value: unknown,
): "inherit" | TaskBugAcceptanceMode | null {
  const text = normalizeTextValue(value);
  if (!text) {
    return null;
  }
  if (text === "继承默认" || text === "inherit") {
    return "inherit";
  }
  if (text === "人工验收" || text === "manual_acceptance") {
    return "manual_acceptance";
  }
  if (text === "允许Agent完结" || text === "agent_can_finalize") {
    return "agent_can_finalize";
  }
  return null;
}

function normalizeCompletionNotifyOverride(
  value: unknown,
): "inherit" | TaskBugCompletionNotifyMode | null {
  const text = normalizeTextValue(value);
  if (!text) {
    return null;
  }
  if (text === "继承默认" || text === "inherit") {
    return "inherit";
  }
  if (text === "完成边界提醒" || text === "dm_on_completion_boundary") {
    return "dm_on_completion_boundary";
  }
  if (
    text === "完成边界不提醒" ||
    text === "no_dm_on_completion_boundary"
  ) {
    return "no_dm_on_completion_boundary";
  }
  return null;
}

function normalizeReviewResolutionDecision(
  value: unknown,
): "accepted" | "rejected" | null {
  const text = normalizeTextValue(value);
  if (!text) {
    return null;
  }
  if (text === "accepted" || text === "accept" || text === "通过" || text === "验收通过") {
    return "accepted";
  }
  if (
    text === "rejected" ||
    text === "reject" ||
    text === "reopened" ||
    text === "驳回" ||
    text === "回退"
  ) {
    return "rejected";
  }
  return null;
}

function resolveTargets(parameters: Record<string, unknown> | null): FeishuTaskBugTarget[] {
  if (!parameters) {
    return [];
  }

  const taskRecordId = pickString(parameters.task_record_id, parameters.taskRecordId);
  const bugRecordId = pickString(parameters.bug_record_id, parameters.bugRecordId);
  const targets: FeishuTaskBugTarget[] = [];

  if (taskRecordId) {
    targets.push({ kind: "task", record_id: taskRecordId });
  }
  if (bugRecordId) {
    targets.push({ kind: "bug", record_id: bugRecordId });
  }

  return targets;
}

export function hasFeishuTaskBugWritebackAnchors(
  parameters: Record<string, unknown> | null,
): boolean {
  return resolveTargets(parameters).length > 0;
}

function resolveTaskBugPolicy(input: {
  routerConfig: RouterConfig;
  acceptanceOverride: unknown;
  completionNotifyOverride: unknown;
}): ResolvedTaskBugPolicy {
  const defaultAcceptance =
    input.routerConfig.task_bug_policy?.defaults?.acceptance_mode ??
    BUILTIN_TASK_BUG_POLICY_DEFAULTS.acceptance_mode;
  const defaultCompletionNotify =
    input.routerConfig.task_bug_policy?.defaults?.completion_notify_mode ??
    BUILTIN_TASK_BUG_POLICY_DEFAULTS.completion_notify_mode;
  const acceptanceDefaultSource =
    input.routerConfig.task_bug_policy?.defaults?.acceptance_mode
      ? "router_default"
      : "builtin_default";
  const completionDefaultSource =
    input.routerConfig.task_bug_policy?.defaults?.completion_notify_mode
      ? "router_default"
      : "builtin_default";

  const rowAcceptanceMode =
    normalizeAcceptanceOverride(input.acceptanceOverride) ?? "inherit";
  const rowCompletionNotifyMode =
    normalizeCompletionNotifyOverride(input.completionNotifyOverride) ?? "inherit";

  return {
    acceptance_mode:
      rowAcceptanceMode !== "inherit" ? rowAcceptanceMode : defaultAcceptance,
    completion_notify_mode:
      rowCompletionNotifyMode !== "inherit"
        ? rowCompletionNotifyMode
        : defaultCompletionNotify,
    acceptance_mode_source:
      rowAcceptanceMode !== "inherit" ? "row_override" : acceptanceDefaultSource,
    completion_notify_mode_source:
      rowCompletionNotifyMode !== "inherit"
        ? "row_override"
        : completionDefaultSource,
    row_acceptance_mode: rowAcceptanceMode,
    row_completion_notify_mode: rowCompletionNotifyMode,
  };
}

function deriveWritebackPatch(input: {
  kind: FeishuTaskBugKind;
  envelope: NormalizedEnvelope;
  serviceResult: ServiceResult;
}): DerivedWritebackPatch {
  const reviewResolutionDecision = normalizeReviewResolutionDecision(
    input.envelope.parameters?.decision,
  );
  const summary = truncateText(
    pickString(
      input.serviceResult.summary,
      input.envelope.parameters?.comment,
      input.envelope.parameters?.reason,
      input.serviceResult.reply_payload,
      input.serviceResult.escalation_reason,
    ),
  );
  const escalationReason = truncateText(input.serviceResult.escalation_reason ?? null);
  const reviewLike =
    input.envelope.workflow === "review" ||
    /review/i.test(escalationReason ?? "") ||
    /review/i.test(summary ?? "");

  if (input.envelope.action_name === "review_resolution") {
    if (reviewResolutionDecision === "accepted") {
      return {
        phase: "resolution_boundary",
        status: input.kind === "task" ? "Done" : "Fixed",
        current_step: "COMPLETE",
        step_result: "accepted",
        next_action:
          truncateText(summary ? `已验收通过: ${summary}` : "已验收通过") ?? "已验收通过",
        summary,
        set_started_at_if_empty: false,
      };
    }

    if (reviewResolutionDecision === "rejected") {
      return {
        phase: "resolution_boundary",
        status: "Todo",
        current_step: "REPLAN",
        step_result: "rejected",
        next_action:
          truncateText(
            summary ? `根据验收反馈重新处理: ${summary}` : "根据验收反馈重新处理",
          ) ?? "根据验收反馈重新处理",
        summary,
        set_started_at_if_empty: false,
      };
    }

    return {
      phase: "error",
      status: null,
      current_step: "REPORT",
      step_result: "failed",
      next_action: "缺少有效的 review_resolution decision",
      summary,
      set_started_at_if_empty: false,
    };
  }

  if (
    input.envelope.workflow === "review" ||
    input.serviceResult.needs_escalation ||
    input.serviceResult.status === "needs_escalation"
  ) {
    return {
      phase: "review_boundary",
      status: "Reviewing",
      current_step: "REVIEW_WAIT",
      step_result: reviewLike ? "need_review" : "blocked",
      next_action: truncateText(
        reviewLike
          ? `等待Review${summary ? `: ${summary}` : ""}`
          : `NEED_DECISION: ${summary ?? escalationReason ?? "等待人工决策"}`,
      ) ?? (reviewLike ? "等待Review" : "NEED_DECISION: 等待人工决策"),
      summary,
      set_started_at_if_empty: false,
    };
  }

  if (
    input.serviceResult.status === "error" ||
    input.serviceResult.result_kind === "rejected"
  ) {
    return {
      phase: "error",
      status: null,
      current_step: "REPORT",
      step_result: "failed",
      next_action:
        truncateText(summary ?? escalationReason ?? "排查失败原因") ?? "排查失败原因",
      summary,
      set_started_at_if_empty: false,
    };
  }

  return {
    phase: "in_progress",
    status: input.kind === "task" ? "Doing" : "Fixing",
    current_step: "EXECUTE",
    step_result: "in_progress",
    next_action:
      input.serviceResult.result_kind === "queued"
        ? "等待执行队列出列"
        : "继续执行当前事项",
    summary,
    set_started_at_if_empty: true,
  };
}

function shouldNoopForStatus(input: {
  kind: FeishuTaskBugKind;
  currentStatus: string | null;
  patch: DerivedWritebackPatch;
  actionName: string | null;
}): string | null {
  const currentStatus = input.currentStatus?.trim() ?? "";
  if (!currentStatus) {
    return null;
  }

  const terminalStatuses =
    input.kind === "task"
      ? new Set(["Done", "Archived"])
      : new Set(["Fixed", "Archived"]);

  if (input.actionName === "review_resolution") {
    if (currentStatus === "Archived") {
      return `terminal_status:${currentStatus}`;
    }
    return null;
  }

  if (terminalStatuses.has(currentStatus)) {
    return `terminal_status:${currentStatus}`;
  }

  if (currentStatus === "Reviewing" && input.patch.phase === "in_progress") {
    return "status_regression:Reviewing->in_progress";
  }

  return null;
}

export async function resolveDefaultFeishuTaskBugWritebackOptions(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string | null;
} = {}): Promise<Pick<FeishuTaskBugWritebackAdapterConfig, "baseToken" | "identity">> {
  const binding = await resolveFeishuWorkSurfaceBinding(input);
  return {
    baseToken: binding.baseToken,
    identity: binding.identity,
  };
}

export function createFeishuTaskBugWritebackAdapter(
  config: FeishuTaskBugWritebackAdapterConfig,
) {
  const tableNames = {
    ...DEFAULT_FEISHU_TASK_BUG_TABLE_NAMES,
    ...(config.tableNames ?? {}),
  };
  const taskFieldNames: FeishuTaskFieldMap = {
    ...DEFAULT_FEISHU_TASK_FIELD_NAMES,
    ...(config.fieldNames?.task ?? {}),
  };
  const bugFieldNames: FeishuBugFieldMap = {
    ...DEFAULT_FEISHU_BUG_FIELD_NAMES,
    ...(config.fieldNames?.bug ?? {}),
  };

  const client = createLarkCliBaseClient({
    baseToken: config.baseToken,
    identity: config.identity,
    cliBin: config.cliBin,
    cwd: config.cwd,
    env: config.env,
    runner: config.runner,
  });

  let metadataPromise: Promise<FeishuTaskBugMetadata> | null = null;

  async function inspectMetadata(): Promise<FeishuTaskBugMetadata> {
    if (!metadataPromise) {
      metadataPromise = (async () => {
        const tables = await client.listTables();
        const tasksTable = findTable(tables, tableNames.tasks);
        const bugsTable = findTable(tables, tableNames.bugs);
        if (!tasksTable) {
          throw new Error(`missing-feishu-table:tasks:${tableNames.tasks}`);
        }
        if (!bugsTable) {
          throw new Error(`missing-feishu-table:bugs:${tableNames.bugs}`);
        }

        const [taskFields, bugFields] = await Promise.all([
          client.listFields(tasksTable.table_id),
          client.listFields(bugsTable.table_id),
        ]);

        const taskFieldsByName = indexFieldsByName(taskFields);
        const bugFieldsByName = indexFieldsByName(bugFields);

        requireFields(
          taskFieldsByName,
          TASK_REQUIRED_FIELDS.map((key) => taskFieldNames[key]),
          "tasks",
        );
        requireFields(
          bugFieldsByName,
          BUG_REQUIRED_FIELDS.map((key) => bugFieldNames[key]),
          "bugs",
        );

        return {
          tasksTable,
          bugsTable,
          taskFields: taskFieldsByName,
          bugFields: bugFieldsByName,
        };
      })();
    }

    return metadataPromise;
  }

  async function findTargetRecord(target: FeishuTaskBugTarget): Promise<LarkCliRecord> {
    const metadata = await inspectMetadata();
    const tableId =
      target.kind === "task" ? metadata.tasksTable.table_id : metadata.bugsTable.table_id;
    const records = await client.listRecords(tableId, 1000);
    const record = records.find((item) => item.record_id === target.record_id);
    if (!record) {
      throw new Error(`missing-task-bug-record:${target.kind}:${target.record_id}`);
    }
    return record;
  }

  async function planWriteback(input: {
    envelope: NormalizedEnvelope;
    serviceResult: ServiceResult;
    routerConfig: RouterConfig;
    now?: () => Date;
  }): Promise<FeishuTaskBugWritebackPlan[]> {
    const metadata = await inspectMetadata();
    const targets = resolveTargets(input.envelope.parameters);
    if (targets.length === 0) {
      return [];
    }

    const timestamp = (input.now ?? (() => new Date()))().toISOString();
    const plans: FeishuTaskBugWritebackPlan[] = [];

    for (const target of targets) {
      const record = await findTargetRecord(target);
      const fields = target.kind === "task" ? taskFieldNames : bugFieldNames;
      const currentStatus = normalizeTextValue(getRecordFieldValue(record, fields.status)) || null;
      const noopReason = shouldNoopForStatus({
        kind: target.kind,
        currentStatus,
        actionName: input.envelope.action_name,
        patch: deriveWritebackPatch({
          kind: target.kind,
          envelope: input.envelope,
          serviceResult: input.serviceResult,
        }),
      });
      const policy = resolveTaskBugPolicy({
        routerConfig: input.routerConfig,
        acceptanceOverride: getRecordFieldValue(record, fields.acceptance_mode),
        completionNotifyOverride: getRecordFieldValue(record, fields.completion_notify_mode),
      });

      if (noopReason) {
        plans.push({
          kind: target.kind,
          record_id: target.record_id,
          operation: "noop",
          reason: noopReason,
          status_before: currentStatus,
          fields: {},
          policy,
        });
        continue;
      }

      const patch = deriveWritebackPatch({
        kind: target.kind,
        envelope: input.envelope,
        serviceResult: input.serviceResult,
      });
      const nextFields: Record<string, unknown> = {
        [fields.current_step]: patch.current_step,
        [fields.step_result]: patch.step_result,
        [fields.next_action]: patch.next_action,
        [fields.last_event_at]: toFeishuDatetime(timestamp),
      };

      if (patch.status && patch.status !== currentStatus) {
        nextFields[fields.status] = patch.status;
      }

      const startedAtValue = getRecordFieldValue(record, fields.started_at);
      if (
        patch.set_started_at_if_empty &&
        !normalizeTextValue(startedAtValue)
      ) {
        nextFields[fields.started_at] = toFeishuDatetime(timestamp);
      }

      if (target.kind === "task" && patch.summary) {
        nextFields[taskFieldNames.execution_summary] = patch.summary;
      }

      validateSelectCoverage({
        kind: target.kind,
        fieldsByName: target.kind === "task" ? metadata.taskFields : metadata.bugFields,
        nextFields,
      });

      plans.push({
        kind: target.kind,
        record_id: target.record_id,
        operation: "updated",
        reason: patch.phase,
        status_before: currentStatus,
        fields: nextFields,
        policy,
      });
    }

    return plans;
  }

  async function applyWriteback(
    plan: FeishuTaskBugWritebackPlan,
  ): Promise<FeishuTaskBugWritebackApplyResult> {
    if (plan.operation === "noop") {
      return {
        kind: plan.kind,
        record_id: plan.record_id,
        operation: "noop",
        applied_record_id: plan.record_id,
        fields: {},
      };
    }

    const metadata = await inspectMetadata();
    const tableId =
      plan.kind === "task" ? metadata.tasksTable.table_id : metadata.bugsTable.table_id;
    const upsertPayload = await client.upsertRecord({
      tableIdOrName: tableId,
      recordId: plan.record_id,
      fields: plan.fields,
    });

    return {
      kind: plan.kind,
      record_id: plan.record_id,
      operation: "updated",
      applied_record_id: extractRecordIdFromUpsertPayload(upsertPayload) ?? plan.record_id,
      fields: plan.fields,
    };
  }

  return {
    inspectMetadata,
    planWriteback,
    applyWriteback,
  };
}

export async function runFeishuTaskBugWriteback(input: {
  envelope: NormalizedEnvelope;
  serviceResult: ServiceResult;
  routerConfig: RouterConfig;
  apply?: boolean;
} & FeishuTaskBugWritebackAdapterConfig): Promise<FeishuTaskBugWritebackRunResult> {
  const adapter = createFeishuTaskBugWritebackAdapter({
    baseToken: input.baseToken,
    identity: input.identity,
    cliBin: input.cliBin,
    cwd: input.cwd,
    env: input.env,
    runner: input.runner,
    tableNames: input.tableNames,
    fieldNames: input.fieldNames,
  });
  const plans = await adapter.planWriteback({
    envelope: input.envelope,
    serviceResult: input.serviceResult,
    routerConfig: input.routerConfig,
  });

  if (!input.apply) {
    return {
      mode: "dry_run",
      plans,
    };
  }

  const results = await Promise.all(plans.map((plan) => adapter.applyWriteback(plan)));
  return {
    mode: "apply",
    plans,
    results,
  };
}
