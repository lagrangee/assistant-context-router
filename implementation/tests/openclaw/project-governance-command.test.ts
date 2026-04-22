import test from "node:test";
import assert from "node:assert/strict";

import { handleProjectGovernanceCommand } from "../../adapters/openclaw/plugin/src/commands/project-governance.ts";
import { buildGovernanceDeliverySeed } from "../../core/src/routing/governance-delivery.ts";
import { createGovernanceDeliveryOutbox } from "../../core/src/state/governance-delivery-outbox.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("project-governance command uses current session project by default", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  const outbox = createGovernanceDeliveryOutbox({
    dataDir: workspace.dataDir,
    now: () => new Date("2026-04-21T12:00:00.000Z"),
  });

  await store.set("session:governance", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  await outbox.upsertPending(
    buildGovernanceDeliverySeed({
      escalation: {
        escalation_id: "escalation:proj-sample:block-1",
        created_at: "2026-04-21T11:59:00.000Z",
        updated_at: "2026-04-21T11:59:00.000Z",
        canonical_session_key: "session:governance",
        project_id: "proj-sample",
        signal_kind: "blocked",
        source: "service_result",
        target: "main_session",
        status: "open",
        reason: "blocked_human_decision_required_project_owner_approval",
        summary: "Waiting for project owner approval",
        trace_id: "trace-proj-sample-1",
        action_name: "dispatch",
        workflow: "dispatch",
        run_id: "run-proj-sample-1",
        queue_ref: "queue-proj-sample-1",
        artifact_ref: null,
        resolution: null,
      },
      binding: {
        channel_type: "wechat",
        target_kind: "dm",
        target_ref: "local:human_dm",
        delivery_mode: "direct",
      },
    }),
  );

  const result = await handleProjectGovernanceCommand({
    registryPath: workspace.registryPath,
    store,
    sessionKey: "session:governance",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /Governance outbox: proj-sample/);
  assert.match(result.content, /Pending records: 1/);
  assert.match(result.content, /Current target: wechat\/dm\/local:human_dm/);
  assert.match(result.content, /These are delivery mirrors\/outbox records, not governance truth\./);
  assert.match(result.content, /Waiting for project owner approval/);
});

test("project-governance command accepts explicit project id and shows empty state", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleProjectGovernanceCommand({
    registryPath: workspace.registryPath,
    store,
    projectId: "proj-openclaw-feishu-orchestrator",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /Governance outbox: proj-openclaw-feishu-orchestrator/);
  assert.match(result.content, /Latest delivery: none/);
  assert.match(result.content, /No governance delivery records found yet/);
});

test("project-governance command does not count delivered records as pending", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  const outbox = createGovernanceDeliveryOutbox({
    dataDir: workspace.dataDir,
    now: () => new Date("2026-04-21T12:05:00.000Z"),
  });

  const pending = await outbox.upsertPending(
    buildGovernanceDeliverySeed({
      escalation: {
        escalation_id: "escalation:proj-sample:blocked:dispatch:approval",
        created_at: "2026-04-21T12:04:00.000Z",
        updated_at: "2026-04-21T12:04:00.000Z",
        canonical_session_key: "session:governance",
        project_id: "proj-sample",
        signal_kind: "blocked",
        source: "service_result",
        target: "main_session",
        status: "open",
        reason: "blocked_human_decision_required_project_owner_approval",
        summary: "Dispatch is blocked until project owner approval is granted",
        trace_id: "proj-sample-blocked-human-decision-002",
        action_name: "dispatch",
        workflow: "dispatch",
        run_id: "run-proj-sample-2",
        queue_ref: "queue-proj-sample-2",
        artifact_ref: null,
        resolution: null,
      },
      binding: {
        channel_type: "wechat",
        target_kind: "dm",
        target_ref: "local:human_dm",
        delivery_mode: "direct",
      },
    }),
  );

  await outbox.markDelivery({
    deliveryId: pending.delivery_id,
    status: "delivered",
    runtimeTargetId: "agent:main:main",
  });

  const result = await handleProjectGovernanceCommand({
    registryPath: workspace.registryPath,
    store,
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /Governance outbox: proj-sample/);
  assert.match(result.content, /Pending records: 0/);
  assert.match(result.content, /delivered \| wechat\/dm\/local:human_dm/);
  assert.match(result.content, /runtime_target: agent:main:main/);
});
