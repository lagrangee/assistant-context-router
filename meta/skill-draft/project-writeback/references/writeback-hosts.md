# Writeback Hosts

## Purpose
Choose the minimum correct writeback host set for `project-writeback`.

## Host Selection
### Authoritative topic doc
Use first when the thread changed a topic-specific source of truth such as:
- active strategy notes
- architecture notes
- decision docs
- scoped design or contract docs

Patch this host before deciding whether hall docs also need updates.

### `RESUME.md`
Use only when the change affects:
- current mainline
- next working cut
- interruption point
- immediate next actions

### `STATUS.md`
Use only when the change affects:
- current phase
- top-level summary
- phase-level next step
- current project state snapshot

### `execution/COLLAB.md`
Use only when the change affects:
- ownership
- handoff
- blocked / needs review / needs decision
- multi-agent coordination state

## Selection Bias
When in doubt:
- choose the topic doc first
- treat hall docs as mirrors, not replacements
- choose fewer files
- add `RESUME.md` only when execution continuity changed
- add `STATUS.md` only when the phase summary changed
- add `COLLAB.md` only when collaboration flow changed

## Example Patterns
- Strategy or plan update:
  - authoritative host = active strategy / roadmap / plan doc
  - mirror `STATUS.md` only if project phase summary or next step changed
  - mirror `RESUME.md` only if the active working cut changed
- Architecture or decision update:
  - authoritative host = architecture note or decision doc
  - mirror hall docs only if current execution continuity changed
- Continuity-only update:
  - authoritative host = `RESUME.md` and possibly `STATUS.md`
  - do not force `execution/COLLAB.md` unless collaboration state changed
