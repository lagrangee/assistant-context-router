import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { createAssistantContextRouterPlugin } from "../src/index.ts";
import { makeTempProjectWorkspace } from "./test-helpers.ts";

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

  assert.deepEqual(commands.sort(), ["project", "projects"]);
  assert.deepEqual(hooks.sort(), ["before_dispatch", "before_prompt_build"]);
});

test("default plugin export does not require config.registryPath", async () => {
  const module = await import("../src/index.ts");
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

  assert.equal(registered, 2);
});

test("before_dispatch handles slash-like /projects input from nested message payload", async () => {
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
      text: "/projects",
    },
  });

  assert.equal(result?.handled, true);
  assert.match(String(result?.text), /Projects:/);
  assert.match(String(result?.text), /proj-sample/);
});

test("before_dispatch handles slash-like /projects query input", async () => {
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
      text: "/projects feishu orchestrator",
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
