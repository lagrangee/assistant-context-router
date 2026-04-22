import { findClosestProjects, getProjectById, loadProjectDefinition } from "../../../../../core/src/projects/registry.ts";
import { createCurrentProjectBindingPatch } from "../../../../../core/src/state/current-project-binding.ts";
import { createRouteTrace } from "../../../../../core/src/trace/route-trace.ts";
import type { SessionProjectStore } from "../../../../../core/src/state/session-project-store.ts";
import type { CommandContextLike, MainSessionBinding, ProjectSwitchResult } from "../../../../../core/src/types.ts";

export interface ParsedProjectCommandArgs {
  action:
    | "switch"
    | "help"
    | "list"
    | "lane"
    | "notifications"
    | "governance"
    | "surface_sync"
    | "catalog_sync"
    | "save";
  projectId?: string;
  apply: boolean;
  saveMode: "arm" | "apply" | "cancel" | "dry-run";
}

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

export function parseProjectCommandArgs(rawArgs: string | undefined): ParsedProjectCommandArgs {
  const tokens = (rawArgs ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const projectTokens: string[] = [];
  let action: ParsedProjectCommandArgs["action"] = "switch";
  let apply = false;
  let saveMode: ParsedProjectCommandArgs["saveMode"] = "arm";
  let sawApply = false;
  let sawCancel = false;
  let sawDryRun = false;

  function setAction(nextAction: ParsedProjectCommandArgs["action"]): void {
    if (action !== "switch" && action !== nextAction) {
      throw new Error(`Conflicting /project actions: ${action} and ${nextAction}`);
    }
    action = nextAction;
  }

  for (const token of tokens) {
    if (token === "--help" || token === "-h") {
      setAction("help");
      continue;
    }
    if (token === "--all") {
      setAction("list");
      continue;
    }
    if (token === "--lane") {
      setAction("lane");
      continue;
    }
    if (token === "--notifications") {
      setAction("notifications");
      continue;
    }
    if (token === "--governance") {
      setAction("governance");
      continue;
    }
    if (token === "--surface-sync") {
      setAction("surface_sync");
      continue;
    }
    if (token === "--catalog-sync") {
      setAction("catalog_sync");
      continue;
    }
    if (token === "--save") {
      setAction("save");
      continue;
    }
    if (token === "--apply") {
      apply = true;
      saveMode = "apply";
      sawApply = true;
      continue;
    }
    if (token === "--cancel") {
      saveMode = "cancel";
      sawCancel = true;
      continue;
    }
    if (token === "--dry-run") {
      apply = false;
      saveMode = "dry-run";
      sawDryRun = true;
      continue;
    }
    if (token.startsWith("--")) {
      throw new Error(`Unknown flag: ${token}`);
    }
    projectTokens.push(token);
  }

  if (action === "help") {
    return {
      action,
      projectId: projectTokens.length > 0 ? projectTokens.join(" ") : undefined,
      apply,
      saveMode,
    };
  }

  if (action === "switch" && (sawApply || sawCancel || sawDryRun)) {
    throw new Error("Mode flags require --surface-sync, --catalog-sync or --save");
  }

  if ((action === "list" || action === "lane" || action === "notifications" || action === "governance") && (sawApply || sawCancel || sawDryRun)) {
    throw new Error(
      `Mode flags are not supported with --${
        action === "list"
          ? "all"
          : action === "lane"
            ? "lane"
            : action === "notifications"
              ? "notifications"
              : "governance"
      }`,
    );
  }

  if ((action === "surface_sync" || action === "catalog_sync") && sawCancel) {
    throw new Error("--cancel is only supported with --save");
  }

  if (action === "save" && projectTokens.length > 0) {
    throw new Error("Use /project <project_ref> first, then /project --save. The save action currently operates on the current binding.");
  }

  return {
    action,
    projectId: projectTokens.length > 0 ? projectTokens.join(" ") : undefined,
    apply,
    saveMode,
  };
}

export function renderProjectCommandHelp(): string {
  return [
    "Project command help:",
    "- /project <project_ref>",
    "- /project --all [query]",
    "- /project [<project_ref>] --lane",
    "- /project [<project_ref>] --notifications",
    "- /project [<project_ref>] --governance",
    "- /project [<project_ref>] --surface-sync [--apply]",
    "- /project [<project_ref>] --catalog-sync [--apply]",
    "- /project --save",
    "- /project --save --dry-run",
    "- /project --save --apply",
    "- /project --save --cancel",
    "- /project --help",
    "",
    "Rules:",
    "- Non-flag tokens are treated as a project ref or list query and may contain spaces.",
    "- --all lists projects and can take an optional query.",
    "- --save currently operates on the current project binding only.",
  ].join("\n");
}

export async function handleProjectCommand(input: {
  registryPath: string;
  projectId: string;
  sessionKey: string;
  store: SessionProjectStore;
  mainSessionBinding?: MainSessionBinding | null;
  now?: () => Date;
}): Promise<ProjectSwitchResult> {
  let entry = await getProjectById(input.registryPath, input.projectId);
  if (!entry) {
    const suggestions = await findClosestProjects(input.registryPath, input.projectId);
    if (suggestions.length === 1) {
      entry = suggestions[0];
    } else {
      const suggestionText =
        suggestions.length > 0
          ? ` Did you mean: ${suggestions.map((candidate) => candidate.project_id).join(", ")}`
          : "";
      throw new Error(`Unknown project_id: ${input.projectId}.${suggestionText}`);
    }
  }

  const definition = await loadProjectDefinition(entry);
  const timestamp = (input.now ?? (() => new Date()))().toISOString();
  const trace = createRouteTrace({
    traceId: null,
    sourceType: "human",
    channelType: null,
    projectRef: entry.project_id,
    resolvedProjectId: entry.project_id,
    routeSource: "manual",
    workflow: null,
    targetKind: "main_session",
    targetId: input.sessionKey,
    routeEvidence: [
      "explicit /project command",
      "main session focus switch",
      ...(input.mainSessionBinding ? [`main_session_binding:${input.mainSessionBinding.binding_id}`] : []),
    ],
    mainSessionBindingId: input.mainSessionBinding?.binding_id ?? null,
    safeFail: false,
    reason: "Explicit /project focus switch in main session",
    timestamp,
  });

  const state = await input.store.set(
    input.sessionKey,
    createCurrentProjectBindingPatch({
      projectId: entry.project_id,
      selectedAt: timestamp,
      selectedVia: "manual",
      currentWorkflow: null,
      updatedAt: timestamp,
      lastRouteTrace: trace,
      clearPendingSave: true,
    }),
  );

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

export function buildMissingSessionKeyMessage(projectId?: string | null): string {
  if (projectId && projectId.trim()) {
    return [
      `Cannot switch to project ${projectId} because the command context does not include a session key.`,
      "This command currently requires a runtime or command bridge that passes sessionKey into the plugin command handler.",
    ].join(" ");
  }

  return [
    "This command requires a session key in the command context.",
    "It currently depends on a runtime or command bridge that passes sessionKey into the plugin command handler.",
  ].join(" ");
}
