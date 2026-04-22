import { findClosestProjects, getProjectById } from "../../../../../core/src/projects/registry.ts";
import { readCurrentProjectBinding } from "../../../../../core/src/state/current-project-binding.ts";
import { readBusinessNotificationDeliveryRecords } from "../../../../../core/src/state/business-notification-delivery-outbox.ts";
import type { ProjectNotificationsCommandResult } from "../../../../../core/src/types.ts";
import type { SessionProjectStore } from "../../../../../core/src/state/session-project-store.ts";

function renderTarget(record: {
  channel_type: string | null;
  target_kind: string | null;
  target_ref: string | null;
}): string {
  if (!record.channel_type || !record.target_kind || !record.target_ref) {
    return "record_only";
  }

  return `${record.channel_type}/${record.target_kind}/${record.target_ref}`;
}

function isPendingNotificationRecord(
  status: "record_only" | "pending" | "delivered" | "queued" | "failed",
): boolean {
  return status === "pending" || status === "queued";
}

export async function handleProjectNotificationsCommand(input: {
  registryPath: string;
  store: SessionProjectStore;
  sessionKey?: string | null;
  projectId?: string | null;
  dataDir?: string;
}): Promise<ProjectNotificationsCommandResult> {
  let projectId = input.projectId?.trim() ?? "";

  if (!projectId) {
    if (!input.sessionKey) {
      throw new Error("No current project selected. Use /project <project_id> first or pass a project id.");
    }
    const sessionState = await input.store.get(input.sessionKey);
    const binding = readCurrentProjectBinding(sessionState);
    if (!binding) {
      throw new Error("No current project selected. Use /project <project_id> first or pass a project id.");
    }
    projectId = binding.project_id;
  }

  let entry = await getProjectById(input.registryPath, projectId);
  if (!entry) {
    const suggestions = await findClosestProjects(input.registryPath, projectId);
    if (suggestions.length === 1) {
      entry = suggestions[0];
      projectId = entry.project_id;
    } else {
      const suggestionText =
        suggestions.length > 0
          ? ` Did you mean: ${suggestions.map((candidate) => candidate.project_id).join(", ")}`
          : "";
      throw new Error(`Unknown project_id: ${projectId}.${suggestionText}`);
    }
  }

  const records = (await readBusinessNotificationDeliveryRecords({ dataDir: input.dataDir }))
    .filter((record) => record.project_id === projectId);
  const latest = records.length > 0 ? records[records.length - 1] : null;
  const pendingCount = records.filter((record) => isPendingNotificationRecord(record.status)).length;
  const recordOnlyCount = records.filter((record) => record.status === "record_only").length;

  const lines = [
    `Business notifications: ${projectId}`,
    latest ? `Latest delivery: ${latest.updated_at}` : "Latest delivery: none",
    `Pending records: ${pendingCount}`,
    `Record-only records: ${recordOnlyCount}`,
    latest ? `Current target: ${renderTarget(latest)}` : "Current target: none",
  ];

  if (records.length === 0) {
    lines.push(
      "",
      "No business-notification delivery records found yet for this project.",
      "A delivery mirror appears only after a business-notification signal is recorded.",
    );
    return {
      content: lines.join("\n"),
    };
  }

  lines.push(
    "These are delivery mirrors/outbox records, not business-notification truth.",
    "",
    "Recent business-notification deliveries:",
  );

  for (const record of records.slice(-5).reverse()) {
    lines.push(
      `- ${record.signal_kind} | ${record.action_name ?? "unknown_action"} | ${record.updated_at} | ${record.status} | ${renderTarget(record)}`,
    );
    lines.push(`  notification: ${record.notification_id}`);
    if (record.runtime_target_id) {
      lines.push(`  runtime_target: ${record.runtime_target_id}`);
    }
    if (record.summary) {
      lines.push(`  summary: ${record.summary}`);
    }
    if (record.trace_id) {
      lines.push(`  trace: ${record.trace_id}`);
    }
    if (record.error_reason) {
      lines.push(`  error: ${record.error_reason}`);
    }
  }

  return {
    content: lines.join("\n"),
  };
}
