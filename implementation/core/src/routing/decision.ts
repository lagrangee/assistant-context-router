import type {
  ActionRouteConfig,
  NormalizedEnvelope,
  RouteDecision,
  SessionProjectState,
  WorkflowFamily,
} from "../types.ts";
import { readCurrentProjectBinding } from "../state/current-project-binding.ts";

function normalizeWorkflow(
  envelopeWorkflow: WorkflowFamily | null,
  sessionWorkflow: WorkflowFamily | null | undefined,
): WorkflowFamily | null {
  return envelopeWorkflow ?? sessionWorkflow ?? null;
}

export function decideRoute(input: {
  envelope: NormalizedEnvelope;
  sessionKey: string | null;
  sessionState?: SessionProjectState | null;
  availableServiceActions?: Set<string>;
  actionConfig?: ActionRouteConfig | null;
}): RouteDecision {
  const { envelope, sessionKey, sessionState } = input;
  const binding = readCurrentProjectBinding(sessionState);
  const resolvedProjectId = envelope.resolved_project_id ?? binding?.project_id ?? "unresolved";
  const workflow = input.actionConfig?.workflow ?? normalizeWorkflow(envelope.workflow, binding?.current_workflow);
  const hasServiceAction =
    !!envelope.action_name && !!input.availableServiceActions?.has(envelope.action_name);
  const preferredTarget = input.actionConfig?.target_kind;
  const requiresResolvedProject = input.actionConfig?.requires_resolved_project ?? true;
  const isStructuredWorkflowSource =
    envelope.source_type === "automation" ||
    (envelope.source_type === "agent" && !!envelope.action_name);

  if (isStructuredWorkflowSource) {
    if (requiresResolvedProject && resolvedProjectId === "unresolved") {
      return {
        target_kind: "safe_fail",
        target_id: null,
        resolved_project_id: "unresolved",
        project_ref: envelope.project_ref,
        route_source: "unresolved",
        route_reason: "Automation message could not resolve project",
        route_evidence: ["automation message", "project unresolved"],
        workflow,
        fallback_to_main_session: true,
        escalation_reason: "unresolved_project",
        safe_fail_reason: "Automation message could not resolve project",
      };
    }

    if (preferredTarget === "project_session") {
      return {
        target_kind: "project_session",
        target_id:
          resolvedProjectId === "unresolved" ? null : `project:${resolvedProjectId}`,
        resolved_project_id: resolvedProjectId,
        project_ref: envelope.project_ref,
        route_source: "automation",
        route_reason: "Automation message routed to project session event lane by config",
        route_evidence: ["automation message", "route config target=project_session"],
        workflow,
        fallback_to_main_session: true,
        escalation_reason: null,
        safe_fail_reason: null,
      };
    }

    if (preferredTarget === "service" && hasServiceAction) {
      return {
        target_kind: "service",
        target_id: `${resolvedProjectId}:${envelope.action_name}`,
        resolved_project_id: resolvedProjectId,
        project_ref: envelope.project_ref,
        route_source: "automation",
        route_reason: "Structured automation message routed to internal service",
        route_evidence: ["automation message", "resolved_project_id", "action_name"],
        workflow,
        fallback_to_main_session: true,
        escalation_reason: null,
        safe_fail_reason: null,
      };
    }

    if (preferredTarget === "service" && !hasServiceAction) {
      return {
        target_kind: "safe_fail",
        target_id: null,
        resolved_project_id: resolvedProjectId,
        project_ref: envelope.project_ref,
        route_source: "unresolved",
        route_reason: "Configured service route could not execute because no service handler is registered",
        route_evidence: [
          "automation message",
          "route config target=service",
          "service handler missing",
        ],
        workflow,
        fallback_to_main_session: true,
        escalation_reason: "missing_service_handler",
        safe_fail_reason:
          "Configured service route could not execute because no service handler is registered",
      };
    }

    if (hasServiceAction) {
      return {
        target_kind: "service",
        target_id: `${resolvedProjectId}:${envelope.action_name}`,
        resolved_project_id: resolvedProjectId,
        project_ref: envelope.project_ref,
        route_source: "automation",
        route_reason: "Structured automation message routed to internal service",
        route_evidence: ["automation message", "resolved_project_id", "action_name"],
        workflow,
        fallback_to_main_session: true,
        escalation_reason: null,
        safe_fail_reason: null,
      };
    }

    return {
      target_kind: "project_session",
      target_id: `project:${resolvedProjectId}`,
      resolved_project_id: resolvedProjectId,
      project_ref: envelope.project_ref,
      route_source: "automation",
      route_reason: envelope.action_name
        ? "Automation message routed to project session event lane"
        : "Automation message without executable action routed to project session event lane",
      route_evidence: envelope.action_name
        ? ["automation message", "resolved_project_id", "no registered service handler"]
        : ["automation message", "resolved_project_id", "action_name missing"],
      workflow,
      fallback_to_main_session: true,
      escalation_reason: null,
      safe_fail_reason: null,
    };
  }

  return {
    target_kind: "main_session",
    target_id: sessionKey,
    resolved_project_id: resolvedProjectId,
    project_ref: envelope.project_ref,
    route_source:
      envelope.resolved_project_id || envelope.project_ref
        ? "anchor"
        : binding?.project_id
          ? "binding"
          : "route",
    route_reason:
      binding?.project_id
        ? "Human-facing message stays in main session with current project focus"
        : "Human-facing message enters main session by default",
    route_evidence:
      binding?.project_id
        ? ["human-facing message", "main session", "current_project_binding"]
        : ["human-facing message", "main session default"],
    workflow,
    fallback_to_main_session: false,
    escalation_reason: null,
    safe_fail_reason: null,
  };
}
