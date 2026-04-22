import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import {
  DEFAULT_WORKFLOW_BINDINGS_DIRNAME,
  DEFAULT_WORKFLOW_BINDINGS_FILENAME,
  loadWorkflowBindingsConfig,
  renderWorkflowBindingsConfigYaml,
  resolveDefaultWorkflowBindingsPathForDataDir,
  resolveWorkflowDefaultReplyTarget,
} from "../../adapters/openclaw/runtime/src/workflow-bindings.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("workflow bindings default to plugin-owned workflow-bindings.yaml", async () => {
  const workspace = await makeTempProjectWorkspace();
  const workflowBindingsPath = path.join(
    workspace.dataDir,
    DEFAULT_WORKFLOW_BINDINGS_DIRNAME,
    DEFAULT_WORKFLOW_BINDINGS_FILENAME,
  );
  await mkdir(path.dirname(workflowBindingsPath), { recursive: true });
  await writeFile(
    workflowBindingsPath,
    renderWorkflowBindingsConfigYaml({
      dispatch: {
        default_reply_target: {
          channel_type: "feishu",
          target_kind: "channel",
          target_id: "oc_dispatch_default",
          visibility: "system_facing",
          reply_mode: "direct",
        },
      },
      review: {
        default_reply_target: {
          channel_type: "feishu",
          target_kind: "channel",
          target_id: "oc_review_default",
          visibility: "system_facing",
          reply_mode: "direct",
        },
      },
    }),
    "utf8",
  );

  const config = await loadWorkflowBindingsConfig(undefined, process.env, workspace.dataDir);
  assert.equal(resolveDefaultWorkflowBindingsPathForDataDir(workspace.dataDir), workflowBindingsPath);
  assert.equal(
    resolveWorkflowDefaultReplyTarget({ workflow: "dispatch", config })?.target_id,
    "oc_dispatch_default",
  );
  assert.equal(
    resolveWorkflowDefaultReplyTarget({ workflow: "review", config })?.target_id,
    "oc_review_default",
  );
});

test("workflow bindings fall back to general default when workflow-specific target is absent", async () => {
  const config = await loadWorkflowBindingsConfig(undefined, process.env, "/nonexistent/path");
  assert.deepEqual(config, {});

  const resolved = resolveWorkflowDefaultReplyTarget({
    workflow: "dispatch",
    config: {
      general: {
        default_reply_target: {
          channel_type: "discord",
          target_kind: "channel",
          target_id: "discord:channel:general",
          visibility: "system_facing",
          reply_mode: "direct",
        },
      },
    },
  });

  assert.equal(resolved?.channel_type, "discord");
  assert.equal(resolved?.target_id, "discord:channel:general");
});
