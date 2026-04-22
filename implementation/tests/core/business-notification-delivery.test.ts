import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessNotificationDeliveryPlan,
  deriveBusinessNotificationDeliveryDedupKey,
} from "../../core/src/routing/business-notification-delivery.ts";

const baseNotification = {
  notification_id: "notification:test:dispatch:1",
  created_at: "2026-04-21T12:00:00.000Z",
  project_id: "demo-acr",
  signal_kind: "high_signal_completion" as const,
  source: "service_result" as const,
  trace_id: "trace-demo-1",
  action_name: "dispatch",
  workflow: "dispatch" as const,
  reason: "service_result_ok",
  summary: "Dispatch accepted for demo-acr",
  run_id: "run-demo-1",
  queue_ref: "queue-demo-1",
  artifact_ref: {
    kind: "pull_request",
    label: "PR #42",
    target: "https://example.test/pr/42",
  },
  status: "recorded" as const,
};

test("business notification delivery plan resolves deliverable Feishu chat targets", () => {
  const plan = buildBusinessNotificationDeliveryPlan({
    notification: baseNotification,
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: null,
      reply_target: {
        target_kind: "channel",
        target_id: "oc_1234567890",
        visibility: "system_facing",
        reply_mode: "direct",
      },
      trace_id: "trace-demo-1",
      workflow: "dispatch",
      raw_message_ref: "msg-demo-1",
      text: null,
    },
  });

  assert.equal(plan.deliverable, true);
  assert.equal(plan.error_reason, null);
  assert.equal(plan.seed.channel_type, "feishu");
  assert.equal(plan.seed.target_kind, "chat");
  assert.equal(plan.seed.target_ref, "oc_1234567890");
  assert.equal(plan.seed.delivery_mode, "channel_message");
  assert.match(plan.seed.rendered_message, /ACR business notification/);
});

test("business notification delivery plan falls back to record_only for unsupported symbolic thread refs", () => {
  const plan = buildBusinessNotificationDeliveryPlan({
    notification: baseNotification,
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: null,
      reply_target: {
        target_kind: "channel",
        target_id: "feishu:thread:demo-dispatch-1",
        visibility: "system_facing",
        reply_mode: "direct",
      },
      trace_id: "trace-demo-1",
      workflow: "dispatch",
      raw_message_ref: "msg-demo-1",
      text: null,
    },
  });

  assert.equal(plan.deliverable, false);
  assert.match(String(plan.error_reason), /record_only:unsupported_feishu_reply_target/);
  assert.equal(plan.seed.channel_type, null);
  assert.equal(plan.seed.target_ref, "feishu:thread:demo-dispatch-1");
});

test("business notification dedupe key remains stable for record_only fallback", () => {
  assert.equal(
    deriveBusinessNotificationDeliveryDedupKey({
      notificationId: "notification:test:dispatch:1",
      targetRef: null,
      deliveryMode: null,
    }),
    deriveBusinessNotificationDeliveryDedupKey({
      notificationId: "notification:test:dispatch:1",
      targetRef: null,
      deliveryMode: null,
    }),
  );
});

test("business notification delivery plan falls back to workflow binding target when reply_target is absent", () => {
  const plan = buildBusinessNotificationDeliveryPlan({
    notification: baseNotification,
    envelope: {
      source_type: "automation",
      channel_type: "unknown",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: null,
      reply_target: null,
      trace_id: "trace-demo-1",
      workflow: "dispatch",
      raw_message_ref: "msg-demo-1",
      text: null,
    },
    defaultReplyTarget: {
      channel_type: "feishu",
      target_kind: "channel",
      target_id: "oc_dispatchlive123",
      visibility: "system_facing",
      reply_mode: "direct",
    },
  });

  assert.equal(plan.deliverable, true);
  assert.equal(plan.error_reason, null);
  assert.equal(plan.seed.channel_type, "feishu");
  assert.equal(plan.seed.target_kind, "chat");
  assert.equal(plan.seed.target_ref, "oc_dispatchlive123");
});

test("business notification delivery plan keeps record_only for unsupported workflow binding transport", () => {
  const plan = buildBusinessNotificationDeliveryPlan({
    notification: baseNotification,
    envelope: {
      source_type: "automation",
      channel_type: "unknown",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: null,
      reply_target: null,
      trace_id: "trace-demo-1",
      workflow: "dispatch",
      raw_message_ref: "msg-demo-1",
      text: null,
    },
    defaultReplyTarget: {
      channel_type: "discord",
      target_kind: "channel",
      target_id: "discord:channel:dispatch",
      visibility: "system_facing",
      reply_mode: "direct",
    },
  });

  assert.equal(plan.deliverable, false);
  assert.equal(plan.seed.channel_type, null);
  assert.equal(plan.seed.target_ref, "discord:channel:dispatch");
  assert.match(String(plan.error_reason), /record_only:unsupported_notification_channel:discord/);
});
