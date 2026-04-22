import type { InternalServiceHandler, InternalServiceRequest, ServiceResult } from "../types.ts";
import { normalizeServiceResult } from "./service-result.ts";

export interface InternalServiceRegistry {
  has(actionName: string, projectId?: string | null): boolean;
  execute(actionName: string, request: InternalServiceRequest): Promise<ServiceResult>;
}

function projectScopedKey(projectId: string, actionName: string): string {
  return `${projectId}:${actionName}`;
}

export function createInternalServiceRegistry(
  handlers?: Record<string, InternalServiceHandler>,
): InternalServiceRegistry {
  const registry = new Map(Object.entries(handlers ?? {}));

  return {
    has(actionName, projectId) {
      return (
        (!!projectId && registry.has(projectScopedKey(projectId, actionName))) ||
        registry.has(actionName)
      );
    },
    async execute(actionName, request) {
      const scopedKey = request.resolved_project_id
        ? projectScopedKey(request.resolved_project_id, actionName)
        : null;
      const handler = (scopedKey ? registry.get(scopedKey) : null) ?? registry.get(actionName);
      if (!handler) {
        return normalizeServiceResult({
          status: "needs_escalation",
          reply_payload: null,
          needs_escalation: true,
          escalation_reason: `No internal service registered for action ${actionName}`,
          trace_patch: {
            service_handler: "missing",
            action_name: actionName,
            resolved_project_id: request.resolved_project_id,
          },
        });
      }
      return normalizeServiceResult(await handler(request));
    },
  };
}
