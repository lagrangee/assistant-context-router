import type {
  ChannelType,
  RouteDecision,
  RouteSource,
  RouteTrace,
  SourceType,
  TargetKind,
  WorkflowFamily,
} from "../types.ts";

export function createRouteTrace(input: {
  traceId?: string | null;
  sourceType?: SourceType | null;
  channelType?: ChannelType | null;
  projectRef?: string | null;
  resolvedProjectId: string | "unresolved";
  routeSource: RouteSource;
  workflow?: WorkflowFamily | null;
  targetKind?: TargetKind | null;
  targetId?: string | null;
  routeEvidence?: string[];
  mainSessionBindingId?: string | null;
  projectSessionRuntimeKind?: string | null;
  projectSessionDeliveryStatus?: import("../types.ts").ProjectSessionDeliveryStatus | null;
  projectSessionRuntimeTargetId?: string | null;
  fallbackUsed?: boolean;
  escalationReason?: string | null;
  safeFail?: boolean;
  safeFailReason?: string | null;
  reason: string;
  timestamp?: string;
}): RouteTrace {
  return {
    trace_id: input.traceId ?? null,
    timestamp: input.timestamp ?? new Date().toISOString(),
    source_type: input.sourceType ?? null,
    channel_type: input.channelType ?? null,
    project_ref: input.projectRef ?? null,
    resolved_project_id: input.resolvedProjectId,
    route_source: input.routeSource,
    workflow: input.workflow ?? null,
    target_kind: input.targetKind ?? null,
    target_id: input.targetId ?? null,
    route_evidence: input.routeEvidence ?? [],
    main_session_binding_id: input.mainSessionBindingId ?? null,
    project_session_runtime_kind: input.projectSessionRuntimeKind ?? null,
    project_session_delivery_status: input.projectSessionDeliveryStatus ?? null,
    project_session_runtime_target_id: input.projectSessionRuntimeTargetId ?? null,
    fallback_used: input.fallbackUsed ?? false,
    escalation_reason: input.escalationReason ?? null,
    safe_fail: input.safeFail ?? false,
    safe_fail_reason: input.safeFailReason ?? (input.safeFail ? input.reason : null),
    reason: input.reason,
  };
}

export function createSafeFailTrace(reason: string, timestamp?: string): RouteTrace {
  return createRouteTrace({
    traceId: null,
    resolvedProjectId: "unresolved",
    routeSource: "unresolved",
    workflow: null,
    targetKind: "safe_fail",
    routeEvidence: ["safe-fail"],
    safeFail: true,
    safeFailReason: reason,
    reason,
    timestamp,
  });
}

export function createRouteTraceFromDecision(
  decision: RouteDecision,
  extras?: {
    traceId?: string | null;
    sourceType?: SourceType | null;
    channelType?: ChannelType | null;
    timestamp?: string;
    mainSessionBindingId?: string | null;
    projectSessionRuntimeKind?: string | null;
    projectSessionDeliveryStatus?: import("../types.ts").ProjectSessionDeliveryStatus | null;
    projectSessionRuntimeTargetId?: string | null;
    fallbackUsed?: boolean;
  },
): RouteTrace {
  return createRouteTrace({
    traceId: extras?.traceId ?? null,
    sourceType: extras?.sourceType ?? null,
    channelType: extras?.channelType ?? null,
    projectRef: decision.project_ref,
    resolvedProjectId: decision.resolved_project_id,
    routeSource: decision.route_source,
    workflow: decision.workflow,
    targetKind: decision.target_kind,
    targetId: decision.target_id,
    routeEvidence: decision.route_evidence,
    mainSessionBindingId: extras?.mainSessionBindingId ?? null,
    projectSessionRuntimeKind: extras?.projectSessionRuntimeKind ?? null,
    projectSessionDeliveryStatus: extras?.projectSessionDeliveryStatus ?? null,
    projectSessionRuntimeTargetId: extras?.projectSessionRuntimeTargetId ?? null,
    fallbackUsed: extras?.fallbackUsed ?? false,
    escalationReason: decision.escalation_reason,
    safeFail: decision.target_kind === "safe_fail",
    safeFailReason: decision.safe_fail_reason,
    reason: decision.route_reason,
    timestamp: extras?.timestamp,
  });
}

export function formatRouteTrace(trace: RouteTrace): string {
  const parts = [
    `trace_id=${trace.trace_id ?? "none"}`,
    `source_type=${trace.source_type ?? "unknown"}`,
    `channel=${trace.channel_type ?? "unknown"}`,
    `project_ref=${trace.project_ref ?? "none"}`,
    `project=${trace.resolved_project_id}`,
    `source=${trace.route_source}`,
    `target=${trace.target_kind ?? "none"}:${trace.target_id ?? "none"}`,
    `workflow=${trace.workflow ?? "none"}`,
    `main_binding=${trace.main_session_binding_id ?? "none"}`,
    `project_delivery=${trace.project_session_delivery_status ?? "none"}`,
    `safe_fail=${trace.safe_fail ? "yes" : "no"}`,
    `reason=${trace.reason}`,
  ];
  return parts.join(" | ");
}
