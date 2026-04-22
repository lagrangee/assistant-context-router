# Work-Surface Projection Contract

## Purpose
把 Step 2 剩余的 “Feishu / board 可见度” 缺口，先收成 ACR 内部一个**极小、稳定、可消费**的 projection contract。

这一层不是新的 authority host，也不是完整 board system。  
它只是回答：

- ACR 在高信号 execution 发生后，究竟向 work-surface adapter 暴露什么
- Feishu 这类 surface 后续应该消费哪一份派生快照，而不是自己同时读 lane / notification / escalation

## Scope
当前 contract 只覆盖：

- 单 project 的最新 high-signal execution snapshot
- 高信号来自：
  - `blocked`
  - `review_request`
  - `high_signal_completion`
  - `service_error`
- snapshot 中的最小字段：
  - `signal_kind`
  - `surface_status`
  - `headline`
  - `summary`
  - `trace_id`
  - `action_name`
  - `workflow`
  - `run_id`
  - `queue_ref`
  - optional `artifact_ref`

当前不覆盖：

- 完整 task list / backlog / board column state
- run heartbeat stream
- retry/backoff history
- terminal replay
- artifact 内容本体
- Feishu card/comment/bitable 的最终字段布局

## Host and authority
这份 projection 是：

- `derived read model`
- `adapter-facing snapshot`

它不是：

- workflow truth
- docs truth
- escalation truth
- business notification truth

authority 仍然保持：

- workflow truth 在 orchestrator / service result source
- governance truth 在 `main-session escalation`
- high-signal history 在 `project session lane`
- business-side signal record 在 `business notification log`

work-surface projection 只是把这些高信号 execution 结果压成一个**单 project 最新快照**，给 surface adapter 消费。

## Why a snapshot
当前不直接让 Feishu adapter 自己去拼：

- project lane
- notification log
- escalation store

因为那样会导致：

- adapter 侧重复理解 authority map
- 多处拼装 summary 语义
- later adapter migration 更困难

所以当前 contract 要求：

> ACR 自己先产出一份最小 snapshot；任何 work-surface adapter 都只消费这份 snapshot。

## Minimal snapshot semantics
### 1. One latest high-signal item per project
当前只保留每个 project 的**最新一条高信号 execution snapshot**。

这意味着：

- 它不是事件历史
- 也不是 unresolved governance item list
- 它只回答：`这个项目当前在 work-surface 上最值得显示的执行信号是什么`

### 2. `surface_status` is derived, not authoritative
推荐映射：

- `blocked` -> `blocked`
- `review_request` -> `in_review`
- `high_signal_completion` -> `completed`
- `service_error` -> `failed`

这只是 work-surface 展示语义，不回写 workflow truth。

### 3. `headline` should be adapter-ready
snapshot 里应直接给一个最小 headline，例如：

- `Blocked: dispatch`
- `Review requested: review`
- `Completed: dispatch`
- `Service error: dispatch`

这样 adapter 不需要再重复编码一套标题逻辑。

### 4. `artifact_ref` remains optional
如果高信号事项带 `artifact_ref`，snapshot 应原样带出。  
如果没有，也不阻断 projection。

## Current implementation rule
当前 work-surface projection 只在：

- signal kind 不为 `none`

时更新。

换句话说：

- local-only activity 不生成 projection snapshot
- 只有值得进入 visibility / notification / escalation 语义空间的 execution signal，才更新 snapshot

## Non-goals
当前不做：

- 真实 Feishu API delivery
- 多 card / 多 row / 多 item 聚合
- task ownership / board status writeback
- 独立 dashboard
- second truth layer

## Acceptance
这一刀通过的最小标准是：

1. ACR 能对每个 project 产出一个最新 high-signal work-surface snapshot
2. snapshot 带最小 execution summary + optional `artifact_ref`
3. snapshot 更新不改变现有 promotion / escalation / lane authority
4. 任何未来 Feishu adapter 都可以只消费这份 snapshot，而不再自己拼 lane / notification / escalation
