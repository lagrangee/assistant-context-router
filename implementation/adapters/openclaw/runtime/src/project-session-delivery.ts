import type {
  ProjectSessionDeliveryAdapter,
  ProjectSessionDeliveryRequest,
  ProjectSessionDeliveryResult,
} from "../../../../core/src/types.ts";

interface OpenClawRuntimeLike {
  system?: {
    enqueueSystemEvent?: (
      text: string,
      options: {
        sessionKey: string;
        contextKey?: string | null;
        deliveryContext?: Record<string, unknown>;
        trusted?: boolean;
      },
    ) => boolean;
    runHeartbeatOnce?: (options?: {
      reason?: string;
      sessionKey?: string;
      heartbeat?: {
        target?: string;
      };
    }) => Promise<
      | { status: "ran"; durationMs: number }
      | { status: "skipped"; reason: string }
      | { status: "failed"; reason: string }
    >;
    requestHeartbeatNow?: (options?: {
      reason?: string;
      sessionKey?: string;
    }) => unknown;
  };
}

function stringifyParameters(value: ProjectSessionDeliveryRequest["envelope"]["parameters"]): string {
  if (!value) {
    return "{}";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{\"error\":\"parameters_not_serializable\"}";
  }
}

function buildOpenClawProjectSessionEventText(
  request: ProjectSessionDeliveryRequest,
): string {
  const lines = [
    "Assistant Context Router project session event:",
    `project_id: ${request.project_id}`,
    `action_name: ${request.envelope.action_name ?? "unknown_action"}`,
    `workflow: ${request.route_decision.workflow ?? "general"}`,
    `trace_id: ${request.envelope.trace_id ?? "none"}`,
    `source_type: ${request.envelope.source_type}`,
    `channel_type: ${request.envelope.channel_type}`,
    "",
    "parameters:",
    stringifyParameters(request.envelope.parameters),
  ];

  if (request.envelope.text) {
    lines.push("", "text:", request.envelope.text);
  }

  lines.push(
    "",
    "Treat this as a system-facing project lane event routed by ACR. Continue project-side processing in this session.",
  );

  return lines.join("\n");
}

export function createOpenClawProjectSessionDeliveryAdapter(
  runtime?: OpenClawRuntimeLike,
): ProjectSessionDeliveryAdapter {
  return async function deliverToOpenClawProjectSession(
    request: ProjectSessionDeliveryRequest,
  ): Promise<ProjectSessionDeliveryResult> {
    const targetSessionKey = request.binding.target_ref.trim();
    const enqueueSystemEvent = runtime?.system?.enqueueSystemEvent;
    const runHeartbeatOnce = runtime?.system?.runHeartbeatOnce;
    const requestHeartbeatNow = runtime?.system?.requestHeartbeatNow;
    const wakeReason = "acr:project_session_delivery";

    if (!targetSessionKey) {
      return {
        status: "failed",
        runtime_target_id: null,
        fallback_used: true,
        error_reason: "missing_openclaw_session_target",
        trace_patch: null,
      };
    }

    if (!enqueueSystemEvent) {
      return {
        status: "failed",
        runtime_target_id: targetSessionKey,
        fallback_used: true,
        error_reason: "missing_openclaw_runtime_system_api",
        trace_patch: null,
      };
    }

    const accepted = enqueueSystemEvent(buildOpenClawProjectSessionEventText(request), {
      sessionKey: targetSessionKey,
      contextKey: `acr:project:${request.project_id}`,
      trusted: true,
    });

    if (!accepted) {
      return {
        status: "failed",
        runtime_target_id: targetSessionKey,
        fallback_used: true,
        error_reason: "openclaw_system_event_rejected",
        trace_patch: null,
      };
    }

    if (runHeartbeatOnce) {
      const heartbeatResult = await runHeartbeatOnce({
        reason: wakeReason,
        sessionKey: targetSessionKey,
        heartbeat: {
          target: "last",
        },
      });

      if (heartbeatResult.status === "ran") {
        return {
          status: "delivered",
          runtime_target_id: targetSessionKey,
          fallback_used: false,
          error_reason: null,
          trace_patch: {
            delivered_by: "openclaw_session",
            delivery_mode: "system_event_heartbeat_once",
            wake_reason: wakeReason,
            heartbeat_status: heartbeatResult.status,
            heartbeat_duration_ms: heartbeatResult.durationMs,
          },
        };
      }

      if (
        heartbeatResult.status === "skipped" &&
        heartbeatResult.reason === "requests-in-flight" &&
        requestHeartbeatNow
      ) {
        requestHeartbeatNow({
          reason: wakeReason,
          sessionKey: targetSessionKey,
        });

        return {
          status: "queued",
          runtime_target_id: targetSessionKey,
          fallback_used: false,
          error_reason: null,
          trace_patch: {
            delivered_by: "openclaw_session",
            delivery_mode: "system_event_queued",
            wake_reason: wakeReason,
            heartbeat_status: heartbeatResult.status,
            heartbeat_reason: heartbeatResult.reason,
          },
        };
      }

      return {
        status: "queued",
        runtime_target_id: targetSessionKey,
        fallback_used: false,
        error_reason: null,
        trace_patch: {
          delivered_by: "openclaw_session",
          delivery_mode: "system_event_pending",
          wake_reason: wakeReason,
          heartbeat_status: heartbeatResult.status,
          heartbeat_reason:
            heartbeatResult.status === "ran" ? null : heartbeatResult.reason,
        },
      };
    }

    if (requestHeartbeatNow) {
      requestHeartbeatNow({
        reason: wakeReason,
        sessionKey: targetSessionKey,
      });
    }

    return {
      status: "queued",
      runtime_target_id: targetSessionKey,
      fallback_used: false,
      error_reason: null,
      trace_patch: {
        delivered_by: "openclaw_session",
        delivery_mode: "system_event_queued",
        wake_reason: wakeReason,
      },
    };
  };
}

export function createProjectSessionDeliveryRegistry(
  adapters?: Record<string, ProjectSessionDeliveryAdapter>,
) {
  const table = new Map<string, ProjectSessionDeliveryAdapter>(
    Object.entries(adapters ?? {}),
  );

  return {
    has(runtimeKind: string): boolean {
      return table.has(runtimeKind);
    },

    async deliver(
      request: ProjectSessionDeliveryRequest,
    ): Promise<ProjectSessionDeliveryResult> {
      const adapter = table.get(request.binding.runtime_kind);
      if (!adapter) {
        return {
          status: "failed",
          runtime_target_id: null,
          fallback_used: true,
          error_reason: `missing_delivery_adapter:${request.binding.runtime_kind}`,
          trace_patch: null,
        };
      }

      try {
        return await adapter(request);
      } catch (error) {
        return {
          status: "failed",
          runtime_target_id: null,
          fallback_used: true,
          error_reason: String((error as Error)?.message ?? error),
          trace_patch: null,
        };
      }
    },
  };
}
