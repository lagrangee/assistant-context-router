import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMissingSessionKeyMessage,
  handleProjectCommand,
  resolveSessionKeyFromCommandContext,
} from "../src/commands/project.ts";
import { createSessionProjectStore } from "../src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "./test-helpers.ts";

test("project command stores current project in session-owned state", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleProjectCommand({
    registryPath: workspace.registryPath,
    projectId: "proj-sample",
    sessionKey: "agent:test:webchat:1",
    store,
  });

  const stored = await store.get("agent:test:webchat:1");

  assert.match(result.content, /Current project: proj-sample/);
  assert.ok(stored);
  assert.equal(stored?.current_project_id, "proj-sample");
  assert.equal(stored?.selected_via, "manual");
  assert.equal(stored?.last_route_trace?.route_source, "manual");
});

test("command context session key resolver prefers explicit sessionKey fields", () => {
  assert.equal(
    resolveSessionKeyFromCommandContext({ sessionKey: "agent:main:webchat:1" }),
    "agent:main:webchat:1",
  );
  assert.equal(
    resolveSessionKeyFromCommandContext({ session: { sessionKey: "agent:main:webchat:2" } }),
    "agent:main:webchat:2",
  );
  assert.equal(resolveSessionKeyFromCommandContext({ args: "proj-sample" }), null);
  assert.match(buildMissingSessionKeyMessage("proj-sample"), /requires a runtime or command bridge/);
});

test("project command suggests nearest project id on typo", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleProjectCommand({
    registryPath: workspace.registryPath,
    projectId: "proj-sampel",
    sessionKey: "agent:test:webchat:1",
    store,
  });

  assert.match(result.content, /Current project: proj-sample/);
});

test("project command auto-resolves keyword query when there is one strong match", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleProjectCommand({
    registryPath: workspace.registryPath,
    projectId: "sample project",
    sessionKey: "agent:test:webchat:2",
    store,
  });

  assert.match(result.content, /Current project: proj-sample/);
});

test("project command clears pending save draft when switching projects", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("agent:test:webchat:3", {
    current_project_id: "proj-openclaw-feishu-orchestrator",
    selected_via: "manual",
    pending_save_draft: {
      created_at: "2026-04-13T00:00:00.000Z",
      project_id: "proj-openclaw-feishu-orchestrator",
      updated_files: ["/tmp/RESUME.md"],
      resume_draft: "# RESUME",
      status_draft: "# STATUS",
      summary_for_chat: "pending",
    },
  });

  await handleProjectCommand({
    registryPath: workspace.registryPath,
    projectId: "proj-sample",
    sessionKey: "agent:test:webchat:3",
    store,
  });

  const stored = await store.get("agent:test:webchat:3");
  assert.equal(stored?.current_project_id, "proj-sample");
  assert.equal(stored?.pending_save_draft, null);
});
