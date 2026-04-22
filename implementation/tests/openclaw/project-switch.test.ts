import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMissingSessionKeyMessage,
  handleProjectCommand,
  parseProjectCommandArgs,
  resolveSessionKeyFromCommandContext,
} from "../../adapters/openclaw/plugin/src/commands/project.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

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
  assert.equal(stored?.last_route_trace?.target_kind, "main_session");
  assert.equal(stored?.last_route_trace?.target_id, "agent:test:webchat:1");
  assert.match(String(stored?.last_route_trace?.reason), /focus switch/);
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

test("project command arg parser supports unified /project actions", () => {
  assert.deepEqual(parseProjectCommandArgs("sample project"), {
    action: "switch",
    projectId: "sample project",
    apply: false,
    saveMode: "arm",
  });
  assert.deepEqual(parseProjectCommandArgs("--all feishu orchestrator"), {
    action: "list",
    projectId: "feishu orchestrator",
    apply: false,
    saveMode: "arm",
  });
  assert.deepEqual(parseProjectCommandArgs("--lane sample project"), {
    action: "lane",
    projectId: "sample project",
    apply: false,
    saveMode: "arm",
  });
  assert.deepEqual(parseProjectCommandArgs("--notifications sample project"), {
    action: "notifications",
    projectId: "sample project",
    apply: false,
    saveMode: "arm",
  });
  assert.deepEqual(parseProjectCommandArgs("--governance sample project"), {
    action: "governance",
    projectId: "sample project",
    apply: false,
    saveMode: "arm",
  });
  assert.deepEqual(parseProjectCommandArgs("--surface-sync"), {
    action: "surface_sync",
    projectId: undefined,
    apply: false,
    saveMode: "arm",
  });
  assert.deepEqual(parseProjectCommandArgs("--catalog-sync"), {
    action: "catalog_sync",
    projectId: undefined,
    apply: false,
    saveMode: "arm",
  });
  assert.deepEqual(parseProjectCommandArgs("sample project --surface-sync --apply"), {
    action: "surface_sync",
    projectId: "sample project",
    apply: true,
    saveMode: "apply",
  });
  assert.deepEqual(parseProjectCommandArgs("sample project --catalog-sync --apply"), {
    action: "catalog_sync",
    projectId: "sample project",
    apply: true,
    saveMode: "apply",
  });
  assert.deepEqual(parseProjectCommandArgs("--save --dry-run"), {
    action: "save",
    projectId: undefined,
    apply: false,
    saveMode: "dry-run",
  });
  assert.deepEqual(parseProjectCommandArgs("--help"), {
    action: "help",
    projectId: undefined,
    apply: false,
    saveMode: "arm",
  });
  assert.throws(() => parseProjectCommandArgs("sample project --apply"), /Mode flags require/);
  assert.throws(() => parseProjectCommandArgs("--catalog-sync --cancel"), /only supported with --save/);
  assert.throws(() => parseProjectCommandArgs("--save sample project"), /current binding/);
  assert.throws(() => parseProjectCommandArgs("--all --lane"), /Conflicting \/project actions/);
  assert.throws(() => parseProjectCommandArgs("--notifications --apply"), /Mode flags are not supported with --notifications/);
  assert.throws(() => parseProjectCommandArgs("--governance --apply"), /Mode flags are not supported with --governance/);
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
    pending_save_mode: {
      created_at: "2026-04-13T00:00:00.000Z",
      project_id: "proj-openclaw-feishu-orchestrator",
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
  assert.equal(stored?.pending_save_mode, null);
  assert.equal(stored?.pending_save_draft, null);
});
