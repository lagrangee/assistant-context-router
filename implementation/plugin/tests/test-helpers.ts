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
`,
  );

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
    path.join(deliveryRoot, "docs", "recent-state.md"),
    `## Current State

The prototype is ready for implementation.

## Notes

Longer history should not be included in full.
`,
  );

  return {
    root,
    registryPath: path.join(projectsRoot, "index.yaml"),
    dataDir,
  };
}
