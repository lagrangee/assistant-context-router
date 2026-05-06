import assert from "node:assert/strict";
import test from "node:test";

import { createOpenClawMainSessionSemanticExecutor } from "../../adapters/openclaw/runtime/src/feishu-task-bug-semantic-executor.ts";
import {
  buildFeishuTaskBugExecutionEnvelope,
  type FeishuTaskBugExecutionContext,
  type FeishuTaskBugSemanticExecutorInput,
} from "../../adapters/feishu/src/task-bug-semantic-service-bridge.ts";

function makeContext(
  overrides: Partial<FeishuTaskBugExecutionContext> = {},
): FeishuTaskBugExecutionContext {
  return {
    kind: "task",
    record_id: "rec-task-semantic-main",
    status: "Doing",
    headline: "Implement real semantic executor",
    project: "proj-assistant-context-router",
    priority: "P1",
    assignee: "Codex",
    acceptance_mode: "人工验收",
    completion_notify_mode: "完成边界不提醒",
    next_action: "Wire main session mediated executor",
    business_fields: {
      title: "Implement real semantic executor",
      dod: "Main session receives card context and sends complete when done",
      description: "Use ACR itself as the first semantic execution user",
      due_date: "2026/04/30",
    },
    work_surface_origin: {
      source_system: "feishu_base",
      surface_kind: "project_management",
      adapter: "feishu_task_bug_semantic",
      identity: "bot",
      config_path: "/tmp/acr/feishu-adapter.yaml",
      base_ref: "feishu_adapter_config",
      table_id: "tbl-tasks",
      table_name: "Tasks",
      record_id: "rec-task-semantic-main",
    },
    raw_fields: {},
    ...overrides,
  };
}

function makeExecutorInput(
  overrides: Partial<FeishuTaskBugSemanticExecutorInput["request"]> = {},
): FeishuTaskBugSemanticExecutorInput {
  const request = {
    action_name: "dispatch",
    resolved_project_id: "proj-assistant-context-router",
    workflow: "dispatch",
    parameters: {
      task_record_id: "rec-task-semantic-main",
    },
    trace_id: "trace-semantic-main-001",
    reply_target: null,
    ...overrides,
  };
  const contexts = [makeContext()];
  return {
    binding: {
      runtime_kind: "feishu_task_bug_semantic",
      target_ref: "main",
      metadata: null,
    },
    request,
    contexts,
    execution_envelope: buildFeishuTaskBugExecutionEnvelope({
      request,
      contexts,
      projectRoot:
        "<repo-root>",
    }),
  };
}

test("openclaw main-session semantic executor queues dispatch context to canonical main session", async () => {
  const events: Array<{
    text: string;
    options: {
      sessionKey: string;
      contextKey?: string | null;
      deliveryContext?: Record<string, unknown>;
      trusted?: boolean;
    };
  }> = [];
  const heartbeatCalls: unknown[] = [];
  const storePatches: Array<{
    sessionKey: string;
    patch: Record<string, unknown>;
  }> = [];
  const executor = createOpenClawMainSessionSemanticExecutor({
    runtimeBindings: {
      main_sessions: [
        {
          binding_id: "main",
          runtime_kind: "openclaw_session",
          canonical_session_key: "agent:main:main",
          aliases: ["main"],
          metadata: null,
        },
      ],
    },
    store: {
      async get() {
        return null;
      },
      async set(sessionKey, patch) {
        storePatches.push({ sessionKey, patch });
        return {} as never;
      },
      async clear() {},
      async invalidate() {
        return {} as never;
      },
      async cleanup() {},
    },
    runtime: {
      system: {
        enqueueSystemEvent(text, options) {
          events.push({ text, options });
          return true;
        },
        async runHeartbeatOnce(options) {
          heartbeatCalls.push(options);
          return { status: "ran", durationMs: 12 };
        },
      },
    },
  });

  const result = await executor(makeExecutorInput());

  assert.equal(result.status, "ok");
  assert.equal(result.result_kind, "queued");
  assert.equal(result.work_surface_action, "dispatch");
  assert.equal(result.queue_ref, "openclaw:agent:main:main:trace-semantic-main-001");
  assert.equal(result.trace_patch?.target_session_key, "agent:main:main");
  assert.equal(result.trace_patch?.heartbeat_status, "requested");
  assert.equal(result.trace_patch?.heartbeat_mode, "run_once_async");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.options.sessionKey, "agent:main:main");
  assert.equal(events[0]?.options.contextKey, "acr:semantic:proj-assistant-context-router");
  assert.equal(events[0]?.options.trusted, true);
  assert.match(events[0]?.text ?? "", /Assistant Context Router semantic execution request/);
  assert.match(events[0]?.text ?? "", /Implement real semantic executor/);
  assert.match(events[0]?.text ?? "", /work_surface_origin/);
  assert.match(events[0]?.text ?? "", /feishu_base/);
  assert.match(events[0]?.text ?? "", /missing_context/);
  assert.match(events[0]?.text ?? "", /action_name=complete/);
  assert.match(events[0]?.text ?? "", /completion_boundary_schema/);
  assert.match(events[0]?.text ?? "", /summary/);
  assert.match(events[0]?.text ?? "", /evidence/);
  assert.doesNotMatch(events[0]?.text ?? "", /suggested_complete_message/);
  assert.equal(heartbeatCalls.length, 1);
  assert.equal(storePatches.length, 1);
  assert.equal(storePatches[0]?.sessionKey, "agent:main:main");
  const pending = storePatches[0]?.patch.pending_semantic_execution as
    | { created_at: string }
    | undefined;
  assert.equal(typeof pending?.created_at, "string");
  assert.deepEqual(storePatches[0]?.patch.pending_semantic_execution, {
    created_at: pending?.created_at,
    project_id: "proj-assistant-context-router",
    action_name: "dispatch",
    workflow: "dispatch",
    trace_id: "trace-semantic-main-001",
    task_record_id: "rec-task-semantic-main",
    bug_record_id: null,
    adapter_facts: {
      source: "external work-surface semantic context",
      adapter: "feishu_task_bug_semantic",
      pending_semantic_execution: true,
      original_parameters: {
        task_record_id: "rec-task-semantic-main",
      },
    },
    execution_contexts: [
      {
        kind: "task",
        record_id: "rec-task-semantic-main",
        status: "Doing",
        headline: "Implement real semantic executor",
        project: "proj-assistant-context-router",
        priority: "P1",
        assignee: "Codex",
        acceptance_mode: "人工验收",
        completion_notify_mode: "完成边界不提醒",
        next_action: "Wire main session mediated executor",
        business_fields: {
          title: "Implement real semantic executor",
          dod: "Main session receives card context and sends complete when done",
          description: "Use ACR itself as the first semantic execution user",
          due_date: "2026/04/30",
        },
        work_surface_origin: {
          source_system: "feishu_base",
          surface_kind: "project_management",
          adapter: "feishu_task_bug_semantic",
          identity: "bot",
          config_path: "/tmp/acr/feishu-adapter.yaml",
          base_ref: "feishu_adapter_config",
          table_id: "tbl-tasks",
          table_name: "Tasks",
          record_id: "rec-task-semantic-main",
        },
      },
    ],
  });
});

test("openclaw main-session semantic executor requests heartbeat without awaiting run-once when available", async () => {
  const events: string[] = [];
  const heartbeatRequests: unknown[] = [];
  const runOnceCalls: unknown[] = [];
  const executor = createOpenClawMainSessionSemanticExecutor({
    runtimeBindings: {
      main_sessions: [
        {
          binding_id: "main",
          runtime_kind: "openclaw_session",
          canonical_session_key: "agent:main:main",
          aliases: ["main"],
          metadata: null,
        },
      ],
    },
    runtime: {
      system: {
        enqueueSystemEvent(text) {
          events.push(text);
          return true;
        },
        async runHeartbeatOnce(options) {
          runOnceCalls.push(options);
          return { status: "ran", durationMs: 10_000 };
        },
        requestHeartbeatNow(options) {
          heartbeatRequests.push(options);
        },
      },
    },
  });

  const result = await executor(makeExecutorInput());

  assert.equal(result.status, "ok");
  assert.equal(result.result_kind, "queued");
  assert.equal(result.trace_patch?.heartbeat_status, "requested");
  assert.equal(events.length, 1);
  assert.equal(heartbeatRequests.length, 1);
  assert.equal(runOnceCalls.length, 0);
});

test("openclaw main-session semantic executor asks bug completions to include fix_result", async () => {
  const events: Array<{ text: string }> = [];
  const executor = createOpenClawMainSessionSemanticExecutor({
    runtimeBindings: {
      main_sessions: [
        {
          binding_id: "main",
          runtime_kind: "openclaw_session",
          canonical_session_key: "agent:main:main",
          aliases: ["main"],
          metadata: null,
        },
      ],
    },
    runtime: {
      system: {
        enqueueSystemEvent(text) {
          events.push({ text });
          return true;
        },
      },
    },
  });

  const input = makeExecutorInput({
    parameters: {
      bug_record_id: "rec-bug-semantic-main",
    },
  });
  input.contexts = [
    makeContext({
      kind: "bug",
      record_id: "rec-bug-semantic-main",
      status: "Fixing",
      headline: "Classify bug completion",
      business_fields: {
        description: "Bug completion should classify the proposed result",
      },
    }),
  ];
  input.execution_envelope = buildFeishuTaskBugExecutionEnvelope({
    request: input.request,
    contexts: input.contexts,
    projectRoot:
      "<repo-root>",
  });

  const result = await executor(input);

  assert.equal(result.status, "ok");
  assert.equal(events.length, 1);
  assert.match(events[0]?.text ?? "", /fix_result/);
  assert.match(events[0]?.text ?? "", /Fixed/);
  assert.match(events[0]?.text ?? "", /Won't fix/);
  assert.match(events[0]?.text ?? "", /Can't rep/);
});

test("openclaw main-session semantic executor passes complete boundary through without enqueueing", async () => {
  const events: string[] = [];
  const executor = createOpenClawMainSessionSemanticExecutor({
    runtime: {
      system: {
        enqueueSystemEvent(text) {
          events.push(text);
          return true;
        },
      },
    },
  });

  const result = await executor(
    makeExecutorInput({
      action_name: "complete",
      parameters: {
        task_record_id: "rec-task-semantic-main",
        summary: "Semantic task implementation finished",
        evidence: "Verified via semantic-execution-executor.test.ts",
      },
    }),
  );

  assert.equal(result.status, "ok");
  assert.equal(result.work_surface_action, "complete");
  assert.equal(result.summary, "Semantic task implementation finished");
  assert.equal(events.length, 0);
});

test("openclaw main-session semantic executor blocks prose-only external mutation claims", async () => {
  const executor = createOpenClawMainSessionSemanticExecutor({});

  const result = await executor(
    makeExecutorInput({
      action_name: "complete",
      parameters: {
        task_record_id: "rec-task-semantic-main",
        summary: "已更新两条目标记录，从 Todo 放入 Pending。",
        evidence: "Feishu Base records rec-a and rec-b were updated.",
      },
    }),
  );

  assert.equal(result.status, "needs_escalation");
  assert.equal(result.result_kind, "needs_escalation");
  assert.equal(result.work_surface_action, "blocked");
  assert.equal(
    result.escalation_reason,
    "semantic_complete_missing_work_surface_operations",
  );
});

test("openclaw main-session semantic executor blocks complete boundary without explicit summary", async () => {
  const executor = createOpenClawMainSessionSemanticExecutor({});

  const result = await executor(
    makeExecutorInput({
      action_name: "complete",
      parameters: {
        task_record_id: "rec-task-semantic-main",
      },
    }),
  );

  assert.equal(result.status, "needs_escalation");
  assert.equal(result.result_kind, "needs_escalation");
  assert.equal(result.work_surface_action, "blocked");
  assert.equal(result.escalation_reason, "semantic_complete_missing_summary");
  assert.match(result.summary ?? "", /missing_summary/);
});

test("openclaw main-session semantic executor blocks complete boundary with placeholder summary", async () => {
  const executor = createOpenClawMainSessionSemanticExecutor({});

  const result = await executor(
    makeExecutorInput({
      action_name: "complete",
      parameters: {
        task_record_id: "rec-task-semantic-main",
        summary: "<required: concrete outcome>",
      },
    }),
  );

  assert.equal(result.status, "needs_escalation");
  assert.equal(result.work_surface_action, "blocked");
  assert.equal(result.escalation_reason, "semantic_complete_missing_summary");
});

test("openclaw main-session semantic executor passes review resolution through without enqueueing", async () => {
  const events: string[] = [];
  const executor = createOpenClawMainSessionSemanticExecutor({
    runtime: {
      system: {
        enqueueSystemEvent(text) {
          events.push(text);
          return true;
        },
      },
    },
  });

  const result = await executor(
    makeExecutorInput({
      action_name: "review_resolution",
      workflow: "review",
      parameters: {
        task_record_id: "rec-task-semantic-main",
        decision: "accepted",
        comment: "Manual acceptance passed in Feishu card",
      },
    }),
  );

  assert.equal(result.status, "ok");
  assert.equal(result.result_kind, "accepted");
  assert.equal(result.work_surface_action, "review_resolution");
  assert.equal(
    result.summary,
    "Review resolution recorded for proj-assistant-context-router",
  );
  assert.equal(events.length, 0);
});

test("openclaw main-session semantic executor blocks when target session is not configured", async () => {
  const executor = createOpenClawMainSessionSemanticExecutor({
    runtimeBindings: {},
    runtime: {
      system: {
        enqueueSystemEvent() {
          throw new Error("should-not-enqueue");
        },
      },
    },
  });

  const input = makeExecutorInput({
    parameters: {
      task_record_id: "rec-task-semantic-main",
    },
  });
  input.binding.target_ref = "feishu://base/tasks-bugs";

  const result = await executor(input);

  assert.equal(result.status, "needs_escalation");
  assert.equal(result.work_surface_action, "blocked");
  assert.equal(result.escalation_reason, "semantic_executor_target_not_configured");
});
