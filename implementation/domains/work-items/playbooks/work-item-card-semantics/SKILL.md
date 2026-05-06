---
name: work-item-card-semantics
description: Use when an agent must interpret a project-management card or ticket after navigation has loaded its fields. Trigger for Tasks/Bugs style workflow rows with status, assignee, priority, acceptance mode, current step, step result, next action, or execution summary fields.
---

# Work Item Card Semantics

Interpret project-management cards without binding the execution model to one vendor.

## Purpose
- Understand common card fields once the record has been loaded.
- Separate human-owned planning fields from agent/ACR-owned execution fields.
- Preserve the work surface as workflow visibility, not full project truth.

## Common Fields
- `title/description`: human-facing request or bug description.
- `status`: board state such as Todo, Pending, Doing, Fixing, Reviewing, Done, Fixed, or Archived.
- `assignee`: intended executor or owner.
- `acceptance_mode`: whether completion stops for human review or agent may finalize.
- `completion_notify_mode`: whether completion boundary should notify a human.
- `current_step`: current ACR execution phase.
- `step_result`: current ACR phase result.
- `next_action`: next visible action or reason for waiting.
- `execution_summary`: concise result or review summary.

## Workflow Semantics
- `Todo` is backlog until an explicit dispatch transition or policy claims it.
- `Pending` is waiting or queued work, not automatically executing.
- `Doing/Fixing` means active execution can be dispatched.
- `Reviewing` means execution reached a review boundary.
- `Done/Fixed` means accepted terminal work.
- `Archived` means hidden or no longer active.

## Guardrails
- Do not overwrite human-owned request fields unless the task explicitly asks for it.
- Do not regress terminal or review states without a review resolution or explicit instruction.
- Do not infer acceptance policy from status alone; read acceptance fields and project defaults.
- If card semantics and local project truth conflict, stop for review.

## Lifecycle
This is a candidate domain playbook. Feishu field names may appear through adapter facts, but the semantics remain vendor-neutral.
