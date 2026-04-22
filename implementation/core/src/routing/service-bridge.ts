import type {
  InternalServiceRequest,
  ServiceBinding,
  ServiceBridgeAdapter,
  ServiceResult,
} from "../types.ts";
import { normalizeServiceResult } from "./service-result.ts";

export interface ServiceBridgeRegistry {
  has(runtimeKind: string): boolean;
  execute(input: {
    binding: ServiceBinding;
    request: InternalServiceRequest;
  }): Promise<ServiceResult>;
}

export function createServiceBridgeRegistry(
  adapters?: Record<string, ServiceBridgeAdapter>,
): ServiceBridgeRegistry {
  const registry = new Map(Object.entries(adapters ?? {}));

  return {
    has(runtimeKind) {
      return registry.has(runtimeKind);
    },
    async execute(input) {
      const adapter = registry.get(input.binding.runtime_kind);
      if (!adapter) {
        return normalizeServiceResult({
          status: "needs_escalation",
          result_kind: "needs_escalation",
          summary: `No service bridge adapter registered for runtime ${input.binding.runtime_kind}`,
          reply_payload: null,
          needs_escalation: true,
          escalation_reason: `No service bridge adapter registered for runtime ${input.binding.runtime_kind}`,
          trace_patch: {
            service_bridge_adapter: "missing",
            runtime_kind: input.binding.runtime_kind,
            target_ref: input.binding.target_ref,
          },
        });
      }

      return normalizeServiceResult(
        await adapter({
          binding: input.binding,
          request: input.request,
        }),
      );
    },
  };
}
