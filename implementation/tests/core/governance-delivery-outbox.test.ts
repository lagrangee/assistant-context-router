import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildGovernanceDeliverySeed } from "../../core/src/routing/governance-delivery.ts";
import { createGovernanceDeliveryOutbox } from "../../core/src/state/governance-delivery-outbox.ts";
import type { MainSessionEscalationRecord } from "../../core/src/types.ts";

function makeEscalation(summary: string): MainSessionEscalationRecord {
  return {
    escalation_id: "escalation:demo-acr|blocked",
    created_at: "2026-04-21T10:00:00.000Z",
    updated_at: "2026-04-21T10:00:00.000Z",
    canonical_session_key: "session:demo-acr",
    project_id: "demo-acr",
    signal_kind: "blocked",
    source: "service_result",
    target: "main_session",
    status: "open",
    reason: "blocked_human_decision_required_project_owner_approval",
    summary,
    trace_id: "trace-demo-acr-001",
    action_name: "dispatch",
    workflow: "dispatch",
    run_id: "run-demo-acr-001",
    queue_ref: "queue-demo-acr-001",
    artifact_ref: {
      kind: "approval_request",
      label: "Approval payload",
      target: "file:///tmp/approval.json",
    },
    resolution: null,
  };
}

test("governance delivery outbox upserts pending records by escalation and target", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "acr-governance-outbox-"));
  const outbox = createGovernanceDeliveryOutbox({
    dataDir,
    now: () => new Date("2026-04-21T10:00:00.000Z"),
  });

  const created = await outbox.upsertPending(
    buildGovernanceDeliverySeed({
      escalation: makeEscalation("First summary"),
      binding: {
        channel_type: "wechat",
        target_kind: "dm",
        target_ref: "local:human_dm",
        delivery_mode: "direct",
      },
    }),
  );

  const updatedOutbox = createGovernanceDeliveryOutbox({
    dataDir,
    now: () => new Date("2026-04-21T10:05:00.000Z"),
  });

  const updated = await updatedOutbox.upsertPending(
    buildGovernanceDeliverySeed({
      escalation: makeEscalation("Updated summary"),
      binding: {
        channel_type: "wechat",
        target_kind: "dm",
        target_ref: "local:human_dm",
        delivery_mode: "direct",
      },
    }),
  );

  assert.equal(created.delivery_id, updated.delivery_id);
  assert.equal(updated.summary, "Updated summary");
  assert.equal(updated.created_at, "2026-04-21T10:00:00.000Z");
  assert.equal(updated.updated_at, "2026-04-21T10:05:00.000Z");

  const records = await updatedOutbox.listByProject({
    projectId: "demo-acr",
  });
  assert.equal(records.length, 1);
  assert.equal(records[0]?.target_ref, "local:human_dm");
  assert.match(String(records[0]?.rendered_message), /Updated summary/);
});
