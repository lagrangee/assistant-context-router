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

function makeEnvelope(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

test("business notification delivery plan resolves Feishu chat targets from direct and workflow bindings", () => {
  const cases = [
    {
      name: "direct reply target",
      input: {
        notification: baseNotification,
        envelope: makeEnvelope(),
      },
      targetRef: "oc_1234567890",
    },
    {
      name: "workflow default reply target",
      input: {
        notification: baseNotification,
        envelope: makeEnvelope({
          channel_type: "unknown",
          reply_target: null,
        }),
        defaultReplyTarget: {
          channel_type: "feishu",
          target_kind: "channel",
          target_id: "oc_dispatchlive123",
          visibility: "system_facing",
          reply_mode: "direct",
        },
      },
      targetRef: "oc_dispatchlive123",
    },
  ];

  for (const testCase of cases) {
    const plan = buildBusinessNotificationDeliveryPlan(testCase.input);

    assert.equal(plan.deliverable, true, testCase.name);
    assert.equal(plan.error_reason, null, testCase.name);
    assert.equal(plan.seed.channel_type, "feishu", testCase.name);
    assert.equal(plan.seed.target_kind, "chat", testCase.name);
    assert.equal(plan.seed.target_ref, testCase.targetRef, testCase.name);
    assert.equal(plan.seed.delivery_mode, "channel_message", testCase.name);
    assert.match(plan.seed.rendered_message, /ACR business notification/, testCase.name);
  }
});

test("business notification delivery plan falls back to record_only for unsupported targets", () => {
  const cases = [
    {
      name: "symbolic Feishu thread ref",
      input: {
        notification: baseNotification,
        envelope: makeEnvelope({
          reply_target: {
            target_kind: "channel",
            target_id: "feishu:thread:demo-dispatch-1",
            visibility: "system_facing",
            reply_mode: "direct",
          },
        }),
      },
      targetRef: "feishu:thread:demo-dispatch-1",
      error: /record_only:unsupported_feishu_reply_target/,
    },
    {
      name: "unsupported workflow binding transport",
      input: {
        notification: baseNotification,
        envelope: makeEnvelope({
          channel_type: "unknown",
          reply_target: null,
        }),
        defaultReplyTarget: {
          channel_type: "discord",
          target_kind: "channel",
          target_id: "discord:channel:dispatch",
          visibility: "system_facing",
          reply_mode: "direct",
        },
      },
      targetRef: "discord:channel:dispatch",
      error: /record_only:unsupported_notification_channel:discord/,
    },
  ];

  for (const testCase of cases) {
    const plan = buildBusinessNotificationDeliveryPlan(testCase.input);

    assert.equal(plan.deliverable, false, testCase.name);
    assert.equal(plan.seed.channel_type, null, testCase.name);
    assert.equal(plan.seed.target_ref, testCase.targetRef, testCase.name);
    assert.match(String(plan.error_reason), testCase.error, testCase.name);
  }
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

test("business notification delivery plan can target configured human DM", () => {
  const plan = buildBusinessNotificationDeliveryPlan({
    notification: {
      ...baseNotification,
      action_name: "complete",
      workflow: "dispatch",
    },
    envelope: makeEnvelope({
      source_type: "agent",
      channel_type: "unknown",
      action_name: "complete",
      parameters: { task_record_id: "rec-task-1" },
      reply_target: null,
      trace_id: "trace-complete-1",
      raw_message_ref: "msg-complete-1",
    }),
    defaultReplyTarget: {
      channel_type: "feishu",
      target_kind: "channel",
      target_id: "oc_dispatchlive123",
      visibility: "system_facing",
      reply_mode: "direct",
    },
    defaultDeliveryTarget: {
      channel_type: "wechat",
      target_kind: "dm",
      target_ref: "local:human_dm",
      delivery_mode: "direct",
    },
  });

  assert.equal(plan.deliverable, true);
  assert.equal(plan.error_reason, null);
  assert.equal(plan.seed.channel_type, "wechat");
  assert.equal(plan.seed.target_kind, "dm");
  assert.equal(plan.seed.target_ref, "local:human_dm");
  assert.equal(plan.seed.delivery_mode, "direct");
});
