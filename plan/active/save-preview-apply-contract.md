# Save Preview Apply Contract

## Purpose
定义 Step 2 当前 `/project --save` 的正式 contract，回答：

- `/project --save` 的 scope 是什么
- source hierarchy 是什么
- preview / apply 的默认行为是什么
- 什么情况下 draft 应失效

本文档承接：
- [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1)
- [current-project-binding-contract.md](<repo-root>/plan/active/current-project-binding-contract.md:1)
- [project-contract-host-matrix.md](<repo-root>/plan/active/project-contract-host-matrix.md:1)

## Scope
`/project --save` 的默认 scope 是：

> 当前 `current_project_binding` 内的 continuity 收口。

它不是：
- 全量 archive compaction
- 跨项目 writeback
- 自动文档治理引擎
- collaboration event sink

## Source hierarchy
当前 `/project --save` 的默认 source hierarchy 应为：

1. current conversation in save mode
2. current project hall docs
3. current project binding metadata
4. recent route / session state

解释：
- conversation 是本轮收口的主源
- hall docs 是 truth anchor
- binding 决定 scope
- route/session state 只作为 working-state hint，不升格成 truth

## Default preview behavior
`/project --save` 必须：
- 先生成 preview
- 明确列出默认 apply hosts
- 明确说明 source hierarchy
- 明确保持 no silent write

preview 至少应让 human 看见：
- 当前 project scope
- 默认写回的 docs host
- 关键内容分别会去哪一层

## Default apply behavior
默认 apply 只允许：
- `RESUME.md`
- `STATUS.md`

默认不允许：
- `README.md`
- `execution/COLLAB.md`

## Draft invalidation rules
以下情况下 pending save mode / draft 应失效或拒绝 apply：

1. current binding changed
2. pending draft project no longer resolves from registry
3. pending draft no longer matches current binding scope

## Hard rules

### Rule 1 — no silent write
默认不得无预览直接写文件。

### Rule 2 — binding-scoped only
`/project --save` 永远只写当前 binding 对应 project 的宿主。

### Rule 3 — hall-doc anchored
conversation draft 不得脱离当前 project hall docs 作为 truth anchor。

### Rule 4 — route trace is hint, not host
route/session state 只能作为 working-state hint，不能决定长期 truth host。

## Out of scope
当前不在本 contract 内处理：
- 自动 writeback 到 `README.md`
- 自动 writeback 到 `COLLAB.md`
- conversation compaction beyond current project scope
- autonomous save triggering
