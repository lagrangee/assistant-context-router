import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  DEFAULT_WORKFLOW_BINDINGS_FILENAME,
  writeWorkflowBindingsConfigFile,
} from "../../../openclaw/runtime/src/workflow-bindings.ts";
import type { WorkflowBindingsConfig, WorkflowSurfaceReplyTargetBinding } from "../../../../core/src/types.ts";

interface ParsedArgs {
  dataDir: string;
  force: boolean;
  dispatchTarget: string | null;
  reviewTarget: string | null;
  generalTarget: string | null;
  channelType: "feishu" | "discord" | "wechat" | "tui" | "unknown";
}

function usage(): string {
  return [
    "Usage: node scripts/init-workflow-bindings.ts [--data-dir <dir>] [--dispatch-target-id <id>] [--review-target-id <id>] [--general-target-id <id>] [--channel-type <feishu|discord|wechat|tui|unknown>] [--force]",
    "",
    "Defaults:",
    `- dataDir: ${path.join(os.homedir(), ".openclaw", "assistant-context-router")}`,
    `- file: ${DEFAULT_WORKFLOW_BINDINGS_FILENAME}`,
    "- channel-type: feishu",
  ].join("\n");
}

function requireStringFlag(argv: string[], index: number, flagName: string): [string, number] {
  const value = argv[index + 1];
  if (!value || value.trim() === "") {
    throw new Error(`missing-required-flag:${flagName}`);
  }
  return [value.trim(), index + 2];
}

function parseArgs(argv = process.argv.slice(2)): ParsedArgs {
  let dataDir = path.join(os.homedir(), ".openclaw", "assistant-context-router");
  let force = false;
  let dispatchTarget: string | null = null;
  let reviewTarget: string | null = null;
  let generalTarget: string | null = null;
  let channelType: ParsedArgs["channelType"] = "feishu";

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
    if (token === "--dispatch-target-id") {
      [dispatchTarget, index] = requireStringFlag(argv, index, "--dispatch-target-id");
      continue;
    }
    if (token === "--review-target-id") {
      [reviewTarget, index] = requireStringFlag(argv, index, "--review-target-id");
      continue;
    }
    if (token === "--general-target-id") {
      [generalTarget, index] = requireStringFlag(argv, index, "--general-target-id");
      continue;
    }
    if (token === "--channel-type") {
      const [value, nextIndex] = requireStringFlag(argv, index, "--channel-type");
      if (
        value !== "feishu" &&
        value !== "discord" &&
        value !== "wechat" &&
        value !== "tui" &&
        value !== "unknown"
      ) {
        throw new Error(`unsupported-channel-type:${value}`);
      }
      channelType = value;
      index = nextIndex;
      continue;
    }
    throw new Error(`unknown-flag:${token}`);
  }

  return {
    dataDir,
    force,
    dispatchTarget,
    reviewTarget,
    generalTarget,
    channelType,
  };
}

function buildBinding(channelType: ParsedArgs["channelType"], targetId: string): WorkflowSurfaceReplyTargetBinding {
  return {
    channel_type: channelType,
    target_kind: "channel",
    target_id: targetId,
    visibility: "system_facing",
    reply_mode: "direct",
  };
}

async function main() {
  const parsed = parseArgs();
  const config: WorkflowBindingsConfig = {};

  if (parsed.generalTarget) {
    config.general = {
      default_reply_target: buildBinding(parsed.channelType, parsed.generalTarget),
    };
  }
  if (parsed.dispatchTarget) {
    config.dispatch = {
      default_reply_target: buildBinding(parsed.channelType, parsed.dispatchTarget),
    };
  }
  if (parsed.reviewTarget) {
    config.review = {
      default_reply_target: buildBinding(parsed.channelType, parsed.reviewTarget),
    };
  }

  if (!config.general && !config.dispatch && !config.review) {
    throw new Error("missing-workflow-targets");
  }

  const configPath = await writeWorkflowBindingsConfigFile({
    dataDir: parsed.dataDir,
    force: parsed.force,
    config,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        data_dir: parsed.dataDir,
        config_path: configPath,
        force: parsed.force,
        channel_type: parsed.channelType,
        dispatch_target: parsed.dispatchTarget,
        review_target: parsed.reviewTarget,
        general_target: parsed.generalTarget,
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
