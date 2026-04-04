import { getProjectById, loadProjectDefinition } from "../projects/registry.ts";
import { createRouteTrace } from "../trace/route-trace.ts";
import type { SessionProjectStore } from "../state/session-project-store.ts";
import type { CommandContextLike, ProjectSwitchResult } from "../types.ts";

export function resolveSessionKeyFromCommandContext(
  commandContext: CommandContextLike,
): string | null {
  return (
    (typeof commandContext.sessionKey === "string" && commandContext.sessionKey.trim()) ||
    (typeof commandContext.session?.sessionKey === "string" &&
      commandContext.session.sessionKey.trim()) ||
    (typeof commandContext.session?.key === "string" && commandContext.session.key.trim()) ||
    null
  );
}

export async function handleProjectCommand(input: {
  registryPath: string;
  projectId: string;
  sessionKey: string;
  store: SessionProjectStore;
  now?: () => Date;
}): Promise<ProjectSwitchResult> {
  const entry = await getProjectById(input.registryPath, input.projectId);
  if (!entry) {
    throw new Error(`Unknown project_id: ${input.projectId}`);
  }

  const definition = await loadProjectDefinition(entry);
  const timestamp = (input.now ?? (() => new Date()))().toISOString();
  const trace = createRouteTrace({
    resolvedProjectId: entry.project_id,
    routeSource: "manual",
    workflow: null,
    safeFail: false,
    reason: "Explicit /project switch",
    timestamp,
  });

  const state = await input.store.set(input.sessionKey, {
    current_project_id: entry.project_id,
    selected_at: timestamp,
    selected_via: "manual",
    current_workflow: null,
    updated_at: timestamp,
    last_route_trace: trace,
  });

  const content = [
    `Current project: ${entry.project_id}`,
    definition.title ? `Title: ${definition.title}` : null,
    definition.status ? `Status: ${definition.status}` : null,
    definition.objective ? `Objective: ${definition.objective}` : null,
    definition.next_action ? `Next action: ${definition.next_action}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    content,
    entry,
    state,
  };
}

export function buildMissingSessionKeyMessage(projectId: string): string {
  return [
    `Cannot switch to project ${projectId} because the command context does not include a session key.`,
    "This command currently requires a runtime or command bridge that passes sessionKey into the plugin command handler.",
  ].join(" ");
}
