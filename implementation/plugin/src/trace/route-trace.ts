import type { RouteSource, RouteTrace, WorkflowFamily } from "../types.ts";

export function createRouteTrace(input: {
  resolvedProjectId: string | "unresolved";
  routeSource: RouteSource;
  workflow?: WorkflowFamily | null;
  safeFail?: boolean;
  reason: string;
  timestamp?: string;
}): RouteTrace {
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    resolved_project_id: input.resolvedProjectId,
    route_source: input.routeSource,
    workflow: input.workflow ?? null,
    safe_fail: input.safeFail ?? false,
    reason: input.reason,
  };
}

export function createSafeFailTrace(reason: string, timestamp?: string): RouteTrace {
  return createRouteTrace({
    resolvedProjectId: "unresolved",
    routeSource: "unresolved",
    workflow: null,
    safeFail: true,
    reason,
    timestamp,
  });
}

export function formatRouteTrace(trace: RouteTrace): string {
  const parts = [
    `project=${trace.resolved_project_id}`,
    `source=${trace.route_source}`,
    `workflow=${trace.workflow ?? "none"}`,
    `safe_fail=${trace.safe_fail ? "yes" : "no"}`,
    `reason=${trace.reason}`,
  ];
  return parts.join(" | ");
}
