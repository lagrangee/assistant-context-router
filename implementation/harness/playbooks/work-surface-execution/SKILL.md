---
name: work-surface-execution
description: Use when an agent receives work from an external work surface such as a card, issue, ticket, table row, chat automation, or workflow event. Trigger when the request includes work_surface_origin, record/card identifiers, or a dispatch/review boundary from an external system. Not for normal human chat with no external work surface.
---

# Work Surface Execution

Execute externally originated work without guessing missing context or turning one work surface into a hardcoded protocol.

## Purpose
- Treat the work surface as an execution entrance, not as full project truth.
- Start from the provided origin, record/card identifiers, and local project workspace.
- Verify referenced objects before mutating them.
- Use an explicit boundary when the work is complete, needs review, or is blocked.

## Workflow
1. Read the provided `work_surface_origin`, `record_id`, `project_id`, and `project_root`.
2. Read the local project context or truth docs needed for the work.
3. Read the source record/card from the external work surface when the task depends on row/card fields.
4. If the task references other work-surface objects, identify them from the same source system using stable fields or unique matches.
5. If the target objects are ambiguous, missing, or not safely writable, stop and emit a review/block boundary with `reason=missing_context`.
6. Execute the real work only after the target and intended change are clear.
7. For external record mutations, include structured `work_surface_operations` in the completion boundary so ACR can apply and verify the side effects.
8. Report concrete `summary` and `evidence` at the boundary.

## Guardrails
- Do not infer target records from vague natural language when more than one plausible match exists.
- Do not mark the source card complete just because the dispatch was accepted.
- Do not treat work-surface status as the only source of project truth.
- Do not create a work-surface-specific parser unless the adapter contract explicitly owns that syntax.
- Do not hide external row/card mutations inside prose evidence; use the boundary side-effect contract.
- Prefer `review_request` with `missing_context` over silent best-effort mutation.

## Boundary Shape
- `complete`: real work finished and evidence is available.
- `review`: human or agent review is required, including `missing_context`.
- `blocked`: execution cannot continue because of external dependency, permissions, or missing required context.

## Lifecycle
This is a candidate ACR harness playbook. Promote only after it works across more than one external work-surface workflow.
