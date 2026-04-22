import assert from "node:assert/strict";
import test from "node:test";

import { createFeishuWorkSurfaceAdapter } from "../../adapters/work-surfaces/feishu/src/work-surface-adapter.ts";

function makeSnapshot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    project_id: "demo-acr",
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
            items:
              fixtures?.fields?.[String(tableId)] ?? [],
          };
        }

        if (command === "base +record-list") {
          return {
            items:
              fixtures?.records?.[String(tableId)] ?? [],
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

test("feishu adapter inspects metadata and validates required fields", async () => {
  const stub = createStubRunner({
    fields: makeDefaultFields(),
  });
  const adapter = createFeishuWorkSurfaceAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  const metadata = await adapter.inspectMetadata();

  assert.equal(metadata.projectionTable.table_id, "tbl-snapshots");
  assert.equal(metadata.projectsTable.table_id, "tbl-projects");
  assert.ok(metadata.projectionFields["Project ID"]);
  assert.ok(metadata.projectsFields["Project ID"]);
});

test("feishu adapter fails clearly when required projection field is missing", async () => {
  const fields = makeDefaultFields();
  fields["tbl-snapshots"] = fields["tbl-snapshots"].filter((field) => field.field_name !== "所属项目");

  const stub = createStubRunner({ fields });
  const adapter = createFeishuWorkSurfaceAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  await assert.rejects(
    adapter.inspectMetadata(),
    /missing-feishu-fields:projection:所属项目/,
  );
});

test("feishu adapter updates existing snapshot row using project_id lookup", async () => {
  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [
        {
          record_id: "rec-project",
          fields: {
            "Project ID": "demo-acr",
          },
        },
      ],
      "tbl-snapshots": [
        {
          record_id: "rec-existing",
          fields: {
            "Project ID": "demo-acr",
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

  const adapter = createFeishuWorkSurfaceAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  const result = await adapter.upsertSnapshot(makeSnapshot());

  assert.equal(result.operation, "updated");
  assert.equal(result.record_id, "rec-existing");
  assert.equal(result.project_record_id, "rec-project");

  const upsertCall = stub.calls.find((call) => call[1] === "+record-upsert");
  assert.ok(upsertCall);
  assert.ok(upsertCall.includes("--record-id"));
  assert.ok(upsertCall.includes("rec-existing"));

  const fields = stub.getLastUpsertFields();
  assert.ok(fields);
  assert.equal(fields["Project ID"], "demo-acr");
  assert.deepEqual(fields["所属项目"], ["rec-project"]);
  assert.equal(fields["状态"], "blocked");
  assert.equal(fields["标题"], "Blocked: dispatch");
  assert.equal(fields["摘要"], "Waiting for approval payload.");
  assert.equal(fields["更新时间"], new Date("2026-04-20T04:00:00.000Z").getTime());
  assert.equal(fields.artifact_kind, "approval_request");
  assert.equal(fields.artifact_target, "file:///tmp/approval-payload.json");
});

test("feishu adapter creates new snapshot row and clears optional fields when snapshot is sparse", async () => {
  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [
        {
          record_id: "rec-project",
          fields: {
            "Project ID": "demo-acr",
          },
        },
      ],
      "tbl-snapshots": [],
    },
    upsertResult: {
      record: {
        record_id: "rec-created",
      },
    },
  });

  const adapter = createFeishuWorkSurfaceAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  const result = await adapter.upsertSnapshot(
    makeSnapshot({
      summary: null,
      trace_id: null,
      run_id: null,
      queue_ref: null,
      artifact_ref: null,
    }),
  );

  assert.equal(result.operation, "created");
  assert.equal(result.record_id, "rec-created");

  const upsertCall = stub.calls.find((call) => call[1] === "+record-upsert");
  assert.ok(upsertCall);
  assert.ok(!upsertCall.includes("--record-id"));

  const fields = stub.getLastUpsertFields();
  assert.ok(fields);
  assert.equal(fields["摘要"], "");
  assert.equal(fields.trace_id, "");
  assert.equal(fields.run_id, "");
  assert.equal(fields.queue_ref, "");
  assert.equal(fields.artifact_label, "");
  assert.equal(fields.artifact_target, "");
  assert.equal(fields.artifact_kind, "");
});

test("feishu adapter fails clearly when project relation target is missing", async () => {
  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [],
      "tbl-snapshots": [],
    },
  });

  const adapter = createFeishuWorkSurfaceAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  await assert.rejects(
    adapter.upsertSnapshot(makeSnapshot()),
    /missing-project-record:demo-acr/,
  );
});

test("feishu adapter can serialize relation as record refs when configured", async () => {
  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [
        {
          record_id: "rec-project",
          fields: {
            "Project ID": "demo-acr",
          },
        },
      ],
      "tbl-snapshots": [],
    },
  });

  const adapter = createFeishuWorkSurfaceAdapter({
    baseToken: "base-token",
    runner: stub.runner,
    relationWriteMode: "record_ref_array",
  });

  await adapter.upsertSnapshot(makeSnapshot());

  const fields = stub.getLastUpsertFields();
  assert.ok(fields);
  assert.deepEqual(fields["所属项目"], [{ record_id: "rec-project" }]);
});

test("feishu adapter extracts created record id from live nested record_id_list shape", async () => {
  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [
        {
          record_id: "rec-project",
          fields: {
            "Project ID": "demo-acr",
          },
        },
      ],
      "tbl-snapshots": [],
    },
    upsertResult: {
      created: true,
      record: {
        data: [["demo-acr", "Completed: dispatch"]],
        fields: ["Project ID", "标题"],
        record_id_list: ["rec-created-live-nested-list"],
      },
    },
  });

  const adapter = createFeishuWorkSurfaceAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  const result = await adapter.upsertSnapshot(
    makeSnapshot({
      signal_kind: "high_signal_completion",
      surface_status: "completed",
      headline: "Completed: dispatch",
      summary: "Dispatch accepted for demo-acr",
    }),
  );

  assert.equal(result.operation, "created");
  assert.equal(result.record_id, "rec-created-live-nested-list");
});
