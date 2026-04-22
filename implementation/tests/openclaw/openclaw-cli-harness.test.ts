import test from "node:test";
import assert from "node:assert/strict";

import {
  findSessionKeysForProject,
  parseValidateOpenClawCliArgs,
  patchOpenClawConfigForValidation,
  sessionProjectStorePath,
} from "../../adapters/openclaw/plugin/src/validation/openclaw-cli-harness.ts";

test("parseValidateOpenClawCliArgs keeps defaults and accepts overrides", () => {
  const defaults = {
    cliBin: "openclaw",
    pluginPath: "/tmp/plugin",
    registryPath: "/tmp/index.yaml",
    defaultProjectRef: "proj-assistant-context-router",
    promptMessage: "这个项目下一步是什么？",
    sessionId: "acr-cli-validation",
  };

  const parsed = parseValidateOpenClawCliArgs(
    [
      "--project-ref",
      "proj-sample",
      "--session-id",
      "session-42",
      "--prompt-message",
      "继续下一步",
      "--model",
      "openai-codex/gpt-5.4",
      "--gateway-port",
      "19001",
      "--keep-temp",
      "--skip-prompt-build",
    ],
    defaults,
  );

  assert.equal(parsed.projectRef, "proj-sample");
  assert.equal(parsed.sessionId, "session-42");
  assert.equal(parsed.promptMessage, "继续下一步");
  assert.equal(parsed.model, "openai-codex/gpt-5.4");
  assert.equal(parsed.gatewayPort, 19001);
  assert.equal(parsed.keepTemp, true);
  assert.equal(parsed.skipPromptBuild, true);
  assert.equal(parsed.registryPath, defaults.registryPath);
  assert.equal(parsed.pluginPath, defaults.pluginPath);
});

test("patchOpenClawConfigForValidation injects isolated gateway and plugin config", () => {
  const config = {
    gateway: {
      mode: "local",
      auth: {
        mode: "token",
        token: "token",
      },
    },
    agents: {
      defaults: {
        workspace: "/tmp/workspace",
      },
    },
    plugins: {
      load: {
        paths: ["/tmp/existing-plugin"],
      },
    },
  };

  const patched = patchOpenClawConfigForValidation({
    config,
    pluginPath: "/tmp/acr-plugin",
    registryPath: "/tmp/projects/index.yaml",
    dataDir: "/tmp/plugin-data",
    gatewayPort: 19001,
    model: "openai-codex/gpt-5.4",
  });

  assert.deepEqual(patched.gateway, {
    mode: "local",
    auth: {
      mode: "token",
      token: "token",
    },
    port: 19001,
    bind: "custom",
    customBindHost: "127.0.0.1",
    controlUi: {
      enabled: false,
    },
  });
  assert.deepEqual(patched.plugins, {
    allow: ["assistant-context-router"],
    load: {
      paths: ["/tmp/existing-plugin", "/tmp/acr-plugin"],
    },
    entries: {
      "assistant-context-router": {
        enabled: true,
        hooks: {
          allowPromptInjection: true,
        },
        config: {
          registryPath: "/tmp/projects/index.yaml",
          dataDir: "/tmp/plugin-data",
        },
      },
    },
  });
  assert.deepEqual(patched.agents, {
    defaults: {
      workspace: "/tmp/workspace",
      model: {
        primary: "openai-codex/gpt-5.4",
      },
    },
  });
});

test("findSessionKeysForProject returns matching session keys and tolerates invalid state", () => {
  const raw = JSON.stringify({
    version: 1,
    sessions: {
      "session:a": {
        current_project_id: "proj-assistant-context-router",
      },
      "session:b": {
        current_project_id: "proj-sample",
      },
      "session:c": {
        current_project_id: "proj-assistant-context-router",
      },
    },
  });

  assert.deepEqual(findSessionKeysForProject(raw, "proj-assistant-context-router"), [
    "session:a",
    "session:c",
  ]);
  assert.deepEqual(findSessionKeysForProject("not-json", "proj-assistant-context-router"), []);
  assert.equal(
    sessionProjectStorePath("/tmp/plugin-data"),
    "/tmp/plugin-data/assistant-context-router/session-project-store.json",
  );
});
