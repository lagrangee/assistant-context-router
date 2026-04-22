import test from "node:test";
import assert from "node:assert/strict";

import { createBeforePromptBuildHook } from "../../adapters/openclaw/plugin/src/hooks/before-prompt-build.ts";
import { createSaveModeLlmOutputHook, parseSaveDraftFromAssistantText } from "../../adapters/openclaw/plugin/src/hooks/save-mode.ts";
import { createSessionProjectStore } from "../../core/src/state/session-project-store.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("before_prompt_build adds save mode frame when pending save mode is armed", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:save-mode", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    pending_save_mode: {
      created_at: "2026-04-13T00:00:00.000Z",
      project_id: "proj-sample",
    },
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
  });

  const result = await hook({
    sessionKey: "session:save-mode",
    messages: [],
  });

  assert.match(String(result.prependSystemContext), /Assistant Context Router project context/);
  assert.match(String(result.prependSystemContext), /Assistant Context Router save mode/);
  assert.match(String(result.prependSystemContext), /\[\[SAVE_DRAFT_RESUME\]\]/);
  assert.match(String(result.prependSystemContext), /Only produce draft blocks when there is enough current-project signal/);
  assert.match(String(result.prependSystemContext), /read them in this order:/);
});

test("before_prompt_build save mode hook resolves session key from hook context", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:save-mode-ctx", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    pending_save_mode: {
      created_at: "2026-04-13T00:00:00.000Z",
      project_id: "proj-sample",
    },
  });

  const hook = createBeforePromptBuildHook({
    registryPath: workspace.registryPath,
    store,
  });

  const result = await hook(
    {
      prompt: "/project --save",
      messages: [],
    },
    {
      sessionKey: "session:save-mode-ctx",
    },
  );

  assert.match(String(result.prependSystemContext), /Assistant Context Router save mode/);
  assert.match(String(result.prependSystemContext), /\[\[SAVE_DRAFT_RESUME\]\]/);
});

test("save mode llm_output captures pending draft and clears save mode", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:save-capture", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    pending_save_mode: {
      created_at: "2026-04-13T00:00:00.000Z",
      project_id: "proj-sample",
    },
  });

  const hook = createSaveModeLlmOutputHook({ store });
  await hook(
    {
      assistantTexts: [
        [
          "I prepared a concise save draft for the current project.",
          "",
          "[[SAVE_DRAFT_RESUME]]",
          "# RESUME",
          "",
          "## Current phase",
          "",
          "Save mode capture",
          "[[/SAVE_DRAFT_RESUME]]",
          "",
          "[[SAVE_DRAFT_STATUS]]",
          "# STATUS",
          "",
          "## TL;DR（一句话）",
          "",
          "Ready to continue.",
          "[[/SAVE_DRAFT_STATUS]]",
        ].join("\n"),
      ],
    },
    { sessionKey: "session:save-capture" },
  );

  const state = await store.get("session:save-capture");
  assert.equal(state?.pending_save_mode, null);
  assert.equal(state?.pending_save_draft?.project_id, "proj-sample");
  assert.match(state?.pending_save_draft?.resume_draft ?? "", /Save mode capture/);
  assert.match(state?.pending_save_draft?.summary_for_chat ?? "", /I prepared a concise save draft/);
});

test("save mode llm_output clears save mode when no draft blocks are found", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:save-empty", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    pending_save_mode: {
      created_at: "2026-04-13T00:00:00.000Z",
      project_id: "proj-sample",
    },
  });

  const hook = createSaveModeLlmOutputHook({ store });
  await hook(
    {
      assistantTexts: ["I do not have enough certainty to produce a save draft yet."],
    },
    { sessionKey: "session:save-empty" },
  );

  const state = await store.get("session:save-empty");
  assert.equal(state?.pending_save_mode, null);
  assert.equal(state?.pending_save_draft, null);
});

test("save mode draft parser separates summary and blocks", () => {
  const parsed = parseSaveDraftFromAssistantText(
    [
      "Here is the draft.",
      "",
      "[[SAVE_DRAFT_RESUME]]",
      "# RESUME",
      "[[/SAVE_DRAFT_RESUME]]",
      "",
      "[[SAVE_DRAFT_STATUS]]",
      "# STATUS",
      "[[/SAVE_DRAFT_STATUS]]",
    ].join("\n"),
  );

  assert.equal(parsed.summaryForChat, "Here is the draft.");
  assert.equal(parsed.resumeDraft, "# RESUME");
  assert.equal(parsed.statusDraft, "# STATUS");
});

test("save mode draft parser falls back to heading-based drafts when markers are missing", () => {
  const parsed = parseSaveDraftFromAssistantText(
    [
      "I prepared a conservative save draft.",
      "",
      "## Current phase",
      "",
      "Step 1.5C validation",
      "",
      "## Current mainline",
      "",
      "- Verify save mode",
      "",
      "## Immediate next actions",
      "",
      "1. Retry /project --save",
      "",
      "## TL;DR（一句话）",
      "",
      "Save mode is close.",
      "",
      "## 当前阶段（你现在在哪）",
      "",
      "- Running validation",
      "",
      "## 下一步（从这里继续推进主线）",
      "",
      "- Retry with stronger prompt",
    ].join("\n"),
  );

  assert.match(parsed.resumeDraft ?? "", /# RESUME/);
  assert.match(parsed.resumeDraft ?? "", /Step 1\.5C validation/);
  assert.match(parsed.statusDraft ?? "", /# STATUS/);
  assert.match(parsed.statusDraft ?? "", /Save mode is close/);
});
