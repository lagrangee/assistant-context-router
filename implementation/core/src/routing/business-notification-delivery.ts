import type {
  BusinessNotificationDeliveryRecord,
  BusinessNotificationRecord,
  NormalizedEnvelope,
  WorkflowSurfaceReplyTargetBinding,
} from "../types.ts";

function stableId(prefix: string, parts: Array<string | null | undefined>): string {
  const base = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("|")
    .replace(/[^a-zA-Z0-9._|:-]+/g, "_");

  return `${prefix}:${base || "record"}`;
}

type DeliveryMode = "channel_message" | "reply" | "thread_reply" | "direct";
type ResolvedTargetKind = "chat" | "user" | "message" | "dm";

export interface BusinessNotificationDeliveryTargetBinding {
  channel_type: string;
  target_kind: string;
  target_ref: string;
  delivery_mode: string;
}

interface ResolvedTransportReplyTarget {
  channel_type: string;
  target_kind: ResolvedTargetKind;
  target_ref: string;
  delivery_mode: DeliveryMode;
}

export interface BusinessNotificationDeliveryPlan {
  deliverable: boolean;
  error_reason: string | null;
  seed: Omit<
    BusinessNotificationDeliveryRecord,
    "delivery_id" | "created_at" | "updated_at" | "status" | "runtime_target_id" | "error_reason" | "trace_patch"
  >;
}

function renderArtifactLine(record: BusinessNotificationRecord): string {
  if (!record.artifact_ref) {
    return "Artifact: none";
  }

  return `Artifact: ${record.artifact_ref.kind} | ${record.artifact_ref.label ?? "unnamed"} | ${record.artifact_ref.target}`;
}

function renderBusinessNotificationMessage(input: {
  notification: BusinessNotificationRecord;
  target: ResolvedTransportReplyTarget | null;
}): string {
  const { notification } = input;

  return [
    "ACR business notification",
    `Project: ${notification.project_id}`,
    `Signal: ${notification.signal_kind}`,
    `Action: ${notification.action_name ?? "unknown"}`,
    `Workflow: ${notification.workflow ?? "unknown"}`,
    `Reason: ${notification.reason}`,
    `Summary: ${notification.summary ?? "none"}`,
    `Trace: ${notification.trace_id ?? "none"}`,
    `Notification ID: ${notification.notification_id}`,
    input.target
      ? `Target: ${input.target.channel_type}/${input.target.target_kind}/${input.target.target_ref}`
      : "Target: record_only",
    renderArtifactLine(notification),
  ].join("\n");
}

function resolveFeishuTargetFromReplyTarget(input: {
  channelType: string | null | undefined;
  replyTarget: {
    target_kind: string;
    target_id: string | null;
    reply_mode: string;
  } | null;
  missingTargetErrorReason: string;
}): { target: ResolvedTransportReplyTarget | null; error_reason: string | null } {
  if (!input.replyTarget) {
    return {
      target: null,
      error_reason: input.missingTargetErrorReason,
    };
  }

  if (input.channelType !== "feishu") {
    return {
      target: null,
      error_reason: `record_only:unsupported_notification_channel:${input.channelType ?? "unknown"}`,
    };
  }

  const replyTarget = input.replyTarget;
  if (replyTarget.target_kind !== "channel" || replyTarget.reply_mode !== "direct") {
    return {
      target: null,
      error_reason: `record_only:unsupported_reply_target:${replyTarget.target_kind}:${replyTarget.reply_mode}`,
    };
  }

  const targetRef = replyTarget.target_id?.trim() ?? "";
  if (!targetRef) {
    return {
      target: null,
      error_reason: "record_only:missing_reply_target_id",
    };
  }

  if (/^oc_[A-Za-z0-9]+$/.test(targetRef)) {
    return {
        target: {
          channel_type: "feishu",
        target_kind: "chat",
        target_ref: targetRef,
        delivery_mode: "channel_message",
      },
      error_reason: null,
    };
  }

  if (/^ou_[A-Za-z0-9]+$/.test(targetRef)) {
    return {
      target: {
        channel_type: "feishu",
        target_kind: "user",
        target_ref: targetRef,
        delivery_mode: "channel_message",
      },
      error_reason: null,
    };
  }

  if (/^om_[A-Za-z0-9]+$/.test(targetRef)) {
    return {
      target: {
        channel_type: "feishu",
        target_kind: "message",
        target_ref: targetRef,
        delivery_mode: "reply",
      },
      error_reason: null,
    };
  }

  const chatMatch = /^feishu:chat:(oc_[A-Za-z0-9]+)$/.exec(targetRef);
  if (chatMatch) {
    return {
      target: {
        channel_type: "feishu",
        target_kind: "chat",
        target_ref: chatMatch[1]!,
        delivery_mode: "channel_message",
      },
      error_reason: null,
    };
  }

  const userMatch = /^feishu:user:(ou_[A-Za-z0-9]+)$/.exec(targetRef);
  if (userMatch) {
    return {
      target: {
        channel_type: "feishu",
        target_kind: "user",
        target_ref: userMatch[1]!,
        delivery_mode: "channel_message",
      },
      error_reason: null,
    };
  }

  const messageMatch = /^feishu:message:(om_[A-Za-z0-9]+)$/.exec(targetRef);
  if (messageMatch) {
    return {
      target: {
        channel_type: "feishu",
        target_kind: "message",
        target_ref: messageMatch[1]!,
        delivery_mode: "reply",
      },
      error_reason: null,
    };
  }

  const threadMatch = /^feishu:thread:(om_[A-Za-z0-9]+)$/.exec(targetRef);
  if (threadMatch) {
    return {
      target: {
        channel_type: "feishu",
        target_kind: "message",
        target_ref: threadMatch[1]!,
        delivery_mode: "thread_reply",
      },
      error_reason: null,
    };
  }

  return {
    target: null,
    error_reason: `record_only:unsupported_feishu_reply_target:${targetRef}`,
  };
}

function resolveTargetFromDeliveryBinding(input: {
  binding: BusinessNotificationDeliveryTargetBinding | null | undefined;
}): { target: ResolvedTransportReplyTarget | null; error_reason: string | null } {
  const binding = input.binding;
  if (!binding) {
    return {
      target: null,
      error_reason: "record_only:no_delivery_target",
    };
  }

  if (
    binding.channel_type === "feishu" &&
    (binding.target_kind === "chat" ||
      binding.target_kind === "user" ||
      binding.target_kind === "message") &&
    (binding.delivery_mode === "channel_message" ||
      binding.delivery_mode === "reply" ||
      binding.delivery_mode === "thread_reply")
  ) {
    return {
      target: {
        channel_type: "feishu",
        target_kind: binding.target_kind,
        target_ref: binding.target_ref,
        delivery_mode: binding.delivery_mode,
      },
      error_reason: null,
    };
  }

  if (
    binding.channel_type === "wechat" &&
    binding.target_kind === "dm" &&
    binding.delivery_mode === "direct"
  ) {
    return {
      target: {
        channel_type: "wechat",
        target_kind: "dm",
        target_ref: binding.target_ref,
        delivery_mode: "direct",
      },
      error_reason: null,
    };
  }

  return {
    target: null,
    error_reason: `record_only:unsupported_delivery_target:${binding.channel_type}:${binding.target_kind}:${binding.delivery_mode}`,
  };
}

export function deriveBusinessNotificationDeliveryDedupKey(input: {
  notificationId: string;
  targetRef?: string | null;
  deliveryMode?: string | null;
}): string {
  return stableId("business_notification_delivery", [
    input.notificationId,
    input.targetRef ?? "record_only",
    input.deliveryMode ?? "record_only",
  ]);
}

export function buildBusinessNotificationDeliveryPlan(input: {
  notification: BusinessNotificationRecord;
  envelope: NormalizedEnvelope;
  defaultReplyTarget?: WorkflowSurfaceReplyTargetBinding | null;
  defaultDeliveryTarget?: BusinessNotificationDeliveryTargetBinding | null;
}): BusinessNotificationDeliveryPlan {
  const deliveryTarget = resolveTargetFromDeliveryBinding({
    binding: input.defaultDeliveryTarget,
  });
  const candidate =
    input.defaultDeliveryTarget
      ? null
      : input.envelope.reply_target
      ? {
          channelType: input.envelope.channel_type,
          replyTarget: input.envelope.reply_target,
          missingTargetErrorReason: "record_only:no_feishu_reply_target",
        }
      : input.defaultReplyTarget
        ? {
            channelType: input.defaultReplyTarget.channel_type,
            replyTarget: input.defaultReplyTarget,
            missingTargetErrorReason: "record_only:no_workflow_binding_target",
          }
        : {
            channelType: input.envelope.channel_type,
            replyTarget: null,
            missingTargetErrorReason: "record_only:no_delivery_target",
          };

  const resolved = input.defaultDeliveryTarget
    ? deliveryTarget
    : resolveFeishuTargetFromReplyTarget(candidate);

  return {
    deliverable: Boolean(resolved.target),
    error_reason: resolved.error_reason,
    seed: {
      notification_id: input.notification.notification_id,
      project_id: input.notification.project_id,
      signal_kind: input.notification.signal_kind,
      trace_id: input.notification.trace_id,
      action_name: input.notification.action_name,
      workflow: input.notification.workflow,
      reason: input.notification.reason,
      summary: input.notification.summary,
      artifact_ref: input.notification.artifact_ref,
      channel_type: resolved.target?.channel_type ?? null,
      target_kind: resolved.target?.target_kind ?? null,
      target_ref:
        resolved.target?.target_ref ??
        input.defaultDeliveryTarget?.target_ref ??
        candidate?.replyTarget?.target_id ??
        null,
      delivery_mode: resolved.target?.delivery_mode ?? null,
      rendered_message: renderBusinessNotificationMessage({
        notification: input.notification,
        target: resolved.target,
      }),
    },
  };
}
