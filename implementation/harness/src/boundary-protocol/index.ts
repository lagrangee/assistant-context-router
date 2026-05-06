import type { WorkSurfaceActionName } from "../../../core/src/types.ts";
import type { ExecutionWorkItem } from "../execution-envelope/index.ts";

export interface BoundaryResult {
  action: WorkSurfaceActionName;
  task_record_id: string | null;
  bug_record_id: string | null;
  summary: string | null;
  evidence: string | null;
  reason: string | null;
  fix_result: string | null;
  work_surface_operations: WorkSurfaceOperation[];
  parameters: Record<string, unknown>;
}

export interface BoundaryValidationResult {
  ok: boolean;
  boundary: BoundaryResult | null;
  errors: string[];
  escalation_reason: string | null;
}

export interface WorkSurfaceOperation {
  operation: "update_record";
  source_system: string;
  table_id: string | null;
  table_name: string | null;
  record_id: string;
  set_fields: Record<string, unknown>;
  verify_fields: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

export function isPlaceholderString(value: string | null | undefined): boolean {
  return typeof value === "string" && /^<[^>]+>$/.test(value.trim());
}

function hasPlaceholderValue(value: unknown): boolean {
  if (typeof value === "string") {
    return isPlaceholderString(value);
  }
  if (Array.isArray(value)) {
    return value.some(hasPlaceholderValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasPlaceholderValue);
  }
  return false;
}

function mutationClaimText(summary: string | null, evidence: string | null): string {
  return [summary, evidence].filter((item): item is string => !!item).join("\n").toLowerCase();
}

function claimsWorkSurfaceMutation(summary: string | null, evidence: string | null): boolean {
  const text = mutationClaimText(summary, evidence);
  if (!text) {
    return false;
  }

  const hasMutationVerb =
    /\b(updated|changed|moved|set|patched|wrote|modified|created|deleted|marked|transitioned)\b/.test(text) ||
    /(已更新|已移动|移入|放入|切换|改为|写入|修改|标记|创建|删除)/.test(text);
  const hasWorkSurfaceNoun =
    /\b(record|records|row|rows|card|cards|base|table|field|fields|status|feishu|lark)\b/.test(text) ||
    /(记录|行|卡片|多维表格|表格|字段|状态|飞书)/.test(text);

  return hasMutationVerb && hasWorkSurfaceNoun;
}

function arrayFromUnknown(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeWorkSurfaceOperation(value: unknown): WorkSurfaceOperation | null {
  const objectValue = asObject(value);
  if (!objectValue || pickString(objectValue.operation) !== "update_record") {
    return null;
  }

  const sourceSystem = pickString(
    objectValue.source_system,
    objectValue.sourceSystem,
  );
  const recordId = pickString(objectValue.record_id, objectValue.recordId);
  const tableId = pickString(objectValue.table_id, objectValue.tableId);
  const tableName = pickString(objectValue.table_name, objectValue.tableName);
  const setFields =
    objectOrNull(objectValue.set_fields) ??
    objectOrNull(objectValue.setFields) ??
    objectOrNull(objectValue.fields);
  const verifyFields =
    objectOrNull(objectValue.verify_fields) ??
    objectOrNull(objectValue.verifyFields) ??
    objectOrNull(objectValue.expected_fields) ??
    objectOrNull(objectValue.expectedFields) ??
    setFields;

  if (
    !sourceSystem ||
    !recordId ||
    (!tableId && !tableName) ||
    !isNonEmptyObject(setFields) ||
    !isNonEmptyObject(verifyFields) ||
    hasPlaceholderValue(objectValue)
  ) {
    return null;
  }

  return {
    operation: "update_record",
    source_system: sourceSystem,
    table_id: tableId,
    table_name: tableName,
    record_id: recordId,
    set_fields: setFields,
    verify_fields: verifyFields,
  };
}

function normalizeChangedRecord(value: unknown): WorkSurfaceOperation | null {
  const objectValue = asObject(value);
  if (!objectValue) {
    return null;
  }

  const sourceSystem = pickString(
    objectValue.source_system,
    objectValue.sourceSystem,
  );
  const recordId = pickString(objectValue.record_id, objectValue.recordId);
  const tableId = pickString(objectValue.table_id, objectValue.tableId);
  const tableName = pickString(objectValue.table_name, objectValue.tableName);
  const fields =
    objectOrNull(objectValue.set_fields) ??
    objectOrNull(objectValue.setFields) ??
    objectOrNull(objectValue.verify_fields) ??
    objectOrNull(objectValue.verifyFields) ??
    objectOrNull(objectValue.expected_fields) ??
    objectOrNull(objectValue.expectedFields) ??
    objectOrNull(objectValue.fields);

  if (
    !sourceSystem ||
    !recordId ||
    (!tableId && !tableName) ||
    !isNonEmptyObject(fields) ||
    hasPlaceholderValue(objectValue)
  ) {
    return null;
  }

  return {
    operation: "update_record",
    source_system: sourceSystem,
    table_id: tableId,
    table_name: tableName,
    record_id: recordId,
    set_fields: fields,
    verify_fields: fields,
  };
}

export function extractWorkSurfaceOperations(
  parameters?: Record<string, unknown> | null,
): WorkSurfaceOperation[] {
  const safeParameters = asObject(parameters);
  const operations = arrayFromUnknown(
    safeParameters.work_surface_operations ?? safeParameters.workSurfaceOperations,
  )
    .map(normalizeWorkSurfaceOperation)
    .filter((operation): operation is WorkSurfaceOperation => operation !== null);
  const changedRecords = arrayFromUnknown(
    safeParameters.changed_records ?? safeParameters.changedRecords,
  )
    .map(normalizeChangedRecord)
    .filter((operation): operation is WorkSurfaceOperation => operation !== null);

  return [...operations, ...changedRecords];
}

function hasInvalidStructuredOperations(parameters: Record<string, unknown>): boolean {
  const rawOperations = arrayFromUnknown(
    parameters.work_surface_operations ?? parameters.workSurfaceOperations,
  );
  const rawChangedRecords = arrayFromUnknown(
    parameters.changed_records ?? parameters.changedRecords,
  );
  const normalizedCount = extractWorkSurfaceOperations(parameters).length;
  return rawOperations.length + rawChangedRecords.length > normalizedCount;
}

function hasBugBoundary(input: {
  bugRecordId: string | null;
  workItems?: ExecutionWorkItem[];
}): boolean {
  return !!input.bugRecordId || !!input.workItems?.some((item) => item.kind === "bug");
}

function firstRecordIds(input: {
  parameters: Record<string, unknown>;
  workItems?: ExecutionWorkItem[];
}): { taskRecordId: string | null; bugRecordId: string | null } {
  return {
    taskRecordId: pickString(
      input.parameters.task_record_id,
      input.parameters.taskRecordId,
      input.workItems?.find((item) => item.kind === "task")?.record_id,
    ),
    bugRecordId: pickString(
      input.parameters.bug_record_id,
      input.parameters.bugRecordId,
      input.workItems?.find((item) => item.kind === "bug")?.record_id,
    ),
  };
}

function escalationReasonFor(errors: string[]): string {
  if (errors.includes("missing_record_id")) {
    return "semantic_boundary_missing_record_id";
  }
  if (errors.includes("missing_summary") || errors.includes("placeholder_summary")) {
    return "semantic_complete_missing_summary";
  }
  if (errors.includes("missing_evidence") || errors.includes("placeholder_evidence")) {
    return "semantic_complete_missing_evidence";
  }
  if (errors.includes("missing_work_surface_operations")) {
    return "semantic_complete_missing_work_surface_operations";
  }
  if (errors.includes("invalid_work_surface_operations")) {
    return "semantic_complete_invalid_work_surface_operations";
  }
  if (errors.includes("missing_fix_result") || errors.includes("unsupported_fix_result")) {
    return "semantic_complete_missing_fix_result";
  }
  if (errors.includes("missing_reason")) {
    return "semantic_boundary_missing_reason";
  }
  return "semantic_boundary_invalid";
}

export function validateBoundaryResult(input: {
  action_name: string | null;
  parameters?: Record<string, unknown> | null;
  work_items?: ExecutionWorkItem[];
  accepted_bug_fix_results?: string[];
}): BoundaryValidationResult {
  const parameters = asObject(input.parameters);
  const action = pickString(input.action_name) as WorkSurfaceActionName | null;
  const allowedActions = new Set<WorkSurfaceActionName>([
    "complete",
    "review",
    "review_request",
    "blocked",
  ]);
  const errors: string[] = [];

  if (!action || !allowedActions.has(action)) {
    errors.push("unsupported_action");
  }

  const { taskRecordId, bugRecordId } = firstRecordIds({
    parameters,
    workItems: input.work_items,
  });
  const summary = pickString(
    parameters.summary,
    parameters.completion_summary,
    parameters.completionSummary,
  );
  const evidence = pickString(parameters.evidence, parameters.verification, parameters.proof);
  const reason = pickString(parameters.reason, parameters.escalation_reason);
  const fixResult = pickString(parameters.fix_result, parameters.fixResult);
  const workSurfaceOperations = extractWorkSurfaceOperations(parameters);

  if ((action === "complete" || action === "review" || action === "review_request" || action === "blocked") && !taskRecordId && !bugRecordId) {
    errors.push("missing_record_id");
  }

  if (action === "complete") {
    if (!summary) {
      errors.push("missing_summary");
    } else if (isPlaceholderString(summary)) {
      errors.push("placeholder_summary");
    }
    if (!evidence) {
      errors.push("missing_evidence");
    } else if (isPlaceholderString(evidence)) {
      errors.push("placeholder_evidence");
    }
    if (hasInvalidStructuredOperations(parameters)) {
      errors.push("invalid_work_surface_operations");
    }
    if (
      claimsWorkSurfaceMutation(summary, evidence) &&
      workSurfaceOperations.length === 0
    ) {
      errors.push("missing_work_surface_operations");
    }
    if (hasBugBoundary({ bugRecordId, workItems: input.work_items })) {
      const acceptedFixResults = input.accepted_bug_fix_results ?? [
        "Fixed",
        "Won't fix",
        "Can't rep",
      ];
      if (!fixResult || isPlaceholderString(fixResult)) {
        errors.push("missing_fix_result");
      } else if (!acceptedFixResults.includes(fixResult)) {
        errors.push("unsupported_fix_result");
      }
    }
  }

  if ((action === "review" || action === "review_request" || action === "blocked") && !reason) {
    errors.push("missing_reason");
  }

  const boundary = action
    ? {
        action,
        task_record_id: taskRecordId,
        bug_record_id: bugRecordId,
        summary,
        evidence,
        reason,
        fix_result: fixResult,
        work_surface_operations: workSurfaceOperations,
        parameters,
      }
    : null;
  const ok = errors.length === 0;
  return {
    ok,
    boundary: ok ? boundary : null,
    errors,
    escalation_reason: ok ? null : escalationReasonFor(errors),
  };
}
