import test from "node:test";
import assert from "node:assert/strict";

import { handleProjectWorkSurfaceSyncCommand } from "../../adapters/openclaw/plugin/src/commands/project-work-surface-sync.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("project-work-surface-sync uses current session project by default", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:work-surface-sync", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  let received:
    | {
        projectId: string;
        dataDir?: string;
        apply: boolean;
      }
    | null = null;

  const result = await handleProjectWorkSurfaceSyncCommand({
    registryPath: workspace.registryPath,
    store,
    sessionKey: "session:work-surface-sync",
    dataDir: workspace.dataDir,
    apply: false,
    sync: async (input) => {
      received = input;
      return {
        mode: "dry_run",
        project_id: input.projectId,
        snapshot_path: `${workspace.dataDir}/assistant-context-router/work-surface-projections/${input.projectId}.json`,
        snapshot: {
          project_id: input.projectId,
          updated_at: "2026-04-20T13:30:00.000Z",
          signal_kind: "review_request",
          surface_status: "in_review",
          headline: "Review requested: dispatch",
          summary: "Waiting for human review.",
          trace_id: "trace-sync-command-001",
          action_name: "dispatch",
          workflow: "review",
          run_id: "run-sync-command-001",
          queue_ref: "queue-sync-command-001",
          artifact_ref: null,
        },
        plan: {
          operation: "created",
          project_id: input.projectId,
          project_record_id: "rec-project",
          projection_record_id: null,
          fields: {},
        },
      };
    },
  });

  assert.deepEqual(received, {
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
    apply: false,
  });
  assert.match(result.content, /Work-surface sync: proj-sample/);
  assert.match(result.content, /Mode: dry_run/);
  assert.match(result.content, /Planned Feishu operation: created/);
  assert.match(result.content, /Run \/project --surface-sync --apply/);
});

test("project-work-surface-sync accepts explicit project id and apply mode", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  const result = await handleProjectWorkSurfaceSyncCommand({
    registryPath: workspace.registryPath,
    store,
    projectId: "proj-openclaw-feishu-orchestrator",
    dataDir: workspace.dataDir,
    apply: true,
    sync: async (input) => ({
      mode: "apply",
      project_id: input.projectId,
      snapshot_path: `${workspace.dataDir}/assistant-context-router/work-surface-projections/${input.projectId}.json`,
      snapshot: {
        project_id: input.projectId,
        updated_at: "2026-04-20T13:35:00.000Z",
        signal_kind: "high_signal_completion",
        surface_status: "completed",
        headline: "Completed: dispatch",
        summary: "Feishu sync applied.",
        trace_id: "trace-sync-command-apply-001",
        action_name: "dispatch",
        workflow: "dispatch",
        run_id: "run-sync-command-apply-001",
        queue_ref: "queue-sync-command-apply-001",
        artifact_ref: null,
      },
      plan: {
        operation: "updated",
        project_id: input.projectId,
        project_record_id: "rec-project",
        projection_record_id: "rec-feishu-row",
        fields: {},
      },
      result: {
        operation: "updated",
        record_id: "rec-feishu-row",
        project_record_id: "rec-project",
        projection_record_id: "rec-feishu-row",
        fields: {},
      },
    }),
  });

  assert.match(result.content, /Work-surface sync: proj-openclaw-feishu-orchestrator/);
  assert.match(result.content, /Mode: apply/);
  assert.match(result.content, /Planned Feishu operation: updated/);
  assert.match(result.content, /Feishu record: rec-feishu-row/);
});

test("project-work-surface-sync surfaces a friendly missing snapshot error", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:work-surface-sync-missing", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  await assert.rejects(
    handleProjectWorkSurfaceSyncCommand({
      registryPath: workspace.registryPath,
      store,
      sessionKey: "session:work-surface-sync-missing",
      dataDir: workspace.dataDir,
      apply: false,
      sync: async () => {
        throw new Error("missing-work-surface-snapshot:proj-sample");
      },
    }),
    /No latest work-surface snapshot found for proj-sample/i,
  );
});

test("project-work-surface-sync surfaces a friendly missing project record error", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:work-surface-sync-project-missing", {
    current_project_id: "proj-sample",
    selected_via: "manual",
  });

  await assert.rejects(
    handleProjectWorkSurfaceSyncCommand({
      registryPath: workspace.registryPath,
      store,
      sessionKey: "session:work-surface-sync-project-missing",
      dataDir: workspace.dataDir,
      apply: false,
      sync: async () => {
        throw new Error("missing-project-record:proj-sample");
      },
    }),
    /Feishu Projects table is missing proj-sample/i,
  );
});
