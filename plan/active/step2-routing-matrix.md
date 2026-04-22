# Step 2 Routing Matrix

## Purpose
定义 Step 2 的 routing validation matrix，用于验证：
- 外部消息是否能先进入正确的处理面
- `main session` / `project session` / `internal service` 的边界是否清楚
- unresolved 场景是否能够 safe-fail
- route trace 是否足够 explainable

本文件不负责定义 default project context；那部分由 `step2-project-context-definition.md` 负责。

## Position in Step 2
当前顺序应为：
1. `step2-strategy-note.md`
2. `step2-project-context-definition.md`
3. `step2-routing-matrix.md`
4. `step2-context-validation.md`
5. 其他后续实现设计

## Routing goal
Step 2 routing 现在要回答的是：
1. Human 私聊消息是否能稳定进入 `main session`
2. `/project` 后主会话是否保持正确 project boundary，但不切 session
3. automation / agent / service 事件是否进入正确的 `project session` 或 `internal service`
4. 哪些事项应升级回 `main session`
5. unresolved 场景是否能够 safe-fail

当前这份 matrix 首先服务于 `proj-openclaw-feishu-orchestrator` 这类真实客户协作场景，不提前扩展为完整 orchestration engine。

## Required routing semantics
Step 2 routing 评审中必须显式区分：

### 1. Main session
Human 与 `coordinator-agent` 的唯一 human-facing 默认工作入口。

### 2. Project session
per-project 的 system-facing event lane，主要给 automation / agents / services 使用。

### 3. Internal service
接收结构化 action 的非对话执行目标。

### 4. Escalation to main session
仅在需要 Human 决策、review、blocked 或高信号完成时发生。

规则：
- Human 私聊消息默认进入 `main session`
- `/project` 只切 `main session` 的焦点，不切 session identity
- automation 不默认进入 `main session`
- unresolved route 不应伪造 project 或 target

## Minimum routing order
建议最小 routing 顺序为：
1. channel ingress normalization
2. explicit `/project <id>` focus switch
3. known canonical `main session`
4. explicit `resolved_project_id` or `project_ref`
5. structured automation -> `service` or `project session`
6. unresolved -> safe-fail or explicit fallback

## Minimum matrix
| Area | Scenario | Expected | Fail means |
| --- | --- | --- | --- |
| Routing | human DM | enters `main session` | human-facing entry is unstable |
| Routing | explicit `/project` | changes focus only, keeps session identity | project switch wrongly acts like session switch |
| Routing | project continuation in main session | keeps current project boundary | focus state is unstable or stale |
| Routing | structured automation | routes to `project session` or `service` | automation leaks into main session |
| Routing | escalation | only high-signal items reach `main session` | main session is polluted by project noise |
| Safe-fail | unresolved project/action | asks / halts safely with trace | high-risk misrouting |
| Trace | every route | route evidence is explainable | routing is not debuggable |

## Route trace requirements
每次 routing decision 应尽量能够解释：
- 为什么进入 `main session` / `project session` / `service`
- project 是否 unresolved
- 是否触发了 escalation
- 是基于哪类证据完成 route

建议 trace 字段至少包括：
- `source_type`
- `channel_type`
- `project_ref`
- `resolved_project_id`
- `target_kind`
- `target_id`
- `route_evidence`
- `safe_fail_reason`
- `escalation_reason`（当升级到主会话时）

## Scenario classes

### 1. Human DM default
示例：
- project owner 在 TUI / 微信 / 飞书私聊里直接发消息给 `coordinator-agent`

期待：
- 默认进入 canonical `main session`
- 不因物理 channel 不同而分裂成人类主会话

### 2. Explicit project focus switch
示例：
- Human 在 `main session` 中执行 `/project foo`

期待：
- 只更新 `current_project_id`
- 不切换到 `project session`
- 后续在主会话中保持 `foo` 的项目边界

### 3. Main-session project continuation
示例：
- `/project foo` 后继续讨论下一步、约束、实现判断

期待：
- 推理持续留在 `foo`
- 不因为没有切 session 而丢失项目边界

### 4. Structured automation event
示例：
- Feishu / orchestrator 自动化消息带有结构化 action 与参数

期待：
- 路由到 `project session` 或 `service`
- 不默认进入 `main session`

### 5. Service-first automation
示例：
- 自动化消息足够结构化，且 action 可直接命中 internal service

期待：
- 可不经一轮 `coordinator-agent` ingress 判断而直达 service
- service 结果写入 `project session` 或回原 channel
- 只有异常或需要解释时才升级

### 6. Escalation to main session
示例：
- blocked
- need review
- need decision
- high-signal completion

期待：
- 这些事项才进入 `main session`
- 普通中间进度不应上浮

### 7. Unresolved / ambiguous route
示例：
- project 未解析
- action_name 未解析
- reply target 不清楚

期待：
- safe-fail
- 请求更多信息或停止高风险动作
- 保留 trace

## Acceptance rule

### Routing passes when
- Human 私聊稳定进入 `main session`
- `/project` 只切焦点，不切 session identity
- automation 默认进入 `project session` 或 `service`
- `main session` 不被普通项目事件污染
- unresolved 时能保守失败
- trace 对 Human 与 agent 都可解释

### Routing fails when
- Human 消息被错误送进 `project session`
- `/project` 被实现成会话跳转
- automation 默认灌入 `main session`
- unresolved 时仍贸然继续
- 无法解释 route 为什么成立

## Relationship to context design
routing matrix 不负责解决“context 不够”的问题。

如果 routing 失败，应先判断失败类型：
1. 是 route 错了
2. 还是 route 对了，但 `/project` 后主会话内的 context 不足

不能把所有失败都归因为 context。

## Relationship to future implementation
本文件仍属于设计与评审层：
- 先定义 scenario / expected / fail means
- 不在当前文件里直接展开实现代码
- 不因 routing 设计直接引入 writeback 机制
- 不在当前 Step 2 中引入 ACP visible mode、native thread、shared thread governance 等 advanced collaboration 维度

## Next step
在本矩阵通过评审后，后续应：
1. 按 scenario 设计验证用例
2. 与 `step2-context-validation.md` 协同执行
3. 根据失败类型分别修正 context design 或 routing policy
