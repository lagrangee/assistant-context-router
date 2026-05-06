---
name: feishu-base-navigation
description: Use when an agent must inspect or update Feishu/Lark Base records from a provided base/table/record origin. Trigger when work_surface_origin.source_system is feishu_base or when a task explicitly requires lark-cli base operations. Not for interpreting project-management policy by itself.
---

# Feishu Base Navigation

Navigate Feishu Base as a work surface using stable table and record facts.

## Purpose
- Use `lark-cli base` to read Feishu Base facts from a known origin.
- Keep navigation separate from business semantics.
- Avoid hardcoding table-specific natural language patterns into adapter code.

## Inputs
- `source_system: feishu_base`
- `table_id` or `table_name`
- `record_id`
- `identity`
- `config_path` or another configured base reference
- `project_root` when the Base row is tied to a local project

## Workflow
1. Read the origin record first.
2. If the prompt includes `config_path`, use that config host to find the Base binding rather than asking the user for credentials.
3. Use `work_surface_navigation_manifest` when present as the Base map: table catalog, field roles, source-table schema, and query recipes.
4. Treat board labels such as `Todo`, `Pending`, `Doing`, and `Reviewing` as status-like field values or views first, not as table names.
5. Use `lark-cli base +record-get` for the source record when `table_id` and `record_id` are known.
6. Use `lark-cli base +field-list` when field meaning or enum options are unclear.
7. Use `lark-cli base +record-list` with selected fields when the task references other records in the same table.
8. Restrict related-record searches to the same project/surface when the project relation is available.
9. When the intended result is a Feishu record mutation, emit `work_surface_operations` in the ACR completion boundary instead of relying only on prose evidence.
10. Update records only after the target record and intended field changes are unambiguous.

## Completion Operation Shape
- Use `operation: update_record`.
- Use `source_system: feishu_base`.
- Include the target `table_id` and `record_id`.
- Put the fields to write in `set_fields`, for example `{ "状态": "Pending" }`.
- Put the expected post-write state in `verify_fields`; for simple updates this usually matches `set_fields`.

## Missing Context
- If `table_id` or `record_id` is missing, request review instead of guessing.
- If multiple records match the same natural-language reference, request review with `reason=missing_context`.
- If a required enum value is not present in the live field definition, block or review instead of inventing a value.
- A `missing_context` boundary must include navigation evidence: which table was inspected, which fields/options were checked, and which record filters or search terms failed to produce a unique target.

## Non-goals
- This playbook does not define Tasks/Bugs workflow semantics.
- This playbook does not decide acceptance policy.
- This playbook does not make Feishu Base the project truth source.

## Lifecycle
This is a candidate adapter playbook. Promote only after it works for more than one Feishu Base workflow.
