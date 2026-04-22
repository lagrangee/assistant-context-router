import test from "node:test";
import assert from "node:assert/strict";

import { handleProjectLaneCommand } from "../../adapters/openclaw/plugin/src/commands/project-lane.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { appendProjectSessionEvent } from "../../core/src/routing/project-session-lane.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("project-lane command uses current session project by default", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:lane", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  await appendProjectSessionEvent({
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
    decision: {
      target_kind: "project_session",
      target_id: "project:proj-sample",
      resolved_project_id: "proj-sample",
      project_ref: "proj-sample",
      route_source: "automation",
      route_reason: "Automation message routed to project session event lane",
      route_evidence: ["automation message"],
      workflow: null,
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
      parameters: null,
      reply_target: null,
      trace_id: "trace-1",
      workflow: null,
      raw_message_ref: "msg-1",
      text: null,
    },
    serviceResult: {
      status: "needs_escalation",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "needs_review",
      summary: "Review target is ready",
      run_id: "run-lane-review-1",
      queue_ref: null,
      artifact_ref: {
        kind: "review_target",
        label: "Diff bundle",
        target: "file:///tmp/review-target.diff",
      },
      trace_patch: null,
    },
  });

  const result = await handleProjectLaneCommand({
    registryPath: workspace.registryPath,
    store,
    sessionKey: "session:lane",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /Project lane summary: proj-sample/);
  assert.match(result.content, /review_request/);
  assert.match(result.content, /review-request events: 1/);
  assert.match(result.content, /not deduped unresolved governance items/i);
  assert.match(result.content, /evidence: Diff bundle \| review_target \| file:\/\/\/tmp\/review-target\.diff/);
});

test("project-lane command accepts explicit project id", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleProjectLaneCommand({
    registryPath: workspace.registryPath,
    store,
    projectId: "proj-openclaw-feishu-orchestrator",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /Project lane summary: proj-openclaw-feishu-orchestrator/);
  assert.match(result.content, /No events recorded yet/);
});

test("project-lane command presents blocked counts as event history, not open escalation count", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:lane-history", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  for (const traceId of ["trace-blocked-1", "trace-blocked-2"]) {
    await appendProjectSessionEvent({
      projectId: "proj-sample",
      dataDir: workspace.dataDir,
      decision: {
        target_kind: "service",
        target_id: "proj-sample:dispatch",
        resolved_project_id: "proj-sample",
        project_ref: "proj-sample",
        route_source: "automation",
        route_reason: "Structured automation message routed to internal service",
        route_evidence: ["automation message"],
        workflow: "dispatch",
        fallback_to_main_session: true,
        escalation_reason: "human decision required",
        safe_fail_reason: null,
      },
      envelope: {
        source_type: "automation",
        channel_type: "feishu",
        project_ref: "proj-sample",
        resolved_project_id: "proj-sample",
        action_name: "dispatch",
        parameters: null,
        reply_target: null,
        trace_id: traceId,
        workflow: "dispatch",
        raw_message_ref: traceId,
        text: null,
      },
      serviceResult: {
        status: "needs_escalation",
        reply_payload: null,
        needs_escalation: true,
        escalation_reason: "human decision required",
        summary: "Dispatch is blocked pending approval",
        trace_patch: null,
      },
    });
  }

  const result = await handleProjectLaneCommand({
    registryPath: workspace.registryPath,
    store,
    sessionKey: "session:lane-history",
    dataDir: workspace.dataDir,
  });

  assert.match(result.content, /blocked events: 2/);
  assert.match(result.content, /not deduped unresolved governance items/i);
});
