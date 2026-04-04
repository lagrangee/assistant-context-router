import test from "node:test";
import assert from "node:assert/strict";

import { handleProjectsCommand } from "../src/commands/projects.ts";
import { makeTempProjectWorkspace } from "./test-helpers.ts";

test("projects command lists registry entries", async () => {
  const workspace = await makeTempProjectWorkspace();
  const result = await handleProjectsCommand({
    registryPath: workspace.registryPath,
  });

  assert.equal(result.count, 2);
  assert.match(result.content, /proj-sample/);
  assert.match(result.content, /Sample Project/);
});

test("projects command filters by free-text query", async () => {
  const workspace = await makeTempProjectWorkspace();
  const result = await handleProjectsCommand({
    registryPath: workspace.registryPath,
    query: "feishu orchestrator",
  });

  assert.equal(result.count, 1);
  assert.match(result.content, /proj-openclaw-feishu-orchestrator/);
  assert.doesNotMatch(result.content, /proj-sample/);
});
