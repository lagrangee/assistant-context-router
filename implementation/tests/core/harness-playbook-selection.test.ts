import assert from "node:assert/strict";
import test from "node:test";

import {
  createExecutionEnvelope,
  loadPlaybookRegistry,
  selectPlaybooks,
} from "../../harness/src/index.ts";

function makeFeishuTaskEnvelope(title = "Move Todo cards to Pending") {
  return createExecutionEnvelope({
    project_id: "proj-assistant-context-router",
    project_root: "/tmp/proj-assistant-context-router",
    action_name: "dispatch",
    workflow: "dispatch",
    trace_id: "trace-selection-001",
    work_items: [
      {
        kind: "task",
        record_id: "rec-task-selection",
        status: "Doing",
        headline: title,
        project: "proj-assistant-context-router",
        priority: "P1",
        assignee: "Codex",
        acceptance_mode: "manual_acceptance",
        completion_notify_mode: "no_dm_on_completion_boundary",
        next_action: "Use typed facts",
        business_fields: {
          title,
          dod: "Selection must not parse the title",
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
          record_id: "rec-task-selection",
        },
      },
    ],
    adapter_facts: {
      pending_semantic_execution: true,
    },
  });
}

test("harness selects playbooks from typed work-surface facts", async () => {
  const registry = await loadPlaybookRegistry();
  const selected = selectPlaybooks({
    registry,
    envelope: makeFeishuTaskEnvelope(),
  });

  assert.deepEqual(
    selected.map((playbook) => playbook.id),
    [
      "acr-boundary-protocol",
      "work-surface-execution",
      "feishu-base-navigation",
      "work-item-card-semantics",
    ],
  );
});

test("harness selection does not depend on task title text", async () => {
  const registry = await loadPlaybookRegistry();
  const first = selectPlaybooks({
    registry,
    envelope: makeFeishuTaskEnvelope("将 todo 的两个任务放入 pending 面板"),
  }).map((playbook) => playbook.id);
  const second = selectPlaybooks({
    registry,
    envelope: makeFeishuTaskEnvelope("Completely unrelated human wording"),
  }).map((playbook) => playbook.id);

  assert.deepEqual(first, second);
});
