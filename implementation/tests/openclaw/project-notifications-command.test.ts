import test from "node:test";
import assert from "node:assert/strict";

import { handleProjectNotificationsCommand } from "../../adapters/openclaw/plugin/src/commands/project-notifications.ts";
import { createBusinessNotificationDeliveryOutbox } from "../../core/src/state/business-notification-delivery-outbox.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("project-notifications command uses current session project by default", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  const outbox = createBusinessNotificationDeliveryOutbox({
    dataDir: workspace.dataDir,
    now: () => new Date("2026-04-21T12:10:00.000Z"),
  });

  await store.set("session:notifications", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  const pending = await outbox.upsertPending({
    notification_id: "notification:proj-sample:1",
    project_id: "proj-sample",
    signal_kind: "high_signal_completion",
    trace_id: "trace-proj-sample-1",
    action_name: "dispatch",
    workflow: "dispatch",
    reason: "service_result_ok",
    summary: "Dispatch accepted for proj-sample",
    artifact_ref: null,
    channel_type: "feishu",
    target_kind: "chat",
    target_ref: "oc_1234567890",
    delivery_mode: "channel_message",
    rendered_message: "ACR business notification",
  });

  await outbox.markDelivery({
    deliveryId: pending.delivery_id,
    status: "delivered",
    runtimeTargetId: "om_sent_123",
  });

  const result = await handleProjectNotificationsCommand({
    registryPath: workspace.registryPath,
    store,
    sessionKey: "session:notifications",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /Business notifications: proj-sample/);
  assert.match(result.content, /Pending records: 0/);
  assert.match(result.content, /Record-only records: 0/);
  assert.match(result.content, /Current target: feishu\/chat\/oc_1234567890/);
  assert.match(result.content, /runtime_target: om_sent_123/);
});

test("project-notifications command shows empty state for explicit project id", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleProjectNotificationsCommand({
    registryPath: workspace.registryPath,
    store,
    projectId: "proj-openclaw-feishu-orchestrator",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /Business notifications: proj-openclaw-feishu-orchestrator/);
  assert.match(result.content, /Latest delivery: none/);
  assert.match(result.content, /No business-notification delivery records found yet/);
});

test("project-notifications command counts record_only separately from pending", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  const outbox = createBusinessNotificationDeliveryOutbox({
    dataDir: workspace.dataDir,
    now: () => new Date("2026-04-21T12:11:00.000Z"),
  });

  const pending = await outbox.upsertPending({
    notification_id: "notification:proj-sample:record-only",
    project_id: "proj-sample",
    signal_kind: "review_request",
    trace_id: "trace-proj-sample-record-only",
    action_name: "review",
    workflow: "review",
    reason: "review_required",
    summary: "Review target is ready",
    artifact_ref: null,
    channel_type: null,
    target_kind: null,
    target_ref: null,
    delivery_mode: null,
    rendered_message: "ACR business notification",
  });

  await outbox.markDelivery({
    deliveryId: pending.delivery_id,
    status: "record_only",
    errorReason: "record_only:no_feishu_reply_target",
  });

  const result = await handleProjectNotificationsCommand({
    registryPath: workspace.registryPath,
    store,
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /Pending records: 0/);
  assert.match(result.content, /Record-only records: 1/);
  assert.match(result.content, /record_only \| record_only/);
});
