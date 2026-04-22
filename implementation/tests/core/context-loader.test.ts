import test from "node:test";
import assert from "node:assert/strict";

import { getProjectById } from "../../core/src/projects/registry.ts";
import { loadProjectContext } from "../../core/src/context/project-context-loader.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("project context loader builds a bounded summary", async () => {
  const workspace = await makeTempProjectWorkspace();
  const entry = await getProjectById(workspace.registryPath, "proj-sample");
  assert.ok(entry);

  const context = await loadProjectContext({ entry });

  assert.ok(context.rendered.includes("[manifest]"));
  assert.ok(context.rendered.includes("truth_docs:"));
  assert.ok(context.rendered.includes("[anchor:STATUS.md]"));
  assert.ok(context.rendered.includes("[anchor:README.md]"));
  assert.ok(context.rendered.includes("[anchor:RESUME.md]"));
  assert.ok(context.rendered.includes("[identity:project.yaml]"));
  assert.ok(context.totalChars <= 2600);
});
