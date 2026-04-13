import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getProjectById, loadProjectDefinition } from "../projects/registry.ts";
import type { SessionProjectStore } from "../state/session-project-store.ts";
import type { PendingSaveDraft, SaveCommandResult } from "../types.ts";

type SaveCommandMode = "draft" | "apply" | "cancel" | "dry-run";

function section(title: string, lines: string[]): string {
  return [`## ${title}`, "", ...lines, ""].join("\n");
}

function uniqueLines(lines: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const normalized = line?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function renderResume(input: {
  projectId: string;
  updatedAt: string;
  phase: string;
  mainline: string[];
  nextActions: string[];
  pendingDecisions: string[];
  guardrails: string[];
}): string {
  const parts = [
    "# RESUME",
    "",
    `Last saved: ${input.updatedAt}`,
    `Current project: ${input.projectId}`,
    "",
    section("Current phase", [input.phase]),
    section("Current mainline", input.mainline),
    section("Immediate next actions", input.nextActions),
  ];

  if (input.pendingDecisions.length > 0) {
    parts.push(section("Pending decisions", input.pendingDecisions));
  }

  parts.push(section("Guardrail", input.guardrails));
  return parts.join("\n");
}

function renderStatus(input: {
  projectId: string;
  updatedAt: string;
  summary: string;
  phaseLines: string[];
  nextActions: string[];
  openPoints: string[];
}): string {
  const parts = [
    "# STATUS",
    "",
    `Last saved: ${input.updatedAt}`,
    `Current project: ${input.projectId}`,
    "",
    section("TL;DR（一句话）", [input.summary]),
    section("当前阶段（你现在在哪）", input.phaseLines),
    section("下一步（从这里继续推进主线）", input.nextActions),
  ];

  if (input.openPoints.length > 0) {
    parts.push(section("Risks / open points", input.openPoints));
  }

  return parts.join("\n");
}

function deriveSaveDraft(input: {
  projectId: string;
  projectTitle?: string;
  projectStatus?: string;
  definitionPhaseHint?: string;
  nextAction: string;
  selectedVia?: string | null;
  workflow?: string | null;
  routeReason?: string | null;
}): {
  resumeContent: string;
  statusContent: string;
  chatSummary: string;
} {
  const updatedAt = new Date().toISOString();
  const phase = uniqueLines([
    input.definitionPhaseHint,
    input.projectStatus ? `Project status: ${input.projectStatus}` : null,
    input.workflow ? `Current workflow: ${input.workflow}` : null,
    input.selectedVia ? `Current binding source: ${input.selectedVia}` : null,
  ]).join(" | ") || "Active working session";

  const mainline = uniqueLines([
    input.routeReason,
    input.nextAction,
    input.projectTitle ? `Project focus: ${input.projectTitle}` : null,
  ]);

  const nextActions = uniqueLines([
    input.nextAction,
    input.routeReason && input.routeReason !== input.nextAction
      ? `Validate that the current working state still matches: ${input.routeReason}`
      : null,
  ]);

  const pendingDecisions = uniqueLines([
    input.workflow ? `Confirm whether the current workflow should remain ${input.workflow}.` : null,
  ]);

  const openPoints = uniqueLines([
    input.routeReason && input.routeReason !== input.nextAction
      ? `Working state may still need alignment with: ${input.routeReason}`
      : null,
  ]);

  const guardrails = uniqueLines([
    "Keep recovery aligned to hall docs (`STATUS.md` / `README.md` / `RESUME.md`).",
    "Do not expand this save into automatic writeback, routing, or archive sync.",
  ]);

  const summary =
    input.projectTitle && input.projectStatus
      ? `${input.projectTitle} is currently ${input.projectStatus}; next action is ${input.nextAction}`
      : `Current project mainline: ${input.nextAction}`;

  const resumeContent = renderResume({
    projectId: input.projectId,
    updatedAt,
    phase,
    mainline,
    nextActions,
    pendingDecisions,
    guardrails,
  });

  const statusContent = renderStatus({
    projectId: input.projectId,
    updatedAt,
    summary,
    phaseLines: uniqueLines([
      input.projectStatus ? `Project status: ${input.projectStatus}` : null,
      input.workflow ? `Workflow: ${input.workflow}` : null,
      input.selectedVia ? `Current binding source: ${input.selectedVia}` : null,
    ]),
    nextActions,
    openPoints,
  });

  const chatSummary = [
    `Prepared save draft for ${input.projectId}.`,
    "Would update:",
    "- RESUME.md",
    "- STATUS.md",
    "",
    "RESUME.md will keep:",
    `- Current phase: ${phase}`,
    ...mainline.slice(0, 2).map((line) => `- Mainline: ${line}`),
    ...nextActions.slice(0, 2).map((line) => `- Next: ${line}`),
    "",
    "STATUS.md will keep:",
    `- TL;DR: ${summary}`,
    ...openPoints.slice(0, 2).map((line) => `- Open point: ${line}`),
    "",
    "I can apply this now with /save apply. If you want changes first, tell me what to adjust or use /save cancel.",
  ].join("\n");

  return {
    resumeContent,
    statusContent,
    chatSummary,
  };
}

function buildDryRunContent(input: PendingSaveDraft): string {
  return [
    `Dry run for current project state save: ${input.project_id}`,
    "Would update:",
    ...input.updated_files.map((file) => `- ${file}`),
    "",
    "--- RESUME.md preview ---",
    input.resume_draft,
    input.status_draft
      ? ["", "--- STATUS.md preview ---", input.status_draft].join("\n")
      : "",
  ].join("\n");
}

async function resolveSaveDraft(input: {
  registryPath: string;
  sessionKey: string;
  store: SessionProjectStore;
}): Promise<{
  draft: PendingSaveDraft;
  statusPath: string;
  resumePath: string;
}> {
  const sessionState = await input.store.get(input.sessionKey);
  if (!sessionState?.current_project_id) {
    throw new Error("No current project selected. Use /project <project_id> first.");
  }

  const entry = await getProjectById(input.registryPath, sessionState.current_project_id);
  if (!entry) {
    throw new Error(
      `Current project ${sessionState.current_project_id} could not be resolved from registry.`,
    );
  }

  const definition = await loadProjectDefinition(entry);
  const projectDir = path.dirname(path.resolve(path.dirname(input.registryPath), entry.file));
  const resumePath = path.join(projectDir, "RESUME.md");
  const statusPath = path.join(projectDir, "STATUS.md");

  const nextAction =
    sessionState.last_route_trace?.reason ||
    definition.next_action ||
    "Continue the current project mainline from the latest confirmed work state.";

  const rendered = deriveSaveDraft({
    projectId: entry.project_id,
    projectTitle: entry.title ?? definition.title,
    projectStatus: definition.status ?? entry.status,
    definitionPhaseHint: typeof definition.kind === "string" ? `Project kind: ${definition.kind}` : null,
    nextAction,
    selectedVia: sessionState.selected_via ?? null,
    workflow: sessionState.current_workflow ?? null,
    routeReason: sessionState.last_route_trace?.reason ?? null,
  });

  let hasStatus = true;
  try {
    await readFile(statusPath, "utf8");
  } catch {
    hasStatus = false;
  }

  const updatedFiles = hasStatus ? [resumePath, statusPath] : [resumePath];
  const sourceNotes = [
    "Primary source: current project hall docs (`README.md` / `STATUS.md` / `RESUME.md`).",
    "Working source: current project binding and recent route/session state.",
  ];

  return {
    draft: {
      created_at: new Date().toISOString(),
      project_id: entry.project_id,
      updated_files: updatedFiles,
      resume_draft: rendered.resumeContent,
      status_draft: hasStatus ? rendered.statusContent : null,
      summary_for_chat: rendered.chatSummary,
      source_notes: sourceNotes,
    },
    statusPath,
    resumePath,
  };
}

export async function handleSaveCommand(input: {
  registryPath: string;
  sessionKey: string;
  store: SessionProjectStore;
  mode?: SaveCommandMode;
}): Promise<SaveCommandResult> {
  const mode = input.mode ?? "draft";
  const sessionState = await input.store.get(input.sessionKey);

  if (mode === "cancel") {
    if (!sessionState?.pending_save_draft) {
      return {
        content: "No pending save draft to cancel.",
        updatedFiles: [],
      };
    }

    await input.store.set(input.sessionKey, {
      pending_save_draft: null,
    });

    return {
      content: `Discarded pending save draft for ${sessionState.pending_save_draft.project_id}.`,
      updatedFiles: [],
    };
  }

  if (mode === "apply") {
    const pending = sessionState?.pending_save_draft;
    if (!pending) {
      return {
        content: "No pending save draft. Run /save first to prepare a conversational draft.",
        updatedFiles: [],
      };
    }

    if (!sessionState.current_project_id || pending.project_id !== sessionState.current_project_id) {
      return {
        content:
          "Pending save draft no longer matches the current project binding. Run /save again to regenerate it.",
        updatedFiles: [],
      };
    }

    const entry = await getProjectById(input.registryPath, pending.project_id);
    if (!entry) {
      return {
        content: `Pending save draft project ${pending.project_id} could not be resolved from registry.`,
        updatedFiles: [],
      };
    }

    const projectDir = path.dirname(path.resolve(path.dirname(input.registryPath), entry.file));
    const resumePath = path.join(projectDir, "RESUME.md");
    const statusPath = path.join(projectDir, "STATUS.md");

    await writeFile(resumePath, pending.resume_draft, "utf8");
    if (pending.status_draft) {
      await writeFile(statusPath, pending.status_draft, "utf8");
    }

    await input.store.set(input.sessionKey, {
      pending_save_draft: null,
    });

    return {
      content: [
        `Saved current project state for ${pending.project_id}.`,
        "Updated:",
        ...pending.updated_files.map((file) => `- ${file}`),
      ].join("\n"),
      updatedFiles: pending.updated_files,
    };
  }

  try {
    const { draft } = await resolveSaveDraft(input);

    if (mode === "dry-run") {
      return {
        content: buildDryRunContent(draft),
        updatedFiles: draft.updated_files,
        dryRun: true,
      };
    }

    await input.store.set(input.sessionKey, {
      pending_save_draft: draft,
    });

    return {
      content: draft.summary_for_chat,
      updatedFiles: draft.updated_files,
      needsConfirmation: true,
    };
  } catch (error) {
    return {
      content:
        error instanceof Error ? error.message : "Unable to prepare a save draft for the current project.",
      updatedFiles: [],
      dryRun: mode === "dry-run",
    };
  }
}
