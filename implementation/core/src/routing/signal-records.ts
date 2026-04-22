import type {
  BusinessNotificationRecord,
  MainSessionEscalationRecord,
  NormalizedEnvelope,
  ProjectSessionDeliveryResult,
  ProjectSessionSignalKind,
  RouteDecision,
  ServiceResult,
  SignalPromotionSource,
} from "../types.ts";
import { deriveSignalReason } from "./signal-promotion.ts";

function stableId(prefix: string, parts: Array<string | null | undefined>): string {
  const base = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("|")
    .replace(/[^a-zA-Z0-9._|:-]+/g, "_");

  return `${prefix}:${base || "record"}`;
}

export function deriveSignalPromotionSource(input: {
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
}): SignalPromotionSource {
  if (input.deliveryResult) {
    return "delivery_result";
  }
  if (input.serviceResult) {
    return "service_result";
  }
  return "route_decision";
}

export function buildBusinessNotificationRecord(input: {
  projectId: string;
  signalKind: ProjectSessionSignalKind;
  decision: RouteDecision;
  envelope: NormalizedEnvelope;
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
  now?: () => Date;
}): BusinessNotificationRecord {
  const createdAt = (input.now ?? (() => new Date()))().toISOString();
  const source = deriveSignalPromotionSource(input);
  const reason = deriveSignalReason(input) || input.decision.route_reason;
  const summary =
    input.serviceResult?.summary ??
    input.serviceResult?.reply_payload ??
    input.deliveryResult?.error_reason ??
    input.decision.escalation_reason ??
    input.decision.safe_fail_reason ??
    null;

  return {
    notification_id: stableId("notification", [
      createdAt,
      input.projectId,
      input.signalKind,
      input.envelope.trace_id,
      input.envelope.action_name,
    ]),
    created_at: createdAt,
    project_id: input.projectId,
    signal_kind: input.signalKind,
    source,
    trace_id: input.envelope.trace_id,
    action_name: input.envelope.action_name,
    workflow: input.envelope.workflow,
    reason,
    summary,
    run_id: input.serviceResult?.run_id ?? null,
    queue_ref: input.serviceResult?.queue_ref ?? null,
    artifact_ref: input.serviceResult?.artifact_ref ?? null,
    status: "recorded",
  };
}

export function buildMainSessionEscalationSeed(input: {
  canonicalSessionKey: string;
  projectId: string;
  signalKind: ProjectSessionSignalKind;
  decision: RouteDecision;
  envelope: NormalizedEnvelope;
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
}): Omit<
  MainSessionEscalationRecord,
  "escalation_id" | "created_at" | "updated_at" | "status"
> {
  const source = deriveSignalPromotionSource(input);
  const reason = deriveSignalReason(input) || input.decision.route_reason;
  const summary =
    input.serviceResult?.summary ??
    input.serviceResult?.reply_payload ??
    input.deliveryResult?.error_reason ??
    input.decision.escalation_reason ??
    input.decision.safe_fail_reason ??
    null;

  return {
    canonical_session_key: input.canonicalSessionKey,
    project_id: input.projectId,
    signal_kind: input.signalKind,
    source,
    target: "main_session",
    reason,
    summary,
    trace_id: input.envelope.trace_id,
    action_name: input.envelope.action_name,
    workflow: input.envelope.workflow,
    run_id: input.serviceResult?.run_id ?? null,
    queue_ref: input.serviceResult?.queue_ref ?? null,
    artifact_ref: input.serviceResult?.artifact_ref ?? null,
    resolution: null,
  };
}

export function deriveEscalationDedupKey(
  seed: Omit<
    MainSessionEscalationRecord,
    "escalation_id" | "created_at" | "updated_at" | "status"
  >,
): string {
  return stableId("escalation", [
    seed.canonical_session_key,
    seed.project_id,
    seed.signal_kind,
    seed.action_name,
    seed.reason,
  ]);
}
