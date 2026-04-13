import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";

import { handleSaveCommand } from "../src/commands/save.ts";
import { createSessionProjectStore } from "../src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "./test-helpers.ts";

test("save command prepares a conversational draft without writing files", async () => {
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
  });

  assert.equal(result.needsConfirmation, true);
  assert.match(result.content, /Prepared save draft for proj-sample/);
  assert.match(result.content, /\/save apply/);

  const resumePath = path.join(workspace.root, "projects", "delivery", "sample-project", "RESUME.md");
  const resume = await readFile(resumePath, "utf8");
  assert.doesNotMatch(resume, /Last saved:/);

  const state = await store.get("session:save-test");
  assert.equal(state?.pending_save_draft?.project_id, "proj-sample");
  assert.match(state?.pending_save_draft?.resume_draft ?? "", /Current phase/);
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

  await store.set("session:save-apply", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  await handleSaveCommand({
    sessionKey: "session:save-apply",
    registryPath: workspace.registryPath,
    store,
  });

  const resumePath = path.join(workspace.root, "projects", "delivery", "sample-project", "RESUME.md");
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

  const statusPath = path.join(workspace.root, "projects", "delivery", "sample-project", "STATUS.md");
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
  });

  const result = await handleSaveCommand({
    sessionKey: "session:save-cancel",
    registryPath: workspace.registryPath,
    store,
    mode: "cancel",
  });

  assert.match(result.content, /Discarded pending save draft/);

  const resume = await readFile(resumePath, "utf8");
  assert.doesNotMatch(resume, /Last saved:/);

  const state = await store.get("session:save-cancel");
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
  assert.equal(state?.pending_save_draft, null);
});
