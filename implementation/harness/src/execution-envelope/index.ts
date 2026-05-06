import type {
  PendingSemanticExecution,
  WorkflowFamily,
  WorkSurfaceActionName,
  WorkSurfaceOrigin,
} from "../../../core/src/types.ts";

export interface ExecutionWorkItem {
  kind: string;
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
  work_surface_origin?: WorkSurfaceOrigin | null;
}

export interface BoundaryRequirements {
  allowed_actions: WorkSurfaceActionName[];
  require_record_id: boolean;
  require_summary: boolean;
  require_evidence: boolean;
  bug_fix_result_values?: string[];
}

export interface ExecutionEnvelope {
  project_id: string;
  project_root: string | null;
  action_name: string;
  workflow: WorkflowFamily | null;
  trace_id: string | null;
  message_id: string | null;
  work_surface_origin: WorkSurfaceOrigin | null;
  work_items: ExecutionWorkItem[];
  adapter_facts: Record<string, unknown>;
  boundary_requirements: BoundaryRequirements;
}

export function firstWorkSurfaceOrigin(
  workItems: ExecutionWorkItem[],
): WorkSurfaceOrigin | null {
  return workItems.find((item) => item.work_surface_origin)?.work_surface_origin ?? null;
}

export function createExecutionEnvelope(input: {
  project_id: string;
  project_root?: string | null;
  action_name: string;
  workflow?: WorkflowFamily | null;
  trace_id?: string | null;
  message_id?: string | null;
  work_surface_origin?: WorkSurfaceOrigin | null;
  work_items?: ExecutionWorkItem[];
  adapter_facts?: Record<string, unknown>;
  boundary_requirements?: Partial<BoundaryRequirements>;
}): ExecutionEnvelope {
  const workItems = input.work_items ?? [];
  return {
    project_id: input.project_id,
    project_root: input.project_root ?? null,
    action_name: input.action_name,
    workflow: input.workflow ?? null,
    trace_id: input.trace_id ?? null,
    message_id: input.message_id ?? null,
    work_surface_origin: input.work_surface_origin ?? firstWorkSurfaceOrigin(workItems),
    work_items: workItems,
    adapter_facts: input.adapter_facts ?? {},
    boundary_requirements: {
      allowed_actions: input.boundary_requirements?.allowed_actions ?? [
        "complete",
        "review",
        "blocked",
      ],
      require_record_id: input.boundary_requirements?.require_record_id ?? true,
      require_summary: input.boundary_requirements?.require_summary ?? true,
      require_evidence: input.boundary_requirements?.require_evidence ?? true,
      bug_fix_result_values: input.boundary_requirements?.bug_fix_result_values ?? [
        "Fixed",
        "Won't fix",
        "Can't rep",
      ],
    },
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function createExecutionEnvelopeFromPendingSemanticExecution(input: {
  pending: PendingSemanticExecution;
  projectRoot: string | null;
}): ExecutionEnvelope {
  const pendingAdapterFacts = asObject(input.pending.adapter_facts);
  const pendingOriginalParameters = asObject(pendingAdapterFacts.original_parameters);

  return createExecutionEnvelope({
    project_id: input.pending.project_id,
    project_root: input.projectRoot,
    action_name: input.pending.action_name,
    workflow: input.pending.workflow,
    trace_id: input.pending.trace_id,
    message_id: null,
    work_items: input.pending.execution_contexts ?? [],
    adapter_facts: {
      ...pendingAdapterFacts,
      source: "external work-surface semantic context",
      pending_semantic_execution: true,
      original_parameters: {
        ...pendingOriginalParameters,
        ...(input.pending.task_record_id
          ? { task_record_id: input.pending.task_record_id }
          : {}),
        ...(input.pending.bug_record_id
          ? { bug_record_id: input.pending.bug_record_id }
          : {}),
      },
    },
  });
}
