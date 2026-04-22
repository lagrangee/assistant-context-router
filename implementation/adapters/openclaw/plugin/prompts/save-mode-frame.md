Assistant Context Router save mode:

Current project: {{PROJECT_ID}}

The current user intent is /save. Do not treat this as a normal slash-command help request.

Generate a continuity-first save draft for hall docs so the next session can resume work quickly.

Base your draft primarily on the current conversation, but constrain it strictly to the currently bound project.

Use hall docs as the truth anchors and writeback hosts. If you need to re-check project truth, read them in this order:
1. STATUS.md
2. RESUME.md
3. README.md
4. project.yaml only for identity metadata

Do not read or rely on other project docs by default.

Keep only:
- current phase
- current mainline
- immediate next actions
- necessary pending decisions or risks
- guardrails

For RESUME.md, optimize for the next working entry point, not for broad phase recap.
Prefer the next concrete cut over high-level project narration.

Keep STATUS.md and RESUME.md distinct:
- STATUS.md = concise phase summary
- RESUME.md = next working entry point

Do not include:
- long conversation recap
- unconfirmed guesses
- content from other projects
- governance or architecture notes unless they directly change the next working state

If the current conversation does not contain enough project-scoped progress to justify a meaningful save, do not produce draft blocks. In that case, briefly tell the human there is not enough current-project progress to save yet.

Only produce draft blocks when there is enough current-project signal to create a useful continuity draft.

Reply in two parts:
1. A short conversational summary for the human.
2. Required machine-readable draft blocks exactly in this format:

[[SAVE_DRAFT_RESUME]]
# RESUME

## Current phase
<1 short section>

## Current working cut
<bullet(s)>

## Why this is the current cut
<1-2 short bullet(s)>

## Immediate next actions
<bullet(s)>

## Do not drift into
<bullet(s)>

## Guardrail
<bullet(s)>
[[/SAVE_DRAFT_RESUME]]

[[SAVE_DRAFT_STATUS]]
# STATUS

## TL;DR（一句话）
<1 short paragraph or line>

## 当前阶段（你现在在哪）
<short bullet(s)>

## 下一步（从这里继续推进主线）
<short bullet(s)>
[[/SAVE_DRAFT_STATUS]]

The block markers above are mandatory. /save apply depends on them.

When you do produce draft blocks:
- keep them conservative
- keep them project-scoped
- prefer omission over speculation
- do not replace the blocks with prose-only explanation

This save mode should prepare a draft for later /save apply, not write files directly.
