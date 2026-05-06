import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleExecutionContext,
  createExecutionEnvelope,
  loadPlaybookRegistry,
} from "../../harness/src/index.ts";

test("harness assembles Feishu task dispatch context with selected playbook guidance", async () => {
  const registry = await loadPlaybookRegistry();
  const envelope = createExecutionEnvelope({
    project_id: "proj-assistant-context-router",
    project_root: "<repo-root>",
    action_name: "dispatch",
    workflow: "dispatch",
    trace_id: "trace-context-001",
    work_items: [
      {
        kind: "task",
        record_id: "rec-task-context",
        status: "Doing",
        headline: "Implement harness context assembly",
        project: "proj-assistant-context-router",
        priority: "P1",
        assignee: "Codex",
        acceptance_mode: "manual_acceptance",
        completion_notify_mode: "no_dm_on_completion_boundary",
        next_action: "Render playbooks",
        business_fields: {
          title: "Implement harness context assembly",
          dod: "Agent receives work-surface execution semantics",
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
          record_id: "rec-task-context",
        },
      },
    ],
    adapter_facts: {
      source: "external work-surface semantic context",
      pending_semantic_execution: true,
      original_parameters: {
        task_record_id: "rec-task-context",
      },
      work_surface_navigation_manifest: {
        source: {
          table_id: "tbl-tasks",
          table_name: "Tasks",
          kind: "task",
          record_id: "rec-task-context",
          headline: "Implement harness context assembly",
          status: "Doing",
          project_relation_ids: ["rec-project-acr"],
        },
        tables: [
          {
            kind: "task",
            table_id: "tbl-tasks",
            table_name: "Tasks",
            aliases: ["task", "todo", "doing", "pending"],
            field_roles: {
              title: "任务",
              status: "状态",
              project: "所属项目",
            },
          },
          {
            kind: "bug",
            table_id: "tbl-bugs",
            table_name: "Bugs",
            aliases: ["bug", "issue", "fixing"],
            field_roles: {
              title: "描述",
              status: "状态",
              project: "所属项目",
            },
          },
        ],
        source_table_schema: {
          fields: [
            {
              field_name: "状态",
              field_id: "fld-status",
              role: "status",
              type: "select",
              options: ["Todo", "Doing", "Done", "Pending", "Reviewing"],
            },
          ],
        },
        query_recipes: [
          "Treat board labels such as Todo/Pending as status field values, not table names.",
          "When a task references other work items, query the selected table by same project, title, and status.",
        ],
      },
    },
  });

  const assembled = await assembleExecutionContext({ envelope, registry });

  assert.deepEqual(
    assembled.selected_playbooks.map((playbook) => playbook.id),
    [
      "acr-boundary-protocol",
      "work-surface-execution",
      "feishu-base-navigation",
      "work-item-card-semantics",
    ],
  );
  assert.match(assembled.agent_context, /Assistant Context Router semantic execution request/);
  assert.match(assembled.agent_context, /project_root:/);
  assert.match(assembled.agent_context, /work_surface_origin/);
  assert.match(assembled.agent_context, /feishu_base/);
  assert.match(assembled.agent_context, /selected_playbooks/);
  assert.match(assembled.agent_context, /work-surface-execution/);
  assert.match(assembled.agent_context, /feishu-base-navigation/);
  assert.match(assembled.agent_context, /work-item-card-semantics/);
  assert.match(assembled.agent_context, /acr-boundary-protocol/);
  assert.match(assembled.agent_context, /completion_boundary_schema/);
  assert.match(assembled.agent_context, /adapter_facts_json/);
  assert.match(assembled.agent_context, /adapter-provided navigation facts/);
  assert.match(assembled.agent_context, /work_surface_navigation_manifest/);
  assert.match(assembled.agent_context, /query_recipes/);
  assert.match(assembled.agent_context, /search_budget_rule/);
  assert.match(assembled.agent_context, /inspect the repo\/package layout/);
  assert.doesNotMatch(assembled.agent_context, /rec-related-context/);
  assert.match(assembled.agent_context, /Pending/);
  assert.match(assembled.agent_context, /summary/);
  assert.match(assembled.agent_context, /evidence/);
  assert.match(assembled.agent_context, /work_surface_operations/);
  assert.match(assembled.agent_context, /missing_context/);
});
