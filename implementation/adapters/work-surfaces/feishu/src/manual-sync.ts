import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  FEISHU_WORK_SURFACE_BASE_TOKEN_ENV,
  type FeishuIdentity,
  type FeishuRelationWriteMode,
  resolveFeishuWorkSurfaceBinding,
} from "../../../feishu/src/config-host.ts";
import {
  readWorkSurfaceProjectionSnapshot,
  workSurfaceProjectionPath,
} from "../../../../core/src/routing/work-surface-projection.ts";
import type { WorkSurfaceProjectionSnapshot } from "../../../../core/src/types.ts";

import {
  createFeishuWorkSurfaceAdapter,
  type FeishuWorkSurfaceAdapterConfig,
  type FeishuWorkSurfaceUpsertPlan,
  type FeishuWorkSurfaceUpsertResult,
} from "./work-surface-adapter.ts";
export { FEISHU_WORK_SURFACE_BASE_TOKEN_ENV } from "../../../feishu/src/config-host.ts";

export interface FeishuWorkSurfaceManualSyncOptions
  extends Pick<
    FeishuWorkSurfaceAdapterConfig,
    | "baseToken"
    | "identity"
    | "cliBin"
    | "cwd"
    | "env"
    | "runner"
    | "relationWriteMode"
    | "tableNames"
    | "fieldNames"
  > {
  projectId: string;
  dataDir?: string;
  apply?: boolean;
}

export interface FeishuWorkSurfaceSyncOptions
  extends Pick<
    FeishuWorkSurfaceAdapterConfig,
    | "baseToken"
    | "identity"
    | "cliBin"
    | "cwd"
    | "env"
    | "runner"
    | "relationWriteMode"
    | "tableNames"
    | "fieldNames"
  > {
  snapshot: WorkSurfaceProjectionSnapshot;
  snapshotPath?: string | null;
  apply?: boolean;
}

export interface FeishuWorkSurfaceManualSyncResult {
  mode: "dry_run" | "apply";
  project_id: string;
  snapshot_path: string | null;
  snapshot: WorkSurfaceProjectionSnapshot;
  plan: FeishuWorkSurfaceUpsertPlan;
  result?: FeishuWorkSurfaceUpsertResult;
}

export interface FeishuWorkSurfaceProjectionObserverInput {
  projectId: string;
  snapshot: WorkSurfaceProjectionSnapshot;
  snapshotPath: string;
  dataDir?: string;
}

export interface ParsedFeishuWorkSurfaceManualSyncArgs {
  projectId: string;
  baseToken: string;
  identity?: FeishuIdentity;
  cliBin?: string;
  dataDir?: string;
  apply: boolean;
  relationWriteMode?: FeishuRelationWriteMode;
}

function requireStringFlag(
  value: string | undefined,
  flagName: string,
): string {
  if (!value || value.trim() === "") {
    throw new Error(`missing-required-flag:${flagName}`);
  }
  return value;
}

function parseStringFlag(
  argv: string[],
  index: number,
  flagName: string,
): [string, number] {
  const value = argv[index + 1];
  return [requireStringFlag(value, flagName), index + 2];
}

export function parseFeishuWorkSurfaceManualSyncArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): ParsedFeishuWorkSurfaceManualSyncArgs {
  let projectId: string | null = null;
  let baseToken: string | null = env[FEISHU_WORK_SURFACE_BASE_TOKEN_ENV]?.trim() || null;
  let identity: FeishuIdentity | undefined;
  let cliBin: string | undefined;
  let dataDir: string | undefined;
  let apply = false;
  let relationWriteMode: FeishuRelationWriteMode | undefined;

  for (let index = 0; index < argv.length; ) {
    const token = argv[index];

    if (token === "--apply") {
      apply = true;
      index += 1;
      continue;
    }

    if (token === "--project-id") {
      [projectId, index] = parseStringFlag(argv, index, "--project-id");
      continue;
    }

    if (token === "--base-token") {
      [baseToken, index] = parseStringFlag(argv, index, "--base-token");
      continue;
    }

    if (token === "--identity") {
      const [rawIdentity, nextIndex] = parseStringFlag(argv, index, "--identity");
      if (rawIdentity !== "bot" && rawIdentity !== "user") {
        throw new Error(`invalid-identity:${rawIdentity}`);
      }
      identity = rawIdentity;
      index = nextIndex;
      continue;
    }

    if (token === "--cli-bin") {
      [cliBin, index] = parseStringFlag(argv, index, "--cli-bin");
      continue;
    }

    if (token === "--data-dir") {
      [dataDir, index] = parseStringFlag(argv, index, "--data-dir");
      continue;
    }

    if (token === "--relation-write-mode") {
      const [rawMode, nextIndex] = parseStringFlag(argv, index, "--relation-write-mode");
      if (rawMode !== "record_id_array" && rawMode !== "record_ref_array") {
        throw new Error(`invalid-relation-write-mode:${rawMode}`);
      }
      relationWriteMode = rawMode;
      index = nextIndex;
      continue;
    }

    throw new Error(`unknown-flag:${token}`);
  }

  return {
    projectId: requireStringFlag(projectId ?? undefined, "--project-id"),
    baseToken: requireStringFlag(baseToken ?? undefined, `--base-token-or-${FEISHU_WORK_SURFACE_BASE_TOKEN_ENV}`),
    identity,
    cliBin,
    dataDir,
    apply,
    relationWriteMode,
  };
}

export async function runFeishuWorkSurfaceManualSync(
  options: FeishuWorkSurfaceManualSyncOptions,
): Promise<FeishuWorkSurfaceManualSyncResult> {
  const snapshotPath = workSurfaceProjectionPath(options.projectId, options.dataDir);
  const snapshot = await readWorkSurfaceProjectionSnapshot({
    projectId: options.projectId,
    dataDir: options.dataDir,
  });

  if (!snapshot) {
    throw new Error(`missing-work-surface-snapshot:${options.projectId}`);
  }

  return runFeishuWorkSurfaceSync({
    baseToken: options.baseToken,
    identity: options.identity,
    cliBin: options.cliBin,
    cwd: options.cwd,
    env: options.env,
    runner: options.runner,
    relationWriteMode: options.relationWriteMode,
    tableNames: options.tableNames,
    fieldNames: options.fieldNames,
    snapshot,
    snapshotPath,
    apply: options.apply,
  });
}

export async function runFeishuWorkSurfaceSync(
  options: FeishuWorkSurfaceSyncOptions,
): Promise<FeishuWorkSurfaceManualSyncResult> {
  const projectId = options.snapshot.project_id;

  const adapter = createFeishuWorkSurfaceAdapter({
    baseToken: options.baseToken,
    identity: options.identity,
    cliBin: options.cliBin,
    cwd: options.cwd,
    env: options.env,
    runner: options.runner,
    relationWriteMode: options.relationWriteMode,
    tableNames: options.tableNames,
    fieldNames: options.fieldNames,
  });

  const plan = await adapter.planSnapshotUpsert(options.snapshot);

  if (!options.apply) {
    return {
      mode: "dry_run",
      project_id: projectId,
      snapshot_path: options.snapshotPath ?? null,
      snapshot: options.snapshot,
      plan,
    };
  }

  const result = await adapter.upsertSnapshot(options.snapshot);
  return {
    mode: "apply",
    project_id: projectId,
    snapshot_path: options.snapshotPath ?? null,
    snapshot: options.snapshot,
    plan,
    result,
  };
}

export function createFeishuWorkSurfaceProjectionObserver(
  options: Pick<
    FeishuWorkSurfaceSyncOptions,
    | "baseToken"
    | "identity"
    | "cliBin"
    | "cwd"
    | "env"
    | "runner"
    | "relationWriteMode"
    | "tableNames"
    | "fieldNames"
    | "apply"
  >,
) {
  return async (
    input: FeishuWorkSurfaceProjectionObserverInput,
  ): Promise<FeishuWorkSurfaceManualSyncResult> =>
    runFeishuWorkSurfaceSync({
      ...options,
      snapshot: input.snapshot,
      snapshotPath: input.snapshotPath,
    });
}

export async function resolveDefaultFeishuWorkSurfaceManualSyncOptions(input: {
  configPath?: string | null;
  env?: NodeJS.ProcessEnv;
  dataDir?: string;
  baseToken?: string | null;
  identity?: FeishuIdentity;
  relationWriteMode?: FeishuRelationWriteMode;
} = {}): Promise<
  Pick<
    FeishuWorkSurfaceManualSyncOptions,
    "baseToken" | "identity" | "tableNames" | "fieldNames" | "relationWriteMode"
  >
> {
  const binding = await resolveFeishuWorkSurfaceBinding({
    configPath: input.configPath,
    env: input.env,
    dataDir: input.dataDir,
    baseToken: input.baseToken,
    identity: input.identity,
    relationWriteMode: input.relationWriteMode,
  });

  return {
    baseToken: binding.baseToken,
    identity: binding.identity,
    tableNames: binding.tableNames,
    fieldNames: binding.fieldNames,
    relationWriteMode: binding.relationWriteMode,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseFeishuWorkSurfaceManualSyncArgs(argv);
  const result = await runFeishuWorkSurfaceManualSync({
    projectId: parsed.projectId,
    baseToken: parsed.baseToken,
    identity: parsed.identity,
    cliBin: parsed.cliBin,
    dataDir: parsed.dataDir,
    apply: parsed.apply,
    relationWriteMode: parsed.relationWriteMode,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
