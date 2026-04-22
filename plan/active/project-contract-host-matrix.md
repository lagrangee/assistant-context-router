# Project Contract Host Matrix

## Purpose
定义 Step 2 中 project contract docs 的默认宿主分工，回答：

- 什么类型的结论默认写到哪份 docs
- `/project --save` 默认允许写哪些宿主
- 哪些对象不能被 `/project --save` 默认触达

本文档承接：
- [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1)
- [project-doc-object-schemas.md](<repo-root>/plan/active/project-doc-object-schemas.md:1)
- [current-project-binding-contract.md](<repo-root>/plan/active/current-project-binding-contract.md:1)

## Default host matrix

| doc host | role | default payload kind | default write path |
| --- | --- | --- | --- |
| `README.md` | identity layer | project identity / long-lived framing / stable goals / stable boundaries | not writable by default `/project --save` |
| `STATUS.md` | current-state layer | executive summary / current phase / confirmed conclusions / remaining gaps / next step | writable by default `/project --save` |
| `RESUME.md` | working-state layer | current mainline / interruption point / immediate next actions / pending decisions / guardrails | writable by default `/project --save` |
| `execution/COLLAB.md` | collaboration layer | cross-session unresolved collaboration obligation / handoff / review / decision / blocked ownership | not writable by default `/project --save` |

## Hard rules

### Rule 1 — `/project --save` 默认只写 `RESUME.md` 和 `STATUS.md`
当前默认 `/project --save` apply 只应触达：
- `RESUME.md`
- `STATUS.md`

原因：
- 它们分别承接 working-state 与 current-state 收口
- 是当前 continuity baseline 的最小默认写面

### Rule 2 — `README.md` 不属于默认 `/project --save` 写面
`README.md` 只承接：
- long-lived identity
- stable goals
- stable non-goals
- stable architecture / boundary framing

因此：
- `/project --save` 不应默认写 `README.md`
- 若未来需要写入，必须走明确 promotion path

### Rule 3 — `COLLAB.md` 不属于默认 `/project --save` 写面
`COLLAB.md` 只承接：
- 跨 session 仍未解决的 collaboration obligation
- handoff / review / blocked / need decision 的 collaboration 语义

因此：
- `/project --save` 不应默认把 conversation state 写进 `COLLAB.md`
- 只有当某事项已经满足 collaboration-object 条件时，未来才允许走显式 promotion

### Rule 4 — 同一结论默认只选一个主宿主
如果某条结论同时影响多个文档：
- 必须先选一个主宿主
- 其他文档只允许镜像性摘要，不允许竞争 authority

当前默认：
- project-wide working resumption -> `RESUME.md`
- current-stage executive summary -> `STATUS.md`
- unresolved collaboration obligation -> `COLLAB.md`
- long-lived identity / architecture framing -> `README.md`

## `/project --save` default host policy
当前 `/project --save` 默认只承接：
- current binding scope 内的 continuity 收口
- working-state / current-state 级别变化

不承接：
- long-lived identity rewrite
- architecture decision promotion
- collaboration backlog/event sink
- route trace archive

## Out of scope
当前不在本 host matrix 内解决：
- 自动把结果从 `RESUME/STATUS` promote 到 `README`
- 自动把 blocked/review 归档到 `COLLAB.md`
- 通用多项目 host abstraction
