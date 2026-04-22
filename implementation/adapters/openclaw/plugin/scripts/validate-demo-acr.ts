import os from "node:os";
import path from "node:path";
import {
  appendFile,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

import { createAssistantContextRouterPlugin } from "../src/index.ts";
import { projectSessionEventPath } from "../../../../core/src/routing/project-session-lane.ts";

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "assistant-context-router-demo-validate-"));
  const dataDir = path.join(tempRoot, "plugin-data");
  const projectRoot = path.join(tempRoot, "projects", "delivery", "demo-acr");
  const runtimeTarget = path.join(tempRoot, "runtime-project-session.jsonl");
  const registryPath = path.join(tempRoot, "index.yaml");
  const runtimeBindingsPath = path.join(tempRoot, "runtime-bindings.yaml");
  const sourceProjectRoot = path.resolve(
    "<demo-acr-root>",
  );

  try {
    await mkdir(path.dirname(projectRoot), { recursive: true });
    await mkdir(dataDir, { recursive: true });
    await cp(sourceProjectRoot, projectRoot, { recursive: true });

    await writeFile(
      registryPath,
      `version: 3
projects:
  - project_id: demo-acr
    title: "demo-acr"
    type: delivery
    status: active
    owner: project-owner
    file: "${projectRoot}/project.yaml"
    cadence: "ad-hoc"
`,
    );

    await writeFile(
      runtimeBindingsPath,
      `main_sessions:
  - binding_id: demo-main
    runtime_kind: openclaw
    canonical_session_key: main:demo:human
    aliases: feishu:dm:human
`,
    );

    await writeFile(
      path.join(projectRoot, "router.yaml"),
      `actions:
  dispatch:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true
  review:
    target_kind: service
    workflow: review
    requires_resolved_project: true
  append_project_note:
    target_kind: project_session
    workflow: general
    requires_resolved_project: true
project_session_binding:
  runtime_kind: file_jsonl
  target_ref: "${runtimeTarget}"
`,
    );

    const plugin = createAssistantContextRouterPlugin({
      registryPath,
      dataDir,
      runtimeBindingsPath,
      projectSessionDeliveryAdapters: {
        file_jsonl: async (request) => {
          await appendFile(
            request.binding.target_ref,
            `${JSON.stringify({
              project_id: request.project_id,
              action_name: request.envelope.action_name,
              parameters: request.envelope.parameters,
              trace_id: request.envelope.trace_id,
            })}\n`,
            "utf8",
          );
          return {
            status: "delivered",
            runtime_target_id: request.binding.target_ref,
            fallback_used: false,
            error_reason: null,
            trace_patch: {
              delivered_by: "file_jsonl",
            },
          };
        },
      },
    });

    const handlers = new Map<string, (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>>();
    await plugin.register({
      registerCommand() {},
      on(eventName, handler) {
        handlers.set(eventName, handler);
      },
    });

    const beforeDispatch = handlers.get("before_dispatch");
    const beforePromptBuild = handlers.get("before_prompt_build");
    if (!beforeDispatch || !beforePromptBuild) {
      throw new Error("plugin hooks were not registered");
    }

    const projectSwitch = await beforeDispatch({
      content: "/project demo-acr",
      sessionKey: "feishu:dm:human",
    });
    const promptContext = await beforePromptBuild({
      sessionKey: "main:demo:human",
      systemPrompt: "Base system prompt.",
      messages: [],
    });
    const fixture = JSON.parse(
      await readFile(path.join(projectRoot, "fixtures", "append-note.json"), "utf8"),
    ) as Record<string, unknown>;
    const delivery = await beforeDispatch(fixture);
    const runtimeLog = await readFile(runtimeTarget, "utf8");
    const laneLog = await readFile(projectSessionEventPath("demo-acr", dataDir), "utf8");

    console.log(
      JSON.stringify(
        {
          ok: true,
          project_switch_handled: projectSwitch?.handled ?? false,
          prompt_has_project_context:
            typeof promptContext?.prependSystemContext === "string" &&
            promptContext.prependSystemContext.includes("demo-acr"),
          delivery_handled: delivery?.handled ?? false,
          runtime_target: runtimeTarget,
          runtime_log_lines: runtimeLog.trim().split("\n").filter(Boolean).length,
          lane_log_lines: laneLog.trim().split("\n").filter(Boolean).length,
          note: "demo-acr validation uses a copied project workspace plus a generic file_jsonl delivery adapter to exercise runtime session binding end-to-end.",
        },
        null,
        2,
      ),
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
