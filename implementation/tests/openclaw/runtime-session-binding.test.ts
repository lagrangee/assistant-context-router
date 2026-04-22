import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";

import { createAssistantContextRouterPlugin } from "../../adapters/openclaw/plugin/src/index.ts";
import {
  DEFAULT_RUNTIME_BINDINGS_DIRNAME,
  DEFAULT_RUNTIME_BINDINGS_FILENAME,
  renderRuntimeBindingsConfigYaml,
} from "../../adapters/openclaw/runtime/src/bindings.ts";
import { projectSessionEventPath } from "../../core/src/routing/project-session-lane.ts";
import {
  makeCopiedDemoAcrWorkspace,
  makeTempProjectWorkspace,
  writeRuntimeBindingsConfig,
} from "../test-helpers.ts";

test("main session binding canonicalizes aliases for /project focus switching", async () => {
  const workspace = await makeTempProjectWorkspace();
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
  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    runtimeBindingsPath,
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

  const switchResult = await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "wechat:dm:human",
  });
  assert.equal(switchResult?.handled, true);

  const statePath = path.join(
    workspace.dataDir,
    "assistant-context-router",
    "session-project-store.json",
  );
  const rawState = JSON.parse(await readFile(statePath, "utf8")) as {
    sessions: Record<string, { current_project_id: string | null }>;
  };
  assert.equal(rawState.sessions["main:human"]?.current_project_id, "proj-sample");
  assert.equal(rawState.sessions["wechat:dm:human"], undefined);

  const promptResult = await beforePromptBuild?.({
    sessionKey: "main:human",
    systemPrompt: "Base system prompt.",
    messages: [],
  });
  assert.match(String(promptResult?.prependSystemContext), /Sample Project/);
});

test("main session binding defaults to plugin-owned runtime-bindings.yaml when runtimeBindingsPath is omitted", async () => {
  const workspace = await makeTempProjectWorkspace();
  const runtimeBindingsPath = path.join(
    workspace.dataDir,
    DEFAULT_RUNTIME_BINDINGS_DIRNAME,
    DEFAULT_RUNTIME_BINDINGS_FILENAME,
  );
  await mkdir(path.dirname(runtimeBindingsPath), { recursive: true });
  await writeFile(
    runtimeBindingsPath,
    renderRuntimeBindingsConfigYaml({
      bindings: [
        {
          binding_id: "main-session",
          runtime_kind: "openclaw",
          canonical_session_key: "agent:main:main",
          aliases: ["wechat:dm:human"],
          metadata: null,
        },
      ],
    }),
    "utf8",
  );

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
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

  const switchResult = await beforeDispatch?.({
    content: "/project proj-sample",
    sessionKey: "wechat:dm:human",
  });
  assert.equal(switchResult?.handled, true);

  const statePath = path.join(
    workspace.dataDir,
    "assistant-context-router",
    "session-project-store.json",
  );
  const rawState = JSON.parse(await readFile(statePath, "utf8")) as {
    sessions: Record<string, { current_project_id: string | null }>;
  };
  assert.equal(rawState.sessions["agent:main:main"]?.current_project_id, "proj-sample");
  assert.equal(rawState.sessions["wechat:dm:human"], undefined);
});

test("project session binding delivers to a runtime target and keeps a shadow lane", async () => {
  const workspace = await makeTempProjectWorkspace();
  const runtimeTarget = path.join(workspace.root, "proj-sample-runtime.jsonl");
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  append_project_note:
    target_kind: project_session
    workflow: general
    requires_resolved_project: true
project_session_binding:
  runtime_kind: file_jsonl
  target_ref: "${runtimeTarget}"
`,
  );

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    projectSessionDeliveryAdapters: {
      file_jsonl: async (request) => {
        await appendFile(
          request.binding.target_ref,
          `${JSON.stringify({
            project_id: request.project_id,
            action_name: request.envelope.action_name,
            trace_id: request.envelope.trace_id,
          })}\n`,
          "utf8",
        );
        return {
          status: "delivered",
          runtime_target_id: request.binding.target_ref,
          fallback_used: false,
          error_reason: null,
          trace_patch: {
            delivered_by: "file_jsonl",
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

  const result = await beforeDispatch?.({
    channel: "feishu",
    payload: {
      project_id: "proj-sample",
      action_name: "append_project_note",
      parameters: {
        note: "runtime-bound event",
      },
      trace_id: "trace-runtime-bind-1",
    },
  });

  assert.equal(result?.handled, true);
  const runtimeLog = await readFile(runtimeTarget, "utf8");
  assert.match(runtimeLog, /append_project_note/);
  assert.match(runtimeLog, /trace-runtime-bind-1/);

  const laneLog = await readFile(projectSessionEventPath("proj-sample", workspace.dataDir), "utf8");
  assert.match(laneLog, /"delivery_result":\{"status":"delivered"/);
});

test("project session binding degrades to shadow lane when binding is missing", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  append_project_note:
    target_kind: project_session
    workflow: general
    requires_resolved_project: true
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

  const result = await beforeDispatch?.({
    channel: "feishu",
    payload: {
      project_id: "proj-sample",
      action_name: "append_project_note",
      parameters: {
        note: "missing binding should fallback",
      },
    },
  });

  assert.equal(result?.handled, true);
  const laneLog = await readFile(projectSessionEventPath("proj-sample", workspace.dataDir), "utf8");
  assert.match(laneLog, /missing_project_session_binding/);
  assert.match(laneLog, /"delivery_result":\{"status":"unresolved_binding"/);
});

test("openclaw_session binding delivers immediately when runtime heartbeat runs once", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  append_project_note:
    target_kind: project_session
    workflow: general
    requires_resolved_project: true
project_session_binding:
  runtime_kind: openclaw_session
  target_ref: agent:proj-sample:system
`,
  );

  const enqueued: Array<{ text: string; sessionKey: string; contextKey?: string | null }> = [];
  const heartbeatRuns: Array<{ reason?: string; sessionKey?: string; target?: string }> = [];
  const heartbeats: Array<{ reason?: string; sessionKey?: string }> = [];

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  plugin.register({
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
            durationMs: 12,
          };
        },
        requestHeartbeatNow(options) {
          heartbeats.push({
            reason: options?.reason,
            sessionKey: options?.sessionKey,
          });
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

  const result = await beforeDispatch?.({
    channel: "feishu",
    payload: {
      project_id: "proj-sample",
      action_name: "append_project_note",
      parameters: {
        note: "queue this into runtime session",
      },
      trace_id: "trace-openclaw-session-1",
    },
  });

  assert.equal(result?.handled, true);
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0]?.sessionKey, "agent:proj-sample:system");
  assert.match(String(enqueued[0]?.text), /append_project_note/);
  assert.match(String(enqueued[0]?.text), /queue this into runtime session/);
  assert.equal(heartbeatRuns.length, 1);
  assert.equal(heartbeatRuns[0]?.sessionKey, "agent:proj-sample:system");
  assert.equal(heartbeatRuns[0]?.reason, "acr:project_session_delivery");
  assert.equal(heartbeatRuns[0]?.target, "last");
  assert.equal(heartbeats.length, 0);

  const laneLog = await readFile(projectSessionEventPath("proj-sample", workspace.dataDir), "utf8");
  assert.match(laneLog, /"delivery_result":\{"status":"delivered"/);
  assert.match(laneLog, /"runtime_target_id":"agent:proj-sample:system"/);
  assert.match(laneLog, /"delivery_mode":"system_event_heartbeat_once"/);
});

test("openclaw_session binding falls back to queued when heartbeat run is busy", async () => {
  const workspace = await makeTempProjectWorkspace();
  await writeFile(
    path.join(workspace.root, "projects", "delivery", "sample-project", "router.yaml"),
    `actions:
  append_project_note:
    target_kind: project_session
    workflow: general
    requires_resolved_project: true
project_session_binding:
  runtime_kind: openclaw_session
  target_ref: agent:proj-sample:system
`,
  );

  const enqueued: Array<{ text: string; sessionKey: string; contextKey?: string | null }> = [];
  const heartbeatRuns: Array<{ reason?: string; sessionKey?: string; target?: string }> = [];
  const heartbeats: Array<{ reason?: string; sessionKey?: string }> = [];

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
  });

  const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
  plugin.register({
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
            status: "skipped",
            reason: "requests-in-flight",
          };
        },
        requestHeartbeatNow(options) {
          heartbeats.push({
            reason: options?.reason,
            sessionKey: options?.sessionKey,
          });
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

  const result = await beforeDispatch?.({
    channel: "feishu",
    payload: {
      project_id: "proj-sample",
      action_name: "append_project_note",
      parameters: {
        note: "queue this into runtime session",
      },
      trace_id: "trace-openclaw-session-1",
    },
  });

  assert.equal(result?.handled, true);
  assert.equal(enqueued.length, 1);
  assert.equal(heartbeatRuns.length, 1);
  assert.equal(heartbeats.length, 1);
  assert.equal(heartbeats[0]?.sessionKey, "agent:proj-sample:system");
  assert.equal(heartbeats[0]?.reason, "acr:project_session_delivery");

  const laneLog = await readFile(projectSessionEventPath("proj-sample", workspace.dataDir), "utf8");
  assert.match(laneLog, /"delivery_result":\{"status":"queued"/);
  assert.match(laneLog, /"delivery_mode":"system_event_queued"/);
});

test("demo-acr real validation path binds main session and delivers append-note fixture", async () => {
  const workspace = await makeCopiedDemoAcrWorkspace();
  const runtimeBindingsPath = await writeRuntimeBindingsConfig({
    root: workspace.root,
    bindings: [
      {
        binding_id: "demo-main",
        runtime_kind: "openclaw",
        canonical_session_key: "main:demo:human",
        aliases: ["feishu:dm:human"],
      },
    ],
  });
  const runtimeTarget = path.join(workspace.root, "demo-runtime-session.jsonl");
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
  runtime_kind: file_jsonl
  target_ref: "${runtimeTarget}"
`,
  );

  const plugin = createAssistantContextRouterPlugin({
    registryPath: workspace.registryPath,
    dataDir: workspace.dataDir,
    runtimeBindingsPath,
    projectSessionDeliveryAdapters: {
      file_jsonl: async (request) => {
        await appendFile(
          request.binding.target_ref,
          `${JSON.stringify({
            project_id: request.project_id,
            action_name: request.envelope.action_name,
            note: request.envelope.parameters?.note ?? null,
          })}\n`,
          "utf8",
        );
        return {
          status: "delivered",
          runtime_target_id: request.binding.target_ref,
          fallback_used: false,
          error_reason: null,
          trace_patch: {
            delivered_by: "file_jsonl",
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
  const beforePromptBuild = handlers.get("before_prompt_build");
  assert.ok(beforeDispatch);
  assert.ok(beforePromptBuild);

  const projectResult = await beforeDispatch?.({
    content: "/project demo-acr",
    sessionKey: "feishu:dm:human",
  });
  assert.equal(projectResult?.handled, true);

  const promptResult = await beforePromptBuild?.({
    sessionKey: "main:demo:human",
    systemPrompt: "Base system prompt.",
    messages: [],
  });
  assert.match(String(promptResult?.prependSystemContext), /demo-acr/);

  const fixture = JSON.parse(
    await readFile(path.join(workspace.projectRoot, "fixtures", "append-note.json"), "utf8"),
  ) as Record<string, unknown>;
  const dispatchResult = await beforeDispatch?.(fixture);
  assert.equal(dispatchResult?.handled, true);

  const runtimeLog = await readFile(runtimeTarget, "utf8");
  assert.match(runtimeLog, /append_project_note/);
  assert.match(runtimeLog, /Checkpoint: manifest reviewed and kept minimal/);

  const laneLog = await readFile(projectSessionEventPath("demo-acr", workspace.dataDir), "utf8");
  assert.match(laneLog, /"delivery_result":\{"status":"delivered"/);
});
