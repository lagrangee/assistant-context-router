import test from "node:test";
import assert from "node:assert/strict";

import {
  createOpenClawChannelBusinessNotificationDeliveryAdapter,
  createOpenClawFeishuBusinessNotificationDeliveryAdapter,
  createOpenClawSessionBusinessNotificationDeliveryAdapter,
  createOpenClawWechatBusinessNotificationDeliveryAdapter,
} from "../../adapters/openclaw/runtime/src/business-notification-delivery.ts";

function assertLarkIdempotencyKey(value: unknown) {
  assert.equal(typeof value, "string");
  assert.match(value, /^acr-[a-f0-9]{32}$/);
}

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
  assert.deepEqual(calls[0]?.slice(0, -1), [
    "im",
    "+messages-send",
    "--as",
    "bot",
    "--chat-id",
    "oc_1234567890",
    "--text",
    "ACR business notification",
    "--idempotency-key",
  ]);
  assertLarkIdempotencyKey(calls[0]?.at(-1));
  assert.notEqual(calls[0]?.at(-1), "business_notification_delivery:test:1");
  assert.equal(result.trace_patch?.lark_idempotency_key, calls[0]?.at(-1));
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
  assert.deepEqual(calls[0]?.slice(0, -1), [
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
  ]);
  assertLarkIdempotencyKey(calls[0]?.at(-1));
  assert.notEqual(calls[0]?.at(-1), "business_notification_delivery:test:2");
  assert.equal(result.trace_patch?.lark_idempotency_key, calls[0]?.at(-1));
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

test("business notification delivery adapter sends configured wechat DM via channel outbound", async () => {
  const sent: Array<{ to: string; text: string; accountId?: string | null }> = [];
  const adapter = createOpenClawChannelBusinessNotificationDeliveryAdapter({
    runtimeBindings: {
      channel_targets: [
        {
          binding_id: "human-dm",
          channel_type: "wechat",
          target_kind: "dm",
          target_ref: "user@example.invalid",
          delivery_mode: "direct",
          aliases: ["local:human_dm", "wechat:dm:human"],
          runtime_channel_id: "openclaw-direct-message",
          account_id: "account-test",
        },
      ],
    },
    runtime: {
      config: {
        loadConfig: () => ({}),
      },
      channel: {
        outbound: {
          async loadAdapter(id) {
            assert.equal(id, "openclaw-direct-message");
            return {
              async sendText(ctx) {
                sent.push({
                  to: ctx.to,
                  text: ctx.text,
                  accountId: ctx.accountId,
                });
                return {
                  channel: "openclaw-direct-message",
                  messageId: "wx-msg-123",
                };
              },
            };
          },
        },
      },
    },
  });

  const result = await adapter({
    delivery_id: "business_notification_delivery:test:4",
    created_at: "2026-04-21T12:03:00.000Z",
    updated_at: "2026-04-21T12:03:00.000Z",
    notification_id: "notification:test:4",
    project_id: "demo-acr",
    signal_kind: "high_signal_completion",
    trace_id: "trace-complete-1",
    action_name: "complete",
    workflow: "dispatch",
    reason: "completion boundary requested DM",
    summary: "Agent reached completion boundary",
    artifact_ref: null,
    channel_type: "wechat",
    target_kind: "dm",
    target_ref: "local:human_dm",
    delivery_mode: "direct",
    rendered_message: "ACR business notification",
    status: "pending",
    runtime_target_id: null,
    error_reason: null,
    trace_patch: null,
  });

  assert.equal(result.status, "delivered");
  assert.equal(result.runtime_target_id, "wx-msg-123");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], {
    to: "user@example.invalid",
    text: "ACR business notification",
    accountId: "account-test",
  });
  assert.equal(result.trace_patch?.delivered_by, "openclaw_channel_outbound");
});

test("business notification delivery adapter fails closed for unresolved symbolic wechat DM", async () => {
  const adapter = createOpenClawChannelBusinessNotificationDeliveryAdapter({
    runtimeBindings: {},
    runtime: {
      config: {
        loadConfig: () => ({}),
      },
      channel: {
        outbound: {
          async loadAdapter() {
            throw new Error("should-not-load-channel-for-unresolved-symbolic-target");
          },
        },
      },
    },
  });

  const result = await adapter({
    delivery_id: "business_notification_delivery:test:5",
    created_at: "2026-04-21T12:04:00.000Z",
    updated_at: "2026-04-21T12:04:00.000Z",
    notification_id: "notification:test:5",
    project_id: "demo-acr",
    signal_kind: "high_signal_completion",
    trace_id: "trace-complete-2",
    action_name: "complete",
    workflow: "dispatch",
    reason: "completion boundary requested DM",
    summary: "Agent reached completion boundary",
    artifact_ref: null,
    channel_type: "wechat",
    target_kind: "dm",
    target_ref: "local:human_dm",
    delivery_mode: "direct",
    rendered_message: "ACR business notification",
    status: "pending",
    runtime_target_id: null,
    error_reason: null,
    trace_patch: null,
  });

  assert.equal(result.status, "failed");
  assert.match(
    String(result.error_reason),
    /unresolved_business_notification_channel_target:local:human_dm/,
  );
});

test("business notification delivery adapter fails closed when wechat provider rejects send", async () => {
  const adapter = createOpenClawChannelBusinessNotificationDeliveryAdapter({
    runtimeBindings: {
      channel_targets: [
        {
          binding_id: "human-dm",
          channel_type: "wechat",
          target_kind: "dm",
          target_ref: "user@example.invalid",
          delivery_mode: "direct",
          aliases: ["local:human_dm"],
          runtime_channel_id: "openclaw-direct-message",
          account_id: "account-test",
        },
      ],
    },
    runtime: {
      config: {
        loadConfig: () => ({}),
      },
      channel: {
        outbound: {
          async loadAdapter() {
            return {
              async sendText() {
                throw new Error("sendMessage ret=-2: unknown error");
              },
            };
          },
        },
      },
    },
  });

  const result = await adapter({
    delivery_id: "business_notification_delivery:test:provider-reject",
    created_at: "2026-04-21T12:05:00.000Z",
    updated_at: "2026-04-21T12:05:00.000Z",
    notification_id: "notification:test:provider-reject",
    project_id: "demo-acr",
    signal_kind: "high_signal_completion",
    trace_id: "trace-complete-provider-reject",
    action_name: "complete",
    workflow: "dispatch",
    reason: "completion boundary requested DM",
    summary: "Agent reached completion boundary",
    artifact_ref: null,
    channel_type: "wechat",
    target_kind: "dm",
    target_ref: "local:human_dm",
    delivery_mode: "direct",
    rendered_message: "ACR business notification",
    status: "pending",
    runtime_target_id: null,
    error_reason: null,
    trace_patch: null,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.runtime_target_id, "user@example.invalid");
  assert.match(String(result.error_reason), /openclaw_channel_delivery_failed:sendMessage ret=-2/);
});

test("business notification delivery adapter falls back from rejected wechat direct send to OpenClaw session", async () => {
  const enqueued: Array<{ text: string; sessionKey: string; contextKey?: string | null }> = [];
  const heartbeatRuns: Array<{ reason?: string; sessionKey?: string; target?: string }> = [];
  const adapter = createOpenClawWechatBusinessNotificationDeliveryAdapter({
    runtimeBindings: {
      main_sessions: [
        {
          binding_id: "human-dm-session",
          runtime_kind: "openclaw",
          canonical_session_key: "agent:main:main",
          aliases: ["wechat:dm:human"],
        },
      ],
      channel_targets: [
        {
          binding_id: "human-dm",
          channel_type: "wechat",
          target_kind: "dm",
          target_ref: "user@example.invalid",
          delivery_mode: "direct",
          aliases: ["local:human_dm"],
          runtime_channel_id: "openclaw-direct-message",
          account_id: "account-test",
        },
      ],
    },
    runtime: {
      config: {
        loadConfig: () => ({}),
      },
      channel: {
        outbound: {
          async loadAdapter() {
            return {
              async sendText() {
                throw new Error("sendMessage ret=-2: unknown error");
              },
            };
          },
        },
      },
      system: {
        enqueueSystemEvent(text, options) {
          enqueued.push({
            text,
            sessionKey: options.sessionKey,
            contextKey: options.contextKey,
          });
          return true;
        },
        async runHeartbeatOnce(options) {
          heartbeatRuns.push({
            reason: options?.reason,
            sessionKey: options?.sessionKey,
            target: options?.heartbeat?.target,
          });
          return {
            status: "ran",
            durationMs: 11,
          };
        },
      },
    },
  });

  const result = await adapter({
    delivery_id: "business_notification_delivery:test:wechat-fallback",
    created_at: "2026-04-21T12:05:30.000Z",
    updated_at: "2026-04-21T12:05:30.000Z",
    notification_id: "notification:test:wechat-fallback",
    project_id: "demo-acr",
    signal_kind: "high_signal_completion",
    trace_id: "trace-complete-wechat-fallback",
    action_name: "complete",
    workflow: "dispatch",
    reason: "completion boundary requested DM",
    summary: "Agent reached completion boundary",
    artifact_ref: null,
    channel_type: "wechat",
    target_kind: "dm",
    target_ref: "local:human_dm",
    delivery_mode: "direct",
    rendered_message: "ACR business notification",
    status: "pending",
    runtime_target_id: null,
    error_reason: null,
    trace_patch: null,
  });

  assert.equal(result.status, "delivered");
  assert.equal(result.runtime_target_id, "agent:main:main");
  assert.equal(result.error_reason, null);
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0]?.sessionKey, "agent:main:main");
  assert.equal(enqueued[0]?.contextKey, "acr:business_notification:demo-acr");
  assert.equal(heartbeatRuns.length, 1);
  assert.equal(result.trace_patch?.delivered_by, "openclaw_business_notification_session");
  assert.equal(result.trace_patch?.primary_delivery_status, "failed");
  assert.match(String(result.trace_patch?.primary_error_reason), /sendMessage ret=-2/);
});

test("business notification delivery adapter can route configured wechat DM via OpenClaw session", async () => {
  const enqueued: Array<{ text: string; sessionKey: string; contextKey?: string | null }> = [];
  const heartbeatRuns: Array<{ reason?: string; sessionKey?: string; target?: string }> = [];
  const adapter = createOpenClawSessionBusinessNotificationDeliveryAdapter({
    runtimeBindings: {
      main_sessions: [
        {
          binding_id: "human-dm",
          runtime_kind: "openclaw",
          canonical_session_key: "main:human",
          aliases: ["wechat:dm:human"],
        },
      ],
    },
    runtime: {
      system: {
        enqueueSystemEvent(text, options) {
          enqueued.push({
            text,
            sessionKey: options.sessionKey,
            contextKey: options.contextKey,
          });
          return true;
        },
        async runHeartbeatOnce(options) {
          heartbeatRuns.push({
            reason: options?.reason,
            sessionKey: options?.sessionKey,
            target: options?.heartbeat?.target,
          });
          return {
            status: "ran",
            durationMs: 7,
          };
        },
      },
    },
  });

  const result = await adapter({
    delivery_id: "business_notification_delivery:test:6",
    created_at: "2026-04-21T12:03:00.000Z",
    updated_at: "2026-04-21T12:03:00.000Z",
    notification_id: "notification:test:6",
    project_id: "demo-acr",
    signal_kind: "high_signal_completion",
    trace_id: "trace-complete-1",
    action_name: "complete",
    workflow: "dispatch",
    reason: "completion boundary requested DM",
    summary: "Agent reached completion boundary",
    artifact_ref: null,
    channel_type: "wechat",
    target_kind: "dm",
    target_ref: "local:human_dm",
    delivery_mode: "direct",
    rendered_message: "ACR business notification",
    status: "pending",
    runtime_target_id: null,
    error_reason: null,
    trace_patch: null,
  });

  assert.equal(result.status, "delivered");
  assert.equal(result.runtime_target_id, "main:human");
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0]?.sessionKey, "main:human");
  assert.equal(enqueued[0]?.contextKey, "acr:business_notification:demo-acr");
  assert.match(String(enqueued[0]?.text), /Assistant Context Router business notification:/);
  assert.equal(heartbeatRuns.length, 1);
  assert.equal(heartbeatRuns[0]?.reason, "acr:business_notification_delivery");
});
