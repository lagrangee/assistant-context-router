import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createAssistantContextRouterPlugin } from "../../adapters/openclaw/plugin/src/index.ts";
import { writeFeishuAdapterConfigFile } from "../../adapters/feishu/src/config-host.ts";
import { projectSessionEventPath } from "../../core/src/routing/project-session-lane.ts";
import { readBusinessNotificationDeliveryRecords } from "../../core/src/state/business-notification-delivery-outbox.ts";
import { readGovernanceDeliveryRecords } from "../../core/src/state/governance-delivery-outbox.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { makeTempProjectWorkspace, writeRuntimeBindingsConfig } from "../test-helpers.ts";

test("llm_output captures pending semantic complete boundary and routes it through writeback", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  complete:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
`,
  );

  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("agent:main:main", {
    pending_semantic_execution: {
      created_at: "2026-04-26T13:00:00.000Z",
      project_id: "proj-sample",
      action_name: "dispatch",
      workflow: "dispatch",
      trace_id: "trace-semantic-dispatch-001",
      task_record_id: "rec-task-semantic-loop",
      bug_record_id: null,
    },
  });

  const serviceRequests: unknown[] = [];
  const writebacks: Array<{
    projectId: string;
    actionName: string | null;
    taskRecordId: unknown;
    workSurfaceAction: unknown;
  }> = [];
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceHandlers: {
      complete: async (request) => {
        serviceRequests.push(request);
        return {
          status: "ok",
          result_kind: "accepted",
          work_surface_action: "complete",
          summary: String(request.parameters?.summary ?? "completed"),
          reply_payload: "Completion boundary accepted",
          needs_escalation: false,
          escalation_reason: null,
        };
      },
    },
    taskBugWritebackObserver: async (input) => {
      writebacks.push({
        projectId: input.projectId,
        actionName: input.envelope.action_name,
        taskRecordId: input.envelope.parameters?.task_record_id,
        workSurfaceAction: input.serviceResult.work_surface_action,
      });
    },
  });

  const handlers = new Map<
    string,
    (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>
  >();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const llmOutput = handlers.get("llm_output");
  assert.ok(llmOutput);

  await llmOutput(
    {
      assistantTexts: [
        [
          "Work reached the completion boundary.",
          "",
          "[ACR_AUTOMATION]",
          JSON.stringify(
            {
              channel: "openclaw",
              payload: {
                source_type: "agent",
                project_id: "proj-sample",
                action_name: "complete",
                workflow: "dispatch",
                parameters: {
                  task_record_id: "rec-task-semantic-loop",
                  summary: "Semantic work finished automatically.",
                  evidence: "The main session completed the requested semantic work.",
                },
                trace_id: "semantic-complete-trace-001",
                message_id: "semantic-complete-msg-001",
              },
            },
            null,
            2,
          ),
          "[/ACR_AUTOMATION]",
        ].join("\n"),
      ],
    },
    { sessionKey: "agent:main:main" },
  );

  assert.equal(serviceRequests.length, 1);
  assert.equal(writebacks.length, 1);
  assert.deepEqual(writebacks[0], {
    projectId: "proj-sample",
    actionName: "complete",
    taskRecordId: "rec-task-semantic-loop",
    workSurfaceAction: "complete",
  });

  const state = await store.get("agent:main:main");
  assert.equal(state?.pending_semantic_execution, null);
});

test("llm_output completion boundary uses row completion DM policy without creating governance truth", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  complete:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
`,
  );
  await writeFeishuAdapterConfigFile({
    dataDir: workspace.dataDir,
    template: {
      governanceTarget: {
        target_ref: "local:human_dm",
      },
    },
  });
  const runtimeBindingsPath = await writeRuntimeBindingsConfig({
    root: workspace.root,
    bindings: [
      {
        binding_id: "human-dm",
        runtime_kind: "openclaw",
        canonical_session_key: "main:human",
        aliases: ["wechat:dm:human"],
      },
    ],
    channelTargets: [
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
  });

  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("agent:main:main", {
    pending_semantic_execution: {
      created_at: "2026-04-26T13:00:00.000Z",
      project_id: "proj-sample",
      action_name: "dispatch",
      workflow: "dispatch",
      trace_id: "trace-semantic-dispatch-002",
      task_record_id: "rec-task-completion-dm",
      bug_record_id: null,
    },
  });

  const sentMessages: Array<{ to: string; text: string; accountId?: string | null }> = [];
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    runtimeBindingsPath,
    serviceHandlers: {
      complete: async (request) => ({
        status: "ok",
        result_kind: "accepted",
        work_surface_action: "complete",
        summary: String(request.parameters?.summary ?? "completed"),
        reply_payload: "Completion boundary accepted",
        needs_escalation: false,
        escalation_reason: null,
      }),
    },
    taskBugWritebackObserver: async () => ({
      mode: "apply",
      plans: [
        {
          kind: "task",
          record_id: "rec-task-completion-dm",
          operation: "updated",
          reason: "completion_boundary",
          status_before: "Doing",
          fields: {},
          policy: {
            acceptance_mode: "manual_acceptance",
            completion_notify_mode: "dm_on_completion_boundary",
            start_mode: "manual_only",
            acceptance_mode_source: "row_override",
            completion_notify_mode_source: "row_override",
            start_mode_source: "builtin_default",
            row_acceptance_mode: "manual_acceptance",
            row_completion_notify_mode: "dm_on_completion_boundary",
          },
        },
      ],
    }),
  });

  const handlers = new Map<
    string,
    (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>
  >();
  await plugin.register({
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
                sentMessages.push({
                  to: ctx.to,
                  text: ctx.text,
                  accountId: ctx.accountId,
                });
                return {
                  channel: "openclaw-direct-message",
                  messageId: "wx-msg-task-complete",
                };
              },
            };
          },
        },
      },
    },
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const llmOutput = handlers.get("llm_output");
  assert.ok(llmOutput);

  await llmOutput(
    {
      assistantTexts: [
        [
          "[ACR_AUTOMATION]",
          JSON.stringify({
            channel: "openclaw",
            payload: {
              source_type: "agent",
              project_id: "proj-sample",
              action_name: "complete",
              workflow: "dispatch",
              parameters: {
                task_record_id: "rec-task-completion-dm",
                summary: "Semantic work finished automatically.",
                evidence: "The main session completed the requested semantic work.",
              },
              trace_id: "semantic-complete-trace-002",
              message_id: "semantic-complete-msg-002",
            },
          }),
          "[/ACR_AUTOMATION]",
        ].join("\n"),
      ],
    },
    { sessionKey: "agent:main:main" },
  );

  const laneLog = await readFile(projectSessionEventPath("proj-sample", workspace.dataDir), "utf8");
  assert.match(laneLog, /"signal_kind":"high_signal_completion"/);

  const deliveries = await readBusinessNotificationDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]?.channel_type, "wechat");
  assert.equal(deliveries[0]?.target_kind, "dm");
  assert.equal(deliveries[0]?.target_ref, "local:human_dm");
  assert.equal(deliveries[0]?.status, "delivered");
  assert.equal(deliveries[0]?.runtime_target_id, "wx-msg-task-complete");
  assert.match(String(deliveries[0]?.rendered_message), /ACR business notification/);

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0]?.to, "user@example.invalid");
  assert.equal(sentMessages[0]?.accountId, "account-test");
  assert.match(String(sentMessages[0]?.text), /ACR business notification/);

  const governanceDeliveries = await readGovernanceDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(governanceDeliveries.length, 0);
});

test("llm_output completion boundary falls back to OpenClaw session when wechat direct send fails", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  complete:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
`,
  );
  await writeFeishuAdapterConfigFile({
    dataDir: workspace.dataDir,
    template: {
      governanceTarget: {
        target_ref: "local:human_dm",
      },
    },
  });
  const runtimeBindingsPath = await writeRuntimeBindingsConfig({
    root: workspace.root,
    bindings: [
      {
        binding_id: "human-dm",
        runtime_kind: "openclaw",
        canonical_session_key: "main:human",
        aliases: ["wechat:dm:human"],
      },
    ],
    channelTargets: [
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
  });

  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("agent:main:main", {
    pending_semantic_execution: {
      created_at: "2026-04-26T13:00:00.000Z",
      project_id: "proj-sample",
      action_name: "dispatch",
      workflow: "dispatch",
      trace_id: "trace-semantic-dispatch-003",
      task_record_id: "rec-task-completion-dm-fallback",
      bug_record_id: null,
    },
  });

  const directAttempts: Array<{ to: string; text: string; accountId?: string | null }> = [];
  const enqueuedEvents: Array<{
    text: string;
    sessionKey: string;
    contextKey?: string | null;
  }> = [];
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    runtimeBindingsPath,
    serviceHandlers: {
      complete: async (request) => ({
        status: "ok",
        result_kind: "accepted",
        work_surface_action: "complete",
        summary: String(request.parameters?.summary ?? "completed"),
        reply_payload: "Completion boundary accepted",
        needs_escalation: false,
        escalation_reason: null,
      }),
    },
    taskBugWritebackObserver: async () => ({
      mode: "apply",
      plans: [
        {
          kind: "task",
          record_id: "rec-task-completion-dm-fallback",
          operation: "updated",
          reason: "completion_boundary",
          status_before: "Doing",
          fields: {},
          policy: {
            acceptance_mode: "manual_acceptance",
            completion_notify_mode: "dm_on_completion_boundary",
            start_mode: "manual_only",
            acceptance_mode_source: "row_override",
            completion_notify_mode_source: "row_override",
            start_mode_source: "builtin_default",
            row_acceptance_mode: "manual_acceptance",
            row_completion_notify_mode: "dm_on_completion_boundary",
          },
        },
      ],
    }),
  });

  const handlers = new Map<
    string,
    (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>
  >();
  await plugin.register({
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
                directAttempts.push({
                  to: ctx.to,
                  text: ctx.text,
                  accountId: ctx.accountId,
                });
                throw new Error("sendMessage ret=-2: unknown error");
              },
            };
          },
        },
      },
      system: {
        enqueueSystemEvent(text, options) {
          enqueuedEvents.push({
            text,
            sessionKey: options.sessionKey,
            contextKey: options.contextKey,
          });
          return true;
        },
        async runHeartbeatOnce() {
          return { status: "ran", durationMs: 5 };
        },
      },
    },
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const llmOutput = handlers.get("llm_output");
  assert.ok(llmOutput);

  await llmOutput(
    {
      assistantTexts: [
        [
          "[ACR_AUTOMATION]",
          JSON.stringify({
            channel: "openclaw",
            payload: {
              source_type: "agent",
              project_id: "proj-sample",
              action_name: "complete",
              workflow: "dispatch",
              parameters: {
                task_record_id: "rec-task-completion-dm-fallback",
                summary: "Semantic work finished automatically.",
                evidence: "The main session completed the requested semantic work.",
              },
              trace_id: "semantic-complete-trace-003",
              message_id: "semantic-complete-msg-003",
            },
          }),
          "[/ACR_AUTOMATION]",
        ].join("\n"),
      ],
    },
    { sessionKey: "agent:main:main" },
  );

  assert.equal(directAttempts.length, 1);
  assert.equal(directAttempts[0]?.to, "user@example.invalid");
  assert.equal(directAttempts[0]?.accountId, "account-test");
  assert.equal(enqueuedEvents.length, 1);
  assert.equal(enqueuedEvents[0]?.sessionKey, "main:human");
  assert.equal(enqueuedEvents[0]?.contextKey, "acr:business_notification:proj-sample");
  assert.match(String(enqueuedEvents[0]?.text), /ACR business notification/);

  const deliveries = await readBusinessNotificationDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]?.status, "delivered");
  assert.equal(deliveries[0]?.runtime_target_id, "main:human");
  assert.equal(deliveries[0]?.trace_patch?.delivered_by, "openclaw_business_notification_session");
  assert.equal(deliveries[0]?.trace_patch?.primary_delivery_status, "failed");
  assert.match(String(deliveries[0]?.trace_patch?.primary_error_reason), /sendMessage ret=-2/);
});

test("llm_output bug completion boundary preserves fix_result and can notify configured human DM", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  complete:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
`,
  );
  await writeFeishuAdapterConfigFile({
    dataDir: workspace.dataDir,
    template: {
      governanceTarget: {
        target_ref: "local:human_dm",
      },
    },
  });
  const runtimeBindingsPath = await writeRuntimeBindingsConfig({
    root: workspace.root,
    bindings: [
      {
        binding_id: "human-dm",
        runtime_kind: "openclaw",
        canonical_session_key: "main:human",
        aliases: ["wechat:dm:human"],
      },
    ],
    channelTargets: [
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
  });

  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("agent:main:main", {
    pending_semantic_execution: {
      created_at: "2026-04-26T13:00:00.000Z",
      project_id: "proj-sample",
      action_name: "dispatch",
      workflow: "dispatch",
      trace_id: "trace-bug-semantic-dispatch-001",
      task_record_id: null,
      bug_record_id: "rec-bug-completion-dm",
    },
  });

  const serviceRequests: Array<{ parameters: Record<string, unknown> | null }> = [];
  const sentMessages: Array<{ to: string; text: string; accountId?: string | null }> = [];
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    runtimeBindingsPath,
    serviceHandlers: {
      complete: async (request) => {
        serviceRequests.push({
          parameters: request.parameters,
        });
        return {
          status: "ok",
          result_kind: "accepted",
          work_surface_action: "complete",
          summary: String(request.parameters?.summary ?? "completed"),
          reply_payload: "Completion boundary accepted",
          needs_escalation: false,
          escalation_reason: null,
        };
      },
    },
    taskBugWritebackObserver: async (input) => ({
      mode: "apply",
      plans: [
        {
          kind: "bug",
          record_id: String(input.envelope.parameters?.bug_record_id),
          operation: "updated",
          reason: "completion_boundary",
          status_before: "Fixing",
          fields: {
            状态: "Reviewing",
            current_step: "REVIEW_WAIT",
            step_result: "need_review",
            修复结果: input.envelope.parameters?.fix_result,
          },
          policy: {
            acceptance_mode: "manual_acceptance",
            completion_notify_mode: "dm_on_completion_boundary",
            start_mode: "manual_only",
            acceptance_mode_source: "row_override",
            completion_notify_mode_source: "row_override",
            start_mode_source: "builtin_default",
            row_acceptance_mode: "manual_acceptance",
            row_completion_notify_mode: "dm_on_completion_boundary",
          },
        },
      ],
    }),
  });

  const handlers = new Map<
    string,
    (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>
  >();
  await plugin.register({
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
                sentMessages.push({
                  to: ctx.to,
                  text: ctx.text,
                  accountId: ctx.accountId,
                });
                return {
                  channel: "openclaw-direct-message",
                  messageId: "wx-msg-bug-complete",
                };
              },
            };
          },
        },
      },
    },
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const llmOutput = handlers.get("llm_output");
  assert.ok(llmOutput);

  await llmOutput(
    {
      assistantTexts: [
        [
          "[ACR_AUTOMATION]",
          JSON.stringify({
            channel: "openclaw",
            payload: {
              source_type: "agent",
              project_id: "proj-sample",
              action_name: "complete",
              workflow: "dispatch",
              parameters: {
                summary: "Bug fix is ready for human acceptance.",
                evidence: "Regression evidence confirms the original repro is resolved.",
                fix_result: "Fixed",
              },
              trace_id: "semantic-bug-complete-trace-001",
              message_id: "semantic-bug-complete-msg-001",
            },
          }),
          "[/ACR_AUTOMATION]",
        ].join("\n"),
      ],
    },
    { sessionKey: "agent:main:main" },
  );

  assert.equal(serviceRequests.length, 1);
  assert.equal(serviceRequests[0]?.parameters?.bug_record_id, "rec-bug-completion-dm");
  assert.equal(serviceRequests[0]?.parameters?.fix_result, "Fixed");
  assert.equal(serviceRequests[0]?.parameters?.summary, "Bug fix is ready for human acceptance.");

  const laneLog = await readFile(projectSessionEventPath("proj-sample", workspace.dataDir), "utf8");
  assert.match(laneLog, /"signal_kind":"high_signal_completion"/);
  assert.match(laneLog, /"bug_record_id":"rec-bug-completion-dm"/);

  const deliveries = await readBusinessNotificationDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]?.channel_type, "wechat");
  assert.equal(deliveries[0]?.target_kind, "dm");
  assert.equal(deliveries[0]?.target_ref, "local:human_dm");
  assert.equal(deliveries[0]?.status, "delivered");
  assert.equal(deliveries[0]?.runtime_target_id, "wx-msg-bug-complete");
  assert.match(String(deliveries[0]?.rendered_message), /Bug fix is ready/);

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0]?.to, "user@example.invalid");
  assert.equal(sentMessages[0]?.accountId, "account-test");

  const governanceDeliveries = await readGovernanceDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(governanceDeliveries.length, 0);
});

test("llm_output ignores semantic boundary blocks when no pending execution exists", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  complete:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
`,
  );

  const serviceRequests: unknown[] = [];
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceHandlers: {
      complete: async (request) => {
        serviceRequests.push(request);
        return {
          status: "ok",
          result_kind: "accepted",
          work_surface_action: "complete",
          summary: "Should not run",
          reply_payload: "Should not run",
          needs_escalation: false,
          escalation_reason: null,
        };
      },
    },
    taskBugWritebackObserver: async () => {
      throw new Error("should-not-writeback-without-pending-execution");
    },
  });

  const handlers = new Map<
    string,
    (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>
  >();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const llmOutput = handlers.get("llm_output");
  assert.ok(llmOutput);

  await llmOutput(
    {
      assistantTexts: [
        [
          "[ACR_AUTOMATION]",
          JSON.stringify({
            channel: "openclaw",
            payload: {
              source_type: "agent",
              project_id: "proj-sample",
              action_name: "complete",
              workflow: "dispatch",
              parameters: {
                task_record_id: "rec-task-semantic-loop",
              },
              trace_id: "semantic-complete-trace-ignored",
              message_id: "semantic-complete-msg-ignored",
            },
          }),
          "[/ACR_AUTOMATION]",
        ].join("\n"),
      ],
    },
    { sessionKey: "agent:main:main" },
  );

  assert.equal(serviceRequests.length, 0);
});
