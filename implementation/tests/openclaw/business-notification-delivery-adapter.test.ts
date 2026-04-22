import test from "node:test";
import assert from "node:assert/strict";

import { createOpenClawFeishuBusinessNotificationDeliveryAdapter } from "../../adapters/openclaw/runtime/src/business-notification-delivery.ts";

test("business notification delivery adapter sends chat messages via lark-cli im", async () => {
  const calls: string[][] = [];
  const adapter = createOpenClawFeishuBusinessNotificationDeliveryAdapter({
    runner: {
      async run(args) {
        calls.push(args);
        return {
          data: {
            message_id: "om_sent_123",
          },
        };
      },
    },
  });

  const result = await adapter({
    delivery_id: "business_notification_delivery:test:1",
    created_at: "2026-04-21T12:00:00.000Z",
    updated_at: "2026-04-21T12:00:00.000Z",
    notification_id: "notification:test:1",
    project_id: "demo-acr",
    signal_kind: "high_signal_completion",
    trace_id: "trace-demo-1",
    action_name: "dispatch",
    workflow: "dispatch",
    reason: "service_result_ok",
    summary: "Dispatch accepted for demo-acr",
    artifact_ref: null,
    channel_type: "feishu",
    target_kind: "chat",
    target_ref: "oc_1234567890",
    delivery_mode: "channel_message",
    rendered_message: "ACR business notification",
    status: "pending",
    runtime_target_id: null,
    error_reason: null,
    trace_patch: null,
  });

  assert.equal(result.status, "delivered");
  assert.equal(result.runtime_target_id, "om_sent_123");
  assert.deepEqual(calls[0], [
    "im",
    "+messages-send",
    "--as",
    "bot",
    "--chat-id",
    "oc_1234567890",
    "--text",
    "ACR business notification",
    "--idempotency-key",
    "business_notification_delivery:test:1",
  ]);
});

test("business notification delivery adapter replies in thread for message targets", async () => {
  const calls: string[][] = [];
  const adapter = createOpenClawFeishuBusinessNotificationDeliveryAdapter({
    runner: {
      async run(args) {
        calls.push(args);
        return {};
      },
    },
  });

  const result = await adapter({
    delivery_id: "business_notification_delivery:test:2",
    created_at: "2026-04-21T12:01:00.000Z",
    updated_at: "2026-04-21T12:01:00.000Z",
    notification_id: "notification:test:2",
    project_id: "demo-acr",
    signal_kind: "review_request",
    trace_id: "trace-demo-2",
    action_name: "review",
    workflow: "review",
    reason: "review_required",
    summary: "Review requires human reviewer",
    artifact_ref: null,
    channel_type: "feishu",
    target_kind: "message",
    target_ref: "om_1234567890",
    delivery_mode: "thread_reply",
    rendered_message: "ACR business notification",
    status: "pending",
    runtime_target_id: null,
    error_reason: null,
    trace_patch: null,
  });

  assert.equal(result.status, "delivered");
  assert.deepEqual(calls[0], [
    "im",
    "+messages-reply",
    "--as",
    "bot",
    "--message-id",
    "om_1234567890",
    "--reply-in-thread",
    "--text",
    "ACR business notification",
    "--idempotency-key",
    "business_notification_delivery:test:2",
  ]);
});

test("business notification delivery adapter keeps record_only fallback for unsupported targets", async () => {
  let called = false;
  const adapter = createOpenClawFeishuBusinessNotificationDeliveryAdapter({
    runner: {
      async run() {
        called = true;
        return {};
      },
    },
  });

  const result = await adapter({
    delivery_id: "business_notification_delivery:test:3",
    created_at: "2026-04-21T12:02:00.000Z",
    updated_at: "2026-04-21T12:02:00.000Z",
    notification_id: "notification:test:3",
    project_id: "demo-acr",
    signal_kind: "blocked",
    trace_id: "trace-demo-3",
    action_name: "dispatch",
    workflow: "dispatch",
    reason: "blocked_human_decision_required_project_owner_approval",
    summary: "Dispatch is blocked until project owner approval is granted",
    artifact_ref: null,
    channel_type: null,
    target_kind: null,
    target_ref: null,
    delivery_mode: null,
    rendered_message: "ACR business notification",
    status: "record_only",
    runtime_target_id: null,
    error_reason: "record_only:no_feishu_reply_target",
    trace_patch: null,
  });

  assert.equal(result.status, "record_only");
  assert.equal(called, false);
});
