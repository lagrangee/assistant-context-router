import { resolveMainSessionBinding } from "./bindings.ts";
import type { GovernanceDeliveryRecord, RuntimeBindingsConfig } from "../../../../core/src/types.ts";

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

export interface GovernanceDeliveryAdapterResult {
  status: GovernanceDeliveryRecord["status"];
  runtime_target_id: string | null;
  error_reason: string | null;
  trace_patch: Record<string, unknown> | null;
}

function localSymbolicAliasCandidates(targetRef: string): string[] {
  if (!targetRef.startsWith("local:")) {
    return [];
  }

  const symbolic = targetRef.slice("local:".length).trim();
  if (!symbolic) {
    return [];
  }

  const parts = symbolic.split("_").filter(Boolean);
  const candidates = new Set<string>([symbolic]);

  if (parts.length >= 3) {
    candidates.add(`${parts[0]}:${parts[1]}:${parts.slice(2).join("_")}`);
  }

  candidates.add(symbolic.replaceAll("_", ":"));
  return Array.from(candidates);
}

export function resolveGovernanceTargetSessionKey(input: {
  targetRef: string;
  runtimeBindings?: RuntimeBindingsConfig;
}): string | null {
  const trimmed = input.targetRef.trim();
  if (!trimmed) {
    return null;
  }

  const primary = resolveMainSessionBinding(trimmed, input.runtimeBindings);
  if (primary.binding) {
    return primary.canonical_session_key;
  }

  for (const candidate of localSymbolicAliasCandidates(trimmed)) {
    const resolution = resolveMainSessionBinding(candidate, input.runtimeBindings);
    if (resolution.binding) {
      return resolution.canonical_session_key;
    }
  }

  if (trimmed.startsWith("local:")) {
    return null;
  }

  return trimmed;
}

function buildOpenClawGovernanceDeliveryText(record: GovernanceDeliveryRecord): string {
  const lines = [
    "Assistant Context Router governance delivery:",
    `project_id: ${record.project_id}`,
    `signal_kind: ${record.signal_kind}`,
    `action_name: ${record.action_name ?? "unknown_action"}`,
    `workflow: ${record.workflow ?? "general"}`,
    `trace_id: ${record.trace_id ?? "none"}`,
    `escalation_id: ${record.escalation_id}`,
    `reason: ${record.reason}`,
    `summary: ${record.summary ?? "none"}`,
    "",
    "rendered_message:",
    record.rendered_message,
    "",
    "Treat this as a system-facing governance alert mirror. It does not resolve the escalation by itself.",
  ];

  if (record.artifact_ref) {
    lines.push(
      "",
      `artifact: ${record.artifact_ref.kind} | ${record.artifact_ref.label ?? "unnamed"} | ${record.artifact_ref.target}`,
    );
  }

  return lines.join("\n");
}

export function createOpenClawGovernanceDeliveryAdapter(input: {
  runtime?: OpenClawRuntimeLike;
  runtimeBindings?: RuntimeBindingsConfig;
}) {
  return async function deliverGovernanceAlert(
    record: GovernanceDeliveryRecord,
  ): Promise<GovernanceDeliveryAdapterResult> {
    const targetSessionKey = resolveGovernanceTargetSessionKey({
      targetRef: record.target_ref,
      runtimeBindings: input.runtimeBindings,
    });
    const enqueueSystemEvent = input.runtime?.system?.enqueueSystemEvent;
    const runHeartbeatOnce = input.runtime?.system?.runHeartbeatOnce;
    const requestHeartbeatNow = input.runtime?.system?.requestHeartbeatNow;
    const wakeReason = "acr:governance_delivery";

    if (!targetSessionKey) {
      return {
        status: "failed",
        runtime_target_id: null,
        error_reason: `unresolved_governance_target:${record.target_ref}`,
        trace_patch: null,
      };
    }

    if (!enqueueSystemEvent) {
      return {
        status: "failed",
        runtime_target_id: targetSessionKey,
        error_reason: "missing_openclaw_runtime_system_api",
        trace_patch: null,
      };
    }

    const accepted = enqueueSystemEvent(buildOpenClawGovernanceDeliveryText(record), {
      sessionKey: targetSessionKey,
      contextKey: `acr:governance:${record.project_id}`,
      trusted: true,
      deliveryContext: {
        governance_delivery_id: record.delivery_id,
        escalation_id: record.escalation_id,
        channel_type: record.channel_type,
        target_kind: record.target_kind,
      },
    });

    if (!accepted) {
      return {
        status: "failed",
        runtime_target_id: targetSessionKey,
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
          error_reason: null,
          trace_patch: {
            delivered_by: "openclaw_governance_session",
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
          error_reason: null,
          trace_patch: {
            delivered_by: "openclaw_governance_session",
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
        error_reason: null,
        trace_patch: {
          delivered_by: "openclaw_governance_session",
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
      error_reason: null,
      trace_patch: {
        delivered_by: "openclaw_governance_session",
        delivery_mode: "system_event_queued",
        wake_reason: wakeReason,
      },
    };
  };
}
