import type {
  GovernanceDeliveryRecord,
  MainSessionEscalationRecord,
} from "../types.ts";

interface GovernanceDeliveryBindingLike {
  channel_type: string;
  target_kind: string;
  target_ref: string;
  delivery_mode: string;
}

function stableId(prefix: string, parts: Array<string | null | undefined>): string {
  const base = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("|")
    .replace(/[^a-zA-Z0-9._|:-]+/g, "_");

  return `${prefix}:${base || "record"}`;
}

export function deriveGovernanceDeliveryDedupKey(input: {
  escalationId: string;
  binding: GovernanceDeliveryBindingLike;
}): string {
  return stableId("governance_delivery", [
    input.escalationId,
    input.binding.channel_type,
    input.binding.target_kind,
    input.binding.target_ref,
    input.binding.delivery_mode,
  ]);
}

export function renderGovernanceAlertMessage(input: {
  escalation: MainSessionEscalationRecord;
  binding: GovernanceDeliveryBindingLike;
}): string {
  const artifactLine = input.escalation.artifact_ref
    ? `Artifact: ${input.escalation.artifact_ref.kind} | ${input.escalation.artifact_ref.label ?? "unnamed"} | ${input.escalation.artifact_ref.target}`
    : "Artifact: none";

  return [
    "ACR governance escalation",
    `Project: ${input.escalation.project_id}`,
    `Signal: ${input.escalation.signal_kind}`,
    `Action: ${input.escalation.action_name ?? "unknown"}`,
    `Workflow: ${input.escalation.workflow ?? "unknown"}`,
    `Reason: ${input.escalation.reason}`,
    `Summary: ${input.escalation.summary ?? "none"}`,
    `Trace: ${input.escalation.trace_id ?? "none"}`,
    `Escalation ID: ${input.escalation.escalation_id}`,
    `Target: ${input.binding.channel_type}/${input.binding.target_kind}/${input.binding.target_ref}`,
    artifactLine,
  ].join("\n");
}

export function buildGovernanceDeliverySeed(input: {
  escalation: MainSessionEscalationRecord;
  binding: GovernanceDeliveryBindingLike;
}): Omit<
  GovernanceDeliveryRecord,
  | "delivery_id"
  | "created_at"
  | "updated_at"
  | "status"
  | "runtime_target_id"
  | "error_reason"
  | "trace_patch"
> {
  return {
    escalation_id: input.escalation.escalation_id,
    canonical_session_key: input.escalation.canonical_session_key,
    project_id: input.escalation.project_id,
    signal_kind: input.escalation.signal_kind,
    trace_id: input.escalation.trace_id,
    action_name: input.escalation.action_name,
    workflow: input.escalation.workflow,
    reason: input.escalation.reason,
    summary: input.escalation.summary,
    artifact_ref: input.escalation.artifact_ref,
    channel_type: input.binding.channel_type,
    target_kind: input.binding.target_kind,
    target_ref: input.binding.target_ref,
    delivery_mode: input.binding.delivery_mode,
    rendered_message: renderGovernanceAlertMessage(input),
  };
}
