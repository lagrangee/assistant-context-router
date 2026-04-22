import { findClosestProjects, getProjectById } from "../../../../../core/src/projects/registry.ts";
import { readCurrentProjectBinding } from "../../../../../core/src/state/current-project-binding.ts";
import type { SessionProjectStore } from "../../../../../core/src/state/session-project-store.ts";
import type { ProjectCatalogSyncCommandResult } from "../../../../../core/src/types.ts";
import type { FeishuProjectCatalogSyncResult } from "../../../../feishu/src/project-catalog-sync.ts";

export interface ProjectCatalogSyncRunner {
  (input: {
    registryPath: string;
    projectId: string;
    dataDir?: string;
    apply: boolean;
  }): Promise<FeishuProjectCatalogSyncResult>;
}

function renderResultContent(result: FeishuProjectCatalogSyncResult): string {
  const lines = [
    `Project catalog sync: ${result.project_id}`,
    `Mode: ${result.mode}`,
    `Planned Feishu operation: ${result.plan.operation}`,
    `Project title: ${result.plan.local.project_name}`,
    `Source path: ${result.plan.local.source_path}`,
    `Objective: ${result.plan.local.objective}`,
    `Cadence: ${result.plan.local.cadence}`,
    `Skipped fields: ${result.plan.skipped_fields.join(", ")}`,
  ];

  if (result.mode === "apply") {
    lines.push(`Feishu record: ${result.result?.record_id ?? result.plan.project_record_id ?? "unknown"}`);
  } else {
    lines.push("Run /project --catalog-sync --apply to write this project anchor to Feishu.");
  }

  return lines.join("\n");
}

function asFriendlyError(error: unknown, projectId: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("missing-project-catalog-objective:")) {
    return new Error(
      `Project ${projectId} is missing objective in project.yaml. Fill local truth first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("missing-project-catalog-cadence:")) {
    return new Error(
      `Project ${projectId} is missing cadence in index.yaml. Fill local truth first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("missing-project-catalog-title:")) {
    return new Error(
      `Project ${projectId} is missing title in index.yaml. Fill local truth first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("missing-project-catalog-file:")) {
    return new Error(
      `Project ${projectId} is missing file in index.yaml. Fill local truth first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("missing-project-catalog-definition-project-id:")) {
    return new Error(
      `Project ${projectId} is missing project_id in project.yaml. Fill local truth first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("project-catalog-project-id-mismatch:")) {
    const [, registryProjectId = projectId, definitionProjectId = "unknown"] = message.split(":");
    return new Error(
      `Project ${registryProjectId} has a project.yaml project_id mismatch (${definitionProjectId}). Fix local truth first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("reconcile-required:duplicate-project-record:")) {
    const duplicateProjectId = message.slice("reconcile-required:duplicate-project-record:".length) || projectId;
    return new Error(
      `Feishu Projects table has multiple rows for ${duplicateProjectId}. Reconcile duplicates first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("reconcile-required:project-title-drift:")) {
    return new Error(
      `Local registry and project.yaml disagree on title for ${projectId}. Resolve local drift first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("reconcile-required:project-owner-drift:")) {
    return new Error(
      `Local registry and project.yaml disagree on owner for ${projectId}. Resolve local drift first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("reconcile-required:project-status-drift:")) {
    return new Error(
      `Local registry and project.yaml disagree on status for ${projectId}. Resolve local drift first, then retry /project --catalog-sync.`,
    );
  }

  if (message.startsWith("missing-feishu-table:projects:")) {
    const tableName = message.slice("missing-feishu-table:projects:".length) || "Projects";
    return new Error(`Feishu Base is missing the ${tableName} table required for /project --catalog-sync.`);
  }

  if (message.startsWith("missing-feishu-fields:projects:")) {
    const fields = message.slice("missing-feishu-fields:projects:".length);
    return new Error(`Feishu Projects table is missing required fields: ${fields}. Fix schema first, then retry /project --catalog-sync.`);
  }

  return error instanceof Error ? error : new Error(message);
}

export async function handleProjectCatalogSyncCommand(input: {
  registryPath: string;
  store: SessionProjectStore;
  sessionKey?: string | null;
  projectId?: string | null;
  dataDir?: string;
  apply: boolean;
  sync: ProjectCatalogSyncRunner;
}): Promise<ProjectCatalogSyncCommandResult> {
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
      registryPath: input.registryPath,
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
