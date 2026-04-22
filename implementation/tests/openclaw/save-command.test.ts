import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";

import { handleSaveCommand } from "../../adapters/openclaw/plugin/src/commands/save.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("save command arm mode stores pending save mode without writing files", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:save-test", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    route_source: "command",
  });

  const result = await handleSaveCommand({
    sessionKey: "session:save-test",
    registryPath: workspace.registryPath,
    store,
    mode: "arm",
  });

  assert.equal(result.needsConfirmation, true);
  assert.match(result.content, /Save mode armed/);

  const resumePath = path.join(workspace.root, "projects", "delivery", "sample-project", "RESUME.md");
  const resume = await readFile(resumePath, "utf8");
  assert.doesNotMatch(resume, /Last saved:/);

  const state = await store.get("session:save-test");
  assert.equal(state?.pending_save_mode?.project_id, "proj-sample");
  assert.equal(state?.pending_save_draft, null);
});

test("save command fails safely without current project", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleSaveCommand({
    sessionKey: "session:no-project",
    registryPath: workspace.registryPath,
    store,
  });

  assert.equal(result.updatedFiles.length, 0);
  assert.match(result.content, /No current project selected/);
});

test("save command apply writes pending draft and clears confirmation state", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });
  const resumePath = path.join(workspace.root, "projects", "delivery", "sample-project", "RESUME.md");
  const statusPath = path.join(workspace.root, "projects", "delivery", "sample-project", "STATUS.md");

  await store.set("session:save-apply", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  await handleSaveCommand({
    sessionKey: "session:save-apply",
    registryPath: workspace.registryPath,
    store,
    mode: "arm",
  });

  await store.set("session:save-apply", {
    pending_save_mode: null,
    pending_save_draft: {
      created_at: "2026-04-13T00:00:00.000Z",
      project_id: "proj-sample",
      updated_files: [resumePath, statusPath],
      resume_draft:
        "# RESUME\n\nLast saved: 2026-04-13T00:00:00.000Z\nCurrent project: proj-sample\n\n## Current phase\n\nActive save mode\n\n## Immediate next actions\n\n1. Continue.\n",
      status_draft:
        "# STATUS\n\nLast saved: 2026-04-13T00:00:00.000Z\nCurrent project: proj-sample\n\n## TL;DR（一句话）\n\nReady to continue.\n\n## 下一步（从这里继续推进主线）\n\n- Continue.\n",
      summary_for_chat: "Prepared save draft.",
    },
  });
  const result = await handleSaveCommand({
    sessionKey: "session:save-apply",
    registryPath: workspace.registryPath,
    store,
    mode: "apply",
  });

  assert.match(result.content, /Saved current project state for proj-sample/);

  const resume = await readFile(resumePath, "utf8");
  assert.match(resume, /Last saved:/);
  assert.match(resume, /Current project: proj-sample/);
  assert.match(resume, /Current phase/);
  assert.match(resume, /Immediate next actions/);

  const status = await readFile(statusPath, "utf8");
  assert.match(status, /TL;DR（一句话）/);
  assert.match(status, /下一步（从这里继续推进主线）/);

  const state = await store.get("session:save-apply");
  assert.equal(state?.pending_save_draft, null);
});

test("save command cancel clears pending draft without writing files", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:save-cancel", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  const resumePath = path.join(workspace.root, "projects", "delivery", "sample-project", "RESUME.md");
  await handleSaveCommand({
    sessionKey: "session:save-cancel",
    registryPath: workspace.registryPath,
    store,
    mode: "arm",
  });

  const result = await handleSaveCommand({
    sessionKey: "session:save-cancel",
    registryPath: workspace.registryPath,
    store,
    mode: "cancel",
  });

  assert.match(result.content, /Canceled pending save mode before any draft was captured|Discarded pending save draft/);

  const resume = await readFile(resumePath, "utf8");
  assert.doesNotMatch(resume, /Last saved:/);

  const state = await store.get("session:save-cancel");
  assert.equal(state?.pending_save_mode, null);
  assert.equal(state?.pending_save_draft, null);
});

test("save command dry-run previews without storing pending draft", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:save-dry-run", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  const resumePath = path.join(workspace.root, "projects", "delivery", "sample-project", "RESUME.md");
  let existedBefore = true;
  try {
    await stat(resumePath);
  } catch {
    existedBefore = false;
  }

  const result = await handleSaveCommand({
    sessionKey: "session:save-dry-run",
    registryPath: workspace.registryPath,
    store,
    mode: "dry-run",
  });

  let existedAfter = true;
  try {
    await stat(resumePath);
  } catch {
    existedAfter = false;
  }

  assert.equal(result.dryRun, true);
  assert.match(result.content, /Dry run for current project state save/);
  assert.match(result.content, /RESUME\.md preview/);
  assert.match(result.content, /Current phase/);
  assert.match(result.content, /STATUS\.md preview/);
  assert.equal(existedAfter, existedBefore);

  const state = await store.get("session:save-dry-run");
  assert.equal(state?.pending_save_mode?.debug_dry_run, true);
  assert.equal(state?.pending_save_draft, null);
});

test("save command dry-run preview includes default apply hosts and source notes", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:save-draft-meta", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  const result = await handleSaveCommand({
    sessionKey: "session:save-draft-meta",
    registryPath: workspace.registryPath,
    store,
    mode: "dry-run",
  });

  assert.match(result.content, /Default apply hosts:/);
  assert.match(result.content, /RESUME\.md:/);
  assert.match(result.content, /STATUS\.md:/);
  assert.match(result.content, /Source notes:/);
  assert.match(result.content, /current project binding only/);
});
