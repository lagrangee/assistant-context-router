import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createAssistantContextRouterPlugin } from "../../adapters/openclaw/plugin/src/index.ts";
import { writeFeishuAdapterConfigFile } from "../../adapters/feishu/src/config-host.ts";
import { readBusinessNotificationRecords } from "../../core/src/routing/business-notification-log.ts";
import { projectSessionEventPath } from "../../core/src/routing/project-session-lane.ts";
import { readWorkSurfaceProjectionSnapshot } from "../../core/src/routing/work-surface-projection.ts";
import { readBusinessNotificationDeliveryRecords } from "../../core/src/state/business-notification-delivery-outbox.ts";
import { readGovernanceDeliveryRecords } from "../../core/src/state/governance-delivery-outbox.ts";
import { createMainSessionEscalationStore } from "../../core/src/state/main-session-escalation-store.ts";
import {
  loadDemoAcrFixture,
  makeCopiedDemoAcrWorkspace,
  makeDemoAcrWorkspace,
  makeTempProjectWorkspace,
  writeRuntimeBindingsConfig,
} from "../test-helpers.ts";

async function readStoredRouteTrace(dataDir: string, sessionKey: string): Promise<{
  trace_id?: string | null;
  route_source?: string | null;
  target_kind?: string | null;
  target_id?: string | null;
  safe_fail?: boolean;
  safe_fail_reason?: string | null;
} | null> {
  const storePath = path.join(
    dataDir,
    "assistant-context-router",
    "session-project-store.json",
  );
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as {
    sessions?: Record<
      string,
      {
        last_route_trace?: {
          trace_id?: string | null;
          route_source?: string | null;
          target_kind?: string | null;
          target_id?: string | null;
          safe_fail?: boolean;
          safe_fail_reason?: string | null;
        };
      }
    >;
  };

  return parsed.sessions?.[sessionKey]?.last_route_trace ?? null;
}

test("demo-acr append_project_note fixture falls back to shadow lane when openclaw runtime system API is unavailable", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("append-note");
  const result = await beforeDispatch?.(fixture);

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  const log = await readFile(lanePath, "utf8");
  assert.match(log, /append_project_note/);
  assert.match(log, /project_session/);
  assert.match(log, /missing_openclaw_runtime_system_api/);
  assert.match(log, /"delivery_result":\{"status":"failed"/);
});

test("structured automation wrapper routes append_project_note as project_session instead of human chat text", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("append-note");
  const wrappedMessage = `[ACR_AUTOMATION]\n${JSON.stringify(fixture, null, 2)}\n[/ACR_AUTOMATION]`;
  const result = await beforeDispatch?.({
    content: wrappedMessage,
    sessionKey: "agent:main:main",
    channel: "feishu",
  });

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  const log = await readFile(lanePath, "utf8");
  assert.match(log, /append_project_note/);
  assert.match(log, /missing_openclaw_runtime_system_api/);
});

test("structured automation wrapper survives leading host metadata prefix stripping", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("append-note");
  const wrappedMessage = `[host-meta] [ACR_AUTOMATION]\n${JSON.stringify(fixture, null, 2)}\n[/ACR_AUTOMATION]`;
  const result = await beforeDispatch?.({
    content: wrappedMessage,
    sessionKey: "agent:main:main",
    channel: "feishu",
  });

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  const log = await readFile(lanePath, "utf8");
  assert.match(log, /append_project_note/);
  assert.match(log, /missing_openclaw_runtime_system_api/);
});

test("structured automation wrapper survives non-bracketed host preamble", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("append-note");
  const wrappedMessage = `sender=automation-bot\nchat=automation-ingress\n[ACR_AUTOMATION]\n${JSON.stringify(fixture, null, 2)}\n[/ACR_AUTOMATION]`;
  const result = await beforeDispatch?.({
    content: wrappedMessage,
    sessionKey: "agent:main:main",
    channel: "feishu",
  });

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  const log = await readFile(lanePath, "utf8");
  assert.match(log, /append_project_note/);
  assert.match(log, /missing_openclaw_runtime_system_api/);
});

test("bare automation JSON body still routes append_project_note when host strips protocol wrapper", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("append-note");
  const bareMessage = JSON.stringify(fixture, null, 2);
  const result = await beforeDispatch?.({
    content: bareMessage,
    sessionKey: "agent:main:main",
    channel: "feishu",
  });

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  const log = await readFile(lanePath, "utf8");
  assert.match(log, /append_project_note/);
  assert.match(log, /missing_openclaw_runtime_system_api/);
});

test("malformed structured automation wrapper safe-fails instead of entering normal conversation path", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const result = await beforeDispatch?.({
    content: `[ACR_AUTOMATION]\n{"payload": {"project_id": "demo-acr", "action_name": "append_project_note"}\n[/ACR_AUTOMATION]`,
    sessionKey: "agent:main:main",
    channel: "feishu",
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /malformed automation message/i);
});

test("demo-acr dispatch fixture can reply directly to channel and log completion", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceHandlers: {
      "demo-acr:dispatch": async (request) => ({
        status: "ok",
        result_kind: "accepted",
        summary: `Dispatch accepted for ${request.resolved_project_id}`,
        reply_payload: `Accepted ${request.action_name} for ${request.resolved_project_id}`,
        needs_escalation: false,
        escalation_reason: null,
        run_id: "run-demo-dispatch-001",
        queue_ref: "queue-demo-dispatch-001",
        artifact_ref: {
          kind: "pull_request",
          label: "PR #42",
          target: "https://example.test/pr/42",
        },
        trace_patch: {
          accepted: true,
        },
      }),
    },
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("dispatch-ok");
  const sessionKey = "agent:main:demo-acr-dispatch";
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey,
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Accepted dispatch/);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  const log = await readFile(lanePath, "utf8");
  assert.match(log, /Accepted dispatch/);
  assert.match(log, /"status":"ok"/);
  assert.match(log, /"result_kind":"accepted"/);
  assert.match(log, /"summary":"Dispatch accepted for demo-acr"/);
  assert.match(log, /"run_id":"run-demo-dispatch-001"/);
  assert.match(log, /"queue_ref":"queue-demo-dispatch-001"/);
  assert.match(log, /"artifact_ref":\{"kind":"pull_request","label":"PR #42","target":"https:\/\/example\.test\/pr\/42"\}/);
  assert.match(log, /"signal_kind":"high_signal_completion"/);

  const workSurfaceSnapshot = await readWorkSurfaceProjectionSnapshot({
    projectId: "demo-acr",
    dataDir: workspace.dataDir,
  });
  assert.equal(workSurfaceSnapshot?.surface_status, "completed");
  assert.equal(workSurfaceSnapshot?.headline, "Completed: dispatch");
  assert.equal(workSurfaceSnapshot?.artifact_ref?.target, "https://example.test/pr/42");

  const trace = await readStoredRouteTrace(workspace.dataDir, sessionKey);
  assert.equal(trace?.trace_id, "demo-acr-dispatch-ok-001");
  assert.equal(trace?.route_source, "automation");
  assert.equal(trace?.target_kind, "service");
  assert.equal(trace?.target_id, "demo-acr:dispatch");
  assert.equal(trace?.safe_fail, false);

  const deliveryOutbox = await readBusinessNotificationDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(deliveryOutbox.length, 1);
  assert.equal(deliveryOutbox[0]?.status, "record_only");
  assert.match(String(deliveryOutbox[0]?.error_reason), /record_only:unsupported_feishu_reply_target/);
});

test("task/bug writeback observer receives project router policy defaults on service path", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  dispatch:
    target_kind: service
    workflow: dispatch
task_bug_policy:
  defaults:
    acceptance_mode: agent_can_finalize
    completion_notify_mode: dm_on_completion_boundary
`,
  );

  const observed: Array<{
    projectId: string;
    taskRecordId: string | null;
    acceptanceMode: string | null | undefined;
    completionNotifyMode: string | null | undefined;
    summary: string | null | undefined;
  }> = [];

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceHandlers: {
      dispatch: async () => ({
        status: "ok",
        result_kind: "accepted",
        summary: "Dispatch accepted for proj-sample",
        reply_payload: "Accepted dispatch for proj-sample",
        needs_escalation: false,
        escalation_reason: null,
        run_id: "run-task-writeback-hook-001",
        queue_ref: "queue-task-writeback-hook-001",
        artifact_ref: null,
        trace_patch: null,
      }),
    },
    taskBugWritebackObserver: async (input) => {
      observed.push({
        projectId: input.projectId,
        taskRecordId:
          typeof input.envelope.parameters?.task_record_id === "string"
            ? input.envelope.parameters.task_record_id
            : null,
        acceptanceMode: input.routerConfig.task_bug_policy?.defaults?.acceptance_mode,
        completionNotifyMode:
          input.routerConfig.task_bug_policy?.defaults?.completion_notify_mode,
        summary: input.serviceResult.summary,
      });
    },
  });

  const handlers = new Map<
    string,
    (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>
  >();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const result = await beforeDispatch?.({
    channel: "feishu",
    sessionKey: "agent:main:human",
    payload: {
      project_id: "proj-sample",
      action_name: "dispatch",
      workflow: "dispatch",
      parameters: {
        task_record_id: "rec-task-1",
      },
      trace_id: "trace-task-writeback-hook-001",
      reply_target: {
        target_kind: "channel",
        target_id: "oc_test_dispatch",
        visibility: "system_facing",
        reply_mode: "direct",
      },
    },
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Accepted dispatch/);
  assert.equal(observed.length, 1);
  assert.deepEqual(observed[0], {
    projectId: "proj-sample",
    taskRecordId: "rec-task-1",
    acceptanceMode: "agent_can_finalize",
    completionNotifyMode: "dm_on_completion_boundary",
    summary: "Dispatch accepted for proj-sample",
  });
});

test("work-surface projection observer receives snapshot from the real signal path", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const observed: Array<{
    projectId: string;
    snapshotPath: string;
    surfaceStatus: string;
    headline: string;
    dataDir?: string;
  }> = [];

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    workSurfaceProjectionObserver: async (input) => {
      observed.push({
        projectId: input.projectId,
        snapshotPath: input.snapshotPath,
        surfaceStatus: input.snapshot.surface_status,
        headline: input.snapshot.headline,
        dataDir: input.dataDir,
      });
    },
    serviceHandlers: {
      "demo-acr:dispatch": async (request) => ({
        status: "ok",
        result_kind: "accepted",
        summary: `Dispatch accepted for ${request.resolved_project_id}`,
        reply_payload: `Accepted ${request.action_name} for ${request.resolved_project_id}`,
        needs_escalation: false,
        escalation_reason: null,
        run_id: "run-demo-dispatch-observer-001",
        queue_ref: "queue-demo-dispatch-observer-001",
        artifact_ref: {
          kind: "pull_request",
          label: "PR #43",
          target: "https://example.test/pr/43",
        },
        trace_patch: null,
      }),
    },
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("dispatch-ok");
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey: "agent:main:demo-acr-observer",
  });

  assert.equal(result?.handled, true);
  assert.equal(observed.length, 1);
  assert.equal(observed[0]?.projectId, "demo-acr");
  assert.equal(observed[0]?.surfaceStatus, "completed");
  assert.equal(observed[0]?.headline, "Completed: dispatch");
  assert.equal(observed[0]?.dataDir, workspace.dataDir);
  assert.match(String(observed[0]?.snapshotPath), /work-surface-projections\/demo-acr\.json$/);
});

test("work-surface projection observer safe-fails without breaking dispatch", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    workSurfaceProjectionObserver: async () => {
      throw new Error("observer_failed");
    },
    serviceHandlers: {
      "demo-acr:dispatch": async (request) => ({
        status: "ok",
        result_kind: "accepted",
        summary: `Dispatch accepted for ${request.resolved_project_id}`,
        reply_payload: `Accepted ${request.action_name} for ${request.resolved_project_id}`,
        needs_escalation: false,
        escalation_reason: null,
        run_id: "run-demo-dispatch-observer-safe-fail-001",
        queue_ref: "queue-demo-dispatch-observer-safe-fail-001",
        artifact_ref: null,
        trace_patch: null,
      }),
    },
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("dispatch-ok");
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey: "agent:main:demo-acr-observer-safe-fail",
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Accepted dispatch/);

  const workSurfaceSnapshot = await readWorkSurfaceProjectionSnapshot({
    projectId: "demo-acr",
    dataDir: workspace.dataDir,
  });
  assert.equal(workSurfaceSnapshot?.surface_status, "completed");
});

test("demo-acr review fixture records review_request signal", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const escalationStore = createMainSessionEscalationStore({ dataDir: workspace.dataDir });
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceHandlers: {
      "demo-acr:review": async () => ({
        status: "needs_escalation",
        result_kind: "needs_escalation",
        summary: "Review requires human reviewer",
        reply_payload: null,
        needs_escalation: true,
        escalation_reason: "review_required",
        run_id: "run-demo-review-001",
        artifact_ref: {
          kind: "review_target",
          label: "Diff bundle",
          target: "file:///tmp/review-target.diff",
        },
        trace_patch: {
          escalation: "review_required",
        },
      }),
    },
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("review-request");
  const sessionKey = "agent:main:demo-acr-review";
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey,
  });

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  const log = await readFile(lanePath, "utf8");
  assert.match(log, /"signal_kind":"review_request"/);
  assert.match(log, /"status":"needs_escalation"/);
  assert.match(log, /"result_kind":"needs_escalation"/);
  assert.match(log, /"summary":"Review requires human reviewer"/);
  assert.match(log, /"run_id":"run-demo-review-001"/);
  assert.match(log, /"artifact_ref":\{"kind":"review_target","label":"Diff bundle","target":"file:\/\/\/tmp\/review-target\.diff"\}/);

  const notifications = await readBusinessNotificationRecords({
    projectId: "demo-acr",
    dataDir: workspace.dataDir,
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.signal_kind, "review_request");
  assert.equal(notifications[0]?.artifact_ref?.kind, "review_target");
  assert.equal(notifications[0]?.artifact_ref?.target, "file:///tmp/review-target.diff");

  const workSurfaceSnapshot = await readWorkSurfaceProjectionSnapshot({
    projectId: "demo-acr",
    dataDir: workspace.dataDir,
  });
  assert.equal(workSurfaceSnapshot?.surface_status, "in_review");
  assert.equal(workSurfaceSnapshot?.headline, "Review requested: review");
  assert.equal(workSurfaceSnapshot?.artifact_ref?.kind, "review_target");

  const deliveryOutbox = await readBusinessNotificationDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(deliveryOutbox.length, 1);
  assert.equal(deliveryOutbox[0]?.status, "record_only");

  const openEscalations = await escalationStore.listOpen({
    canonicalSessionKey: sessionKey,
    projectId: "demo-acr",
  });
  assert.equal(openEscalations.length, 0);
});

test("human decision blocked signal records both business notification and main-session escalation", async () => {
  const workspace = await makeDemoAcrWorkspace();
  await writeFeishuAdapterConfigFile({
    dataDir: workspace.dataDir,
    template: {
      governanceTarget: {
        target_ref: "local:human_dm",
      },
    },
  });
  const escalationStore = createMainSessionEscalationStore({ dataDir: workspace.dataDir });
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceHandlers: {
      "demo-acr:dispatch": async () => ({
        status: "needs_escalation",
        result_kind: "needs_escalation",
        summary: "Dispatch is blocked until project owner approval is granted",
        reply_payload: null,
        needs_escalation: true,
        escalation_reason: "blocked_human_decision_required_project_owner_approval",
        run_id: "run-demo-dispatch-blocked-001",
        queue_ref: "queue-demo-dispatch-blocked-001",
        artifact_ref: {
          kind: "approval_request",
          label: "Approval payload",
          target: "file:///tmp/approval-payload.json",
        },
        trace_patch: {
          escalation: "blocked_human_decision_required_project_owner_approval",
        },
      }),
    },
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("dispatch-ok");
  const sessionKey = "agent:main:demo-acr-dispatch-blocked";
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey,
  });

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const notifications = await readBusinessNotificationRecords({
    projectId: "demo-acr",
    dataDir: workspace.dataDir,
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.signal_kind, "blocked");
  assert.equal(notifications[0]?.artifact_ref?.kind, "approval_request");

  const workSurfaceSnapshot = await readWorkSurfaceProjectionSnapshot({
    projectId: "demo-acr",
    dataDir: workspace.dataDir,
  });
  assert.equal(workSurfaceSnapshot?.surface_status, "blocked");
  assert.equal(workSurfaceSnapshot?.headline, "Blocked: dispatch");
  assert.equal(workSurfaceSnapshot?.artifact_ref?.label, "Approval payload");

  const openEscalations = await escalationStore.listOpen({
    canonicalSessionKey: sessionKey,
    projectId: "demo-acr",
  });
  assert.equal(openEscalations.length, 1);
  assert.equal(openEscalations[0]?.signal_kind, "blocked");
  assert.match(String(openEscalations[0]?.reason), /project owner approval/i);
  assert.equal(openEscalations[0]?.run_id, "run-demo-dispatch-blocked-001");
  assert.equal(openEscalations[0]?.artifact_ref?.target, "file:///tmp/approval-payload.json");

  const governanceDeliveries = await readGovernanceDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(governanceDeliveries.length, 1);
  assert.equal(governanceDeliveries[0]?.project_id, "demo-acr");
  assert.equal(governanceDeliveries[0]?.channel_type, "wechat");
  assert.equal(governanceDeliveries[0]?.target_ref, "local:human_dm");
  assert.equal(governanceDeliveries[0]?.status, "failed");
  assert.equal(
    governanceDeliveries[0]?.error_reason,
    "unresolved_governance_target:local:human_dm",
  );
  assert.match(String(governanceDeliveries[0]?.rendered_message), /ACR governance escalation/);
});

test("governance delivery can resolve local wechat target into canonical runtime session and deliver", async () => {
  const workspace = await makeDemoAcrWorkspace();
  await writeFeishuAdapterConfigFile({
    dataDir: workspace.dataDir,
    template: {
      governanceTarget: {
        target_ref: "local:human_dm",
      },
    },
  });
  const runtimeBindingsPath = await writeRuntimeBindingsConfig({
    root: workspace.root,
    bindings: [
      {
        binding_id: "main-session",
        runtime_kind: "openclaw",
        canonical_session_key: "main:human",
        aliases: ["wechat:dm:human"],
      },
    ],
  });

  const enqueued: Array<{ text: string; sessionKey: string; contextKey?: string | null }> = [];
  const heartbeatRuns: Array<{ reason?: string; sessionKey?: string; target?: string }> = [];

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    runtimeBindingsPath,
    serviceHandlers: {
      "demo-acr:dispatch": async () => ({
        status: "needs_escalation",
        result_kind: "needs_escalation",
        summary: "Dispatch is blocked until project owner approval is granted",
        reply_payload: null,
        needs_escalation: true,
        escalation_reason: "blocked_human_decision_required_project_owner_approval",
        run_id: "run-demo-dispatch-blocked-002",
        queue_ref: "queue-demo-dispatch-blocked-002",
        artifact_ref: null,
        trace_patch: null,
      }),
    },
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    runtime: {
      system: {
        enqueueSystemEvent(text, options) {
          enqueued.push({
            text,
            sessionKey: options.sessionKey,
            contextKey: options.contextKey,
          });
          return true;
        },
        async runHeartbeatOnce(options) {
          heartbeatRuns.push({
            reason: options?.reason,
            sessionKey: options?.sessionKey,
            target: options?.heartbeat?.target,
          });
          return {
            status: "ran",
            durationMs: 8,
          };
        },
      },
    },
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("dispatch-ok");
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey: "main:human",
  });

  assert.equal(result?.handled, true);
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0]?.sessionKey, "main:human");
  assert.match(String(enqueued[0]?.text), /Assistant Context Router governance delivery:/);
  assert.match(String(enqueued[0]?.text), /blocked_human_decision_required_project_owner_approval/);
  assert.equal(heartbeatRuns.length, 1);
  assert.equal(heartbeatRuns[0]?.sessionKey, "main:human");
  assert.equal(heartbeatRuns[0]?.reason, "acr:governance_delivery");

  const governanceDeliveries = await readGovernanceDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(governanceDeliveries.length, 1);
  assert.equal(governanceDeliveries[0]?.status, "delivered");
  assert.equal(governanceDeliveries[0]?.runtime_target_id, "main:human");
  assert.equal(governanceDeliveries[0]?.error_reason, null);
  assert.match(
    JSON.stringify(governanceDeliveries[0]?.trace_patch ?? {}),
    /openclaw_governance_session/,
  );
});

test("demo-acr unresolved project fixture safe-fails without writing a lane event", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceHandlers: {
      dispatch: async () => ({
        status: "ok",
        reply_payload: "should not run",
        needs_escalation: false,
        escalation_reason: null,
      }),
    },
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("unresolved-project");
  const result = await beforeDispatch?.(fixture);

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /safe-fail/i);
  assert.match(String(result?.text), /resolve project/i);

  const lanePath = projectSessionEventPath("demo-acr-missing", workspace.dataDir);
  await assert.rejects(() => readFile(lanePath, "utf8"));
});

test("configured service route missing handler safe-fails without falling back to project session lane", async () => {
  const workspace = await makeCopiedDemoAcrWorkspace();
  await writeFile(
    path.join(workspace.projectRoot, "router.yaml"),
    `actions:
  dispatch:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
  review:
    target_kind: service
    workflow: review
    requires_resolved_project: true
  append_project_note:
    target_kind: project_session
    workflow: general
    requires_resolved_project: true
project_session_binding:
  runtime_kind: openclaw_session
  target_ref: agent:main:demo-acr
  metadata:
    note: "Resolved from current OpenClaw sessions store for Step 2.1 runtime rehearsal."
`,
  );
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const sessionKey = "agent:main:demo-acr-missing-service";
  const fixture = await loadDemoAcrFixture("dispatch-ok");
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey,
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /safe-fail/i);
  assert.match(String(result?.text), /no service handler is registered/i);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  await assert.rejects(() => readFile(lanePath, "utf8"));

  const trace = await readStoredRouteTrace(workspace.dataDir, sessionKey);
  assert.equal(trace?.trace_id, "demo-acr-dispatch-ok-001");
  assert.equal(trace?.route_source, "unresolved");
  assert.equal(trace?.target_kind, "safe_fail");
  assert.equal(trace?.target_id, null);
  assert.equal(trace?.safe_fail, true);
  assert.match(String(trace?.safe_fail_reason), /no service handler is registered/i);
});

test("demo-acr validation_fixture bridge can drive Gate 5 review and blocked scenarios without local handlers", async () => {
  const workspace = await makeCopiedDemoAcrWorkspace();
  await writeFeishuAdapterConfigFile({
    dataDir: workspace.dataDir,
    template: {
      governanceTarget: {
        target_ref: "local:human_dm",
      },
    },
  });
  const fixturePath = path.join(workspace.projectRoot, "validation", "service-results.json");
  await writeFile(
    path.join(workspace.projectRoot, "router.yaml"),
    `actions:
  dispatch:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
  review:
    target_kind: service
    workflow: review
    requires_resolved_project: true
  append_project_note:
    target_kind: project_session
    workflow: general
    requires_resolved_project: true
service_binding:
  runtime_kind: validation_fixture
  target_ref: "${fixturePath}"
project_session_binding:
  runtime_kind: openclaw_session
  target_ref: agent:main:demo-acr
  metadata:
    note: "Resolved from current OpenClaw sessions store for Step 2.1 runtime rehearsal."
`,
  );

  const escalationStore = createMainSessionEscalationStore({ dataDir: workspace.dataDir });
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const reviewFixture = await loadDemoAcrFixture("review-request");
  const reviewSessionKey = "agent:main:demo-acr-review-fixture";
  const reviewResult = await beforeDispatch?.({
    ...reviewFixture,
    sessionKey: reviewSessionKey,
  });

  assert.equal(reviewResult?.handled, true);
  const notificationsAfterReview = await readBusinessNotificationRecords({
    projectId: "demo-acr",
    dataDir: workspace.dataDir,
  });
  assert.equal(notificationsAfterReview.length, 1);
  assert.equal(notificationsAfterReview[0]?.signal_kind, "review_request");

  const openReviewEscalations = await escalationStore.listOpen({
    canonicalSessionKey: reviewSessionKey,
    projectId: "demo-acr",
  });
  assert.equal(openReviewEscalations.length, 0);

  const blockedFixture = await loadDemoAcrFixture("blocked-human-decision");
  const blockedRepeatFixture = await loadDemoAcrFixture("blocked-human-decision-repeat");
  const blockedSessionKey = "agent:main:demo-acr-blocked-fixture";

  const blockedResult = await beforeDispatch?.({
    ...blockedFixture,
    sessionKey: blockedSessionKey,
  });
  assert.equal(blockedResult?.handled, true);

  const openBlockedEscalations = await escalationStore.listOpen({
    canonicalSessionKey: blockedSessionKey,
    projectId: "demo-acr",
  });
  assert.equal(openBlockedEscalations.length, 1);
  assert.equal(openBlockedEscalations[0]?.signal_kind, "blocked");
  assert.match(String(openBlockedEscalations[0]?.reason), /project owner approval/i);

  const repeatedBlockedResult = await beforeDispatch?.({
    ...blockedRepeatFixture,
    sessionKey: blockedSessionKey,
  });
  assert.equal(repeatedBlockedResult?.handled, true);

  const openBlockedEscalationsAfterRepeat = await escalationStore.listOpen({
    canonicalSessionKey: blockedSessionKey,
    projectId: "demo-acr",
  });
  assert.equal(openBlockedEscalationsAfterRepeat.length, 1);

  const governanceDeliveries = await readGovernanceDeliveryRecords({
    dataDir: workspace.dataDir,
  });
  assert.equal(governanceDeliveries.length, 1);
  assert.equal(governanceDeliveries[0]?.status, "failed");
  assert.equal(
    governanceDeliveries[0]?.error_reason,
    "unresolved_governance_target:local:human_dm",
  );
});

test("demo-acr validation_fixture bridge keeps high-signal completion off main session by default", async () => {
  const workspace = await makeCopiedDemoAcrWorkspace();
  const fixturePath = path.join(workspace.projectRoot, "validation", "service-results.json");
  await writeFile(
    path.join(workspace.projectRoot, "router.yaml"),
    `actions:
  dispatch:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
  review:
    target_kind: service
    workflow: review
    requires_resolved_project: true
  append_project_note:
    target_kind: project_session
    workflow: general
    requires_resolved_project: true
service_binding:
  runtime_kind: validation_fixture
  target_ref: "${fixturePath}"
project_session_binding:
  runtime_kind: openclaw_session
  target_ref: agent:main:demo-acr
  metadata:
    note: "Resolved from current OpenClaw sessions store for Step 2.1 runtime rehearsal."
`,
  );

  const escalationStore = createMainSessionEscalationStore({ dataDir: workspace.dataDir });
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const fixture = await loadDemoAcrFixture("dispatch-ok");
  const sessionKey = "agent:main:demo-acr-completion-fixture";
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey,
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Accepted dispatch/);

  const notifications = await readBusinessNotificationRecords({
    projectId: "demo-acr",
    dataDir: workspace.dataDir,
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.signal_kind, "high_signal_completion");

  const openEscalations = await escalationStore.listOpen({
    canonicalSessionKey: sessionKey,
    projectId: "demo-acr",
  });
  assert.equal(openEscalations.length, 0);
});

test("project-owned service binding can bridge dispatch into external ingress without local handler", async () => {
  const workspace = await makeCopiedDemoAcrWorkspace();
  const bridgeTarget = path.join(workspace.root, "orchestrator-ingress.jsonl");
  await writeFile(
    path.join(workspace.projectRoot, "router.yaml"),
    `actions:
  dispatch:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
  review:
    target_kind: service
    workflow: review
    requires_resolved_project: true
service_binding:
  runtime_kind: file_jsonl
  target_ref: "${bridgeTarget}"
`,
  );

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceBridgeAdapters: {
      file_jsonl: async ({ binding, request }) => {
        await appendFile(
          binding.target_ref,
          `${JSON.stringify({
            action_name: request.action_name,
            resolved_project_id: request.resolved_project_id,
            workflow: request.workflow,
            parameters: request.parameters,
            trace_id: request.trace_id,
          })}\n`,
          "utf8",
        );

        return {
          status: "ok",
          result_kind: "queued",
          summary: `Queued ${request.action_name} for ${request.resolved_project_id}`,
          reply_payload: null,
          needs_escalation: false,
          escalation_reason: null,
          queue_ref: "queue-bridge-dispatch-001",
          trace_patch: {
            bridged_by: "file_jsonl",
          },
        };
      },
    },
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  await plugin.register({
    registerCommand() {},
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  });

  const beforeDispatch = handlers.get("before_dispatch");
  assert.ok(beforeDispatch);

  const sessionKey = "agent:main:demo-acr-bridge";
  const fixture = await loadDemoAcrFixture("dispatch-ok");
  const result = await beforeDispatch?.({
    ...fixture,
    sessionKey,
  });

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const bridgeLog = await readFile(bridgeTarget, "utf8");
  assert.match(bridgeLog, /"action_name":"dispatch"/);
  assert.match(bridgeLog, /"resolved_project_id":"demo-acr"/);
  assert.match(bridgeLog, /"trace_id":"demo-acr-dispatch-ok-001"/);

  const lanePath = projectSessionEventPath("demo-acr", workspace.dataDir);
  const laneLog = await readFile(lanePath, "utf8");
  assert.match(laneLog, /"status":"ok"/);
  assert.match(laneLog, /"result_kind":"queued"/);
  assert.match(laneLog, /"summary":"Queued dispatch for demo-acr"/);
  assert.match(laneLog, /"queue_ref":"queue-bridge-dispatch-001"/);
  assert.match(laneLog, /"bridged_by":"file_jsonl"/);

  const trace = await readStoredRouteTrace(workspace.dataDir, sessionKey);
  assert.equal(trace?.trace_id, "demo-acr-dispatch-ok-001");
  assert.equal(trace?.target_kind, "service");
  assert.equal(trace?.target_id, "demo-acr:dispatch");
  assert.equal(trace?.safe_fail, false);
});
