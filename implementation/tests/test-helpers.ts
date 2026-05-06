import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function makeTempProjectWorkspace(): Promise<{
  root: string;
  registryPath: string;
  dataDir: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "assistant-context-router-"));
  const projectsRoot = path.join(root, "projects");
  const deliveryRoot = path.join(projectsRoot, "delivery", "sample-project");
  const dataDir = path.join(root, "plugin-data");

  await mkdir(path.join(deliveryRoot, "docs"), { recursive: true });
  await mkdir(path.join(deliveryRoot, "execution"), { recursive: true });
  await mkdir(dataDir, { recursive: true });

  await writeFile(
    path.join(projectsRoot, "index.yaml"),
    `version: 3
projects:
  - project_id: proj-sample
    title: "Sample Project"
    type: delivery
    status: active
    owner: project-owner
    file: "delivery/sample-project/project.yaml"
    cadence: "ad-hoc"
  - project_id: proj-openclaw-feishu-orchestrator
    title: "OpenClaw Feishu Orchestrator"
    type: governance
    status: in_progress
    owner: project-owner
    file: "governance/openclaw-feishu-orchestrator/project.yaml"
    cadence: "weekly"
`,
  );

  const governanceRoot = path.join(projectsRoot, "governance", "openclaw-feishu-orchestrator");
  await mkdir(path.join(governanceRoot, "docs"), { recursive: true });

  await writeFile(
    path.join(deliveryRoot, "project.yaml"),
    `kind: delivery
project_id: proj-sample
title: "Sample Project"
owner: project-owner
status: active
objective: "Ship a focused MVP."
constraints:
  time: "Keep scope narrow"
  risk: "Avoid context bloat"
principles:
  - "project-first"
  - "safe-fail"
acceptance_criteria:
  - "Can switch project"
  - "Injects lean context"
primary_docs:
  - "README.md"
next_action: "Implement Step 1"
`,
  );

  await writeFile(
    path.join(deliveryRoot, "README.md"),
    `# Sample Project

This project validates project-centric context switching for the assistant.
It should keep context light and explicit.

## Details

This part should not be included by default.
`,
  );

  await writeFile(
    path.join(deliveryRoot, "STATUS.md"),
    `# STATUS

## TL;DR（一句话）
The sample project is in delivery and ready for implementation.

## 当前阶段（你现在在哪）
- Step 1 baseline is complete
- Step 1.5 hall-doc recovery is next

## 下一步（从这里继续推进主线）
- Implement the acceptance fix and verify prompt recovery
`,
  );

  await writeFile(
    path.join(deliveryRoot, "RESUME.md"),
    `# RESUME

## Current phase
Step 1.5 implementation

## Current mainline
- Move the loader to hall-doc-first recovery
- Keep context bounded and explicit

## Immediate next actions
1. Update the project context loader
2. Update tests

## Guardrail
- Do not expand to protocol routing
`,
  );

  await writeFile(
    path.join(deliveryRoot, "execution", "COLLAB.md"),
    `# COLLAB

## Need review / need decision
- none
`,
  );

  await writeFile(
    path.join(governanceRoot, "project.yaml"),
    `kind: governance
project_id: proj-openclaw-feishu-orchestrator
title: "OpenClaw Feishu Orchestrator"
owner: project-owner
status: in_progress
objective: "Route Feishu workflow traffic safely."
next_action: "Validate project routing in OpenClaw TUI"
`,
  );

  await writeFile(
    path.join(governanceRoot, "README.md"),
    `# OpenClaw Feishu Orchestrator

This project defines the protocol and visibility surface for Feishu workflow traffic.
`,
  );

  await writeFile(
    path.join(governanceRoot, "STATUS.md"),
    `# STATUS

## TL;DR（一句话）
Protocol routing validation is the current mainline.
`,
  );

  await writeFile(
    path.join(governanceRoot, "RESUME.md"),
    `# RESUME

## Current phase
Step 2 preparation

## Current mainline
- Validate orchestrator-facing routing
`,
  );

  return {
    root,
    registryPath: path.join(projectsRoot, "index.yaml"),
    dataDir,
  };
}

export function demoAcrRoot(): string {
  return path.resolve(
    "<demo-acr-root>",
  );
}

export async function makeDemoAcrWorkspace(): Promise<{
  root: string;
  registryPath: string;
  dataDir: string;
  projectRoot: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "assistant-context-router-demo-acr-"));
  const registryPath = path.join(root, "index.yaml");
  const dataDir = path.join(root, "plugin-data");
  const projectRoot = demoAcrRoot();

  await mkdir(dataDir, { recursive: true });
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

  return {
    root,
    registryPath,
    dataDir,
    projectRoot,
  };
}

export async function makeCopiedDemoAcrWorkspace(): Promise<{
  root: string;
  registryPath: string;
  dataDir: string;
  projectRoot: string;
}> {
  const base = await makeDemoAcrWorkspace();
  const copiedProjectRoot = path.join(base.root, "projects", "delivery", "demo-acr");
  await mkdir(path.dirname(copiedProjectRoot), { recursive: true });
  await cp(base.projectRoot, copiedProjectRoot, { recursive: true });

  await writeFile(
    base.registryPath,
    `version: 3
projects:
  - project_id: demo-acr
    title: "demo-acr"
    type: delivery
    status: active
    owner: project-owner
    file: "${copiedProjectRoot}/project.yaml"
    cadence: "ad-hoc"
`,
  );

  return {
    ...base,
    projectRoot: copiedProjectRoot,
  };
}

export async function loadDemoAcrFixture(
  name:
    | "dispatch-ok"
    | "review-request"
    | "append-note"
    | "blocked"
    | "blocked-human-decision"
    | "blocked-human-decision-repeat"
    | "unresolved-project",
): Promise<Record<string, unknown>> {
  const fixturePath = path.join(demoAcrRoot(), "fixtures", `${name}.json`);
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function writeRuntimeBindingsConfig(input: {
  root: string;
  bindings: Array<{
    binding_id: string;
    runtime_kind: string;
    canonical_session_key: string;
    aliases: string[];
  }>;
  channelTargets?: Array<{
    binding_id: string;
    channel_type: string;
    target_kind: string;
    target_ref: string;
    delivery_mode: string;
    aliases: string[];
    runtime_channel_id?: string | null;
    account_id?: string | null;
  }>;
}): Promise<string> {
  const configPath = path.join(input.root, "runtime-bindings.yaml");
  const lines = ["main_sessions:"];
  for (const binding of input.bindings) {
    lines.push(`  - binding_id: ${binding.binding_id}`);
    lines.push(`    runtime_kind: ${binding.runtime_kind}`);
    lines.push(`    canonical_session_key: ${binding.canonical_session_key}`);
    lines.push(`    aliases: ${binding.aliases.join(", ")}`);
  }
  if (input.channelTargets?.length) {
    lines.push("channel_targets:");
    for (const binding of input.channelTargets) {
      lines.push(`  - binding_id: ${binding.binding_id}`);
      lines.push(`    channel_type: ${binding.channel_type}`);
      lines.push(`    target_kind: ${binding.target_kind}`);
      lines.push(`    target_ref: ${binding.target_ref}`);
      lines.push(`    delivery_mode: ${binding.delivery_mode}`);
      lines.push(`    aliases: ${binding.aliases.join(", ")}`);
      if (binding.runtime_channel_id) {
        lines.push(`    runtime_channel_id: ${binding.runtime_channel_id}`);
      }
      if (binding.account_id) {
        lines.push(`    account_id: ${binding.account_id}`);
      }
    }
  }
  await writeFile(configPath, `${lines.join("\n")}\n`);
  return configPath;
}
