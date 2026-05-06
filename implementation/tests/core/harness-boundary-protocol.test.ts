import assert from "node:assert/strict";
import test from "node:test";

import { validateBoundaryResult } from "../../harness/src/index.ts";

test("boundary protocol accepts complete with record id, summary, evidence, and structured record operations", () => {
  const result = validateBoundaryResult({
    action_name: "complete",
    parameters: {
      task_record_id: "rec-task-boundary",
      summary: "Moved the target cards to Pending.",
      evidence: "Updated records rec-a and rec-b in Feishu Base.",
      work_surface_operations: [
        {
          operation: "update_record",
          source_system: "feishu_base",
          table_id: "tbl-tasks",
          record_id: "rec-a",
          set_fields: {
            状态: "Pending",
          },
          verify_fields: {
            状态: "Pending",
          },
        },
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.boundary?.action, "complete");
  assert.equal(result.boundary?.task_record_id, "rec-task-boundary");
  assert.equal(result.boundary?.work_surface_operations.length, 1);
});

test("boundary protocol accepts camelCase operation aliases", () => {
  const result = validateBoundaryResult({
    action_name: "complete",
    parameters: {
      taskRecordId: "rec-task-boundary",
      summary: "Moved target card to Pending.",
      evidence: "Feishu Base record rec-a was updated.",
      workSurfaceOperations: [
        {
          operation: "update_record",
          sourceSystem: "feishu_base",
          tableId: "tbl-tasks",
          recordId: "rec-a",
          setFields: {
            状态: "Pending",
          },
          expectedFields: {
            状态: "Pending",
          },
        },
      ],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.boundary?.work_surface_operations[0]?.record_id, "rec-a");
  assert.deepEqual(result.boundary?.work_surface_operations[0]?.verify_fields, {
    状态: "Pending",
  });
});

test("boundary protocol rejects prose-only work-surface mutation claims", () => {
  const result = validateBoundaryResult({
    action_name: "complete",
    parameters: {
      task_record_id: "rec-task-boundary",
      summary: "已更新两条目标记录，从 Todo 放入 Pending。",
      evidence: "Feishu Base records rec-a and rec-b were updated.",
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["missing_work_surface_operations"]);
  assert.equal(
    result.escalation_reason,
    "semantic_complete_missing_work_surface_operations",
  );
});

test("boundary protocol rejects placeholder or missing complete evidence", () => {
  const result = validateBoundaryResult({
    action_name: "complete",
    parameters: {
      task_record_id: "rec-task-boundary",
      summary: "<required: concrete outcome>",
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["placeholder_summary", "missing_evidence"]);
  assert.equal(result.escalation_reason, "semantic_complete_missing_summary");
});

test("boundary protocol accepts review missing_context with a record anchor", () => {
  const result = validateBoundaryResult({
    action_name: "review",
    parameters: {
      task_record_id: "rec-task-boundary",
      reason: "missing_context",
      summary: "Two possible Todo records matched the request.",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.boundary?.reason, "missing_context");
});
