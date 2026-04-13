import test from "node:test";
import assert from "node:assert/strict";

import { getProjectById } from "../src/projects/registry.ts";
import { loadProjectContext } from "../src/context/project-context-loader.ts";
import { makeTempProjectWorkspace } from "./test-helpers.ts";

test("project context loader builds a bounded summary", async () => {
  const workspace = await makeTempProjectWorkspace();
  const entry = await getProjectById(workspace.registryPath, "proj-sample");
  assert.ok(entry);

  const context = await loadProjectContext({ entry });

  assert.ok(context.rendered.includes("[registry]"));
  assert.ok(context.rendered.includes("[STATUS.md]"));
  assert.ok(context.rendered.includes("[README.md]"));
  assert.ok(context.rendered.includes("[RESUME.md]"));
  assert.ok(context.rendered.includes("[project.yaml]"));
  assert.ok(context.totalChars <= 2600);
});
