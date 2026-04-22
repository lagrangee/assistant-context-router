# Route Resolution Trace Safe-Fail Contract

## Purpose
定义 Step 2 当前 `route / trace / safe-fail` 的最小正式 contract，回答：

- route resolution 到底在决定什么
- trace 至少要记录什么
- 哪些情况下必须 safe-fail
- 哪些 fallback 现在不再允许

本文档承接：
- [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1)
- [step2-routing-matrix.md](<repo-root>/plan/active/step2-routing-matrix.md:1)
- [current-project-binding-contract.md](<repo-root>/plan/active/current-project-binding-contract.md:1)

## Core rule
Step 2 的 route resolution 不是在“猜用户想干什么”，而是在做一个更克制的判断：

> 当前消息应该进入 `main_session`、`project_session`、`service`，还是必须 `safe_fail`。

它不负责：
- project truth 更新
- workflow state transition 本身
- human-facing final reply 的完整生成

## Resolution inputs
当前 route resolution 允许消费的最小输入：
- `NormalizedEnvelope`
- `current_project_binding`
- action router config
- available service handlers

其中：
- `current_project_binding` 只提供 human main-session 默认 project focus
- 不允许 route 因为“顺手解析到了别的 project”而 silent 改 binding

## Resolution outputs
当前 route resolution 的最小输出是 `RouteDecision`：
- `target_kind`
- `target_id`
- `resolved_project_id`
- `project_ref`
- `route_source`
- `route_reason`
- `route_evidence`
- `workflow`
- `fallback_to_main_session`
- `escalation_reason`
- `safe_fail_reason`

## Trace minimum
当前 trace 至少应回答：
- 这条消息来自哪里
- route 依据是什么
- project 是否 unresolved
- 最终进入哪个 target
- 是否 safe-fail
- 为什么 safe-fail

当前最小 trace 字段：
- `source_type`
- `channel_type`
- `project_ref`
- `resolved_project_id`
- `route_source`
- `target_kind`
- `target_id`
- `route_evidence`
- `main_session_binding_id`
- `safe_fail`
- `safe_fail_reason`
- `reason`

## Safe-fail rules
以下情况当前必须 safe-fail：

### Rule 1 — unresolved project for required automation action
如果结构化 automation action 需要 resolved project 才能继续，而当前 unresolved：
- 必须 `safe_fail`
- 不得伪造 `resolved_project_id`

### Rule 2 — malformed structured automation payload
如果 automation wrapper / payload 已损坏到无法可靠解析：
- 必须 `safe_fail`
- 不得回退成普通 human free-text conversation

### Rule 3 — configured `service` route without service handler
如果 action config 明确要求 `target_kind=service`，但当前没有可用 handler：
- 必须 `safe_fail` 或显式升级
- 不得自动降级到 `project_session`

这是当前 Step 2 的硬边界，因为：
- `project_session` 是 shadow lane / read model
- 不是“service 缺失时的第二执行入口”

## Fallback rules
当前允许的 fallback 只有两类：

1. `safe_fail -> explain why`
2. `service result -> needs_escalation`

当前不允许：
- `service missing -> silently reroute to project_session`
- `unresolved project -> guess target and continue`
- `malformed payload -> treat as human chat`

## Human route rule
human-facing main-session message：
- 默认留在 `main_session`
- 若当前有 `current_project_binding`，则把它当作 default project focus
- 但 human route 不因此自动变成 workflow ingress

## Out of scope
当前不在本 contract 内处理：
- protocol owner / business target 的正式双层类型系统
- advanced route analytics
- visible mode / shared-thread governance
- cross-surface delivery orchestration
