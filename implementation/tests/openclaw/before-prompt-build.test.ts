import test from "node:test";
import assert from "node:assert/strict";

import { createBeforePromptBuildHook } from "../../adapters/openclaw/plugin/src/hooks/before-prompt-build.ts";
import { appendProjectSessionEvent } from "../../core/src/routing/project-session-lane.ts";
import { createMainSessionEscalationStore } from "../../core/src/state/main-session-escalation-store.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { createSafeFailTrace } from "../../core/src/trace/route-trace.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("before_prompt_build injects project context into system prompt", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("session:hook", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    dataDir: workspace.dataDir,
  });

  const result = await hook({
    sessionKey: "session:hook",
    systemPrompt: "Base system prompt.",
    messages: [],
  });

  assert.match(String(result.prependSystemContext), /Assistant Context Router project context/);
  assert.match(String(result.prependSystemContext), /proj-sample/);
  assert.match(String(result.prependSystemContext), /Step 1\.5 hall-doc recovery is next/);
  assert.match(String(result.prependSystemContext), /Update the project context loader/);
});

test("before_prompt_build safe-fails when stored project is unresolved", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("session:missing", {
    current_project_id: "proj-missing",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
    last_route_trace: createSafeFailTrace("seed"),
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    dataDir: workspace.dataDir,
  });

  const payload = { sessionKey: "session:missing", systemPrompt: "Base system prompt.", messages: [] };
  const result = await hook(payload);
  const stored = await store.get("session:missing");

  assert.match(String(result.prependSystemContext), /invalidated/);
  assert.equal(stored?.last_route_trace?.safe_fail, true);
  assert.equal(stored?.current_project_id, null);
  assert.match(String(stored?.last_route_trace?.reason), /could not be resolved/);
});

test("before_prompt_build returns empty result when no session project is bound", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    dataDir: workspace.dataDir,
  });

  const result = await hook({
    sessionKey: "session:none",
    messages: [],
  });

  assert.deepEqual(result, {});
});

test("before_prompt_build adds project lane summary when notable events exist", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("session:hook-lane", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
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
      parameters: null,
      reply_target: null,
      trace_id: "trace-hook-lane",
      workflow: "review",
      raw_message_ref: "msg-hook-lane",
      text: null,
    },
    serviceResult: {
      status: "needs_escalation",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "needs_review",
      summary: "Review target is ready",
      run_id: "run-hook-lane-1",
      queue_ref: null,
      artifact_ref: {
        kind: "review_target",
        label: "Diff bundle",
        target: "file:///tmp/review-target.diff",
      },
      trace_patch: null,
    },
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    dataDir: workspace.dataDir,
  });

  const result = await hook({
    sessionKey: "session:hook-lane",
    messages: [{ role: "user", content: "What needs my attention in this project right now?" }],
  });

  assert.match(String(result.prependSystemContext), /project lane summary/i);
  assert.match(String(result.prependSystemContext), /review_request_count: 1/);
  assert.match(String(result.prependSystemContext), /append_project_note/);
  assert.match(
    String(result.prependSystemContext),
    /artifact_ref: Diff bundle \| review_target \| file:\/\/\/tmp\/review-target\.diff/,
  );
});

test("before_prompt_build does not add project lane summary when there are no notable events", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("session:hook-lane-empty", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    dataDir: workspace.dataDir,
  });

  const result = await hook({
    sessionKey: "session:hook-lane-empty",
    messages: [{ role: "user", content: "What needs my attention in this project right now?" }],
  });

  assert.doesNotMatch(String(result.prependSystemContext), /project lane summary/i);
});

test("before_prompt_build does not add lane summary for unrelated project questions", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("session:hook-lane-unrelated", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
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
      parameters: null,
      reply_target: null,
      trace_id: "trace-hook-lane-unrelated",
      workflow: "review",
      raw_message_ref: "msg-hook-lane-unrelated",
      text: null,
    },
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    dataDir: workspace.dataDir,
  });

  const result = await hook({
    sessionKey: "session:hook-lane-unrelated",
    messages: [{ role: "user", content: "Explain the project objective." }],
  });

  assert.doesNotMatch(String(result.prependSystemContext), /project lane summary/i);
});

test("before_prompt_build does not add lane summary for generic project status questions", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("session:hook-lane-status", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
  });

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
      trace_id: "trace-hook-lane-status",
      workflow: "dispatch",
      raw_message_ref: "msg-hook-lane-status",
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

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    dataDir: workspace.dataDir,
  });

  const result = await hook({
    sessionKey: "session:hook-lane-status",
    messages: [{ role: "user", content: "这个项目当前状态怎么样？" }],
  });

  assert.doesNotMatch(String(result.prependSystemContext), /project lane summary/i);
});

test("before_prompt_build still adds lane summary for explicit automation history questions", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  await store.set("session:hook-lane-automation", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
  });

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
      escalation_reason: null,
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
      trace_id: "trace-hook-lane-automation",
      workflow: "dispatch",
      raw_message_ref: "msg-hook-lane-automation",
      text: null,
    },
    serviceResult: {
      status: "ok",
      reply_payload: "accepted",
      needs_escalation: false,
      escalation_reason: null,
      summary: "Accepted dispatch for proj-sample",
      trace_patch: null,
    },
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    dataDir: workspace.dataDir,
  });

  const result = await hook({
    sessionKey: "session:hook-lane-automation",
    messages: [{ role: "user", content: "最近自动化发生了什么？" }],
  });

  assert.match(String(result.prependSystemContext), /project lane summary/i);
  assert.match(String(result.prependSystemContext), /high_signal_completion_count: 1/);
});

test("before_prompt_build adds unresolved main-session escalations as governance hints", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  const escalationStore = createMainSessionEscalationStore({ dataDir: workspace.dataDir });
  await store.set("session:hook-escalation", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
  });

  await escalationStore.upsertOpen({
    canonical_session_key: "session:hook-escalation",
    project_id: "proj-sample",
    signal_kind: "blocked",
    source: "service_result",
    target: "main_session",
    reason: "human decision required",
    summary: "Need project owner approval before dispatch can continue",
    trace_id: "trace-escalation-1",
    action_name: "dispatch",
    workflow: "dispatch",
    run_id: "run-escalation-1",
    queue_ref: "queue-escalation-1",
    artifact_ref: {
      kind: "approval_request",
      label: "Approval packet",
      target: "file:///tmp/approval-packet.json",
    },
    resolution: null,
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
    escalationStore,
    dataDir: workspace.dataDir,
  });

  const result = await hook({
    sessionKey: "session:hook-escalation",
    messages: [{ role: "user", content: "继续这个项目吧" }],
  });

  assert.match(String(result.prependSystemContext), /main-session escalations/i);
  assert.match(String(result.prependSystemContext), /human decision required/i);
  assert.match(String(result.prependSystemContext), /trace-escalation-1/);
  assert.match(
    String(result.prependSystemContext),
    /artifact_ref: Approval packet \| approval_request \| file:\/\/\/tmp\/approval-packet\.json/,
  );
});
