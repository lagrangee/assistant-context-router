---
name: acr-boundary-protocol
description: Use when an agent executing ACR-routed work reaches a completion, review, or blocked boundary and must emit a structured ACR automation block. Trigger when pending_semantic_execution exists or an ACR dispatch asks for complete/review/blocked output.
---

# ACR Boundary Protocol

Close ACR-routed work with explicit machine-readable boundaries.

## Purpose
- Let ACR capture agent output and update project lanes/work surfaces automatically.
- Avoid asking the human to copy automation blocks.
- Make completion evidence explicit enough for downstream writeback and review.

## Boundary Actions
- `complete`: the requested work is actually finished.
- `review`: human or agent review is needed, including `missing_context`.
- `blocked`: work cannot proceed due to dependency, permission, external decision, or missing required state.

## Complete Requirements
- Include the original `task_record_id` or `bug_record_id` when available.
- Include a concrete `summary`.
- Include `evidence` describing changed files, changed records, commands, verification, or other proof.
- If completion depends on changing external work-surface records, include `work_surface_operations`; prose evidence alone is not enough.
- For bugs, include `fix_result` as one of the live accepted values such as Fixed, Won't fix, or Can't rep.
- Never copy a placeholder schema as a real complete boundary.

## Review Or Block Requirements
- Include `reason`, such as `missing_context`, `needs_human_acceptance`, `ambiguous_target`, or `external_dependency`.
- Include enough context for the reviewer to decide the next action.
- Do not continue mutating records after emitting the boundary.

## Guardrails
- Do not emit `complete` when only dispatch was accepted.
- Do not emit multiple boundary blocks for one pending semantic execution.
- Do not fabricate evidence.
- Do not claim that records were moved, updated, marked, or changed unless the boundary includes structured side-effect operations that ACR can apply and verify.
- Do not bypass ACR by directly asking project owner to update the card.

## Lifecycle
This is a candidate ACR harness playbook. Promote after boundary schema and action names stabilize.
