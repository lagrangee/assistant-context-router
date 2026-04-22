import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { BusinessNotificationDeliveryRecord } from "../../../../core/src/types.ts";

const execFileAsync = promisify(execFile);

interface LarkCliRunner {
  run(args: string[]): Promise<unknown>;
}

export interface BusinessNotificationDeliveryAdapterResult {
  status: BusinessNotificationDeliveryRecord["status"];
  runtime_target_id: string | null;
  error_reason: string | null;
  trace_patch: Record<string, unknown> | null;
}

interface ResolvedLarkCliTarget {
  target_kind: "chat" | "user" | "message";
  target_ref: string;
  delivery_mode: "channel_message" | "reply" | "thread_reply";
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveMessageId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return null;
  }

  const candidates = [
    objectValue.message_id,
    asObject(objectValue.data)?.message_id,
    asObject(objectValue.message)?.message_id,
    asObject(asObject(objectValue.data)?.message)?.message_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function resolveSupportedTarget(record: BusinessNotificationDeliveryRecord): ResolvedLarkCliTarget | null {
  if (record.channel_type !== "feishu" || !record.target_kind || !record.target_ref || !record.delivery_mode) {
    return null;
  }

  if (
    (record.target_kind === "chat" || record.target_kind === "user" || record.target_kind === "message") &&
    (record.delivery_mode === "channel_message" ||
      record.delivery_mode === "reply" ||
      record.delivery_mode === "thread_reply")
  ) {
    return {
      target_kind: record.target_kind,
      target_ref: record.target_ref,
      delivery_mode: record.delivery_mode,
    };
  }

  return null;
}

function createLarkCliRunner(options?: {
  cliBin?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): LarkCliRunner {
  const cliBin = options?.cliBin ?? "lark-cli";
  return {
    async run(args: string[]) {
      const { stdout } = await execFileAsync(cliBin, args, {
        cwd: options?.cwd,
        env: {
          ...process.env,
          ...(options?.env ?? {}),
        },
        encoding: "utf8",
      });

      try {
        return JSON.parse(stdout);
      } catch {
        return stdout;
      }
    },
  };
}

export function createOpenClawFeishuBusinessNotificationDeliveryAdapter(input?: {
  cliBin?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  runner?: LarkCliRunner;
}) {
  const runner = input?.runner ?? createLarkCliRunner(input);

  return async function deliverBusinessNotification(
    record: BusinessNotificationDeliveryRecord,
  ): Promise<BusinessNotificationDeliveryAdapterResult> {
    const target = resolveSupportedTarget(record);
    if (!target) {
      return {
        status: "record_only",
        runtime_target_id: null,
        error_reason: record.error_reason ?? "record_only:unsupported_delivery_target",
        trace_patch: {
          delivered_by: "record_only_fallback",
        },
      };
    }

    const args =
      target.target_kind === "message"
        ? [
            "im",
            "+messages-reply",
            "--as",
            "bot",
            "--message-id",
            target.target_ref,
            ...(target.delivery_mode === "thread_reply" ? ["--reply-in-thread"] : []),
            "--text",
            record.rendered_message,
            "--idempotency-key",
            record.delivery_id,
          ]
        : [
            "im",
            "+messages-send",
            "--as",
            "bot",
            ...(target.target_kind === "chat"
              ? ["--chat-id", target.target_ref]
              : ["--user-id", target.target_ref]),
            "--text",
            record.rendered_message,
            "--idempotency-key",
            record.delivery_id,
          ];

    try {
      const response = await runner.run(args);
      return {
        status: "delivered",
        runtime_target_id: resolveMessageId(response) ?? target.target_ref,
        error_reason: null,
        trace_patch: {
          delivered_by: "lark_cli_im",
          delivery_mode: target.delivery_mode,
          target_kind: target.target_kind,
        },
      };
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed",
        runtime_target_id: target.target_ref,
        error_reason: `lark_im_delivery_failed:${fallbackMessage}`,
        trace_patch: {
          delivered_by: "lark_cli_im",
          delivery_mode: target.delivery_mode,
          target_kind: target.target_kind,
        },
      };
    }
  };
}
