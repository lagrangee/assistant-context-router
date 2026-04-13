import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
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
