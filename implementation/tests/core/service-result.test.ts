import test from "node:test";
import assert from "node:assert/strict";

import { createInternalServiceRegistry } from "../../core/src/routing/services.ts";

test("internal service registry normalizes ok result into accepted shell", async () => {
  const registry = createInternalServiceRegistry({
    dispatch: async () => ({
      status: "ok",
      reply_payload: "accepted dispatch",
      needs_escalation: false,
      escalation_reason: null,
      artifact_ref: {
        kind: "pull_request",
        label: "PR #42",
        target: "https://example.test/pr/42",
      },
    }),
  });

  const result = await registry.execute("dispatch", {
    action_name: "dispatch",
    resolved_project_id: "demo-acr",
    workflow: "dispatch",
    parameters: { task_id: "TASK-001" },
    trace_id: "trace-1",
    reply_target: null,
  });

  assert.equal(result.status, "ok");
  assert.equal(result.result_kind, "accepted");
  assert.equal(result.summary, "accepted dispatch");
  assert.equal(result.run_id, null);
  assert.equal(result.queue_ref, null);
  assert.equal(result.artifact_ref?.kind, "pull_request");
  assert.equal(result.artifact_ref?.label, "PR #42");
});

test("internal service registry normalizes missing handler into needs_escalation shell", async () => {
  const registry = createInternalServiceRegistry();

  const result = await registry.execute("dispatch", {
    action_name: "dispatch",
    resolved_project_id: "demo-acr",
    workflow: "dispatch",
    parameters: null,
    trace_id: "trace-2",
    reply_target: null,
  });

  assert.equal(result.status, "needs_escalation");
  assert.equal(result.result_kind, "needs_escalation");
  assert.equal(result.summary, null);
  assert.equal(result.artifact_ref, null);
  assert.match(String(result.escalation_reason), /No internal service registered/);
});
