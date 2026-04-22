# Writeback Checks

## Purpose
Decide whether the current Codex thread has crossed the writeback threshold.

## Positive Signals
Writeback is likely required when the thread changed:
- the authoritative strategy, architecture, or decision baseline
- the current mainline
- the next action
- the current phase
- the key guardrail
- the collaboration flow
- the recommended reading / recovery path

## Negative Signals
Writeback is usually not required when the thread only:
- clarified wording without changing meaning
- explored ideas that were not adopted
- discussed implementation details that did not change project truth
- repeated already-written conclusions

## Review Question
Before writing back, ask:

Would another agent resume the project incorrectly tomorrow if this conclusion stayed only in this Codex thread?

If yes, writeback is probably required.

Then ask:

Which document would be wrong or stale first if I only updated hall docs?

Patch that authoritative host before mirroring anything into hall docs.

## Lightweight Bias
Be conservative about scope, not conservative about preserving truth.

That means:
- write back only what changed
- but do write back when stale docs would mislead the next agent or next session
