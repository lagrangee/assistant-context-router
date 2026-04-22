---
name: project-writeback
description: Use when Codex needs to write current-thread conclusions back into the authoritative project truth docs for the topic under discussion, then mirror only the minimum needed updates into STATUS.md, RESUME.md, or execution/COLLAB.md. Trigger on explicit requests to write back or preserve conclusions into docs, and when the current thread changed project truth enough that another agent or future session would resume incorrectly without a writeback. Not for routine progress saves, broad journaling, or general summarization.
---

# Project Writeback

Preserve project truth from the current Codex thread without turning the task into general journaling or broad memory compaction.

## Purpose
- Write back adopted conclusions from the current Codex thread into the authoritative truth host for that topic.
- Mirror the change into `STATUS.md`, `RESUME.md`, or `execution/COLLAB.md` only when resume continuity or collaboration state would otherwise become stale.
- Reduce resume errors for future agents and future sessions.

## Non-goals
- Do not use this as a general save or journaling command.
- Do not treat this as general memory compaction.
- Do not scan the full conversation history unless the task requires it.
- Do not update unrelated docs or speculative conclusions.

## Workflow
1. Detect the active project and identify the topic whose truth changed in the current thread.
2. Find the authoritative truth host for that topic before touching hall docs.
3. Read the authoritative host and the minimum supporting docs needed to patch it safely.
4. Summarize only the conclusions adopted in the current thread.
5. Patch the authoritative host first.
6. Decide whether `STATUS.md`, `RESUME.md`, or `execution/COLLAB.md` need mirror updates for continuity or collaboration state.
7. Patch only the hall docs that would otherwise become stale or misleading.
8. Report what changed, what truth was preserved, and any next step surfaced by the writeback.

## Host Selection
- Start with the authoritative truth host for the topic that changed:
  - strategy changes belong in the active strategy note
  - architecture changes belong in the relevant architecture note
  - decision changes belong in the decision doc that owns that boundary
  - project execution continuity changes belong in hall docs
- Use `RESUME.md` only as a continuity mirror for current mainline, next working cut, interruption point, and immediate next actions.
- Use `STATUS.md` only as a continuity mirror for current phase, top-level summary, phase-level next step, and project snapshot changes.
- Use `execution/COLLAB.md` only when ownership, handoff, blocked state, review state, or other collaboration-flow changes actually changed.
- Prefer the smallest correct host set. Update fewer files when one authoritative host is enough.
- Do not replace an authoritative topic doc with a hall-doc summary.

## Writeback Check
- Write back when the current thread changed project truth in a way that would mislead the next agent or next session.
- Write back to the authoritative host even when hall docs need no changes.
- Skip writeback when the thread only clarified wording, explored options that were not adopted, or repeated truth already stored in docs.
- Ask for confirmation before editing when the writeback threshold is unclear.

## Guardrails
- Prefer the smallest correct writeback.
- Prefer updating existing docs over creating new docs.
- Do not write speculative conclusions.
- Do not write broad summaries when only one concrete change matters.
- Do not overwrite project truth with Codex-only preferences.
- If the current thread did not change project truth, say so and do not force a writeback.
- Prefer preserving updated truth over preserving conversational flavor.
- Do not infer writeback content from unrelated prior conversations or stale memory unless the user explicitly asks for that broader recovery.
- Do not stop at hall docs when the real truth host is a topic-specific doc.

## Output
- Report which files changed.
- Report which file was treated as the authoritative truth host.
- Report what new truth was preserved.
- Report any suggested next step for the project owner or collaborating agent.

## Examples
- Strategy or plan baseline changed:
  - Patch the active strategy, roadmap, or plan doc first.
  - Mirror into `STATUS.md` only if the top-level phase summary or next step changed.
  - Mirror into `RESUME.md` only if the current working cut or immediate next actions changed.
  - Skip `execution/COLLAB.md` unless collaboration state changed.
- Architecture or decision boundary changed:
  - Patch the owning architecture note or decision doc first.
  - Mirror into hall docs only when the new boundary changes current execution continuity.
- Execution continuity changed without a topic-doc change:
  - Patch `RESUME.md` and possibly `STATUS.md` when the thread only changed the active working cut, current phase, or next actions.
  - Do not force a topic-specific doc update if no authoritative topic doc changed.
- Wording-only cleanup or non-adopted discussion:
  - If the thread only improved phrasing, explored options that were not adopted, or restated existing truth, do not write back.

## References
- Read `references/writeback-hosts.md` when host selection is ambiguous.
- Read `references/writeback-checks.md` when deciding whether the thread crossed the writeback threshold.

## Draft Note
This repo copy is the maintained source draft for `assistant-context-router`. When formalized, install the runnable skill at `$CODEX_HOME/skills/project-writeback`.
