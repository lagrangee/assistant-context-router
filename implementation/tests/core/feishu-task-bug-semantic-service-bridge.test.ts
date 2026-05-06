import assert from "node:assert/strict";
import test from "node:test";

import {
  createFeishuTaskBugSemanticServiceBridgeAdapter,
  type FeishuTaskBugExecutionContext,
} from "../../adapters/feishu/src/task-bug-semantic-service-bridge.ts";
import type {
  InternalServiceRequest,
  ServiceBinding,
  ServiceResult,
} from "../../core/src/types.ts";

function createStubRunner(fixtures?: {
  tables?: Array<Record<string, unknown>>;
  fields?: Record<string, Array<Record<string, unknown>>>;
  records?: Record<string, Array<Record<string, unknown>>>;
}) {
  const calls: string[][] = [];
  const records = fixtures?.records ?? {};
  const upserts: Array<{
    tableId: string | null;
    recordId: string | null;
    fields: Record<string, unknown>;
  }> = [];

  return {
    calls,
    records,
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

        if (command === "base +record-list") {
          return {
            items: records[String(tableId)] ?? [],
          };
        }

        if (command === "base +record-get") {
          const recordIdIndex = args.indexOf("--record-id");
          const recordId = recordIdIndex >= 0 ? args[recordIdIndex + 1] : null;
          const record =
            records[String(tableId)]?.find(
              (item) => item.record_id === recordId,
            ) ?? null;
          return record ? { record } : { record: null };
        }

        if (command === "base +record-upsert") {
          const recordIdIndex = args.indexOf("--record-id");
          const jsonIndex = args.indexOf("--json");
          const recordId = recordIdIndex >= 0 ? args[recordIdIndex + 1] : null;
          const fields =
            jsonIndex >= 0
              ? (JSON.parse(args[jsonIndex + 1]) as Record<string, unknown>)
              : {};
          upserts.push({ tableId, recordId, fields });

          const tableRecords = records[String(tableId)] ?? [];
          const record = tableRecords.find((item) => item.record_id === recordId);
          if (record) {
            record.fields = {
              ...((record.fields as Record<string, unknown>) ?? {}),
              ...fields,
            };
          }

          return {
            record: {
              record_id: recordId,
              fields,
            },
            updated: true,
          };
        }

        if (command === "base +field-list") {
          return {
            fields:
              fixtures?.fields?.[String(tableId)] ??
              [
                {
                  id: "fld-status",
                  name: "状态",
                  type: "select",
                  options: [
                    { name: "Todo" },
                    { name: "Doing" },
                    { name: "Done" },
                    { name: "Pending" },
                    { name: "Reviewing" },
                  ],
                },
                { id: "fld-project", name: "所属项目", type: "link" },
                { id: "fld-next-action", name: "next_action", type: "text" },
                { id: "fld-current-step", name: "current_step", type: "select" },
                { id: "fld-step-result", name: "step_result", type: "select" },
                { id: "fld-summary", name: "执行摘要", type: "text" },
              ],
          };
        }

        throw new Error(`unexpected-command:${command}`);
      },
    },
  };
}

function makeBinding(): ServiceBinding {
  return {
    runtime_kind: "feishu_task_bug_semantic",
    target_ref: "feishu://base/tasks-bugs",
    metadata: null,
  };
}

function makeRequest(
  parameters: Record<string, unknown> | null,
  overrides: Partial<InternalServiceRequest> = {},
): InternalServiceRequest {
  return {
    action_name: "dispatch",
    resolved_project_id: "proj-sample",
    workflow: "dispatch",
    parameters,
    trace_id: "trace-semantic-bridge-001",
    reply_target: null,
    ...overrides,
  };
}

function makeCompleteResult(summary: string): ServiceResult {
  return {
    status: "ok",
    result_kind: "accepted",
    work_surface_action: "complete",
    summary,
    reply_payload: summary,
    needs_escalation: false,
    escalation_reason: null,
    trace_patch: {
      executor: "test",
    },
  };
}

test("feishu task/bug semantic bridge reads task row and passes execution context to executor", async () => {
  const stub = createStubRunner({
    records: {
      "tbl-tasks": [
        {
          record_id: "rec-task-semantic-1",
          fields: {
            任务: "Implement semantic execution bridge",
            DoD: "Bridge reads card context and executor returns complete",
            描述: "Use the ACR project itself as first user",
            状态: "Doing",
            优先级: "P1",
            截止时间: "2026/04/30",
            任务执行人: "Codex",
            所属项目: [{ id: "rec-project-acr" }],
            ACR验收模式: "人工验收",
            ACR完成提醒: "完成边界不提醒",
            next_action: "Wire first slice",
          },
        },
        {
          record_id: "rec-related-todo-1",
          fields: {
            任务: "Discuss ACP scheduling policy",
            状态: "Todo",
            所属项目: [{ id: "rec-project-acr" }],
            next_action: "Waiting dispatch",
          },
        },
        {
          record_id: "rec-unrelated-todo-1",
          fields: {
            任务: "Other project task",
            状态: "Todo",
            所属项目: [{ id: "rec-other-project" }],
          },
        },
      ],
      "tbl-bugs": [],
    },
  });
  const capturedContexts: FeishuTaskBugExecutionContext[][] = [];
  const capturedEnvelopeRoots: Array<string | null> = [];
  const adapter = createFeishuTaskBugSemanticServiceBridgeAdapter({
    baseToken: "base-token",
    configHostPath: "/tmp/acr/feishu-adapter.yaml",
    runner: stub.runner,
    resolveProjectRoot: (projectId) => `/tmp/${projectId}`,
    executor: async ({ contexts, execution_envelope }) => {
      capturedContexts.push(contexts);
      capturedEnvelopeRoots.push(execution_envelope.project_root);
      return makeCompleteResult("Semantic execution bridge completed");
    },
  });

  const result = await adapter({
    binding: makeBinding(),
    request: makeRequest({
      task_record_id: "rec-task-semantic-1",
    }),
  });

  assert.equal(result.status, "ok");
  assert.equal(result.work_surface_action, "complete");
  assert.equal(capturedContexts.length, 1);
  assert.equal(capturedContexts[0]?.[0]?.kind, "task");
  assert.equal(capturedContexts[0]?.[0]?.record_id, "rec-task-semantic-1");
  assert.equal(capturedContexts[0]?.[0]?.headline, "Implement semantic execution bridge");
  assert.equal(
    capturedContexts[0]?.[0]?.business_fields.dod,
    "Bridge reads card context and executor returns complete",
  );
  assert.equal(capturedContexts[0]?.[0]?.project, "rec-project-acr");
  const navigationManifest = capturedContexts[0]?.[0]?.adapter_facts
    ?.work_surface_navigation_manifest as
    | {
        source?: { record_id?: string; project_relation_ids?: string[] };
        tables?: Array<{ table_name?: string; kind?: string }>;
        source_table_schema?: { fields?: Array<{ field_name?: string; options?: string[] }> };
        query_recipes?: string[];
      }
    | undefined;
  assert.equal(navigationManifest?.source?.record_id, "rec-task-semantic-1");
  assert.deepEqual(navigationManifest?.source?.project_relation_ids, ["rec-project-acr"]);
  assert.deepEqual(
    navigationManifest?.tables?.map((table) => table.table_name),
    ["Tasks", "Bugs"],
  );
  assert.deepEqual(
    navigationManifest?.source_table_schema?.fields?.find(
      (field) => field.field_name === "状态",
    )?.options,
    ["Todo", "Doing", "Done", "Pending", "Reviewing"],
  );
  assert.equal(
    navigationManifest?.query_recipes?.some((recipe) => recipe.includes("status field")),
    true,
  );
  assert.doesNotMatch(
    JSON.stringify(capturedContexts[0]?.[0]?.adapter_facts),
    /rec-related-todo-1/,
  );
  assert.deepEqual(capturedContexts[0]?.[0]?.work_surface_origin, {
    source_system: "feishu_base",
    surface_kind: "project_management",
    adapter: "feishu_task_bug_semantic",
    identity: "bot",
    config_path: "/tmp/acr/feishu-adapter.yaml",
    base_ref: "feishu_adapter_config",
    table_id: "tbl-tasks",
    table_name: "Tasks",
    record_id: "rec-task-semantic-1",
  });
  assert.equal(result.trace_patch?.bridge_adapter, "feishu_task_bug_semantic");
  assert.equal(result.trace_patch?.semantic_context_loaded, true);
  assert.equal(result.trace_patch?.semantic_context_count, 1);
  assert.equal(
    result.trace_patch?.semantic_contexts?.[0]?.work_surface_navigation_manifest
      ?.table_count,
    2,
  );
  assert.deepEqual(capturedEnvelopeRoots, ["/tmp/proj-sample"]);
});

test("feishu task/bug semantic bridge applies and verifies structured complete side effects", async () => {
  const stub = createStubRunner({
    records: {
      "tbl-tasks": [
        {
          record_id: "rec-source",
          fields: {
            任务: "Move two Todo cards to Pending",
            状态: "Doing",
            所属项目: [{ id: "rec-project-acr" }],
          },
        },
        {
          record_id: "rec-target-a",
          fields: {
            任务: "讨论 acp 的调度策略",
            状态: "Todo",
            所属项目: [{ id: "rec-project-acr" }],
          },
        },
        {
          record_id: "rec-target-b",
          fields: {
            任务: "讨论 antigravity 的 CLI 接入方式",
            状态: "Todo",
            所属项目: [{ id: "rec-project-acr" }],
          },
        },
      ],
      "tbl-bugs": [],
    },
  });
  const adapter = createFeishuTaskBugSemanticServiceBridgeAdapter({
    baseToken: "base-token",
    runner: stub.runner,
    executor: async () => makeCompleteResult("Moved target records to Pending"),
  });

  const result = await adapter({
    binding: makeBinding(),
    request: makeRequest(
      {
        task_record_id: "rec-source",
        summary: "已更新两条目标记录，从 Todo 放入 Pending。",
        evidence: "Feishu Base records rec-target-a and rec-target-b were updated.",
        work_surface_operations: [
          {
            operation: "update_record",
            source_system: "feishu_base",
            table_id: "tbl-tasks",
            record_id: "rec-target-a",
            set_fields: {
              状态: "Pending",
            },
            verify_fields: {
              状态: "Pending",
            },
          },
          {
            operation: "update_record",
            source_system: "feishu_base",
            table_id: "tbl-tasks",
            record_id: "rec-target-b",
            set_fields: {
              状态: "Pending",
            },
            verify_fields: {
              状态: "Pending",
            },
          },
        ],
      },
      { action_name: "complete" },
    ),
  });

  assert.equal(result.status, "ok");
  assert.equal(result.work_surface_action, "complete");
  assert.equal(result.trace_patch?.side_effect_contract, "applied_and_verified");
  assert.equal(stub.upserts.length, 2);
  assert.deepEqual(stub.upserts.map((item) => item.recordId), [
    "rec-target-a",
    "rec-target-b",
  ]);
  assert.equal(
    (
      stub.records["tbl-tasks"]?.find((item) => item.record_id === "rec-target-a")
        ?.fields as Record<string, unknown> | undefined
    )?.状态,
    "Pending",
  );
  assert.equal(
    (
      stub.records["tbl-tasks"]?.find((item) => item.record_id === "rec-target-b")
        ?.fields as Record<string, unknown> | undefined
    )?.状态,
    "Pending",
  );
});

test("feishu task/bug semantic bridge blocks structured side effects with unknown enum values", async () => {
  const stub = createStubRunner({
    records: {
      "tbl-tasks": [
        {
          record_id: "rec-source",
          fields: {
            任务: "Move Todo card to a missing board",
            状态: "Doing",
            所属项目: [{ id: "rec-project-acr" }],
          },
        },
        {
          record_id: "rec-target-a",
          fields: {
            任务: "讨论 acp 的调度策略",
            状态: "Todo",
            所属项目: [{ id: "rec-project-acr" }],
          },
        },
      ],
      "tbl-bugs": [],
    },
  });
  const adapter = createFeishuTaskBugSemanticServiceBridgeAdapter({
    baseToken: "base-token",
    runner: stub.runner,
    executor: async () => makeCompleteResult("Moved target record to Missing"),
  });

  const result = await adapter({
    binding: makeBinding(),
    request: makeRequest(
      {
        task_record_id: "rec-source",
        summary: "已更新目标记录。",
        evidence: "Feishu Base record rec-target-a was updated.",
        work_surface_operations: [
          {
            operation: "update_record",
            source_system: "feishu_base",
            table_id: "tbl-tasks",
            record_id: "rec-target-a",
            set_fields: {
              状态: "Missing",
            },
            verify_fields: {
              状态: "Missing",
            },
          },
        ],
      },
      { action_name: "complete" },
    ),
  });

  assert.equal(result.status, "needs_escalation");
  assert.equal(result.work_surface_action, "blocked");
  assert.equal(result.escalation_reason, "semantic_side_effect_verification_failed");
  assert.match(result.summary ?? "", /missing-option/);
  assert.equal(stub.upserts.length, 0);
});

test("feishu task/bug semantic bridge returns blocked when row anchor is missing", async () => {
  const stub = createStubRunner();
  const adapter = createFeishuTaskBugSemanticServiceBridgeAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  const result = await adapter({
    binding: makeBinding(),
    request: makeRequest({}),
  });

  assert.equal(result.status, "needs_escalation");
  assert.equal(result.work_surface_action, "blocked");
  assert.equal(result.escalation_reason, "semantic_bridge_missing_row_anchor");
  assert.equal(stub.calls.length, 0);
});

test("feishu task/bug semantic bridge returns blocked when anchored row is missing", async () => {
  const stub = createStubRunner({
    records: {
      "tbl-tasks": [],
      "tbl-bugs": [],
    },
  });
  const adapter = createFeishuTaskBugSemanticServiceBridgeAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  const result = await adapter({
    binding: makeBinding(),
    request: makeRequest({
      bug_record_id: "rec-missing-bug",
    }),
  });

  assert.equal(result.status, "needs_escalation");
  assert.equal(result.work_surface_action, "blocked");
  assert.match(String(result.escalation_reason), /missing-feishu-task-bug-record/);
  assert.equal(result.trace_patch?.semantic_context_loaded, false);
});
