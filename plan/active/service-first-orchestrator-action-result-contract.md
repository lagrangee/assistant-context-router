# Service-First Orchestrator Action Result Contract

## Purpose
定义 Step 2 / Cut 3 当前 ACR 与 orchestrator 之间 `service-first` 接缝的最小正式 contract，回答：

- 哪些 action 应视为 orchestrator-facing structured ingress
- ACR 最少应向 orchestrator service bridge 传什么
- orchestrator 最少应返回什么
- 哪些结果语义现在必须稳定下来

本文档承接：
- [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1)
- [orchestrator-integration-boundary.md](<repo-root>/plan/active/orchestrator-integration-boundary.md:1)
- [normalized-envelope-contract.md](<repo-root>/plan/active/normalized-envelope-contract.md:1)
- [route-resolution-trace-safe-fail-contract.md](<repo-root>/plan/active/route-resolution-trace-safe-fail-contract.md:1)

## Core rule
对 orchestrator 场景，默认接线应是：

`NormalizedEnvelope -> project-owned internal service -> orchestrator ingress`

不是：

`NormalizedEnvelope -> project_session -> 再靠 agent 二次理解`

因此这份 contract 的目标不是描述 orchestrator 全部内部状态，而是：

> 给 ACR 一个足够稳定、足够薄的 ingress/result 接缝，让 route、trace、visibility 和后续 escalation 能站在同一个最小语义面上。

## Service-first action scope
当前 Step 2 内，以下动作默认视为 orchestrator-facing structured ingress：

- `dispatch`
- `review`

这里故意保持克制，不提前把全部 lifecycle action 都拉进来。

## Minimum action request shape
ACR 传给 internal service / orchestrator bridge 的最小字段：

- `action_name`
- `resolved_project_id`
- `workflow`
- `parameters`
- `trace_id`
- `reply_target`

当前解释：
- `resolved_project_id`
  - 当前先承载最小 project-level routing 结果
  - `protocol_owner_project_id / business_target_project_id` 的双层语义暂不正式进入类型系统
- `parameters`
  - 保留项目/协议自己的 payload
- `trace_id`
  - 贯穿 route / service / visibility 的最小关联键
- `reply_target`
  - 只提供结果投递提示，不决定最终 human-facing reply policy

## Minimum service result shape
orchestrator-facing service 当前最小应返回：

- `status`
  - 当前 runtime 执行层语义：
    - `ok`
    - `error`
    - `needs_escalation`
- `result_kind`
  - 当前 ACR-facing 结构化结果语义：
    - `accepted`
    - `queued`
    - `rejected`
    - `needs_escalation`
- `summary`
- `reply_payload`
- `needs_escalation`
- `escalation_reason`
- `run_id`
- `queue_ref`
- `trace_patch`

## Status vs Result Kind
这里必须显式区分两层语义：

### `status`
偏 service 执行层：
- handler 执行成功
- handler 执行失败
- handler 认为需要升级

### `result_kind`
偏 orchestrator 协议层：
- 动作已被接受
- 已排队
- 被拒绝
- 需要升级

规则：
- `status=ok` 不自动等于所有事情都完成，只表示当前 service bridge 成功返回
- `result_kind` 才更接近 ACR 关心的业务接缝结果

## Result normalization rule
为避免 project-specific handler 各自发散，当前最小归一化规则应是：

- 若 `status=ok` 且未显式提供 `result_kind`
  - 默认补成 `accepted`
- 若 `status=error` 且未显式提供 `result_kind`
  - 默认补成 `rejected`
- 若 `status=needs_escalation` 且未显式提供 `result_kind`
  - 默认补成 `needs_escalation`
- 若未显式提供 `summary`
  - 默认退回 `reply_payload`

这条规则的目的不是替 orchestrator 决定业务状态，而是让 ACR 至少能稳定消费一个薄结果壳。

## Current output policy
当前 Step 2 的最小 output policy：

- `reply_payload`
  - 可用于 direct channel reply
  - 但不自动等于 main-session escalation
- `summary`
  - 用于 project session / Feishu summary / trace-friendly read model
- `run_id` / `queue_ref`
  - 当前只作为 visibility / future bridge hint
  - 不要求 Step 2 立刻驱动完整 run detail UI

## Out of scope
当前不在本 contract 内解决：

- `protocol_owner_project_id / business_target_project_id` 正式双层类型系统
- signal promotion 细则
- main-session escalation object
- business notification delivery contract
- artifact/evidence 的完整 schema
