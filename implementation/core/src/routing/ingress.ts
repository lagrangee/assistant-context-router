import type {
  ChannelType,
  CommandContextLike,
  NormalizedEnvelope,
  ReplyTarget,
  WorkflowFamily,
} from "../types.ts";
import { randomUUID } from "node:crypto";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const picked = asString(value);
    if (picked) {
      return picked;
    }
  }
  return null;
}

function normalizeChannelType(value: string | null): ChannelType {
  const text = value?.toLowerCase() ?? "";
  if (text.includes("wechat") || text.includes("weixin")) {
    return "wechat";
  }
  if (text.includes("feishu") || text.includes("lark")) {
    return "feishu";
  }
  if (text.includes("discord")) {
    return "discord";
  }
  if (text.includes("tui") || text.includes("terminal") || text.includes("cli")) {
    return "tui";
  }
  return "unknown";
}

function normalizeWorkflow(value: string | null): WorkflowFamily | null {
  if (!value) {
    return null;
  }
  if (value === "dispatch" || value === "review" || value === "general") {
    return value;
  }
  return null;
}

function resolveReplyTarget(input: {
  event: Record<string, unknown>;
  ctx?: unknown;
  channelType: ChannelType;
}): ReplyTarget | null {
  const eventRecord = input.event;
  const ctxRecord = asRecord(input.ctx);
  const payloadRecord = asRecord(eventRecord.payload);
  const replyRecord =
    asRecord(eventRecord.reply_target) ??
    asRecord(payloadRecord?.reply_target) ??
    asRecord(ctxRecord?.reply_target);

  if (replyRecord) {
    return {
      target_kind: (pickString(replyRecord.target_kind, replyRecord.kind) as ReplyTarget["target_kind"]) ?? "channel",
      target_id: pickString(replyRecord.target_id, replyRecord.channel_id, replyRecord.session_id),
      visibility:
        (pickString(replyRecord.visibility) as ReplyTarget["visibility"]) ?? "system_facing",
      reply_mode: (pickString(replyRecord.reply_mode, replyRecord.mode) as ReplyTarget["reply_mode"]) ?? "direct",
    };
  }

  const channelId = pickString(
    eventRecord.channelId,
    eventRecord.channel_id,
    payloadRecord?.channelId,
    payloadRecord?.channel_id,
    ctxRecord?.channelId,
    ctxRecord?.channel_id,
    eventRecord.channel,
    ctxRecord?.channel,
  );

  if (!channelId) {
    return null;
  }

  return {
    target_kind: "channel",
    target_id: channelId,
    visibility: input.channelType === "unknown" ? "system_facing" : "human_facing",
    reply_mode: "direct",
  };
}

export function normalizeIngressEvent(input: {
  event: Record<string, unknown>;
  ctx?: unknown;
}): NormalizedEnvelope | null {
  const eventRecord = input.event;
  const ctxRecord = asRecord(input.ctx);
  const messageRecord = asRecord(eventRecord.message);
  const payloadRecord = asRecord(eventRecord.payload);

  const text = pickString(
    eventRecord.text,
    eventRecord.body,
    eventRecord.content,
    eventRecord.input,
    eventRecord.rawText,
    eventRecord.commandBody,
    typeof eventRecord.message === "string" ? eventRecord.message : null,
    messageRecord?.text,
    messageRecord?.body,
    messageRecord?.content,
    payloadRecord?.text,
    payloadRecord?.body,
    payloadRecord?.content,
    ctxRecord?.text,
    ctxRecord?.body,
    ctxRecord?.content,
  );

  const channelType = normalizeChannelType(
    pickString(
      eventRecord.channel_type,
      eventRecord.channelType,
      eventRecord.channel,
      payloadRecord?.channel_type,
      payloadRecord?.channelType,
      payloadRecord?.channel,
      ctxRecord?.channel_type,
      ctxRecord?.channelType,
      ctxRecord?.channel,
    ),
  );

  const actionName = pickString(
    eventRecord.action_name,
    eventRecord.actionName,
    payloadRecord?.action_name,
    payloadRecord?.actionName,
  );

  const explicitSource = pickString(
    eventRecord.source_type,
    payloadRecord?.source_type,
    ctxRecord?.source_type,
  );

  const sourceType =
    explicitSource === "agent" || explicitSource === "automation"
      ? explicitSource
      : actionName || payloadRecord?.parameters
        ? "automation"
        : "human";

  const projectRef = pickString(
    eventRecord.project_ref,
    eventRecord.projectRef,
    eventRecord.project_id,
    eventRecord.projectId,
    payloadRecord?.project_ref,
    payloadRecord?.projectRef,
    payloadRecord?.project_id,
    payloadRecord?.projectId,
  );

  const resolvedProjectId = pickString(
    eventRecord.resolved_project_id,
    payloadRecord?.resolved_project_id,
    eventRecord.project_id,
    payloadRecord?.project_id,
  );

  const workflow = normalizeWorkflow(
    pickString(
      eventRecord.workflow,
      payloadRecord?.workflow,
      payloadRecord?.workflow_family,
    ),
  );

  const parameters =
    asRecord(eventRecord.parameters) ??
    asRecord(payloadRecord?.parameters) ??
    null;

  const replyTarget = resolveReplyTarget({
    event: eventRecord,
    ctx: input.ctx,
    channelType,
  });

  const traceId = pickString(
    eventRecord.trace_id,
    eventRecord.traceId,
    payloadRecord?.trace_id,
    payloadRecord?.traceId,
  ) ?? ((actionName || projectRef || resolvedProjectId || parameters) ? `trace_${randomUUID()}` : null);

  const rawMessageRef = pickString(
    eventRecord.message_id,
    eventRecord.messageId,
    payloadRecord?.message_id,
    payloadRecord?.messageId,
    traceId,
  );

  if (!text && !actionName && !projectRef && !resolvedProjectId && !parameters) {
    return null;
  }

  return {
    source_type: sourceType,
    channel_type: channelType,
    project_ref: projectRef,
    resolved_project_id: resolvedProjectId,
    action_name: actionName,
    parameters,
    reply_target: replyTarget,
    trace_id: traceId,
    workflow,
    raw_message_ref: rawMessageRef,
    text,
  };
}
