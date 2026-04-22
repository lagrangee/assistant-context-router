# Normalized Envelope Contract

## Purpose
定义 Step 2 当前 `NormalizedEnvelope` 的最小正式 contract，回答：

- ingress normalization 后最少要保留哪些字段
- 哪些字段必须稳定存在
- `trace_id` 在 envelope 层的最低要求是什么

本文档承接：
- [step2-strategy-note.md](<repo-root>/plan/active/step2-strategy-note.md:1)
- [route-resolution-trace-safe-fail-contract.md](<repo-root>/plan/active/route-resolution-trace-safe-fail-contract.md:1)

## Core rule
`NormalizedEnvelope` 不是完整业务对象，而是：

> channel ingress 与 route resolution 之间的最小稳定交接面。

它要做的事情只有两件：
- 把不同 host/channel 送进来的消息压成统一最小字段
- 给 route / trace / service bridge 提供稳定输入

## Minimum fields
当前最小字段：
- `source_type`
- `channel_type`
- `project_ref`
- `resolved_project_id`
- `action_name`
- `parameters`
- `reply_target`
- `trace_id`
- `workflow`
- `raw_message_ref`
- `text`

## Field rules

### `trace_id`
当前规则：
- 对所有结构化 automation envelope，`trace_id` 应尽量总是存在
- 若上游未提供，normalization 层应自动生成
- human free-text message 可以没有 `trace_id`

### `project_ref` vs `resolved_project_id`
- `project_ref` 是 ingress 原始锚点
- `resolved_project_id` 是 normalization / route 前已经拿到的规范 project id
- unresolved 时允许二者同时为空，但不得伪造默认 project

### `reply_target`
- automation/service path 最好有 reply target
- 没有 reply target 不应阻止 safe-fail 或 service execution record

## Out of scope
当前不在 envelope contract 内处理：
- protocol owner / business target 双层语义
- artifact refs
- escalation object
- workflow state
