import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_FEISHU_CONFIG_DIRNAME,
  DEFAULT_FEISHU_CONFIG_FILENAME,
  DEFAULT_FEISHU_CONFIG_PATH_ENV,
  DEFAULT_FEISHU_WORK_SURFACE_BASE_TOKEN,
  loadFeishuAdapterConfig,
  renderFeishuAdapterConfigYaml,
  resolveDefaultFeishuConfigPathForDataDir,
  resolveFeishuConfigPath,
  resolveFeishuWorkSurfaceBinding,
  resolveGovernanceDeliveryBinding,
  writeFeishuAdapterConfigFile,
} from "../../adapters/feishu/src/config-host.ts";

async function makeTempConfig(contents: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "acr-feishu-config-"));
  const configPath = path.join(dir, "feishu-adapter.yaml");
  await writeFile(configPath, contents);
  return configPath;
}

test("resolveFeishuWorkSurfaceBinding falls back to code defaults without a config host", async () => {
  const binding = await resolveFeishuWorkSurfaceBinding({ env: {} });

  assert.equal(binding.baseToken, DEFAULT_FEISHU_WORK_SURFACE_BASE_TOKEN);
  assert.equal(binding.identity, "bot");
  assert.equal(binding.tableNames.projection, "Work Surface Snapshots");
  assert.equal(binding.tableNames.projects, "Projects");
  assert.equal(binding.fieldNames.projection.headline, "标题");
  assert.equal(binding.fieldNames.projects.project_id, "Project ID");
  assert.equal(binding.fieldNames.projects.project_name, "项目名称");
  assert.equal(binding.fieldNames.projects.objective, "目标");
  assert.equal(binding.relationWriteMode, "record_id_array");
});

test("resolveFeishuWorkSurfaceBinding honors FEISHU_BASE_TOKEN env override", async () => {
  const binding = await resolveFeishuWorkSurfaceBinding({
    env: {
      FEISHU_BASE_TOKEN: "env-base-token",
    },
  });

  assert.equal(binding.baseToken, "env-base-token");
});

test("resolveFeishuWorkSurfaceBinding loads explicit config host and env refs", async () => {
  const configPath = await makeTempConfig(`
work_surface:
  base_token_ref: env:CUSTOM_BASE_TOKEN
  identity: user
  table_binding:
    projection: Team Work Surface
  field_binding:
    projection:
      headline: Surface Title
    projects:
      project_id: PID
      project_name: Project Name
      objective: Project Objective
  relation_write_mode: record_ref_array
`);

  const binding = await resolveFeishuWorkSurfaceBinding({
    configPath,
    env: {
      CUSTOM_BASE_TOKEN: "base-from-env-ref",
    },
  });

  assert.equal(binding.baseToken, "base-from-env-ref");
  assert.equal(binding.identity, "user");
  assert.equal(binding.tableNames.projection, "Team Work Surface");
  assert.equal(binding.tableNames.projects, "Projects");
  assert.equal(binding.fieldNames.projection.headline, "Surface Title");
  assert.equal(binding.fieldNames.projection.summary, "摘要");
  assert.equal(binding.fieldNames.projects.project_id, "PID");
  assert.equal(binding.fieldNames.projects.project_name, "Project Name");
  assert.equal(binding.fieldNames.projects.objective, "Project Objective");
  assert.equal(binding.relationWriteMode, "record_ref_array");
});

test("resolveFeishuWorkSurfaceBinding can read config path from env", async () => {
  const configPath = await makeTempConfig(`
work_surface:
  base_token: config-file-base-token
`);

  const binding = await resolveFeishuWorkSurfaceBinding({
    env: {
      [DEFAULT_FEISHU_CONFIG_PATH_ENV]: configPath,
    },
  });

  assert.equal(resolveFeishuConfigPath({ env: { [DEFAULT_FEISHU_CONFIG_PATH_ENV]: configPath } }), configPath);
  assert.equal(binding.baseToken, "config-file-base-token");
});

test("resolveFeishuConfigPath falls back to dataDir default file", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "acr-feishu-data-dir-"));
  const expected = path.join(dataDir, DEFAULT_FEISHU_CONFIG_DIRNAME, DEFAULT_FEISHU_CONFIG_FILENAME);

  assert.equal(resolveDefaultFeishuConfigPathForDataDir(dataDir), expected);
  assert.equal(resolveFeishuConfigPath({ dataDir, env: {} }), expected);
});

test("loadFeishuAdapterConfig returns empty config when default dataDir file is absent", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "acr-feishu-empty-data-dir-"));
  const config = await loadFeishuAdapterConfig(undefined, {}, dataDir);
  assert.deepEqual(config, {});
});

test("resolveFeishuWorkSurfaceBinding auto-discovers dataDir default config host", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "acr-feishu-discover-data-dir-"));
  const configPath = path.join(dataDir, DEFAULT_FEISHU_CONFIG_DIRNAME, DEFAULT_FEISHU_CONFIG_FILENAME);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    `
work_surface:
  base_token: data-dir-base-token
  table_binding:
    projection: DataDir Snapshots
`,
  );

  const binding = await resolveFeishuWorkSurfaceBinding({
    dataDir,
    env: {},
  });

  assert.equal(binding.baseToken, "data-dir-base-token");
  assert.equal(binding.tableNames.projection, "DataDir Snapshots");
  assert.equal(binding.tableNames.projects, "Projects");
});

test("resolveFeishuWorkSurfaceBinding fails when configured env ref is missing", async () => {
  const configPath = await makeTempConfig(`
work_surface:
  base_token_ref: env:MISSING_BASE_TOKEN
`);

  await assert.rejects(
    () =>
      resolveFeishuWorkSurfaceBinding({
        configPath,
        env: {},
      }),
    /missing-feishu-config-env-ref:work_surface\.base_token_ref:MISSING_BASE_TOKEN/,
  );
});

test("loadFeishuAdapterConfig fails clearly when explicit config path is missing", async () => {
  const missingPath = path.join(os.tmpdir(), "acr-does-not-exist-feishu-adapter.yaml");
  await assert.rejects(
    () => loadFeishuAdapterConfig(missingPath, {}),
    /ENOENT/,
  );
});

test("renderFeishuAdapterConfigYaml includes work-surface defaults and optional governance block", () => {
  const yaml = renderFeishuAdapterConfigYaml({
    workSurfaceBaseToken: "base-token",
    governanceTarget: {
      target_ref: "local:human_dm",
    },
  });

  assert.match(yaml, /work_surface:/);
  assert.match(yaml, /base_token: base-token/);
  assert.match(yaml, /projection: Work Surface Snapshots/);
  assert.match(yaml, /project_name: 项目名称/);
  assert.match(yaml, /objective: 目标/);
  assert.match(yaml, /governance:/);
  assert.match(yaml, /target_ref: local:human_dm/);
});

test("writeFeishuAdapterConfigFile writes default file under dataDir", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "acr-feishu-write-data-dir-"));
  const writtenPath = await writeFeishuAdapterConfigFile({
    dataDir,
    template: {
      workSurfaceBaseToken: "written-base-token",
      governanceTarget: {
        target_ref: "local:human_dm",
      },
    },
  });

  assert.equal(writtenPath, path.join(dataDir, DEFAULT_FEISHU_CONFIG_DIRNAME, DEFAULT_FEISHU_CONFIG_FILENAME));
  const raw = await readFile(writtenPath, "utf8");
  assert.match(raw, /base_token: written-base-token/);
  assert.match(raw, /governance:/);
  assert.match(raw, /target_ref: local:human_dm/);

  const binding = await resolveFeishuWorkSurfaceBinding({
    dataDir,
    env: {},
  });
  assert.equal(binding.baseToken, "written-base-token");

  const governanceBinding = await resolveGovernanceDeliveryBinding({
    dataDir,
    env: {},
  });
  assert.equal(governanceBinding?.target_ref, "local:human_dm");
});

test("writeFeishuAdapterConfigFile refuses to overwrite without force", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "acr-feishu-existing-data-dir-"));
  await writeFeishuAdapterConfigFile({
    dataDir,
  });

  await assert.rejects(
    () =>
      writeFeishuAdapterConfigFile({
        dataDir,
      }),
    /feishu-config-exists:/,
  );
});

test("resolveGovernanceDeliveryBinding returns null when no target binding is configured", async () => {
  const binding = await resolveGovernanceDeliveryBinding({ env: {} });
  assert.equal(binding, null);
});

test("resolveGovernanceDeliveryBinding loads config target and applies default semantics", async () => {
  const configPath = await makeTempConfig(`
governance:
  default_target:
    target_ref: local:human_dm
`);

  const binding = await resolveGovernanceDeliveryBinding({
    configPath,
    env: {},
  });

  assert.deepEqual(binding, {
    channel_type: "wechat",
    target_kind: "dm",
    target_ref: "local:human_dm",
    delivery_mode: "direct",
  });
});
