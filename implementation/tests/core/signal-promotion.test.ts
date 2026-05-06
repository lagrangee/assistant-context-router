import test from "node:test";
import assert from "node:assert/strict";

import {
  decideSignalPromotion,
  deriveProjectSessionSignalKind,
} from "../../core/src/routing/signal-promotion.ts";

test("review-required escalation maps to review_request and stays off main session by default", () => {
  const signalKind = deriveProjectSessionSignalKind({
    decision: {
      target_kind: "service",
      target_id: "demo-acr:review",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "review",
      fallback_to_main_session: true,
      escalation_reason: null,
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "review",
      parameters: null,
      reply_target: null,
      trace_id: "trace-review-1",
      workflow: "review",
      raw_message_ref: "msg-review-1",
      text: null,
    },
    serviceResult: {
      status: "needs_escalation",
      result_kind: "needs_escalation",
      summary: "Review requires project reviewer",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "review_required",
      run_id: "run-review-1",
      queue_ref: null,
      trace_patch: null,
    },
  });

  const promotion = decideSignalPromotion({
    signalKind,
    decision: {
      target_kind: "service",
      target_id: "demo-acr:review",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "review",
      fallback_to_main_session: true,
      escalation_reason: null,
      safe_fail_reason: null,
    },
    serviceResult: {
      status: "needs_escalation",
      result_kind: "needs_escalation",
      summary: "Review requires project reviewer",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "review_required",
      run_id: "run-review-1",
      queue_ref: null,
      trace_patch: null,
    },
  });

  assert.equal(signalKind, "review_request");
  assert.equal(promotion.business_notification, true);
  assert.equal(promotion.main_session_escalation, false);
  assert.equal(promotion.collab_promotion, "persistent_only");
});

test("blocked signal with explicit human decision hint escalates main session", () => {
  const signalKind = deriveProjectSessionSignalKind({
    decision: {
      target_kind: "service",
      target_id: "demo-acr:dispatch",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "dispatch",
      fallback_to_main_session: true,
      escalation_reason: "human_decision_required",
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: { task_id: "TASK-1" },
      reply_target: null,
      trace_id: "trace-dispatch-1",
      workflow: "dispatch",
      raw_message_ref: "msg-dispatch-1",
      text: null,
    },
    serviceResult: {
      status: "needs_escalation",
      result_kind: "needs_escalation",
      summary: "Blocked until the project owner makes a decision",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "human_decision_required",
      run_id: null,
      queue_ref: "queue-1",
      trace_patch: null,
    },
  });

  const promotion = decideSignalPromotion({
    signalKind,
    decision: {
      target_kind: "service",
      target_id: "demo-acr:dispatch",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "dispatch",
      fallback_to_main_session: true,
      escalation_reason: "human_decision_required",
      safe_fail_reason: null,
    },
    serviceResult: {
      status: "needs_escalation",
      result_kind: "needs_escalation",
      summary: "Blocked until the project owner makes a decision",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "human_decision_required",
      run_id: null,
      queue_ref: "queue-1",
      trace_patch: null,
    },
  });

  assert.equal(signalKind, "blocked");
  assert.equal(promotion.business_notification, true);
  assert.equal(promotion.main_session_escalation, true);
  assert.equal(promotion.collab_promotion, "persistent_only");
});

test("high-signal completion stays out of main session by default", () => {
  const signalKind = deriveProjectSessionSignalKind({
    decision: {
      target_kind: "service",
      target_id: "demo-acr:dispatch",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "dispatch",
      fallback_to_main_session: true,
      escalation_reason: null,
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: { task_id: "TASK-2" },
      reply_target: null,
      trace_id: "trace-dispatch-2",
      workflow: "dispatch",
      raw_message_ref: "msg-dispatch-2",
      text: null,
    },
    serviceResult: {
      status: "ok",
      result_kind: "accepted",
      summary: "Dispatch accepted for demo-acr",
      reply_payload: "Accepted dispatch for demo-acr",
      needs_escalation: false,
      escalation_reason: null,
      run_id: "run-1",
      queue_ref: "queue-2",
      trace_patch: null,
    },
  });

  const promotion = decideSignalPromotion({
    signalKind,
    decision: {
      target_kind: "service",
      target_id: "demo-acr:dispatch",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "dispatch",
      fallback_to_main_session: true,
      escalation_reason: null,
      safe_fail_reason: null,
    },
    serviceResult: {
      status: "ok",
      result_kind: "accepted",
      summary: "Dispatch accepted for demo-acr",
      reply_payload: "Accepted dispatch for demo-acr",
      needs_escalation: false,
      escalation_reason: null,
      run_id: "run-1",
      queue_ref: "queue-2",
      trace_patch: null,
    },
  });

  assert.equal(signalKind, "high_signal_completion");
  assert.equal(promotion.business_notification, true);
  assert.equal(promotion.main_session_escalation, false);
  assert.equal(promotion.collab_promotion, "none");
});

test("agent completion boundary stays local when completion DM policy is not set", () => {
  const signalKind = deriveProjectSessionSignalKind({
    decision: {
      target_kind: "service",
      target_id: "demo-acr:complete",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "dispatch",
      fallback_to_main_session: true,
      escalation_reason: null,
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "agent",
      channel_type: "unknown",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "complete",
      parameters: { task_record_id: "rec-task-1" },
      reply_target: null,
      trace_id: "trace-complete-agent-1",
      workflow: "dispatch",
      raw_message_ref: "msg-complete-agent-1",
      text: null,
    },
    serviceResult: {
      status: "ok",
      result_kind: "accepted",
      work_surface_action: "complete",
      summary: "Agent reached completion boundary",
      reply_payload: "Agent reached completion boundary",
      needs_escalation: false,
      escalation_reason: null,
      run_id: null,
      queue_ref: null,
      trace_patch: null,
    },
    signalPolicy: {
      completion_notify_mode: "no_dm_on_completion_boundary",
    },
  });

  assert.equal(signalKind, "none");
});

test("agent completion boundary promotes when row policy requests completion DM", () => {
  const decision = {
    target_kind: "service" as const,
    target_id: "demo-acr:complete",
    resolved_project_id: "demo-acr",
    project_ref: "demo-acr",
    route_source: "automation" as const,
    route_reason: "Structured automation message routed to internal service",
    route_evidence: ["automation message", "action_name"],
    workflow: "dispatch" as const,
    fallback_to_main_session: true,
    escalation_reason: null,
    safe_fail_reason: null,
  };
  const serviceResult = {
    status: "ok" as const,
    result_kind: "accepted" as const,
    work_surface_action: "complete" as const,
    summary: "Agent reached completion boundary",
    reply_payload: "Agent reached completion boundary",
    needs_escalation: false,
    escalation_reason: null,
    run_id: null,
    queue_ref: null,
    trace_patch: null,
  };
  const signalKind = deriveProjectSessionSignalKind({
    decision,
    envelope: {
      source_type: "agent",
      channel_type: "unknown",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "complete",
      parameters: { task_record_id: "rec-task-1" },
      reply_target: null,
      trace_id: "trace-complete-agent-2",
      workflow: "dispatch",
      raw_message_ref: "msg-complete-agent-2",
      text: null,
    },
    serviceResult,
    signalPolicy: {
      completion_notify_mode: "dm_on_completion_boundary",
    },
  });
  const promotion = decideSignalPromotion({
    signalKind,
    decision,
    serviceResult,
  });

  assert.equal(signalKind, "high_signal_completion");
  assert.equal(promotion.business_notification, true);
  assert.equal(promotion.main_session_escalation, false);
});
