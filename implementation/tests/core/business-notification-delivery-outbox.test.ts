import test from "node:test";
import assert from "node:assert/strict";

import { createBusinessNotificationDeliveryOutbox } from "../../core/src/state/business-notification-delivery-outbox.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("business notification delivery outbox upserts and marks record_only", async () => {
  const workspace = await makeTempProjectWorkspace();
  const outbox = createBusinessNotificationDeliveryOutbox({
    dataDir: workspace.dataDir,
    now: () => new Date("2026-04-21T12:00:00.000Z"),
  });

  const pending = await outbox.upsertPending({
    notification_id: "notification:test:1",
    project_id: "proj-sample",
    signal_kind: "review_request",
    trace_id: "trace-proj-sample-1",
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

  assert.equal(pending.status, "pending");

  const updated = await outbox.markDelivery({
    deliveryId: pending.delivery_id,
    status: "record_only",
    errorReason: "record_only:no_feishu_reply_target",
  });

  assert.equal(updated?.status, "record_only");
  assert.equal(updated?.error_reason, "record_only:no_feishu_reply_target");

  const listed = await outbox.listByProject({ projectId: "proj-sample" });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.delivery_id, pending.delivery_id);
});
