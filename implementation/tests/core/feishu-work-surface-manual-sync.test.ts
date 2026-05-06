import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { writeWorkSurfaceProjectionSnapshot } from "../../core/src/routing/work-surface-projection.ts";
import {
  FEISHU_WORK_SURFACE_BASE_TOKEN_ENV,
  createFeishuWorkSurfaceProjectionObserver,
  parseFeishuWorkSurfaceManualSyncArgs,
  runFeishuWorkSurfaceManualSync,
} from "../../adapters/work-surfaces/feishu/src/manual-sync.ts";

function makeSnapshot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    project_id: "proj-bitable-pm-system",
    updated_at: "2026-04-20T04:00:00.000Z",
    signal_kind: "blocked",
    surface_status: "blocked",
    headline: "Blocked: dispatch",
    summary: "Waiting for approval payload.",
    trace_id: "trace-001",
    action_name: "dispatch",
    workflow: "dispatch",
    run_id: "run-001",
    queue_ref: "queue-001",
    artifact_ref: {
      kind: "approval_request",
      label: "Approval payload",
      target: "file:///tmp/approval-payload.json",
    },
    ...overrides,
  };
}

function createStubRunner(fixtures?: {
  tables?: Array<Record<string, unknown>>;
  fields?: Record<string, Array<Record<string, unknown>>>;
  records?: Record<string, Array<Record<string, unknown>>>;
  upsertResult?: Record<string, unknown>;
}) {
  const calls: string[][] = [];
  let lastUpsertFields: Record<string, unknown> | null = null;

  return {
    calls,
    getLastUpsertFields(): Record<string, unknown> | null {
      return lastUpsertFields;
    },
    runner: {
      async run(args: string[]): Promise<unknown> {
        calls.push(args);

        const command = `${args[0]} ${args[1]}`;
        if (command === "base +table-list") {
          return {
            items:
              fixtures?.tables ?? [
                { table_id: "tbl-projects", name: "Projects" },
                { table_id: "tbl-snapshots", name: "Work Surface Snapshots" },
              ],
          };
        }

        const tableIdIndex = args.indexOf("--table-id");
        const tableId = tableIdIndex >= 0 ? args[tableIdIndex + 1] : null;

        if (command === "base +field-list") {
          return {
            items: fixtures?.fields?.[String(tableId)] ?? [],
          };
        }

        if (command === "base +record-list") {
          return {
            items: fixtures?.records?.[String(tableId)] ?? [],
          };
        }

        if (command === "base +record-upsert") {
          const jsonIndex = args.indexOf("--json");
          lastUpsertFields =
            jsonIndex >= 0 ? (JSON.parse(args[jsonIndex + 1]) as Record<string, unknown>) : null;
          return fixtures?.upsertResult ?? { record: { record_id: "rec-created" } };
        }

        throw new Error(`unexpected-command:${command}`);
      },
    },
  };
}

function createLiveShapeRunner() {
  const calls: string[][] = [];

  return {
    calls,
    runner: {
      async run(args: string[]): Promise<unknown> {
        calls.push(args);
        const command = `${args[0]} ${args[1]}`;

        if (command === "base +table-list") {
          return {
            ok: true,
            data: {
              tables: [
                { id: "tbl-projects", name: "Projects" },
                { id: "tbl-snapshots", name: "Work Surface Snapshots" },
              ],
            },
          };
        }

        const tableIdIndex = args.indexOf("--table-id");
        const tableId = tableIdIndex >= 0 ? args[tableIdIndex + 1] : null;

        if (command === "base +field-list") {
          if (tableId === "tbl-projects") {
            return {
              ok: true,
              data: {
                fields: [{ id: "fld-project-id", name: "Project ID", type: "text" }],
              },
            };
          }

          return {
            ok: true,
            data: {
              fields: [
                { id: "fld-project-id", name: "Project ID", type: "text" },
                { id: "fld-project-link", name: "所属项目", type: "link" },
                { id: "fld-status", name: "状态", type: "select" },
                { id: "fld-title", name: "标题", type: "text" },
                { id: "fld-summary", name: "摘要", type: "text" },
                { id: "fld-updated", name: "更新时间", type: "datetime" },
                { id: "fld-trace", name: "trace_id", type: "text" },
                { id: "fld-run", name: "run_id", type: "text" },
                { id: "fld-queue", name: "queue_ref", type: "text" },
                { id: "fld-artifact-label", name: "artifact_label", type: "text" },
                { id: "fld-artifact-target", name: "artifact_target", type: "text" },
                { id: "fld-signal", name: "signal_kind", type: "text" },
                { id: "fld-action", name: "action_name", type: "text" },
                { id: "fld-workflow", name: "workflow", type: "text" },
                { id: "fld-artifact-kind", name: "artifact_kind", type: "text" },
              ],
            },
          };
        }

        if (command === "base +record-list" && tableId === "tbl-projects") {
          return {
            ok: true,
            data: {
              data: [["proj-bitable-pm-system"]],
              fields: ["Project ID"],
              record_id_list: ["rec-project"],
            },
          };
        }

        if (command === "base +record-list" && tableId === "tbl-snapshots") {
          return {
            ok: true,
            data: {
              data: [],
              fields: ["Project ID"],
              record_id_list: [],
            },
          };
        }

        if (command === "base +record-upsert") {
          return {
            ok: true,
            data: {
              record_id_list: ["rec-created-live-shape"],
            },
          };
        }

        throw new Error(`unexpected-command:${command}`);
      },
    },
  };
}

function makeDefaultFields() {
  return {
    "tbl-projects": [{ field_name: "Project ID" }],
    "tbl-snapshots": [
      { field_name: "Project ID" },
      { field_name: "所属项目" },
      { field_name: "状态" },
      { field_name: "标题" },
      { field_name: "摘要" },
      { field_name: "更新时间" },
      { field_name: "trace_id" },
      { field_name: "run_id" },
      { field_name: "queue_ref" },
      { field_name: "artifact_label" },
      { field_name: "artifact_target" },
      { field_name: "signal_kind" },
      { field_name: "action_name" },
      { field_name: "workflow" },
      { field_name: "artifact_kind" },
    ],
  };
}

async function makeTempDataDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "acr-feishu-sync-"));
}

test("manual sync arg parser requires an explicit base token source", () => {
  assert.throws(
    () => parseFeishuWorkSurfaceManualSyncArgs(["--project-id", "proj-bitable-pm-system"], {}),
    /missing-required-flag:--base-token-or-FEISHU_BASE_TOKEN/,
  );
});

test("manual sync arg parser still accepts env override", () => {
  const parsed = parseFeishuWorkSurfaceManualSyncArgs(
    ["--project-id", "proj-bitable-pm-system"],
    { [FEISHU_WORK_SURFACE_BASE_TOKEN_ENV]: "base-from-env" },
  );

  assert.equal(parsed.projectId, "proj-bitable-pm-system");
  assert.equal(parsed.baseToken, "base-from-env");
  assert.equal(parsed.apply, false);
});

test("manual sync dry-run reads snapshot and returns upsert plan without writing", async () => {
  const dataDir = await makeTempDataDir();
  await writeWorkSurfaceProjectionSnapshot({
    snapshot: makeSnapshot(),
    dataDir,
  });

  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [
        {
          record_id: "rec-project",
          fields: {
            "Project ID": "proj-bitable-pm-system",
          },
        },
      ],
      "tbl-snapshots": [],
    },
  });

  const result = await runFeishuWorkSurfaceManualSync({
    projectId: "proj-bitable-pm-system",
    dataDir,
    baseToken: "base-token",
    runner: stub.runner,
  });

  assert.equal(result.mode, "dry_run");
  assert.equal(result.plan.operation, "created");
  assert.equal(result.plan.project_record_id, "rec-project");
  assert.equal(result.plan.fields["Project ID"], "proj-bitable-pm-system");
  assert.deepEqual(result.plan.fields["所属项目"], ["rec-project"]);
  assert.equal(result.result, undefined);
  assert.equal(
    stub.calls.some((call) => call[1] === "+record-upsert"),
    false,
  );
});

test("manual sync apply reuses planned fields and upserts snapshot", async () => {
  const dataDir = await makeTempDataDir();
  await writeWorkSurfaceProjectionSnapshot({
    snapshot: makeSnapshot(),
    dataDir,
  });

  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [
        {
          record_id: "rec-project",
          fields: {
            "Project ID": "proj-bitable-pm-system",
          },
        },
      ],
      "tbl-snapshots": [
        {
          record_id: "rec-existing",
          fields: {
            "Project ID": "proj-bitable-pm-system",
          },
        },
      ],
    },
    upsertResult: {
      record: {
        record_id: "rec-existing",
      },
    },
  });

  const result = await runFeishuWorkSurfaceManualSync({
    projectId: "proj-bitable-pm-system",
    dataDir,
    baseToken: "base-token",
    apply: true,
    runner: stub.runner,
  });

  assert.equal(result.mode, "apply");
  assert.equal(result.plan.operation, "updated");
  assert.equal(result.result?.operation, "updated");
  assert.equal(result.result?.record_id, "rec-existing");
  assert.equal(result.result?.projection_record_id, "rec-existing");

  const upsertCall = stub.calls.find((call) => call[1] === "+record-upsert");
  assert.ok(upsertCall);
  assert.ok(upsertCall.includes("--record-id"));
  assert.ok(upsertCall.includes("rec-existing"));

  const fields = stub.getLastUpsertFields();
  assert.ok(fields);
  assert.equal(fields["状态"], "blocked");
  assert.equal(fields["标题"], "Blocked: dispatch");
});

test("manual sync dry-run supports real lark-cli payload shapes", async () => {
  const dataDir = await makeTempDataDir();
  await writeWorkSurfaceProjectionSnapshot({
    snapshot: makeSnapshot(),
    dataDir,
  });

  const liveShape = createLiveShapeRunner();
  const result = await runFeishuWorkSurfaceManualSync({
    projectId: "proj-bitable-pm-system",
    dataDir,
    baseToken: "base-token",
    runner: liveShape.runner,
  });

  assert.equal(result.mode, "dry_run");
  assert.equal(result.plan.operation, "created");
  assert.equal(result.plan.project_record_id, "rec-project");
  assert.equal(result.plan.fields["Project ID"], "proj-bitable-pm-system");
  assert.deepEqual(result.plan.fields["所属项目"], ["rec-project"]);
});

test("manual sync apply extracts record_id from live upsert payload shape", async () => {
  const dataDir = await makeTempDataDir();
  await writeWorkSurfaceProjectionSnapshot({
    snapshot: makeSnapshot(),
    dataDir,
  });

  const liveShape = createLiveShapeRunner();
  const result = await runFeishuWorkSurfaceManualSync({
    projectId: "proj-bitable-pm-system",
    dataDir,
    baseToken: "base-token",
    apply: true,
    runner: liveShape.runner,
  });

  assert.equal(result.mode, "apply");
  assert.equal(result.result?.record_id, "rec-created-live-shape");
});

test("projection observer can sync a snapshot object without rereading the file", async () => {
  const observer = createFeishuWorkSurfaceProjectionObserver({
    baseToken: "base-token",
    apply: false,
    runner: createStubRunner({
      fields: makeDefaultFields(),
      records: {
        "tbl-projects": [
          {
            record_id: "rec-project",
            fields: {
              "Project ID": "proj-bitable-pm-system",
            },
          },
        ],
        "tbl-snapshots": [],
      },
    }).runner,
  });

  const result = await observer({
    projectId: "proj-bitable-pm-system",
    snapshotPath: "/tmp/example/proj-bitable-pm-system.json",
    snapshot: makeSnapshot(),
    dataDir: "/tmp/example",
  });

  assert.equal(result.mode, "dry_run");
  assert.equal(result.snapshot_path, "/tmp/example/proj-bitable-pm-system.json");
  assert.equal(result.plan.operation, "created");
  assert.equal(result.plan.fields["Project ID"], "proj-bitable-pm-system");
});
