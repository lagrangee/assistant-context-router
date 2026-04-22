import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { writeFile } from "node:fs/promises";

import { loadProjectRouterConfig, loadRouterConfig, mergeRouterConfigs } from "../../core/src/routing/config.ts";
import { decideRoute } from "../../core/src/routing/decision.ts";
import { normalizeIngressEvent } from "../../core/src/routing/ingress.ts";
import { createAssistantContextRouterPlugin } from "../../adapters/openclaw/plugin/src/index.ts";
import { demoAcrRoot, loadDemoAcrFixture, makeDemoAcrWorkspace, makeTempProjectWorkspace } from "../test-helpers.ts";
import { getProjectById } from "../../core/src/projects/registry.ts";

test("loadRouterConfig parses action routing manifest", async () => {
  const workspace = await makeTempProjectWorkspace();
  const configPath = path.join(workspace.root, "router.yaml");
  await writeFile(
    configPath,
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
service_binding:
  runtime_kind: file_jsonl
  target_ref: /tmp/service-ingress.jsonl
project_session_binding:
  runtime_kind: file_jsonl
  target_ref: /tmp/project-session.jsonl
`,
  );

  const config = await loadRouterConfig(configPath);
  assert.equal(config.actions?.dispatch?.target_kind, "service");
  assert.equal(config.actions?.dispatch?.workflow, "dispatch");
  assert.equal(config.actions?.review?.target_kind, "service");
  assert.equal(config.actions?.review?.workflow, "review");
  assert.equal(config.actions?.append_project_note?.target_kind, "project_session");
  assert.equal(config.service_binding?.runtime_kind, "file_jsonl");
  assert.equal(config.service_binding?.target_ref, "/tmp/service-ingress.jsonl");
  assert.equal(config.project_session_binding?.runtime_kind, "file_jsonl");
  assert.equal(config.project_session_binding?.target_ref, "/tmp/project-session.jsonl");
});

test("loadRouterConfig parses task_bug_policy defaults", async () => {
  const workspace = await makeTempProjectWorkspace();
  const configPath = path.join(workspace.root, "router.yaml");
  await writeFile(
    configPath,
    `task_bug_policy:
  defaults:
    acceptance_mode: agent_can_finalize
    completion_notify_mode: dm_on_completion_boundary
`,
  );

  const config = await loadRouterConfig(configPath);
  assert.equal(
    config.task_bug_policy?.defaults?.acceptance_mode,
    "agent_can_finalize",
  );
  assert.equal(
    config.task_bug_policy?.defaults?.completion_notify_mode,
    "dm_on_completion_boundary",
  );
});

test("decideRoute respects configured project_session target", () => {
  const envelope = normalizeIngressEvent({
    event: {
      channel: "feishu",
      payload: {
        project_id: "proj-openclaw-feishu-orchestrator",
        action_name: "append_project_note",
      },
    },
  });
  assert.ok(envelope);

  const decision = decideRoute({
    envelope,
    sessionKey: "agent:main:human",
    availableServiceActions: new Set(["append_project_note"]),
    actionConfig: {
      target_kind: "project_session",
      workflow: null,
      requires_resolved_project: true,
    },
  });

  assert.equal(decision.target_kind, "project_session");
  assert.match(decision.route_reason, /by config/);
});

test("loadRouterConfig parses demo-acr router manifest", async () => {
  const config = await loadRouterConfig(path.join(demoAcrRoot(), "router.yaml"));
  assert.equal(config.actions?.dispatch?.target_kind, "service");
  assert.equal(config.actions?.dispatch?.workflow, "dispatch");
  assert.equal(config.actions?.review?.target_kind, "service");
  assert.equal(config.actions?.review?.workflow, "review");
  assert.equal(config.actions?.append_project_note?.target_kind, "project_session");
  assert.equal(config.actions?.append_project_note?.workflow, "general");
  assert.equal(config.service_binding?.runtime_kind, "validation_fixture");
  assert.match(
    String(config.service_binding?.target_ref),
    /demo-acr\/validation\/service-results\.json$/,
  );
  assert.equal(config.project_session_binding?.runtime_kind, "openclaw_session");
  assert.equal(
    config.project_session_binding?.target_ref,
    "agent:main:demo-acr",
  );
});

test("plugin can load router config and route configured action to project lane", async () => {
  const workspace = await makeTempProjectWorkspace();
  const configPath = path.join(workspace.root, "router.yaml");
  await writeFile(
    configPath,
    `actions:
  append_project_note:
    target_kind: project_session
`,
  );

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    routerConfigPath: configPath,
    serviceHandlers: {
      append_project_note: async () => ({
        status: "ok",
        reply_payload: "should not be called",
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

  const result = await beforeDispatch?.({
    channel: "feishu",
    payload: {
      project_id: "proj-openclaw-feishu-orchestrator",
      action_name: "append_project_note",
    },
  });

  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);
});

test("configured service route safe-fails when no service handler is registered", async () => {
  const workspace = await makeTempProjectWorkspace();
  const configPath = path.join(workspace.root, "router.yaml");
  await writeFile(
    configPath,
    `actions:
  dispatch:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
`,
  );

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    routerConfigPath: configPath,
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
    channel: "feishu",
    payload: {
      project_id: "proj-openclaw-feishu-orchestrator",
      action_name: "dispatch",
    },
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /safe-fail/i);
  assert.match(String(result?.text), /no service handler is registered/i);
});

test("project-level router manifest overrides global config", async () => {
  const workspace = await makeTempProjectWorkspace();
  const globalConfigPath = path.join(workspace.root, "router.yaml");
  await writeFile(
    globalConfigPath,
    `actions:
  dispatch:
    target_kind: service
    workflow: dispatch
task_bug_policy:
  defaults:
    acceptance_mode: manual_acceptance
    completion_notify_mode: no_dm_on_completion_boundary
`,
  );

  const projectEntry = await getProjectById(
    workspace.registryPath,
    "proj-openclaw-feishu-orchestrator",
  );
  assert.ok(projectEntry);

  await writeFile(
    path.join(projectEntry.project_root, "router.yaml"),
    `actions:
  dispatch:
    target_kind: project_session
    workflow: dispatch
service_binding:
  runtime_kind: project_bridge
  target_ref: bridge://project
task_bug_policy:
  defaults:
    acceptance_mode: agent_can_finalize
`,
  );

  const globalConfig = await loadRouterConfig(globalConfigPath);
  const projectConfig = await loadProjectRouterConfig(projectEntry);
  const merged = mergeRouterConfigs(globalConfig, projectConfig);

  assert.equal(merged.actions?.dispatch?.target_kind, "project_session");
  assert.equal(merged.service_binding?.runtime_kind, "project_bridge");
  assert.equal(merged.service_binding?.target_ref, "bridge://project");
  assert.equal(
    merged.task_bug_policy?.defaults?.acceptance_mode,
    "agent_can_finalize",
  );
  assert.equal(
    merged.task_bug_policy?.defaults?.completion_notify_mode,
    "no_dm_on_completion_boundary",
  );

  const envelope = normalizeIngressEvent({
    event: {
      channel: "feishu",
      payload: {
        project_id: "proj-openclaw-feishu-orchestrator",
        action_name: "dispatch",
      },
    },
  });
  assert.ok(envelope);

  const decision = decideRoute({
    envelope,
    sessionKey: "agent:main:human",
    availableServiceActions: new Set(["dispatch"]),
    actionConfig: merged.actions?.dispatch ?? null,
  });

  assert.equal(decision.target_kind, "project_session");
});

test("plugin resolves demo-acr project-level router manifest through registry", async () => {
  const workspace = await makeDemoAcrWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    serviceHandlers: {
      append_project_note: async () => ({
        status: "ok",
        reply_payload: "should not be called when manifest forces project_session",
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

  const fixture = await loadDemoAcrFixture("append-note");
  const result = await beforeDispatch?.(fixture);
  assert.equal(result?.handled, true);
  assert.equal(result?.text, undefined);

  const entry = await getProjectById(workspace.registryPath, "demo-acr");
  assert.ok(entry);
  const config = await loadProjectRouterConfig(entry);
  assert.equal(config.actions?.append_project_note?.target_kind, "project_session");
  assert.equal(config.project_session_binding?.runtime_kind, "openclaw_session");
});
