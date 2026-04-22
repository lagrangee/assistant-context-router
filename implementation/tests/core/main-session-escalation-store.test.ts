import test from "node:test";
import assert from "node:assert/strict";

import { createMainSessionEscalationStore } from "../../core/src/state/main-session-escalation-store.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("main session escalation store upserts open records by stable escalation identity", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createMainSessionEscalationStore({
    dataDir: workspace.dataDir,
    now: () => new Date("2026-04-17T10:00:00.000Z"),
  });

  const first = await store.upsertOpen({
    canonical_session_key: "agent:main:test",
    project_id: "proj-sample",
    signal_kind: "blocked",
    source: "service_result",
    target: "main_session",
    reason: "human decision required",
    summary: "Need human approval before dispatch can continue",
    trace_id: "trace-1",
    action_name: "dispatch",
    workflow: "dispatch",
    run_id: "run-1",
    queue_ref: "queue-1",
    artifact_ref: {
      kind: "approval_request",
      label: "Approval payload",
      target: "file:///tmp/approval-1.json",
    },
    resolution: null,
  });

  const second = await store.upsertOpen({
    canonical_session_key: "agent:main:test",
    project_id: "proj-sample",
    signal_kind: "blocked",
    source: "service_result",
    target: "main_session",
    reason: "human decision required",
    summary: "Need human approval before dispatch can continue",
    trace_id: "trace-2",
    action_name: "dispatch",
    workflow: "dispatch",
    run_id: "run-2",
    queue_ref: "queue-2",
    artifact_ref: {
      kind: "approval_request",
      label: "Approval payload v2",
      target: "file:///tmp/approval-2.json",
    },
    resolution: null,
  });

  assert.equal(first.escalation_id, second.escalation_id);

  const open = await store.listOpen({
    canonicalSessionKey: "agent:main:test",
    projectId: "proj-sample",
  });

  assert.equal(open.length, 1);
  assert.equal(open[0]?.trace_id, "trace-2");
  assert.equal(open[0]?.run_id, "run-2");
  assert.equal(open[0]?.artifact_ref?.target, "file:///tmp/approval-2.json");
});

test("main session escalation store can resolve an existing escalation", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createMainSessionEscalationStore({
    dataDir: workspace.dataDir,
    now: () => new Date("2026-04-17T11:00:00.000Z"),
  });

  const created = await store.upsertOpen({
    canonical_session_key: "agent:main:test",
    project_id: "proj-sample",
    signal_kind: "review_request",
    source: "service_result",
    target: "main_session",
    reason: "coordinator-agent review required",
    summary: "Review target ready",
    trace_id: "trace-review-1",
    action_name: "review",
    workflow: "review",
    run_id: "run-review-1",
    queue_ref: null,
    artifact_ref: {
      kind: "review_target",
      label: "Review target",
      target: "file:///tmp/review-target.diff",
    },
    resolution: null,
  });

  const resolved = await store.resolve({
    canonicalSessionKey: "agent:main:test",
    escalationId: created.escalation_id,
    resolution: "accepted",
  });

  assert.equal(resolved?.status, "resolved");
  assert.equal(resolved?.resolution, "accepted");

  const open = await store.listOpen({
    canonicalSessionKey: "agent:main:test",
  });
  assert.equal(open.length, 0);
});
