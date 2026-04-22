import type {
  CurrentProjectBinding,
  RouteTrace,
  SelectedVia,
  SessionProjectState,
  SessionProjectStatePatch,
  WorkflowFamily,
} from "../types.ts";

export function readCurrentProjectBinding(
  sessionState?: SessionProjectState | null,
): CurrentProjectBinding | null {
  if (!sessionState?.current_project_id) {
    return null;
  }

  return {
    project_id: sessionState.current_project_id,
    selected_at: sessionState.selected_at,
    selected_via: sessionState.selected_via,
    current_workflow: sessionState.current_workflow ?? null,
    updated_at: sessionState.updated_at,
  };
}

export function bindingMatchesProject(
  sessionState: SessionProjectState | null | undefined,
  projectId: string,
): boolean {
  return readCurrentProjectBinding(sessionState)?.project_id === projectId;
}

export function createCurrentProjectBindingPatch(input: {
  projectId: string;
  selectedAt: string;
  selectedVia: SelectedVia;
  currentWorkflow?: WorkflowFamily | null;
  updatedAt?: string;
  lastRouteTrace?: RouteTrace | null;
  clearPendingSave?: boolean;
}): SessionProjectStatePatch {
  return {
    current_project_id: input.projectId,
    selected_at: input.selectedAt,
    selected_via: input.selectedVia,
    current_workflow: input.currentWorkflow ?? null,
    updated_at: input.updatedAt ?? input.selectedAt,
    last_route_trace: input.lastRouteTrace ?? null,
    pending_save_mode: input.clearPendingSave ? null : undefined,
    pending_save_draft: input.clearPendingSave ? null : undefined,
  };
}
