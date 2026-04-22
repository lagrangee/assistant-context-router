import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_RUNTIME_BINDINGS_FILENAME,
  writeRuntimeBindingsConfigFile,
} from "../../../openclaw/runtime/src/bindings.ts";

interface ParsedArgs {
  dataDir: string;
  force: boolean;
  bindingId: string;
  runtimeKind: string;
  canonicalSessionKey: string;
  aliases: string[];
}

function usage(): string {
  return [
    "Usage: node scripts/init-runtime-bindings.ts [--data-dir <dir>] [--binding-id <id>] [--runtime-kind <kind>] [--canonical-session-key <key>] [--alias <alias>]... [--force]",
    "",
    "Defaults:",
    `- dataDir: ${path.join(os.homedir(), ".openclaw", "assistant-context-router")}`,
    `- file: ${DEFAULT_RUNTIME_BINDINGS_FILENAME}`,
    "- binding id: main-session",
    "- runtime kind: openclaw",
    "- canonical session key: agent:main:main",
    "- aliases: wechat:dm:human",
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
  let bindingId = "main-session";
  let runtimeKind = "openclaw";
  let canonicalSessionKey = "agent:main:main";
  const aliases = new Set<string>(["wechat:dm:human"]);

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
    if (token === "--binding-id") {
      [bindingId, index] = requireStringFlag(argv, index, "--binding-id");
      continue;
    }
    if (token === "--runtime-kind") {
      [runtimeKind, index] = requireStringFlag(argv, index, "--runtime-kind");
      continue;
    }
    if (token === "--canonical-session-key") {
      [canonicalSessionKey, index] = requireStringFlag(argv, index, "--canonical-session-key");
      continue;
    }
    if (token === "--alias") {
      const aliasValue = argv[index + 1];
      if (!aliasValue || aliasValue.trim() === "") {
        throw new Error("missing-required-flag:--alias");
      }
      aliases.add(aliasValue.trim());
      index += 2;
      continue;
    }
    throw new Error(`unknown-flag:${token}`);
  }

  return {
    dataDir,
    force,
    bindingId,
    runtimeKind,
    canonicalSessionKey,
    aliases: Array.from(aliases),
  };
}

async function main() {
  const parsed = parseArgs();
  const configPath = await writeRuntimeBindingsConfigFile({
    dataDir: parsed.dataDir,
    force: parsed.force,
    bindings: [
      {
        binding_id: parsed.bindingId,
        runtime_kind: parsed.runtimeKind,
        canonical_session_key: parsed.canonicalSessionKey,
        aliases: parsed.aliases,
        metadata: null,
      },
    ],
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        data_dir: parsed.dataDir,
        config_path: configPath,
        force: parsed.force,
        canonical_session_key: parsed.canonicalSessionKey,
        aliases: parsed.aliases,
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
