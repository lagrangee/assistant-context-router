import { findClosestProjects, getProjectById } from "../../../../../core/src/projects/registry.ts";
import { readCurrentProjectBinding } from "../../../../../core/src/state/current-project-binding.ts";
import { readGovernanceDeliveryRecords } from "../../../../../core/src/state/governance-delivery-outbox.ts";
import type { ProjectGovernanceCommandResult } from "../../../../../core/src/types.ts";
import type { SessionProjectStore } from "../../../../../core/src/state/session-project-store.ts";

function renderTarget(record: {
  channel_type: string;
  target_kind: string;
  target_ref: string;
}): string {
  return `${record.channel_type}/${record.target_kind}/${record.target_ref}`;
}

function isPendingGovernanceRecord(status: "pending" | "delivered" | "queued" | "failed"): boolean {
  return status === "pending" || status === "queued";
}

export async function handleProjectGovernanceCommand(input: {
  registryPath: string;
  store: SessionProjectStore;
  sessionKey?: string | null;
  projectId?: string | null;
  dataDir?: string;
}): Promise<ProjectGovernanceCommandResult> {
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

  const records = (await readGovernanceDeliveryRecords({ dataDir: input.dataDir }))
    .filter((record) => record.project_id === projectId);
  const latest = records.length > 0 ? records[records.length - 1] : null;
  const pendingCount = records.filter((record) => isPendingGovernanceRecord(record.status)).length;

  const lines = [
    `Governance outbox: ${projectId}`,
    latest ? `Latest delivery: ${latest.updated_at}` : "Latest delivery: none",
    `Pending records: ${pendingCount}`,
    latest ? `Current target: ${renderTarget(latest)}` : "Current target: none",
  ];

  if (records.length === 0) {
    lines.push(
      "",
      "No governance delivery records found yet for this project.",
      "A governance mirror appears only after a main-session escalation is opened and a governance target binding is configured.",
    );
    return {
      content: lines.join("\n"),
    };
  }

  lines.push(
    "These are delivery mirrors/outbox records, not governance truth.",
    "",
    "Recent governance deliveries:",
  );

  for (const record of records.slice(-5).reverse()) {
    lines.push(
      `- ${record.signal_kind} | ${record.action_name ?? "unknown_action"} | ${record.updated_at} | ${record.status} | ${renderTarget(record)}`,
    );
    lines.push(`  escalation: ${record.escalation_id}`);
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
