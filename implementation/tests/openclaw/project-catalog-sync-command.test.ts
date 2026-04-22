import test from "node:test";
import assert from "node:assert/strict";

import { handleProjectCatalogSyncCommand } from "../../adapters/openclaw/plugin/src/commands/project-catalog-sync.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("project-catalog-sync uses current session project by default", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:catalog-sync", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  let received:
    | {
        registryPath: string;
        projectId: string;
        dataDir?: string;
        apply: boolean;
      }
    | null = null;

  const result = await handleProjectCatalogSyncCommand({
    registryPath: workspace.registryPath,
    store,
    sessionKey: "session:catalog-sync",
    dataDir: workspace.dataDir,
    apply: false,
    sync: async (input) => {
      received = input;
      return {
        mode: "dry_run",
        project_id: input.projectId,
        plan: {
          operation: "created",
          project_id: input.projectId,
          project_record_id: null,
          fields: {
            "Project ID": input.projectId,
          },
          skipped_fields: ["Owner", "类型", "状态"],
          local: {
            project_id: input.projectId,
            project_name: "Sample Project",
            source_path: "projects/delivery/sample-project/project.yaml",
            objective: "Ship a focused MVP.",
            cadence: "ad-hoc",
          },
        },
      };
    },
  });

  assert.deepEqual(received, {
    registryPath: workspace.registryPath,
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
    apply: false,
  });
  assert.match(result.content, /Project catalog sync: proj-sample/);
  assert.match(result.content, /Mode: dry_run/);
  assert.match(result.content, /Planned Feishu operation: created/);
  assert.match(result.content, /Run \/project --catalog-sync --apply/);
});

test("project-catalog-sync accepts explicit project id and apply mode", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleProjectCatalogSyncCommand({
    registryPath: workspace.registryPath,
    store,
    projectId: "proj-openclaw-feishu-orchestrator",
    dataDir: workspace.dataDir,
    apply: true,
    sync: async (input) => ({
      mode: "apply",
      project_id: input.projectId,
      plan: {
        operation: "updated",
        project_id: input.projectId,
        project_record_id: "rec-project-row",
        fields: {
          "Project ID": input.projectId,
        },
        skipped_fields: ["Owner", "类型", "状态"],
        local: {
          project_id: input.projectId,
          project_name: "OpenClaw Feishu Orchestrator",
          source_path: "projects/governance/openclaw-feishu-orchestrator/project.yaml",
          objective: "Route Feishu workflow traffic safely.",
          cadence: "weekly",
        },
      },
      result: {
        operation: "updated",
        record_id: "rec-project-row",
        fields: {
          "Project ID": input.projectId,
        },
      },
    }),
  });

  assert.match(result.content, /Project catalog sync: proj-openclaw-feishu-orchestrator/);
  assert.match(result.content, /Mode: apply/);
  assert.match(result.content, /Planned Feishu operation: updated/);
  assert.match(result.content, /Feishu record: rec-project-row/);
});

test("project-catalog-sync surfaces friendly local drift errors", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:catalog-sync-drift", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  await assert.rejects(
    handleProjectCatalogSyncCommand({
      registryPath: workspace.registryPath,
      store,
      sessionKey: "session:catalog-sync-drift",
      dataDir: workspace.dataDir,
      apply: false,
      sync: async () => {
        throw new Error("reconcile-required:project-title-drift:proj-sample");
      },
    }),
    /Local registry and project.yaml disagree on title for proj-sample/i,
  );
});

test("project-catalog-sync surfaces friendly duplicate record errors", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:catalog-sync-duplicate", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  await assert.rejects(
    handleProjectCatalogSyncCommand({
      registryPath: workspace.registryPath,
      store,
      sessionKey: "session:catalog-sync-duplicate",
      dataDir: workspace.dataDir,
      apply: false,
      sync: async () => {
        throw new Error("reconcile-required:duplicate-project-record:proj-sample");
      },
    }),
    /Feishu Projects table has multiple rows for proj-sample/i,
  );
});
