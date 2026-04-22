import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createAssistantContextRouterPlugin } from "../../adapters/openclaw/plugin/src/index.ts";
import { buildGovernanceDeliverySeed } from "../../core/src/routing/governance-delivery.ts";
import { createGovernanceDeliveryOutbox } from "../../core/src/state/governance-delivery-outbox.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("plugin registers commands and hooks", async () => {
  const workspace = await makeTempProjectWorkspace();
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const commands: string[] = [];
  const hooks: string[] = [];

  await plugin.register({
    registerCommand(command) {
      commands.push(command.name);
    },
    on(eventName) {
      hooks.push(eventName);
    },
  });

  assert.deepEqual(commands.sort(), ["project"]);
  assert.deepEqual(hooks.sort(), ["before_dispatch", "before_prompt_build", "llm_output"]);
});

test("default plugin export does not require config.registryPath", async () => {
  const module = await import("../../adapters/openclaw/plugin/src/index.ts");
  const plugin = module.default;
  assert.ok(plugin);

  let registered = 0;
  await plugin.register({
    config: {
      dataDir: path.join(process.cwd(), ".tmp-plugin-data"),
    },
    registerCommand() {
      registered += 1;
    },
    on() {},
  });

  assert.equal(registered, 1);
});

test("before_dispatch handles slash-like /project --all input from nested message payload", async () => {
  const workspace = await makeTempProjectWorkspace();
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
    message: {
      text: "/project --all",
    },
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Projects:/);
  assert.match(String(result?.text), /proj-sample/);
});

test("before_dispatch handles slash-like /project --all query input", async () => {
  const workspace = await makeTempProjectWorkspace();
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
    message: {
      text: "/project --all feishu orchestrator",
    },
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /proj-openclaw-feishu-orchestrator/);
  assert.doesNotMatch(String(result?.text), /proj-sample/);
});

test("before_dispatch strips TUI metadata prefix and handles /project with session state", async () => {
  const workspace = await makeTempProjectWorkspace();
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
    content: "[Sat 2026-04-04 18:13 GMT+8] /project proj-sample",
    sessionKey: "agent:main:orchestrator",
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Current project: proj-sample/);
  assert.match(String(result?.text), /Next action: Implement Step 1/);
});

test("before_dispatch handles /project --help", async () => {
  const workspace = await makeTempProjectWorkspace();
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
    content: "/project --help",
    sessionKey: "agent:main:project-help",
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Project command help:/);
  assert.match(String(result?.text), /\/project --all \[query\]/);
  assert.match(String(result?.text), /\/project \[\<project_ref\>\] --notifications/);
  assert.match(String(result?.text), /\/project \[\<project_ref\>\] --catalog-sync \[--apply\]/);
  assert.match(String(result?.text), /\/project \[\<project_ref\>\] --governance/);
});

test("before_dispatch does not treat legacy /projects as a supported command", async () => {
  const workspace = await makeTempProjectWorkspace();
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
    content: "/projects",
    sessionKey: "agent:main:legacy-projects",
  });

  assert.deepEqual(result, {});
});

test("before_dispatch does not treat legacy /project-lane as a supported command", async () => {
  const workspace = await makeTempProjectWorkspace();
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
    content: "/project-lane",
    sessionKey: "agent:main:legacy-project-lane",
  });

  assert.deepEqual(result, {});
});

test("before_dispatch arms save mode for /project --save and allows agent flow to continue", async () => {
  const workspace = await makeTempProjectWorkspace();
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

  await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "agent:main:save-mode",
  });

  const result = await beforeDispatch?.({
    content: "/project --save",
    sessionKey: "agent:main:save-mode",
  });

  assert.deepEqual(result, {});
});

test("before_dispatch safe-fails unresolved automation ingress", async () => {
  const workspace = await makeTempProjectWorkspace();
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
    channel: "feishu",
    payload: {
      action_name: "dispatch",
    },
    sessionKey: "agent:main:automation-safe-fail",
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /safe-fail/i);
  assert.match(String(result?.text), /could not resolve project/i);
});

test("before_dispatch stores route trace with generated trace_id for structured automation ingress", async () => {
  const workspace = await makeTempProjectWorkspace();
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

  await beforeDispatch?.({
    channel: "feishu",
    payload: {
      project_id: "proj-openclaw-feishu-orchestrator",
      action_name: "dispatch",
    },
    sessionKey: "agent:main:trace-id-check",
  });

  const storePath = path.join(
    workspace.dataDir,
    "assistant-context-router",
    "session-project-store.json",
  );
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as {
    sessions?: Record<string, { last_route_trace?: { trace_id?: string | null } }>;
  };

  const traceId = parsed.sessions?.["agent:main:trace-id-check"]?.last_route_trace?.trace_id;
  assert.ok(traceId);
  assert.match(String(traceId), /^trace_/);
});

test("before_dispatch handles /project --lane for the current session project", async () => {
  const workspace = await makeTempProjectWorkspace();
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

  await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "agent:main:lane-summary",
  });

  const result = await beforeDispatch?.({
    content: "/project --lane",
    sessionKey: "agent:main:lane-summary",
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Project lane summary: proj-sample/);
});

test("before_dispatch handles /project --governance for the current session project", async () => {
  const workspace = await makeTempProjectWorkspace();
  const outbox = createGovernanceDeliveryOutbox({
    dataDir: workspace.dataDir,
    now: () => new Date("2026-04-21T12:30:00.000Z"),
  });
  await outbox.upsertPending(
    buildGovernanceDeliverySeed({
      escalation: {
        escalation_id: "escalation:proj-sample:block-1",
        created_at: "2026-04-21T12:29:00.000Z",
        updated_at: "2026-04-21T12:29:00.000Z",
        canonical_session_key: "agent:main:governance-summary",
        project_id: "proj-sample",
        signal_kind: "blocked",
        source: "service_result",
        target: "main_session",
        status: "open",
        reason: "blocked_human_decision_required_project_owner_approval",
        summary: "Waiting for project owner approval",
        trace_id: "trace-proj-sample-1",
        action_name: "dispatch",
        workflow: "dispatch",
        run_id: "run-proj-sample-1",
        queue_ref: "queue-proj-sample-1",
        artifact_ref: null,
        resolution: null,
      },
      binding: {
        channel_type: "wechat",
        target_kind: "dm",
        target_ref: "local:human_dm",
        delivery_mode: "direct",
      },
    }),
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

  await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "agent:main:governance-summary",
  });

  const result = await beforeDispatch?.({
    content: "/project --governance",
    sessionKey: "agent:main:governance-summary",
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Governance outbox: proj-sample/);
  assert.match(String(result?.text), /local:human_dm/);
});

test("before_dispatch handles slash-like /project --surface-sync for the current session project", async () => {
  const workspace = await makeTempProjectWorkspace();
  let received:
    | {
        projectId: string;
        dataDir?: string;
        apply: boolean;
      }
    | null = null;

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    workSurfaceSync: async (input) => {
      received = input;
      return {
        mode: "dry_run",
        project_id: input.projectId,
        snapshot_path: `${workspace.dataDir}/assistant-context-router/work-surface-projections/${input.projectId}.json`,
        snapshot: {
          project_id: input.projectId,
          updated_at: "2026-04-20T13:50:00.000Z",
          signal_kind: "review_request",
          surface_status: "in_review",
          headline: "Review requested: dispatch",
          summary: "Waiting for human review.",
          trace_id: "trace-before-dispatch-project-surface-sync-001",
          action_name: "dispatch",
          workflow: "review",
          run_id: "run-before-dispatch-project-surface-sync-001",
          queue_ref: "queue-before-dispatch-project-surface-sync-001",
          artifact_ref: null,
        },
        plan: {
          operation: "created",
          project_id: input.projectId,
          project_record_id: "rec-project",
          projection_record_id: null,
          fields: {},
        },
      };
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

  await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "agent:main:project-surface-sync",
  });

  const result = await beforeDispatch?.({
    content: "/project --surface-sync",
    sessionKey: "agent:main:project-surface-sync",
  });

  assert.deepEqual(received, {
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
    apply: false,
  });
  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Work-surface sync: proj-sample/);
  assert.match(String(result?.text), /Mode: dry_run/);
});

test("before_dispatch handles slash-like /project sample project --surface-sync --apply", async () => {
  const workspace = await makeTempProjectWorkspace();
  let received:
    | {
        projectId: string;
        dataDir?: string;
        apply: boolean;
      }
    | null = null;

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    workSurfaceSync: async (input) => {
      received = input;
      return {
        mode: "apply",
        project_id: "proj-sample",
        snapshot_path: `${workspace.dataDir}/assistant-context-router/work-surface-projections/proj-sample.json`,
        snapshot: {
          project_id: "proj-sample",
          updated_at: "2026-04-20T14:10:00.000Z",
          signal_kind: "high_signal_completion",
          surface_status: "completed",
          headline: "Completed: dispatch",
          summary: "Feishu sync applied.",
          trace_id: "trace-before-dispatch-project-surface-sync-query-001",
          action_name: "dispatch",
          workflow: "dispatch",
          run_id: "run-before-dispatch-project-surface-sync-query-001",
          queue_ref: "queue-before-dispatch-project-surface-sync-query-001",
          artifact_ref: null,
        },
        plan: {
          operation: "updated",
          project_id: "proj-sample",
          project_record_id: "rec-project",
          projection_record_id: "rec-feishu-row",
          fields: {},
        },
        result: {
          operation: "updated",
          record_id: "rec-feishu-row",
          project_record_id: "rec-project",
          projection_record_id: "rec-feishu-row",
          fields: {},
        },
      };
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
    content: "/project sample project --surface-sync --apply",
    sessionKey: "agent:main:project-surface-sync-query",
  });

  assert.deepEqual(received, {
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
    apply: true,
  });
  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Work-surface sync: proj-sample/);
  assert.match(String(result?.text), /Mode: apply/);
});

test("before_dispatch handles slash-like /project --catalog-sync for the current session project", async () => {
  const workspace = await makeTempProjectWorkspace();
  let received:
    | {
        registryPath: string;
        projectId: string;
        dataDir?: string;
        apply: boolean;
      }
    | null = null;

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    projectCatalogSync: async (input) => {
      received = input;
      return {
        mode: "dry_run",
        project_id: input.projectId,
        plan: {
          operation: "created",
          project_id: input.projectId,
          project_record_id: null,
          fields: {},
          skipped_fields: ["Owner", "类型", "状态"],
          local: {
            project_id: input.projectId,
            project_name: "Sample Project",
            source_path: "projects/delivery/sample-project/project.yaml",
            objective: "Ship a focused MVP.",
            cadence: "ad-hoc",
          },
        },
      };
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

  await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "agent:main:project-catalog-sync",
  });

  const result = await beforeDispatch?.({
    content: "/project --catalog-sync",
    sessionKey: "agent:main:project-catalog-sync",
  });

  assert.deepEqual(received, {
    registryPath: workspace.registryPath,
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
    apply: false,
  });
  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Project catalog sync: proj-sample/);
  assert.match(String(result?.text), /Mode: dry_run/);
});

test("before_dispatch returns friendly surface-sync error text instead of generic failure", async () => {
  const workspace = await makeTempProjectWorkspace();

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    workSurfaceSync: async () => {
      throw new Error("missing-work-surface-snapshot:proj-sample");
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

  await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "agent:main:surface-sync-friendly-error",
  });

  const result = await beforeDispatch?.({
    content: "/project --surface-sync",
    sessionKey: "agent:main:surface-sync-friendly-error",
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /No latest work-surface snapshot found for proj-sample/i);
});

test("project command handler returns friendly surface-sync error text", async () => {
  const workspace = await makeTempProjectWorkspace();

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    workSurfaceSync: async () => {
      throw new Error("missing-work-surface-snapshot:proj-sample");
    },
  });

  const commands = new Map<string, (ctx: Record<string, unknown>) => Promise<{ text: string }>>();

  await plugin.register({
    registerCommand(command) {
      commands.set(command.name, command.handler as (ctx: Record<string, unknown>) => Promise<{ text: string }>);
    },
    on() {},
  });

  const projectHandler = commands.get("project");
  assert.ok(projectHandler);

  await projectHandler?.({
    args: "proj-sample",
    sessionKey: "agent:main:surface-sync-command-error",
  });

  const result = await projectHandler?.({
    args: "--surface-sync",
    sessionKey: "agent:main:surface-sync-command-error",
  });

  assert.match(String(result?.text), /No latest work-surface snapshot found for proj-sample/i);
});

test("before_prompt_build hook can resolve session key from runtime context", async () => {
  const workspace = await makeTempProjectWorkspace();
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
  const beforePromptBuild = handlers.get("before_prompt_build");
  assert.ok(beforeDispatch);
  assert.ok(beforePromptBuild);

  await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "agent:main:ctx-prompt-build",
  });

  await beforeDispatch?.({
    content: "/project --save",
    sessionKey: "agent:main:ctx-prompt-build",
  });

  const result = await beforePromptBuild?.(
    {
      prompt: "/project --save",
      messages: [],
    },
    {
      sessionKey: "agent:main:ctx-prompt-build",
    },
  );

  assert.match(String(result?.prependSystemContext), /Assistant Context Router save mode/);
});
