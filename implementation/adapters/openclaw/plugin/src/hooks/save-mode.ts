import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  bindingMatchesProject,
  readCurrentProjectBinding,
} from "../../../../../core/src/state/current-project-binding.ts";
import type { SessionProjectStore } from "../../../../../core/src/state/session-project-store.ts";
import type {
  BeforePromptBuildEventLike,
  BeforePromptBuildResult,
  LlmOutputEventLike,
  PendingSaveDraft,
  PendingSaveMode,
  PromptBuildLikePayload,
} from "../../../../../core/src/types.ts";

function resolveSessionKey(payload: PromptBuildLikePayload, ctx?: unknown): string | null {
  const ctxRecord = ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>) : null;
  const ctxSession =
    (typeof ctxRecord?.sessionKey === "string" && ctxRecord.sessionKey) ||
    (typeof ctxRecord?.sessionId === "string" && ctxRecord.sessionId) ||
    (ctxRecord?.session && typeof ctxRecord.session === "object"
      ? ((typeof (ctxRecord.session as Record<string, unknown>).sessionKey === "string" &&
          ((ctxRecord.session as Record<string, unknown>).sessionKey as string)) ||
        (typeof (ctxRecord.session as Record<string, unknown>).key === "string" &&
          ((ctxRecord.session as Record<string, unknown>).key as string)))
      : null);

  return (
    ctxSession ??
    payload.sessionKey ??
    payload.session?.sessionKey ??
    payload.session?.key ??
    null
  );
}

function stripDraftBlock(text: string, startTag: string, endTag: string): {
  remaining: string;
  block: string | null;
} {
  const startIndex = text.indexOf(startTag);
  const endIndex = text.indexOf(endTag);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return { remaining: text, block: null };
  }

  const block = text.slice(startIndex + startTag.length, endIndex).trim();
  const remaining = `${text.slice(0, startIndex)}${text.slice(endIndex + endTag.length)}`.trim();
  return {
    remaining,
    block: block || null,
  };
}

function saveModeFramePath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../../prompts/save-mode-frame.md");
}

async function loadSaveModeFrameTemplate(): Promise<string> {
  const raw = await readFile(saveModeFramePath(), "utf8");
  return raw.trim();
}

async function buildSaveModeFrame(input: { projectId: string; debugDryRun?: boolean }): Promise<string> {
  const template = await loadSaveModeFrameTemplate();
  const base = template.replaceAll("{{PROJECT_ID}}", input.projectId).trim();
  if (!input.debugDryRun) {
    return base;
  }

  return [
    base,
    "",
    "This save mode was armed by /project --save --dry-run. Still produce full draft blocks, but treat them as preview-only.",
  ].join("\n");
}

function extractSection(text: string, heading: string): string | null {
  const pattern = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`, "m");
  const match = pattern.exec(text);
  if (!match) {
    return null;
  }
  const start = match.index + match[0].length;
  const remainder = text.slice(start).trimStart();
  const nextHeadingIndex = remainder.search(/^##\s+/m);
  const section = nextHeadingIndex === -1 ? remainder : remainder.slice(0, nextHeadingIndex);
  const trimmed = section.trim();
  return trimmed || null;
}

function parseSaveDraftFromAssistantText(text: string): {
  summaryForChat: string;
  resumeDraft: string | null;
  statusDraft: string | null;
} {
  const resume = stripDraftBlock(text, "[[SAVE_DRAFT_RESUME]]", "[[/SAVE_DRAFT_RESUME]]");
  const status = stripDraftBlock(resume.remaining, "[[SAVE_DRAFT_STATUS]]", "[[/SAVE_DRAFT_STATUS]]");
  let resumeDraft = resume.block;
  let statusDraft = status.block;

  if (!resumeDraft) {
    const currentPhase = extractSection(text, "Current phase");
    const currentMainline = extractSection(text, "Current mainline");
    const immediateNext = extractSection(text, "Immediate next actions");
    if (currentPhase || currentMainline || immediateNext) {
      resumeDraft = [
        "# RESUME",
        "",
        currentPhase ? ["## Current phase", "", currentPhase, ""].join("\n") : null,
        currentMainline ? ["## Current mainline", "", currentMainline, ""].join("\n") : null,
        immediateNext ? ["## Immediate next actions", "", immediateNext, ""].join("\n") : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  if (!statusDraft) {
    const tldr = extractSection(text, "TL;DR（一句话）");
    const currentStage = extractSection(text, "当前阶段（你现在在哪）");
    const nextStep = extractSection(text, "下一步（从这里继续推进主线）");
    if (tldr || currentStage || nextStep) {
      statusDraft = [
        "# STATUS",
        "",
        tldr ? ["## TL;DR（一句话）", "", tldr, ""].join("\n") : null,
        currentStage ? ["## 当前阶段（你现在在哪）", "", currentStage, ""].join("\n") : null,
        nextStep ? ["## 下一步（从这里继续推进主线）", "", nextStep, ""].join("\n") : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  return {
    summaryForChat: status.remaining.trim(),
    resumeDraft,
    statusDraft,
  };
}

export function createSaveModePromptHook(input: {
  store: SessionProjectStore;
}) {
  return async function saveModePromptHook(
    event: BeforePromptBuildEventLike,
    ctx?: unknown,
  ): Promise<BeforePromptBuildResult> {
    const sessionKey = resolveSessionKey(event as PromptBuildLikePayload, ctx);
    if (!sessionKey) {
      return {};
    }

    const sessionState = await input.store.get(sessionKey);
    const saveMode = sessionState?.pending_save_mode;
    const binding = readCurrentProjectBinding(sessionState);
    if (!saveMode || !binding) {
      return {};
    }

    if (!bindingMatchesProject(sessionState, saveMode.project_id)) {
      await input.store.set(sessionKey, {
        pending_save_mode: null,
      });
      return {};
    }

    return {
      prependSystemContext: await buildSaveModeFrame({
        projectId: saveMode.project_id,
        debugDryRun: saveMode.debug_dry_run,
      }),
    };
  };
}

export function createSaveModeLlmOutputHook(input: {
  store: SessionProjectStore;
}) {
  return async function saveModeLlmOutputHook(
    event: LlmOutputEventLike,
    ctx?: { sessionKey?: string },
  ): Promise<void> {
    const sessionKey = ctx?.sessionKey;
    if (!sessionKey) {
      return;
    }

    const sessionState = await input.store.get(sessionKey);
    const saveMode: PendingSaveMode | null = sessionState?.pending_save_mode ?? null;
    const binding = readCurrentProjectBinding(sessionState);
    if (!saveMode || !binding) {
      return;
    }

    const assistantText = (event.assistantTexts ?? []).join("\n\n").trim();
    if (!assistantText) {
      await input.store.set(sessionKey, {
        pending_save_mode: null,
      });
      return;
    }

    const parsed = parseSaveDraftFromAssistantText(assistantText);
    if (!parsed.resumeDraft) {
      await input.store.set(sessionKey, {
        pending_save_mode: null,
      });
      return;
    }

    const pendingDraft: PendingSaveDraft = {
      created_at: new Date().toISOString(),
      project_id: saveMode.project_id,
      updated_files: ["RESUME.md", "STATUS.md"],
      resume_draft: parsed.resumeDraft,
      status_draft: parsed.statusDraft,
      summary_for_chat: parsed.summaryForChat || "Prepared save draft.",
      source_notes: [
        "Primary source: current conversation in save mode.",
        "Truth anchors: current project hall docs.",
      ],
    };

    await input.store.set(sessionKey, {
      pending_save_mode: null,
      pending_save_draft: pendingDraft,
    });
  };
}

export { parseSaveDraftFromAssistantText };
