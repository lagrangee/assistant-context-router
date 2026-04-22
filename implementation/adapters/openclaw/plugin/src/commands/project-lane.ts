import { findClosestProjects, getProjectById } from "../../../../../core/src/projects/registry.ts";
import { summarizeProjectSessionEvents } from "../../../../../core/src/routing/project-session-lane.ts";
import { readCurrentProjectBinding } from "../../../../../core/src/state/current-project-binding.ts";
import type { ArtifactRef, ProjectLaneCommandResult } from "../../../../../core/src/types.ts";
import type { SessionProjectStore } from "../../../../../core/src/state/session-project-store.ts";

function renderCount(label: string, count: number): string | null {
  return count > 0 ? `- ${label}: ${count}` : null;
}

function renderArtifactRef(input: ArtifactRef | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const label = input.label?.trim() || input.target;
  return `  evidence: ${label} | ${input.kind} | ${input.target}`;
}

export async function handleProjectLaneCommand(input: {
  registryPath: string;
  store: SessionProjectStore;
  sessionKey?: string | null;
  projectId?: string | null;
  dataDir?: string;
}): Promise<ProjectLaneCommandResult> {
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

  const summary = await summarizeProjectSessionEvents({
    projectId,
    dataDir: input.dataDir,
  });

  const lines = [
    `Project lane summary: ${projectId}`,
    summary.latest_event_at ? `Latest event: ${summary.latest_event_at}` : "Latest event: none",
    `Latest signal: ${summary.latest_signal}`,
    renderCount("blocked events", summary.blocked_count),
    renderCount("review-request events", summary.review_request_count),
    renderCount("high-signal completion events", summary.high_signal_completion_count),
    renderCount("service-error events", summary.service_error_count),
  ].filter(Boolean) as string[];

  if (summary.notable_events.length > 0) {
    lines.push(
      "Counts below summarize recent lane events, not deduped unresolved governance items.",
    );
    lines.push("", "Recent notable events:");
    for (const event of summary.notable_events) {
      const action = event.envelope.action_name ?? "unknown_action";
      lines.push(
        `- ${event.signal_kind} | ${action} | ${event.recorded_at} | ${event.decision.route_reason}`,
      );
      const artifactLine = renderArtifactRef(event.service_result?.artifact_ref);
      if (artifactLine) {
        lines.push(artifactLine);
      }
    }
  }

  if (summary.total_events === 0) {
    lines.push("", "No events recorded yet for this project lane.");
  }

  return {
    content: lines.join("\n"),
  };
}
