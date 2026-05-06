import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

import type {
  BusinessNotificationDeliveryRecord,
  RuntimeChannelTargetBinding,
  RuntimeBindingsConfig,
} from "../../../../core/src/types.ts";
import { buildNormalizedLarkCliEnv } from "../../../work-surfaces/feishu/src/lark-cli-env.ts";
import { resolveGovernanceTargetSessionKey } from "./governance-delivery.ts";

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

function buildLarkCliIdempotencyKey(deliveryId: string): string {
  return `acr-${createHash("sha256").update(deliveryId).digest("hex").slice(0, 32)}`;
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
        env: buildNormalizedLarkCliEnv(options?.env),
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

    const idempotencyKey = buildLarkCliIdempotencyKey(record.delivery_id);
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
            idempotencyKey,
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
            idempotencyKey,
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
          lark_idempotency_key: idempotencyKey,
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
          lark_idempotency_key: idempotencyKey,
        },
      };
    }
  };
}

interface OpenClawRuntimeLike {
  config?: {
    loadConfig?: () => unknown;
  };
  channel?: {
    outbound?: {
      loadAdapter?: (id: string) => Promise<OpenClawChannelOutboundAdapterLike | undefined>;
    };
  };
  system?: {
    enqueueSystemEvent?: (
      text: string,
      options: {
        sessionKey: string;
        contextKey?: string | null;
        deliveryContext?: Record<string, unknown>;
        trusted?: boolean;
      },
    ) => boolean;
    runHeartbeatOnce?: (options?: {
      reason?: string;
      sessionKey?: string;
      heartbeat?: {
        target?: string;
      };
    }) => Promise<
      | { status: "ran"; durationMs: number }
      | { status: "skipped"; reason: string }
      | { status: "failed"; reason: string }
    >;
    requestHeartbeatNow?: (options?: {
      reason?: string;
      sessionKey?: string;
    }) => unknown;
  };
}

interface OpenClawChannelOutboundAdapterLike {
  sendText?: (ctx: {
    cfg: unknown;
    to: string;
    text: string;
    accountId?: string | null;
  }) => Promise<unknown>;
}

interface ResolvedRuntimeChannelTarget {
  runtime_channel_id: string;
  target_ref: string;
  account_id: string | null;
  binding_id: string | null;
}

function buildOpenClawBusinessNotificationDeliveryText(
  record: BusinessNotificationDeliveryRecord,
): string {
  return [
    "Assistant Context Router business notification:",
    `project_id: ${record.project_id}`,
    `signal_kind: ${record.signal_kind}`,
    `action_name: ${record.action_name ?? "unknown_action"}`,
    `workflow: ${record.workflow ?? "general"}`,
    `trace_id: ${record.trace_id ?? "none"}`,
    `notification_id: ${record.notification_id}`,
    `reason: ${record.reason}`,
    `summary: ${record.summary ?? "none"}`,
    "",
    "rendered_message:",
    record.rendered_message,
    "",
    "Treat this as a notification mirror. It does not create or resolve governance truth.",
  ].join("\n");
}

function localSymbolicAliasCandidates(targetRef: string): string[] {
  if (!targetRef.startsWith("local:")) {
    return [];
  }

  const symbolic = targetRef.slice("local:".length).trim();
  if (!symbolic) {
    return [];
  }

  const parts = symbolic.split("_").filter(Boolean);
  const candidates = new Set<string>([symbolic]);

  if (parts.length >= 3) {
    candidates.add(`${parts[0]}:${parts[1]}:${parts.slice(2).join("_")}`);
  }

  candidates.add(symbolic.replaceAll("_", ":"));
  return Array.from(candidates);
}

function channelTargetMatches(
  binding: RuntimeChannelTargetBinding,
  record: BusinessNotificationDeliveryRecord,
): boolean {
  if (
    binding.channel_type !== record.channel_type ||
    binding.target_kind !== record.target_kind ||
    binding.delivery_mode !== record.delivery_mode
  ) {
    return false;
  }

  const targetRef = record.target_ref?.trim() ?? "";
  if (!targetRef) {
    return false;
  }

  const candidates = new Set([
    targetRef,
    ...localSymbolicAliasCandidates(targetRef),
  ]);

  return (
    candidates.has(binding.binding_id) ||
    candidates.has(binding.target_ref) ||
    binding.aliases.some((alias) => candidates.has(alias))
  );
}

function defaultRuntimeChannelId(channelType: string | null): string | null {
  if (channelType === "wechat") {
    return "openclaw-direct-message";
  }

  return null;
}

function resolveRuntimeChannelTarget(input: {
  record: BusinessNotificationDeliveryRecord;
  runtimeBindings?: RuntimeBindingsConfig;
}): ResolvedRuntimeChannelTarget | null {
  const { record } = input;
  const configuredTarget = (input.runtimeBindings?.channel_targets ?? []).find((binding) =>
    channelTargetMatches(binding, record),
  );

  if (configuredTarget) {
    const runtimeChannelId =
      configuredTarget.runtime_channel_id ??
      defaultRuntimeChannelId(configuredTarget.channel_type);

    if (!runtimeChannelId) {
      return null;
    }

    return {
      runtime_channel_id: runtimeChannelId,
      target_ref: configuredTarget.target_ref,
      account_id: configuredTarget.account_id ?? null,
      binding_id: configuredTarget.binding_id,
    };
  }

  const targetRef = record.target_ref?.trim() ?? "";
  const runtimeChannelId = defaultRuntimeChannelId(record.channel_type);
  if (!targetRef || targetRef.startsWith("local:") || !runtimeChannelId) {
    return null;
  }

  return {
    runtime_channel_id: runtimeChannelId,
    target_ref: targetRef,
    account_id: null,
    binding_id: null,
  };
}

function resolveOutboundMessageId(value: unknown): string | null {
  const objectValue = asObject(value);
  if (!objectValue) {
    return null;
  }

  const candidates = [
    objectValue.messageId,
    objectValue.message_id,
    asObject(objectValue.data)?.messageId,
    asObject(objectValue.data)?.message_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export function createOpenClawChannelBusinessNotificationDeliveryAdapter(input: {
  runtime?: OpenClawRuntimeLike;
  runtimeBindings?: RuntimeBindingsConfig;
}) {
  return async function deliverBusinessNotificationToChannel(
    record: BusinessNotificationDeliveryRecord,
  ): Promise<BusinessNotificationDeliveryAdapterResult> {
    if (
      record.channel_type !== "wechat" ||
      record.target_kind !== "dm" ||
      !record.target_ref ||
      record.delivery_mode !== "direct"
    ) {
      return {
        status: "record_only",
        runtime_target_id: null,
        error_reason: record.error_reason ?? "record_only:unsupported_delivery_target",
        trace_patch: {
          delivered_by: "record_only_fallback",
        },
      };
    }

    const target = resolveRuntimeChannelTarget({
      record,
      runtimeBindings: input.runtimeBindings,
    });
    if (!target) {
      return {
        status: "failed",
        runtime_target_id: null,
        error_reason: `unresolved_business_notification_channel_target:${record.target_ref}`,
        trace_patch: null,
      };
    }

    const cfg = input.runtime?.config?.loadConfig?.();
    const loadAdapter = input.runtime?.channel?.outbound?.loadAdapter;
    if (!cfg || !loadAdapter) {
      return {
        status: "failed",
        runtime_target_id: target.target_ref,
        error_reason: "missing_openclaw_channel_outbound_api",
        trace_patch: {
          delivered_by: "openclaw_channel_outbound",
          runtime_channel_id: target.runtime_channel_id,
          binding_id: target.binding_id,
        },
      };
    }

    const channelAdapter = await loadAdapter(target.runtime_channel_id);
    if (!channelAdapter?.sendText) {
      return {
        status: "failed",
        runtime_target_id: target.target_ref,
        error_reason: `missing_openclaw_channel_send_text:${target.runtime_channel_id}`,
        trace_patch: {
          delivered_by: "openclaw_channel_outbound",
          runtime_channel_id: target.runtime_channel_id,
          binding_id: target.binding_id,
        },
      };
    }

    try {
      const response = await channelAdapter.sendText({
        cfg,
        to: target.target_ref,
        text: record.rendered_message,
        accountId: target.account_id,
      });

      return {
        status: "delivered",
        runtime_target_id: resolveOutboundMessageId(response) ?? target.target_ref,
        error_reason: null,
        trace_patch: {
          delivered_by: "openclaw_channel_outbound",
          runtime_channel_id: target.runtime_channel_id,
          binding_id: target.binding_id,
          target_kind: record.target_kind,
        },
      };
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "failed",
        runtime_target_id: target.target_ref,
        error_reason: `openclaw_channel_delivery_failed:${fallbackMessage}`,
        trace_patch: {
          delivered_by: "openclaw_channel_outbound",
          runtime_channel_id: target.runtime_channel_id,
          binding_id: target.binding_id,
          target_kind: record.target_kind,
        },
      };
    }
  };
}

export function createOpenClawSessionBusinessNotificationDeliveryAdapter(input: {
  runtime?: OpenClawRuntimeLike;
  runtimeBindings?: RuntimeBindingsConfig;
}) {
  return async function deliverBusinessNotificationToSession(
    record: BusinessNotificationDeliveryRecord,
  ): Promise<BusinessNotificationDeliveryAdapterResult> {
    if (
      record.channel_type !== "wechat" ||
      record.target_kind !== "dm" ||
      !record.target_ref ||
      record.delivery_mode !== "direct"
    ) {
      return {
        status: "record_only",
        runtime_target_id: null,
        error_reason: record.error_reason ?? "record_only:unsupported_delivery_target",
        trace_patch: {
          delivered_by: "record_only_fallback",
        },
      };
    }

    const targetSessionKey = resolveGovernanceTargetSessionKey({
      targetRef: record.target_ref,
      runtimeBindings: input.runtimeBindings,
    });
    const enqueueSystemEvent = input.runtime?.system?.enqueueSystemEvent;
    const runHeartbeatOnce = input.runtime?.system?.runHeartbeatOnce;
    const requestHeartbeatNow = input.runtime?.system?.requestHeartbeatNow;
    const wakeReason = "acr:business_notification_delivery";

    if (!targetSessionKey) {
      return {
        status: "failed",
        runtime_target_id: null,
        error_reason: `unresolved_business_notification_target:${record.target_ref}`,
        trace_patch: null,
      };
    }

    if (!enqueueSystemEvent) {
      return {
        status: "failed",
        runtime_target_id: targetSessionKey,
        error_reason: "missing_openclaw_runtime_system_api",
        trace_patch: null,
      };
    }

    const accepted = enqueueSystemEvent(buildOpenClawBusinessNotificationDeliveryText(record), {
      sessionKey: targetSessionKey,
      contextKey: `acr:business_notification:${record.project_id}`,
      trusted: true,
      deliveryContext: {
        business_notification_delivery_id: record.delivery_id,
        notification_id: record.notification_id,
        channel_type: record.channel_type,
        target_kind: record.target_kind,
      },
    });

    if (!accepted) {
      return {
        status: "failed",
        runtime_target_id: targetSessionKey,
        error_reason: "openclaw_system_event_rejected",
        trace_patch: null,
      };
    }

    if (runHeartbeatOnce) {
      const heartbeatResult = await runHeartbeatOnce({
        reason: wakeReason,
        sessionKey: targetSessionKey,
        heartbeat: {
          target: "last",
        },
      });

      if (heartbeatResult.status === "ran") {
        return {
          status: "delivered",
          runtime_target_id: targetSessionKey,
          error_reason: null,
          trace_patch: {
            delivered_by: "openclaw_business_notification_session",
            delivery_mode: "system_event_heartbeat_once",
            wake_reason: wakeReason,
            heartbeat_status: heartbeatResult.status,
            heartbeat_duration_ms: heartbeatResult.durationMs,
          },
        };
      }

      if (
        heartbeatResult.status === "skipped" &&
        heartbeatResult.reason === "requests-in-flight" &&
        requestHeartbeatNow
      ) {
        requestHeartbeatNow({
          reason: wakeReason,
          sessionKey: targetSessionKey,
        });

        return {
          status: "queued",
          runtime_target_id: targetSessionKey,
          error_reason: null,
          trace_patch: {
            delivered_by: "openclaw_business_notification_session",
            delivery_mode: "system_event_queued",
            wake_reason: wakeReason,
            heartbeat_status: heartbeatResult.status,
            heartbeat_reason: heartbeatResult.reason,
          },
        };
      }

      return {
        status: "queued",
        runtime_target_id: targetSessionKey,
        error_reason: null,
        trace_patch: {
          delivered_by: "openclaw_business_notification_session",
          delivery_mode: "system_event_pending",
          wake_reason: wakeReason,
          heartbeat_status: heartbeatResult.status,
          heartbeat_reason:
            heartbeatResult.status === "ran" ? null : heartbeatResult.reason,
        },
      };
    }

    if (requestHeartbeatNow) {
      requestHeartbeatNow({
        reason: wakeReason,
        sessionKey: targetSessionKey,
      });
    }

    return {
      status: "queued",
      runtime_target_id: targetSessionKey,
      error_reason: null,
      trace_patch: {
        delivered_by: "openclaw_business_notification_session",
        delivery_mode: "system_event_queued",
        wake_reason: wakeReason,
      },
    };
  };
}

function isAcceptedDeliveryResult(result: BusinessNotificationDeliveryAdapterResult): boolean {
  return result.status === "delivered" || result.status === "queued";
}

export function createOpenClawWechatBusinessNotificationDeliveryAdapter(input: {
  runtime?: OpenClawRuntimeLike;
  runtimeBindings?: RuntimeBindingsConfig;
}) {
  const channelAdapter = createOpenClawChannelBusinessNotificationDeliveryAdapter(input);
  const sessionAdapter = createOpenClawSessionBusinessNotificationDeliveryAdapter(input);

  return async function deliverBusinessNotificationToWechat(
    record: BusinessNotificationDeliveryRecord,
  ): Promise<BusinessNotificationDeliveryAdapterResult> {
    const channelResult = await channelAdapter(record);
    if (isAcceptedDeliveryResult(channelResult)) {
      return channelResult;
    }

    const sessionResult = await sessionAdapter(record);
    if (isAcceptedDeliveryResult(sessionResult)) {
      return {
        ...sessionResult,
        trace_patch: {
          ...(sessionResult.trace_patch ?? {}),
          primary_delivery_status: channelResult.status,
          primary_error_reason: channelResult.error_reason,
          primary_delivered_by: channelResult.trace_patch?.delivered_by ?? null,
        },
      };
    }

    return {
      status: "failed",
      runtime_target_id: sessionResult.runtime_target_id ?? channelResult.runtime_target_id,
      error_reason: [
        "wechat_business_notification_delivery_failed",
        `channel=${channelResult.error_reason ?? channelResult.status}`,
        `session=${sessionResult.error_reason ?? sessionResult.status}`,
      ].join(":"),
      trace_patch: {
        delivered_by: "openclaw_wechat_business_notification_composite",
        channel_status: channelResult.status,
        channel_error_reason: channelResult.error_reason,
        session_status: sessionResult.status,
        session_error_reason: sessionResult.error_reason,
      },
    };
  };
}
