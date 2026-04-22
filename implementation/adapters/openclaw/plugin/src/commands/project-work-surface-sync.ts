import { findClosestProjects, getProjectById } from "../../../../../core/src/projects/registry.ts";
import { readCurrentProjectBinding } from "../../../../../core/src/state/current-project-binding.ts";
import type { SessionProjectStore } from "../../../../../core/src/state/session-project-store.ts";
import type { ProjectWorkSurfaceSyncCommandResult } from "../../../../../core/src/types.ts";
import type { FeishuWorkSurfaceManualSyncResult } from "../../../../work-surfaces/feishu/src/manual-sync.ts";

export interface ProjectWorkSurfaceSyncRunner {
  (input: {
    projectId: string;
    dataDir?: string;
    apply: boolean;
  }): Promise<FeishuWorkSurfaceManualSyncResult>;
}

function renderResultContent(result: FeishuWorkSurfaceManualSyncResult): string {
  const lines = [
    `Work-surface sync: ${result.project_id}`,
    `Mode: ${result.mode}`,
    `Planned Feishu operation: ${result.plan.operation}`,
    `Surface status: ${result.snapshot.surface_status}`,
    `Headline: ${result.snapshot.headline}`,
    result.snapshot.summary ? `Summary: ${result.snapshot.summary}` : null,
    result.snapshot_path ? `Snapshot path: ${result.snapshot_path}` : null,
  ];

  if (result.mode === "apply") {
    lines.push(
      `Feishu record: ${result.result?.record_id ?? result.result?.projection_record_id ?? "unknown"}`,
    );
  } else {
    lines.push("Run /project --surface-sync --apply to write this snapshot to Feishu.");
  }

  return lines.filter(Boolean).join("\n");
}

function asFriendlyError(error: unknown, projectId: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("missing-work-surface-snapshot:")) {
    return new Error(
      `No latest work-surface snapshot found for ${projectId}. Trigger a high-signal execution path first, then sync again.`,
    );
  }

  if (message.startsWith("missing-feishu-base-token-env:")) {
    return new Error(
      "Feishu work-surface sync requires a configured Feishu Base token.",
    );
  }

  if (message.startsWith("missing-project-record:")) {
    const missingProjectId = message.slice("missing-project-record:".length) || projectId;
    return new Error(
      `Feishu Projects table is missing ${missingProjectId}. Add this project to the Projects table first, then retry /project --surface-sync.`,
    );
  }

  return error instanceof Error ? error : new Error(message);
}

export async function handleProjectWorkSurfaceSyncCommand(input: {
  registryPath: string;
  store: SessionProjectStore;
  sessionKey?: string | null;
  projectId?: string | null;
  dataDir?: string;
  apply: boolean;
  sync: ProjectWorkSurfaceSyncRunner;
}): Promise<ProjectWorkSurfaceSyncCommandResult> {
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

  try {
    const result = await input.sync({
      projectId,
      dataDir: input.dataDir,
      apply: input.apply,
    });
    return {
      content: renderResultContent(result),
    };
  } catch (error) {
    throw asFriendlyError(error, projectId);
  }
}
