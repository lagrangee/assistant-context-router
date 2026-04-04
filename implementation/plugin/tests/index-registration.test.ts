import test from "node:test";
import assert from "node:assert/strict";

import { createAssistantContextRouterPlugin } from "../src/index.ts";
import { makeTempProjectWorkspace } from "./test-helpers.ts";

test("plugin registers commands and before_prompt_build hook", async () => {
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
  assert.deepEqual(hooks, ["before_prompt_build"]);
});
