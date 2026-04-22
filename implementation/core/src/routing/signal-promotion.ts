import type {
  NormalizedEnvelope,
  ProjectSessionDeliveryResult,
  ProjectSessionSignalKind,
  RouteDecision,
  ServiceResult,
  SignalPromotionDecision,
} from "../types.ts";

export function deriveSignalReason(input: {
  decision: RouteDecision;
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
}): string {
  return [
    input.deliveryResult?.error_reason,
    input.serviceResult?.escalation_reason,
    input.decision.escalation_reason,
    input.decision.safe_fail_reason,
    input.serviceResult?.summary,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function hasHumanDecisionHint(reason: string): boolean {
  return [
    "decision",
    "approval",
    "approve",
    "human decision",
    "human approval",
    "project_owner",
    "coordinator-agent",
    "takeover",
  ].some((keyword) => reason.includes(keyword));
}

export function deriveProjectSessionSignalKind(input: {
  decision: RouteDecision;
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
  envelope: NormalizedEnvelope;
}): ProjectSessionSignalKind {
  if (
    input.deliveryResult?.status === "failed" ||
    input.deliveryResult?.status === "unresolved_binding"
  ) {
    return "blocked";
  }

  if (input.serviceResult?.status === "error") {
    return "service_error";
  }

  if (input.serviceResult?.needs_escalation) {
    const reason = deriveSignalReason(input);
    if (reason.includes("block")) {
      return "blocked";
    }
    if (reason.includes("review")) {
      return "review_request";
    }
    return "blocked";
  }

  if (input.decision.escalation_reason) {
    const reason = deriveSignalReason(input);
    if (reason.includes("block")) {
      return "blocked";
    }
    if (reason.includes("review")) {
      return "review_request";
    }
    return "blocked";
  }

  if (
    input.serviceResult?.status === "ok" &&
    !!(input.serviceResult.reply_payload || input.serviceResult.summary) &&
    input.envelope.source_type === "automation"
  ) {
    return "high_signal_completion";
  }

  return "none";
}

export function decideSignalPromotion(input: {
  signalKind: ProjectSessionSignalKind;
  decision: RouteDecision;
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
}): SignalPromotionDecision {
  const reason = deriveSignalReason(input);
  const needsHumanDecision = hasHumanDecisionHint(reason);

  if (input.signalKind === "none") {
    return {
      signal_kind: input.signalKind,
      business_notification: false,
      main_session_escalation: false,
      collab_promotion: "none",
      reason: "Local-only signal; no promotion required.",
    };
  }

  if (input.signalKind === "high_signal_completion") {
    return {
      signal_kind: input.signalKind,
      business_notification: true,
      main_session_escalation: false,
      collab_promotion: "none",
      reason: "High-signal completion should surface to work/business channels first.",
    };
  }

  if (input.signalKind === "review_request") {
    return {
      signal_kind: input.signalKind,
      business_notification: true,
      main_session_escalation: needsHumanDecision,
      collab_promotion: "persistent_only",
      reason: needsHumanDecision
        ? "Review request explicitly requires human/governance decision."
        : "Review request should stay in business/work surface unless it remains unresolved.",
    };
  }

  if (input.signalKind === "blocked" || input.signalKind === "service_error") {
    return {
      signal_kind: input.signalKind,
      business_notification: true,
      main_session_escalation: needsHumanDecision,
      collab_promotion: "persistent_only",
      reason: needsHumanDecision
        ? "Blocked/error signal requires human/governance decision."
        : "Blocked/error signal should stay in business/work surface unless it remains unresolved.",
    };
  }

  return {
    signal_kind: input.signalKind,
    business_notification: false,
    main_session_escalation: false,
    collab_promotion: "none",
    reason: "Unhandled signal family; keep local until contract expands.",
  };
}
