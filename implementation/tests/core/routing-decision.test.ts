import test from "node:test";
import assert from "node:assert/strict";

import { decideRoute } from "../../core/src/routing/decision.ts";
import { normalizeIngressEvent } from "../../core/src/routing/ingress.ts";
import { createRouteTraceFromDecision } from "../../core/src/trace/route-trace.ts";

test("normalizeIngressEvent recognizes structured automation envelope", () => {
  const envelope = normalizeIngressEvent({
    event: {
      channel: "feishu",
      payload: {
        project_id: "proj-openclaw-feishu-orchestrator",
        action_name: "dispatch",
        parameters: {
          task_id: "T-123",
        },
        reply_target: {
          target_kind: "channel",
          target_id: "feishu:thread:1",
          visibility: "system_facing",
          reply_mode: "direct",
        },
      },
    },
  });

  assert.ok(envelope);
  assert.equal(envelope?.source_type, "automation");
  assert.equal(envelope?.channel_type, "feishu");
  assert.equal(envelope?.resolved_project_id, "proj-openclaw-feishu-orchestrator");
  assert.equal(envelope?.action_name, "dispatch");
  assert.deepEqual(envelope?.parameters, { task_id: "T-123" });
  assert.ok(envelope?.trace_id);
});

test("decideRoute keeps human-facing traffic in main session", () => {
  const envelope = normalizeIngressEvent({
    event: {
      channel: "tui",
      text: "what is the next action?",
    },
  });
  assert.ok(envelope);

  const decision = decideRoute({
    envelope,
    sessionKey: "agent:main:human",
    sessionState: {
      current_project_id: "proj-sample",
      selected_at: "2026-04-14T00:00:00.000Z",
      selected_via: "manual",
      current_workflow: null,
      updated_at: "2026-04-14T00:00:00.000Z",
      expires_at: "2026-04-21T00:00:00.000Z",
      last_route_trace: null,
      pending_save_mode: null,
      pending_save_draft: null,
    },
  });

  assert.equal(decision.target_kind, "main_session");
  assert.equal(decision.target_id, "agent:main:human");
  assert.equal(decision.resolved_project_id, "proj-sample");
  assert.equal(decision.route_source, "binding");
  assert.deepEqual(decision.route_evidence, [
    "human-facing message",
    "main session",
    "current_project_binding",
  ]);
});

test("decideRoute sends structured automation to service and creates rich trace", () => {
  const envelope = normalizeIngressEvent({
    event: {
      channel: "feishu",
      payload: {
        project_id: "proj-openclaw-feishu-orchestrator",
        action_name: "dispatch",
        workflow: "dispatch",
      },
    },
  });
  assert.ok(envelope);

  const decision = decideRoute({
    envelope,
    sessionKey: "agent:main:human",
    availableServiceActions: new Set(["dispatch"]),
  });
  const trace = createRouteTraceFromDecision(decision, {
    traceId: envelope?.trace_id,
    sourceType: envelope?.source_type,
    channelType: envelope?.channel_type,
  });

  assert.equal(decision.target_kind, "service");
  assert.equal(decision.target_id, "proj-openclaw-feishu-orchestrator:dispatch");
  assert.equal(trace.target_kind, "service");
  assert.equal(trace.resolved_project_id, "proj-openclaw-feishu-orchestrator");
  assert.equal(trace.trace_id, envelope.trace_id);
  assert.deepEqual(trace.route_evidence, ["automation message", "resolved_project_id", "action_name"]);
});

test("decideRoute safe-fails unresolved automation messages", () => {
  const envelope = normalizeIngressEvent({
    event: {
      channel: "feishu",
      payload: {
        action_name: "dispatch",
      },
    },
  });
  assert.ok(envelope);

  const decision = decideRoute({
    envelope,
    sessionKey: "agent:main:human",
  });

  assert.equal(decision.target_kind, "safe_fail");
  assert.match(String(decision.safe_fail_reason), /could not resolve project/);
  assert.equal(decision.fallback_to_main_session, true);
});

test("decideRoute safe-fails configured service routes when the service handler is missing", () => {
  const envelope = normalizeIngressEvent({
    event: {
      channel: "feishu",
      payload: {
        project_id: "proj-openclaw-feishu-orchestrator",
        action_name: "dispatch",
      },
    },
  });
  assert.ok(envelope);

  const decision = decideRoute({
    envelope,
    sessionKey: "agent:main:human",
    availableServiceActions: new Set(),
    actionConfig: {
      target_kind: "service",
      workflow: "dispatch",
      requires_resolved_project: true,
    },
  });
  const trace = createRouteTraceFromDecision(decision, {
    traceId: envelope?.trace_id,
    sourceType: envelope.source_type,
    channelType: envelope.channel_type,
  });

  assert.equal(decision.target_kind, "safe_fail");
  assert.equal(decision.route_source, "unresolved");
  assert.match(String(decision.safe_fail_reason), /no service handler is registered/);
  assert.equal(trace.safe_fail, true);
  assert.equal(trace.trace_id, envelope.trace_id);
  assert.match(String(trace.safe_fail_reason), /no service handler is registered/);
});

test("normalizeIngressEvent preserves upstream trace_id when provided", () => {
  const envelope = normalizeIngressEvent({
    event: {
      channel: "feishu",
      payload: {
        project_id: "proj-openclaw-feishu-orchestrator",
        action_name: "dispatch",
        trace_id: "trace-upstream-123",
      },
    },
  });

  assert.ok(envelope);
  assert.equal(envelope?.trace_id, "trace-upstream-123");
});
