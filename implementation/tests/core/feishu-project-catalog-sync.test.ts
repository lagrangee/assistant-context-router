import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import {
  createFeishuProjectCatalogAdapter,
  resolveDefaultFeishuProjectCatalogSyncOptions,
  runFeishuProjectCatalogSync,
} from "../../adapters/feishu/src/project-catalog-sync.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

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
              fixtures?.tables ?? [{ table_id: "tbl-projects", name: "Projects" }],
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
          return fixtures?.upsertResult ?? { record: { record_id: "rec-created-project" } };
        }

        throw new Error(`unexpected-command:${command}`);
      },
    },
  };
}

function makeDefaultFields() {
  return {
    "tbl-projects": [
      { field_name: "Project ID" },
      { field_name: "项目名称" },
      { field_name: "Source Path" },
      { field_name: "目标" },
      { field_name: "Cadence" },
      { field_name: "Archived" },
    ],
  };
}

test("resolveDefaultFeishuProjectCatalogSyncOptions reuses work-surface binding defaults", async () => {
  const binding = await resolveDefaultFeishuProjectCatalogSyncOptions({ env: {} });

  assert.equal(binding.tableName, "Projects");
  assert.equal(binding.fieldNames?.project_id, "Project ID");
  assert.equal(binding.fieldNames?.project_name, "项目名称");
  assert.equal(binding.fieldNames?.objective, "目标");
});

test("feishu project catalog adapter validates required fields", async () => {
  const stub = createStubRunner({
    fields: makeDefaultFields(),
  });
  const adapter = createFeishuProjectCatalogAdapter({
    baseToken: "base-token",
    runner: stub.runner,
  });

  const metadata = await adapter.inspectMetadata();

  assert.equal(metadata.projectsTable.table_id, "tbl-projects");
  assert.ok(metadata.projectsFields["Project ID"]);
  assert.ok(metadata.projectsFields["项目名称"]);
});

test("feishu project catalog sync creates a project row with archived=false on first apply", async () => {
  const workspace = await makeTempProjectWorkspace();
  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [],
    },
  });

  const result = await runFeishuProjectCatalogSync({
    registryPath: workspace.registryPath,
    projectId: "proj-sample",
    baseToken: "base-token",
    apply: true,
    runner: stub.runner,
  });

  assert.equal(result.mode, "apply");
  assert.equal(result.plan.operation, "created");
  assert.equal(result.result?.record_id, "rec-created-project");

  const fields = stub.getLastUpsertFields();
  assert.ok(fields);
  assert.equal(fields["Project ID"], "proj-sample");
  assert.equal(fields["项目名称"], "Sample Project");
  assert.equal(fields["Source Path"], "projects/delivery/sample-project/project.yaml");
  assert.equal(fields["目标"], "Ship a focused MVP.");
  assert.equal(fields.Cadence, "ad-hoc");
  assert.equal(fields.Archived, false);
});

test("feishu project catalog sync returns noop when the Feishu row already matches local truth", async () => {
  const workspace = await makeTempProjectWorkspace();
  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [
        {
          record_id: "rec-existing-project",
          fields: {
            "Project ID": "proj-sample",
            "项目名称": "Sample Project",
            "Source Path": "projects/delivery/sample-project/project.yaml",
            "目标": "Ship a focused MVP.",
            Cadence: "ad-hoc",
            Archived: false,
          },
        },
      ],
    },
  });

  const result = await runFeishuProjectCatalogSync({
    registryPath: workspace.registryPath,
    projectId: "proj-sample",
    baseToken: "base-token",
    apply: true,
    runner: stub.runner,
  });

  assert.equal(result.plan.operation, "noop");
  assert.equal(result.result?.operation, "noop");
  assert.equal(result.result?.record_id, "rec-existing-project");
  assert.equal(
    stub.calls.some((call) => call[1] === "+record-upsert"),
    false,
  );
});

test("feishu project catalog sync fails clearly on duplicate Project ID rows", async () => {
  const workspace = await makeTempProjectWorkspace();
  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [
        {
          record_id: "rec-project-1",
          fields: {
            "Project ID": "proj-sample",
          },
        },
        {
          record_id: "rec-project-2",
          fields: {
            "Project ID": "proj-sample",
          },
        },
      ],
    },
  });

  await assert.rejects(
    () =>
      runFeishuProjectCatalogSync({
        registryPath: workspace.registryPath,
        projectId: "proj-sample",
        baseToken: "base-token",
        runner: stub.runner,
      }),
    /reconcile-required:duplicate-project-record:proj-sample/,
  );
});

test("feishu project catalog sync fails clearly on local title drift", async () => {
  const workspace = await makeTempProjectWorkspace();
  const driftedProjectYaml = `kind: delivery
project_id: proj-sample
title: "Drifted Sample Project"
owner: project-owner
status: active
objective: "Ship a focused MVP."
next_action: "Implement Step 1"
`;

  await writeFile(
    `${workspace.root}/projects/delivery/sample-project/project.yaml`,
    driftedProjectYaml,
    "utf8",
  );

  const stub = createStubRunner({
    fields: makeDefaultFields(),
    records: {
      "tbl-projects": [],
    },
  });

  await assert.rejects(
    () =>
      runFeishuProjectCatalogSync({
        registryPath: workspace.registryPath,
        projectId: "proj-sample",
        baseToken: "base-token",
        runner: stub.runner,
      }),
    /reconcile-required:project-title-drift:proj-sample/,
  );
});
