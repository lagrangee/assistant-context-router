import test from "node:test";
import assert from "node:assert/strict";

import {
  appendProjectSessionEvent,
  readProjectSessionEvents,
  summarizeProjectSessionEvents,
} from "../../core/src/routing/project-session-lane.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("project session lane stores typed events and can read them back", async () => {
  const workspace = await makeTempProjectWorkspace();
  const projectId = "proj-sample";
  const dataDir = workspace.dataDir;

  await appendProjectSessionEvent({
    projectId,
    dataDir,
    decision: {
      target_kind: "project_session",
      target_id: "project:proj-sample",
      resolved_project_id: "proj-sample",
      project_ref: "proj-sample",
      route_source: "automation",
      route_reason: "Automation message routed to project session event lane",
      route_evidence: ["automation message"],
      workflow: "review",
      fallback_to_main_session: true,
      escalation_reason: "needs_review",
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "proj-sample",
      resolved_project_id: "proj-sample",
      action_name: "append_project_note",
      parameters: { task_id: "T-1" },
      reply_target: null,
      trace_id: "trace-1",
      workflow: "review",
      raw_message_ref: "msg-1",
      text: null,
    },
  });

  const events = await readProjectSessionEvents({ projectId, dataDir });
  const matching = events.filter((event) => event.project_id === projectId);
  const latest = matching[matching.length - 1];

  assert.ok(latest);
  assert.equal(latest?.signal_kind, "review_request");
  assert.equal(latest?.decision.target_kind, "project_session");
  assert.equal(latest?.envelope.action_name, "append_project_note");
});

test("project session lane can summarize high-signal events", async () => {
  const workspace = await makeTempProjectWorkspace();
  const projectId = "proj-summary";
  const dataDir = workspace.dataDir;

  await appendProjectSessionEvent({
    projectId,
    dataDir,
    decision: {
      target_kind: "service",
      target_id: "proj-summary:review",
      resolved_project_id: "proj-summary",
      project_ref: "proj-summary",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "review",
      fallback_to_main_session: true,
      escalation_reason: null,
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "proj-summary",
      resolved_project_id: "proj-summary",
      action_name: "review",
      parameters: null,
      reply_target: null,
      trace_id: "trace-2",
      workflow: "review",
      raw_message_ref: "msg-2",
      text: null,
    },
    serviceResult: {
      status: "ok",
      reply_payload: "accepted",
      needs_escalation: false,
      escalation_reason: null,
      trace_patch: null,
    },
  });

  await appendProjectSessionEvent({
    projectId,
    dataDir,
    decision: {
      target_kind: "service",
      target_id: "proj-summary:review",
      resolved_project_id: "proj-summary",
      project_ref: "proj-summary",
      route_source: "automation",
      route_reason: "Structured automation message routed to internal service",
      route_evidence: ["automation message", "action_name"],
      workflow: "review",
      fallback_to_main_session: true,
      escalation_reason: "blocked_by_missing_reviewer",
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "proj-summary",
      resolved_project_id: "proj-summary",
      action_name: "review",
      parameters: null,
      reply_target: null,
      trace_id: "trace-3",
      workflow: "review",
      raw_message_ref: "msg-3",
      text: null,
    },
    serviceResult: {
      status: "needs_escalation",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "blocked_by_missing_reviewer",
      trace_patch: null,
    },
  });

  const summary = await summarizeProjectSessionEvents({
    projectId,
    dataDir,
  });

  assert.equal(summary.project_id, projectId);
  assert.ok(summary.total_events >= 2);
  assert.ok(summary.high_signal_completion_count >= 1);
  assert.ok(summary.blocked_count >= 1);
  assert.ok(summary.notable_events.length >= 2);
});
