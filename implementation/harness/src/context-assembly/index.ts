import type { WorkSurfaceOrigin } from "../../../core/src/types.ts";
import type { ExecutionEnvelope, ExecutionWorkItem } from "../execution-envelope/index.ts";
import {
  loadDefaultPlaybookRegistry,
  type PlaybookRegistry,
} from "../playbook-registry/index.ts";
import { selectPlaybooks, type SelectedPlaybook } from "../playbook-selection/index.ts";

export interface AssembledExecutionContext {
  agent_context: string;
  selected_playbooks: SelectedPlaybook[];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function compactWorkItem(item: ExecutionWorkItem): Record<string, unknown> {
  return {
    kind: item.kind,
    record_id: item.record_id,
    status: item.status,
    headline: item.headline,
    project: item.project,
    priority: item.priority,
    assignee: item.assignee,
    acceptance_mode: item.acceptance_mode,
    completion_notify_mode: item.completion_notify_mode,
    next_action: item.next_action,
    work_surface_origin: item.work_surface_origin,
    business_fields: item.business_fields,
  };
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{\"error\":\"value_not_serializable\"}";
  }
}

function renderOrigin(origin: WorkSurfaceOrigin | null): string {
  if (!origin) {
    return "null";
  }
  return stringify(origin);
}

function renderOriginSummary(origin: WorkSurfaceOrigin | null): string[] {
  if (!origin) {
    return ["work_surface_origin: none"];
  }
  const parts = [
    origin.source_system,
    origin.surface_kind,
    origin.table_name,
    origin.table_id,
    origin.record_id,
  ].filter(Boolean);
  const lines = [`work_surface_origin: ${parts.join(" | ")}`];
  if (origin.identity) {
    lines.push(`identity: ${origin.identity}`);
  }
  if (origin.config_path) {
    lines.push(`config_path: ${origin.config_path}`);
  }
  if (origin.base_ref) {
    lines.push(`base_ref: ${origin.base_ref}`);
  }
  return lines;
}

function renderAdapterFacts(facts: Record<string, unknown>): string[] {
  const keys = Object.keys(facts);
  if (keys.length === 0) {
    return ["adapter_facts_json:", "{}"];
  }

  return ["adapter_facts_json:", stringify(facts)];
}

function recordAnchorParameters(envelope: ExecutionEnvelope): Record<string, unknown> {
  const original = asObject(envelope.adapter_facts.original_parameters);
  const parameters: Record<string, unknown> = {
    ...original,
  };

  const task = envelope.work_items.find((item) => item.kind === "task");
  const bug = envelope.work_items.find((item) => item.kind === "bug");
  if (task?.record_id && !parameters.task_record_id) {
    parameters.task_record_id = task.record_id;
  }
  if (bug?.record_id && !parameters.bug_record_id) {
    parameters.bug_record_id = bug.record_id;
  }
  if (envelope.trace_id && !parameters.semantic_source_trace_id) {
    parameters.semantic_source_trace_id = envelope.trace_id;
  }
  if (!parameters.summary) {
    parameters.summary = "<required: concrete outcome after the requested work is actually done>";
  }
  if (!parameters.evidence) {
    parameters.evidence =
      "<required: changed records, files, commands, or verification evidence>";
  }
  if (bug && !parameters.fix_result) {
    parameters.fix_result = "<required: Fixed | Won't fix | Can't rep>";
  }
  if (!parameters.work_surface_operations) {
    parameters.work_surface_operations = [
      {
        operation: "<optional for external record mutations: update_record>",
        source_system: "<required when operation is used, e.g. feishu_base>",
        table_id: "<required table id or remove this operation>",
        record_id: "<required target record id or remove this operation>",
        set_fields: {
          "<field name>": "<new value>",
        },
        verify_fields: {
          "<field name>": "<expected value after write>",
        },
      },
    ];
  }

  return parameters;
}

function renderBoundarySchema(envelope: ExecutionEnvelope): string {
  return stringify({
    channel: "openclaw",
    payload: {
      source_type: "agent",
      project_id: envelope.project_id,
      action_name: "complete",
      workflow: envelope.workflow ?? "dispatch",
      parameters: recordAnchorParameters(envelope),
      trace_id: `semantic-complete-${envelope.trace_id ?? envelope.work_items[0]?.record_id ?? "unknown"}`,
      message_id: `semantic-complete-msg-${envelope.trace_id ?? envelope.work_items[0]?.record_id ?? "unknown"}`,
    },
  });
}

function renderPlaybooks(playbooks: SelectedPlaybook[]): string[] {
  if (playbooks.length === 0) {
    return ["selected_playbooks: []"];
  }

  const lines = ["selected_playbooks:"];
  for (const playbook of playbooks) {
    lines.push(
      `- ${playbook.id} | ${playbook.scope} | ${playbook.status} | ${playbook.absolute_path}`,
    );
  }
  lines.push(
    "",
    "playbook_guidance_summary:",
    "- Use the selected playbooks as references, not inline context. Read a playbook file only when its exact wording is needed for this task.",
    "- Start from project_root, work_surface_origin, record_id, and the local project truth docs needed for the requested work.",
    "- Use project_root as the starting workspace, but inspect the repo/package layout before running package-manager scripts; do not assume project_root itself owns package.json.",
    "- Use adapter_facts_json/work_surface_navigation_manifest as a read-only map for tables, field roles, schema options, and query recipes.",
    "- For ambiguous or missing target records, emit review or blocked with reason=missing_context and navigation evidence.",
    "- For complete boundaries, include concrete summary and evidence. For external record mutations, include work_surface_operations instead of prose-only claims.",
  );
  return lines;
}

export async function assembleExecutionContext(input: {
  envelope: ExecutionEnvelope;
  registry?: PlaybookRegistry;
}): Promise<AssembledExecutionContext> {
  const registry = input.registry ?? await loadDefaultPlaybookRegistry();
  const selectedPlaybooks = selectPlaybooks({
    registry,
    envelope: input.envelope,
  });
  const envelope = input.envelope;
  const rowAnchors = envelope.work_items.map((item) => ({
    [`${item.kind}_record_id`]: item.record_id,
  }));

  const lines = [
    "Assistant Context Router semantic execution request:",
    `project_id: ${envelope.project_id}`,
    `project_root: ${envelope.project_root ?? "unknown"}`,
    `action_name: ${envelope.action_name}`,
    `workflow: ${envelope.workflow ?? "general"}`,
    `trace_id: ${envelope.trace_id ?? "none"}`,
    `source: ${String(envelope.adapter_facts.source ?? "external work-surface semantic context")}`,
    ...renderOriginSummary(envelope.work_surface_origin),
    "",
    "work_surface_origin_json:",
    renderOrigin(envelope.work_surface_origin),
    "",
    "execution_context:",
    stringify(envelope.work_items.map(compactWorkItem)),
    "",
    ...renderAdapterFacts(envelope.adapter_facts),
    "",
    ...renderPlaybooks(selectedPlaybooks),
    "navigation guidance:",
    "prompt_budget_rule: Prefer targeted searches and bounded reads before loading large project docs or long histories; keep enough evidence for the boundary without dragging unrelated context into the main session.",
    "search_budget_rule: Avoid broad repo-root rg over vague terms. Prefer rg --files, exact file paths, narrow globs/directories, and max-count/context limits so tool output stays small.",
    "- Treat work_surface_origin as the factual map entrance, not as completed context.",
    "- Treat adapter_facts_json as read-only adapter-provided navigation facts; if it includes work_surface_navigation_manifest, use its table catalog, field roles, source table schema, and query_recipes to decide what to inspect next.",
    "- Do not expect target records to be preloaded in the prompt; query the work surface on demand using the manifest before declaring source/table/candidate facts missing.",
    "- If more work-surface facts are needed, inspect the indicated source/table/record with available tools before acting.",
    "- If referenced objects cannot be uniquely identified, emit review with reason=missing_context instead of guessing.",
    "navigation_rule: Use work_surface_origin as the map entrance. Inspect the indicated source/table/record when you need more facts; if referenced objects cannot be uniquely resolved, emit review with reason=missing_context instead of guessing.",
    "",
    "expected boundary:",
    "boundary_rule: Do not emit complete just because dispatch was accepted; complete only after verified work, with concrete summary and evidence.",
    "- Start real project work from the execution_context above.",
    "- Do not mark the card complete just because this dispatch was accepted.",
    "- Never emit a complete boundary before verifying that the requested work actually happened.",
    "- When you reach a boundary, emit exactly one ACR automation block in your assistant output:",
    "  - action_name=complete when the work is done",
    "  - action_name=review when human/agent review is needed",
    "  - action_name=blocked when human decision or external dependency blocks execution",
    "- Include the original task_record_id or bug_record_id in parameters.",
    "- For complete, include parameters.summary with a concrete outcome; do not reuse the task title as the summary.",
    "- For complete, include parameters.evidence describing the changed records/files/commands or verification evidence.",
    "- If the requested work changes external work-surface records, include parameters.work_surface_operations; do not describe record mutations only in prose evidence.",
    "- For Feishu Base record updates, use operation=update_record, source_system=feishu_base, table_id, record_id, set_fields, and verify_fields. ACR will apply and verify these side effects.",
    "- For Bug complete, include parameters.fix_result as exactly one of: Fixed, Won't fix, Can't rep.",
    "- Do not copy placeholder values. If you cannot complete the work, emit review/blocked instead of complete.",
    "- Do not ask project owner to copy this block; Assistant Context Router captures it automatically.",
    "",
    "completion_boundary_schema:",
    "This is a schema, not a ready-to-send completion. Replace placeholders only after real work is done.",
    "[ACR_AUTOMATION]",
    renderBoundarySchema(envelope),
    "[/ACR_AUTOMATION]",
  ];

  if (rowAnchors.length > 0) {
    lines.push("", "row_anchors:", stringify(rowAnchors));
  }

  return {
    agent_context: lines.join("\n"),
    selected_playbooks: selectedPlaybooks,
  };
}
