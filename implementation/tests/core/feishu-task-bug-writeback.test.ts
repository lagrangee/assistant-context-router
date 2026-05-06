import assert from "node:assert/strict";
import test from "node:test";

import {
  hasFeishuTaskBugWritebackAnchors,
  runFeishuTaskBugWriteback,
} from "../../adapters/feishu/src/task-bug-writeback.ts";
import type { NormalizedEnvelope, RouterConfig, ServiceResult } from "../../core/src/types.ts";

function createStubRunner(fixtures?: {
  tables?: Array<Record<string, unknown>>;
  fields?: Record<string, Array<Record<string, unknown>>>;
  records?: Record<string, Array<Record<string, unknown>>>;
  upsertResult?: Record<string, unknown>;
}) {
  const calls: string[][] = [];
  const upserts: Array<{
    tableId: string | null;
    recordId: string | null;
    fields: Record<string, unknown>;
  }> = [];

  return {
    calls,
    upserts,
    runner: {
      async run(args: string[]): Promise<unknown> {
        calls.push(args);

        const command = `${args[0]} ${args[1]}`;
        if (command === "base +table-list") {
          return {
            tables:
              fixtures?.tables ??
              [
                { id: "tbl-tasks", name: "Tasks" },
                { id: "tbl-bugs", name: "Bugs" },
              ],
          };
        }

        const tableIdIndex = args.indexOf("--table-id");
        const tableId = tableIdIndex >= 0 ? args[tableIdIndex + 1] : null;

        if (command === "base +field-list") {
          return {
            fields: fixtures?.fields?.[String(tableId)] ?? [],
          };
        }

        if (command === "base +record-list") {
          return {
            items: fixtures?.records?.[String(tableId)] ?? [],
          };
        }

        if (command === "base +record-upsert") {
          const jsonIndex = args.indexOf("--json");
          const recordIdIndex = args.indexOf("--record-id");
          upserts.push({
            tableId,
            recordId: recordIdIndex >= 0 ? args[recordIdIndex + 1] : null,
            fields:
              jsonIndex >= 0
                ? (JSON.parse(args[jsonIndex + 1]) as Record<string, unknown>)
                : {},
          });
          return fixtures?.upsertResult ?? {
            record: {
              record_id_list: [upserts[upserts.length - 1]?.recordId ?? "rec-upserted"],
            },
          };
        }

        throw new Error(`unexpected-command:${command}`);
      },
    },
  };
}

function makeDefaultTaskFields() {
  return [
    {
      id: "fld-task-status",
      name: "状态",
      type: "select",
      options: ["Todo", "Doing", "Done", "Pending", "Reviewing", "Archived"].map((name) => ({
        name,
      })),
    },
    {
      id: "fld-task-step",
      name: "current_step",
      type: "select",
      options: [
        "ACK",
        "PLAN",
        "EXECUTE",
        "REPORT",
        "REVIEW_WAIT",
        "FINALIZE",
        "COMPLETE",
        "REPLAN",
      ].map((name) => ({ name })),
    },
    {
      id: "fld-task-step-result",
      name: "step_result",
      type: "select",
      options: [
        "success",
        "failed",
        "need_review",
        "blocked",
        "in_progress",
        "accepted",
        "rejected",
      ].map((name) => ({ name })),
    },
    { id: "fld-task-next", name: "next_action", type: "text" },
    { id: "fld-task-last-event", name: "last_event_at", type: "datetime" },
    {
      id: "fld-task-acceptance",
      name: "ACR验收模式",
      type: "select",
      options: ["继承默认", "人工验收", "允许Agent完结"].map((name) => ({ name })),
    },
    {
      id: "fld-task-notify",
      name: "ACR完成提醒",
      type: "select",
      options: ["继承默认", "完成边界提醒", "完成边界不提醒"].map((name) => ({ name })),
    },
    { id: "fld-task-started", name: "ACR开始执行时间", type: "datetime" },
    { id: "fld-task-summary", name: "执行摘要", type: "text" },
  ];
}

function makeDefaultBugFields() {
  return [
    {
      id: "fld-bug-status",
      name: "状态",
      type: "select",
      options: ["Todo", "Fixing", "Reviewing", "Fixed", "Archived"].map((name) => ({ name })),
    },
    {
      id: "fld-bug-step",
      name: "current_step",
      type: "select",
      options: [
        "ACK",
        "PLAN",
        "EXECUTE",
        "REPORT",
        "REVIEW_WAIT",
        "FINALIZE",
        "COMPLETE",
        "REPLAN",
      ].map((name) => ({ name })),
    },
    {
      id: "fld-bug-step-result",
      name: "step_result",
      type: "select",
      options: [
        "success",
        "failed",
        "need_review",
        "blocked",
        "in_progress",
        "accepted",
        "rejected",
      ].map((name) => ({ name })),
    },
    { id: "fld-bug-next", name: "next_action", type: "text" },
    { id: "fld-bug-last-event", name: "last_event_at", type: "datetime" },
    { id: "fld-bug-fix-method", name: "修复方式", type: "text" },
    {
      id: "fld-bug-acceptance",
      name: "ACR验收模式",
      type: "select",
      options: ["继承默认", "人工验收", "允许Agent完结"].map((name) => ({ name })),
    },
    {
      id: "fld-bug-notify",
      name: "ACR完成提醒",
      type: "select",
      options: ["继承默认", "完成边界提醒", "完成边界不提醒"].map((name) => ({ name })),
    },
    { id: "fld-bug-started", name: "ACR开始执行时间", type: "datetime" },
    {
      id: "fld-bug-fix-result",
      name: "修复结果",
      type: "select",
      options: ["Fixed", "Won't fix", "Can't rep"].map((name) => ({ name })),
    },
  ];
}

function makeEnvelope(
  parameters: Record<string, unknown> | null,
  overrides: Partial<NormalizedEnvelope> = {},
): NormalizedEnvelope {
  return {
    source_type: "automation",
    channel_type: "feishu",
    project_ref: "proj-sample",
    resolved_project_id: "proj-sample",
    action_name: "dispatch",
    parameters,
    reply_target: null,
    trace_id: "trace-task-bug-writeback",
    workflow: "dispatch",
    raw_message_ref: "msg-task-bug-writeback",
    text: null,
    ...overrides,
  };
}

function makeServiceResult(
  overrides: Partial<ServiceResult> = {},
): ServiceResult {
  return {
    status: "ok",
    result_kind: "accepted",
    summary: "Dispatch accepted for proj-sample",
    reply_payload: "Accepted dispatch for proj-sample",
    needs_escalation: false,
    escalation_reason: null,
    run_id: "run-task-bug-writeback-001",
    queue_ref: "queue-task-bug-writeback-001",
    artifact_ref: null,
    trace_patch: null,
    ...overrides,
  };
}

function makeRouterConfig(overrides: Partial<RouterConfig> = {}): RouterConfig {
  return {
    task_bug_policy: {
      defaults: {
        acceptance_mode: "manual_acceptance",
        completion_notify_mode: "no_dm_on_completion_boundary",
        start_mode: "manual_only",
      },
    },
    ...overrides,
  };
}

test("hasFeishuTaskBugWritebackAnchors detects explicit task and bug record ids", () => {
  assert.equal(
    hasFeishuTaskBugWritebackAnchors({
      task_record_id: "rec-task-1",
    }),
    true,
  );
  assert.equal(
    hasFeishuTaskBugWritebackAnchors({
      bugRecordId: "rec-bug-1",
    }),
    true,
  );
  assert.equal(hasFeishuTaskBugWritebackAnchors({ task_id: "TASK-1" }), false);
  assert.equal(hasFeishuTaskBugWritebackAnchors(null), false);
});

test("task writeback apply updates in-progress fields and sets start time once", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [
        {
          record_id: "rec-task-1",
          fields: {
            状态: "Todo",
            ACR验收模式: "继承默认",
            ACR完成提醒: "继承默认",
            ACR开始执行时间: "",
          },
        },
      ],
      "tbl-bugs": [],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope({
      task_record_id: "rec-task-1",
    }),
    serviceResult: makeServiceResult(),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
    apply: true,
  });

  assert.equal(result.mode, "apply");
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0]?.kind, "task");
  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.policy.acceptance_mode, "manual_acceptance");
  assert.equal(
    result.plans[0]?.policy.completion_notify_mode,
    "no_dm_on_completion_boundary",
  );
  assert.equal(result.plans[0]?.policy.start_mode, "manual_only");

  assert.equal(stub.upserts.length, 1);
  const fields = stub.upserts[0]?.fields ?? {};
  assert.equal(fields["状态"], "Doing");
  assert.equal(fields.current_step, "EXECUTE");
  assert.equal(fields.step_result, "in_progress");
  assert.equal(fields.next_action, "继续执行当前事项");
  assert.equal(fields["执行摘要"], "Dispatch accepted for proj-sample");
  assert.equal(typeof fields.last_event_at, "number");
  assert.equal(typeof fields["ACR开始执行时间"], "number");

  assert.equal(result.results?.[0]?.operation, "updated");
  assert.equal(result.results?.[0]?.applied_record_id, "rec-task-1");
});

test("bug writeback resolves row overrides and moves review workflow into Reviewing", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [],
      "tbl-bugs": [
        {
          record_id: "rec-bug-1",
          fields: {
            状态: "Fixing",
            ACR验收模式: "允许Agent完结",
            ACR完成提醒: "完成边界提醒",
            ACR开始执行时间: "2026/04/21 10:00",
          },
        },
      ],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope(
      {
        bug_record_id: "rec-bug-1",
      },
      {
        action_name: "review",
        workflow: "review",
        trace_id: "trace-bug-review-001",
      },
    ),
    serviceResult: makeServiceResult({
      status: "needs_escalation",
      result_kind: "needs_escalation",
      summary: "Need human review for bug fix",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "review_required",
    }),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
  });

  assert.equal(result.mode, "dry_run");
  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0]?.kind, "bug");
  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.policy.acceptance_mode, "agent_can_finalize");
  assert.equal(
    result.plans[0]?.policy.completion_notify_mode,
    "dm_on_completion_boundary",
  );
  assert.equal(result.plans[0]?.policy.start_mode, "manual_only");

  const fields = result.plans[0]?.fields ?? {};
  assert.equal(fields["状态"], "Reviewing");
  assert.equal(fields.current_step, "REVIEW_WAIT");
  assert.equal(fields.step_result, "need_review");
  assert.match(String(fields.next_action), /等待Review/);
  assert.equal(fields["ACR开始执行时间"], undefined);
});

test("task writeback noops on terminal task status", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [
        {
          record_id: "rec-task-done",
          fields: {
            状态: "Done",
            ACR验收模式: "继承默认",
            ACR完成提醒: "继承默认",
          },
        },
      ],
      "tbl-bugs": [],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope({
      task_record_id: "rec-task-done",
    }),
    serviceResult: makeServiceResult(),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
    apply: true,
  });

  assert.equal(result.plans[0]?.operation, "noop");
  assert.match(String(result.plans[0]?.reason), /terminal_status/);
  assert.equal(stub.upserts.length, 0);
});

test("task review_resolution accepted updates terminal-aligned fields without noop", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [
        {
          record_id: "rec-task-review-done",
          fields: {
            状态: "Done",
            current_step: "REVIEW_WAIT",
            step_result: "need_review",
            ACR验收模式: "人工验收",
            ACR完成提醒: "继承默认",
          },
        },
      ],
      "tbl-bugs": [],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope(
      {
        task_record_id: "rec-task-review-done",
        decision: "accepted",
      },
      {
        action_name: "review_resolution",
        workflow: "review",
        trace_id: "trace-task-review-resolution-accepted-001",
      },
    ),
    serviceResult: makeServiceResult({
      summary: "Manual acceptance recorded",
      reply_payload: "Manual acceptance recorded",
    }),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
    apply: true,
  });

  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.reason, "resolution_boundary");
  assert.equal(stub.upserts.length, 1);
  const fields = stub.upserts[0]?.fields ?? {};
  assert.equal(fields.current_step, "COMPLETE");
  assert.equal(fields.step_result, "accepted");
  assert.match(String(fields.next_action), /已验收通过/);
  assert.equal(fields["状态"], undefined);
  assert.equal(fields["执行摘要"], "Manual acceptance recorded");
});

test("bug review_resolution rejected reopens work via Todo", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [],
      "tbl-bugs": [
        {
          record_id: "rec-bug-review-reopen",
          fields: {
            状态: "Todo",
            current_step: "REVIEW_WAIT",
            step_result: "need_review",
            ACR验收模式: "人工验收",
            ACR完成提醒: "继承默认",
          },
        },
      ],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope(
      {
        bug_record_id: "rec-bug-review-reopen",
        decision: "rejected",
        comment: "Bug still reproduces",
      },
      {
        action_name: "review_resolution",
        workflow: "review",
        trace_id: "trace-bug-review-resolution-rejected-001",
      },
    ),
    serviceResult: makeServiceResult({
      summary: "Review rejected; reopen work",
      reply_payload: "Review rejected; reopen work",
    }),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
  });

  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.reason, "resolution_boundary");
  const fields = result.plans[0]?.fields ?? {};
  assert.equal(fields["状态"], undefined);
  assert.equal(fields.current_step, "REPLAN");
  assert.equal(fields.step_result, "rejected");
  assert.match(String(fields.next_action), /重新处理/);
});

test("task complete respects manual_acceptance and stops at Reviewing", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [
        {
          record_id: "rec-task-complete-manual",
          fields: {
            状态: "Doing",
            current_step: "EXECUTE",
            step_result: "in_progress",
            ACR验收模式: "继承默认",
            ACR完成提醒: "继承默认",
            ACR开始执行时间: "2026/04/21 10:00",
          },
        },
      ],
      "tbl-bugs": [],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope(
      {
        task_record_id: "rec-task-complete-manual",
        evidence:
          "本机 openclaw --version / openclaw status 已核对；release notes 已比对关键变化。",
      },
      {
        action_name: "complete",
        workflow: "dispatch",
        trace_id: "trace-task-complete-manual-001",
      },
    ),
    serviceResult: makeServiceResult({
      summary: "Implementation finished and ready for acceptance",
      reply_payload: "Implementation finished and ready for acceptance",
    }),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
  });

  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.reason, "completion_boundary");
  const fields = result.plans[0]?.fields ?? {};
  assert.equal(fields["状态"], "Reviewing");
  assert.equal(fields.current_step, "REVIEW_WAIT");
  assert.equal(fields.step_result, "need_review");
  assert.match(String(fields.next_action), /等待人工验收/);
  assert.match(String(fields["执行摘要"]), /执行结果：Implementation finished/);
  assert.match(String(fields["执行摘要"]), /验证证据：本机 openclaw --version/);
  assert.equal(fields["ACR开始执行时间"], undefined);
});

test("task dispatch can use explicit service work_surface_action to enter completion boundary", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [
        {
          record_id: "rec-task-dispatch-complete",
          fields: {
            状态: "Doing",
            current_step: "EXECUTE",
            step_result: "in_progress",
            ACR验收模式: "继承默认",
            ACR完成提醒: "继承默认",
            ACR开始执行时间: "2026/04/21 10:00",
          },
        },
      ],
      "tbl-bugs": [],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope(
      {
        task_record_id: "rec-task-dispatch-complete",
      },
      {
        action_name: "dispatch",
        workflow: "dispatch",
        trace_id: "trace-task-dispatch-complete-001",
      },
    ),
    serviceResult: makeServiceResult({
      work_surface_action: "complete",
      summary: "Executor reached completion boundary",
      reply_payload: "Executor reached completion boundary",
    }),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
  });

  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.reason, "completion_boundary");
  const fields = result.plans[0]?.fields ?? {};
  assert.equal(fields["状态"], "Reviewing");
  assert.equal(fields.current_step, "REVIEW_WAIT");
  assert.equal(fields.step_result, "need_review");
  assert.match(String(fields.next_action), /等待人工验收/);
});

test("bug complete respects agent_can_finalize and writes terminal status", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [],
      "tbl-bugs": [
        {
          record_id: "rec-bug-complete-agent",
          fields: {
            状态: "Fixing",
            current_step: "EXECUTE",
            step_result: "in_progress",
            ACR验收模式: "允许Agent完结",
            ACR完成提醒: "完成边界提醒",
            ACR开始执行时间: "2026/04/21 10:00",
          },
        },
      ],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope(
      {
        bug_record_id: "rec-bug-complete-agent",
        fix_result: "fixed",
        evidence: "Regression test passed and the original repro no longer fails.",
      },
      {
        action_name: "complete",
        workflow: "dispatch",
        trace_id: "trace-bug-complete-agent-001",
      },
    ),
    serviceResult: makeServiceResult({
      summary: "Bug fix completed successfully",
      reply_payload: "Bug fix completed successfully",
    }),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
  });

  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.reason, "completion_boundary");
  assert.equal(result.plans[0]?.policy.acceptance_mode, "agent_can_finalize");
  const fields = result.plans[0]?.fields ?? {};
  assert.equal(fields["状态"], "Fixed");
  assert.equal(fields.current_step, "COMPLETE");
  assert.equal(fields.step_result, "accepted");
  assert.match(String(fields.next_action), /已完成/);
  assert.match(String(fields["修复方式"]), /执行结果：Bug fix completed successfully/);
  assert.match(String(fields["修复方式"]), /验证证据：Regression test passed/);
  assert.equal(fields["修复结果"], "Fixed");
});

test("bug complete writes proposed fix result while waiting for manual acceptance", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [],
      "tbl-bugs": [
        {
          record_id: "rec-bug-complete-manual",
          fields: {
            状态: "Fixing",
            current_step: "EXECUTE",
            step_result: "in_progress",
            ACR验收模式: "人工验收",
            ACR完成提醒: "继承默认",
            ACR开始执行时间: "2026/04/21 10:00",
          },
        },
      ],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope(
      {
        bug_record_id: "rec-bug-complete-manual",
        fix_result: "can't reproduce",
      },
      {
        action_name: "complete",
        workflow: "dispatch",
        trace_id: "trace-bug-complete-manual-001",
      },
    ),
    serviceResult: makeServiceResult({
      summary: "Tried the documented repro steps twice; the bug no longer reproduces.",
      reply_payload: "Tried the documented repro steps twice; the bug no longer reproduces.",
    }),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
  });

  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.reason, "completion_boundary");
  const fields = result.plans[0]?.fields ?? {};
  assert.equal(fields["状态"], "Reviewing");
  assert.equal(fields.current_step, "REVIEW_WAIT");
  assert.equal(fields.step_result, "need_review");
  assert.equal(
    fields["修复方式"],
    "Tried the documented repro steps twice; the bug no longer reproduces.",
  );
  assert.equal(fields["修复结果"], "Can't rep");
});

test("bug complete without fix_result fails closed instead of guessing Fixed", async () => {
  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": makeDefaultBugFields(),
    },
    records: {
      "tbl-tasks": [],
      "tbl-bugs": [
        {
          record_id: "rec-bug-complete-missing-result",
          fields: {
            状态: "Fixing",
            current_step: "EXECUTE",
            step_result: "in_progress",
            ACR验收模式: "人工验收",
            ACR完成提醒: "继承默认",
          },
        },
      ],
    },
  });

  const result = await runFeishuTaskBugWriteback({
    envelope: makeEnvelope(
      {
        bug_record_id: "rec-bug-complete-missing-result",
      },
      {
        action_name: "complete",
        workflow: "dispatch",
        trace_id: "trace-bug-complete-missing-result-001",
      },
    ),
    serviceResult: makeServiceResult({
      summary: "Bug work reached a boundary but did not classify the result.",
      reply_payload: "Bug work reached a boundary but did not classify the result.",
    }),
    routerConfig: makeRouterConfig(),
    baseToken: "base-token",
    runner: stub.runner,
  });

  assert.equal(result.plans[0]?.operation, "updated");
  assert.equal(result.plans[0]?.reason, "error");
  const fields = result.plans[0]?.fields ?? {};
  assert.equal(fields["状态"], undefined);
  assert.equal(fields.current_step, "REPORT");
  assert.equal(fields.step_result, "failed");
  assert.match(String(fields.next_action), /缺少 Bug 修复结果/);
  assert.equal(fields["修复结果"], undefined);
});

test("writeback preflight fails early when live enum options drift from code literals", async () => {
  const bugFields = makeDefaultBugFields().map((field) => {
    if (field.name !== "step_result") {
      return field;
    }
    return {
      ...field,
      options: ["success", "failed", "need_review", "blocked", "in_progress"].map((name) => ({
        name,
      })),
    };
  });

  const stub = createStubRunner({
    fields: {
      "tbl-tasks": makeDefaultTaskFields(),
      "tbl-bugs": bugFields,
    },
    records: {
      "tbl-tasks": [],
      "tbl-bugs": [
        {
          record_id: "rec-bug-review-reopen",
          fields: {
            状态: "Todo",
            current_step: "REVIEW_WAIT",
            step_result: "need_review",
            ACR验收模式: "人工验收",
            ACR完成提醒: "继承默认",
          },
        },
      ],
    },
  });

  await assert.rejects(
    () =>
      runFeishuTaskBugWriteback({
        envelope: makeEnvelope(
          {
            bug_record_id: "rec-bug-review-reopen",
            decision: "rejected",
          },
          {
            action_name: "review_resolution",
            workflow: "review",
          },
        ),
        serviceResult: makeServiceResult({
          summary: "Review rejected; reopen work",
          reply_payload: "Review rejected; reopen work",
        }),
        routerConfig: makeRouterConfig(),
        baseToken: "base-token",
        runner: stub.runner,
      }),
    /missing-feishu-enum-options:bug:step_result=rejected/,
  );
});
