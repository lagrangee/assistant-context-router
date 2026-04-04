import test from "node:test";
import assert from "node:assert/strict";

import { createBeforePromptBuildHook } from "../src/hooks/before-prompt-build.ts";
import { createSessionProjectStore } from "../src/state/session-project-store.ts";
import { createSafeFailTrace } from "../src/trace/route-trace.ts";
import { makeTempProjectWorkspace } from "./test-helpers.ts";

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
  });

  const result = await hook({
    sessionKey: "session:hook",
    systemPrompt: "Base system prompt.",
    messages: [],
  });

  assert.match(String(result.prependSystemContext), /Assistant Context Router project context/);
  assert.match(String(result.prependSystemContext), /proj-sample/);
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
  });

  const result = await hook({
    sessionKey: "session:none",
    messages: [],
  });

  assert.deepEqual(result, {});
});
