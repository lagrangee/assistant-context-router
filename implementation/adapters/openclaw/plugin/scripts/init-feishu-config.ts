import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_FEISHU_CONFIG_FILENAME,
  DEFAULT_FEISHU_WORK_SURFACE_BASE_TOKEN_REF,
  DEFAULT_GOVERNANCE_TARGET_REF,
  writeFeishuAdapterConfigFile,
} from "../../../feishu/src/config-host.ts";

interface ParsedArgs {
  dataDir: string;
  force: boolean;
  baseToken: string | null;
  governanceTargetRef: string;
}

function usage(): string {
  return [
    "Usage: node scripts/init-feishu-config.ts [--data-dir <dir>] [--base-token <token>] [--governance-target-ref <ref>] [--force]",
    "",
    "Defaults:",
    `- dataDir: ${path.join(os.homedir(), ".openclaw", "assistant-context-router")}`,
    `- file: ${DEFAULT_FEISHU_CONFIG_FILENAME}`,
    `- base token: no token is written unless --base-token is provided`,
    `- base token ref: ${DEFAULT_FEISHU_WORK_SURFACE_BASE_TOKEN_REF}`,
    `- governance target ref: ${DEFAULT_GOVERNANCE_TARGET_REF}`,
  ].join("\n");
}

function requireStringFlag(
  argv: string[],
  index: number,
  flagName: string,
): [string, number] {
  const value = argv[index + 1];
  if (!value || value.trim() === "") {
    throw new Error(`missing-required-flag:${flagName}`);
  }
  return [value.trim(), index + 2];
}

function parseArgs(argv = process.argv.slice(2)): ParsedArgs {
  let dataDir = path.join(os.homedir(), ".openclaw", "assistant-context-router");
  let force = false;
  let baseToken: string | null = null;
  let governanceTargetRef = DEFAULT_GOVERNANCE_TARGET_REF;

  for (let index = 0; index < argv.length; ) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (token === "--force") {
      force = true;
      index += 1;
      continue;
    }
    if (token === "--data-dir") {
      [dataDir, index] = requireStringFlag(argv, index, "--data-dir");
      continue;
    }
    if (token === "--base-token") {
      [baseToken, index] = requireStringFlag(argv, index, "--base-token");
      continue;
    }
    if (token === "--governance-target-ref") {
      [governanceTargetRef, index] = requireStringFlag(argv, index, "--governance-target-ref");
      continue;
    }
    throw new Error(`unknown-flag:${token}`);
  }

  return {
    dataDir,
    force,
    baseToken,
    governanceTargetRef,
  };
}

async function main() {
  const parsed = parseArgs();
  const configPath = await writeFeishuAdapterConfigFile({
    dataDir: parsed.dataDir,
    force: parsed.force,
    template: {
      workSurfaceBaseToken: parsed.baseToken,
      governanceTarget: {
        target_ref: parsed.governanceTargetRef,
      },
    },
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        data_dir: parsed.dataDir,
        config_path: configPath,
        force: parsed.force,
        governance_target_ref: parsed.governanceTargetRef,
      },
      null,
      2,
    )}\n`,
  );
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.stderr.write(`${usage()}\n`);
  process.exit(1);
});
