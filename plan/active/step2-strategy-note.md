# Step 2 Strategy Note

## 目标
在 Step 1 与 Step 1.5 已跑通的 `project switch + hall-doc recovery + conversational /project --save` 基线上，重新定义 Step 2 的最小交付边界。

Step 2 不再以旧的 `protocol/project/workflow layering` 语义讨论为中心，而改为面向真实使用方式的最小协作链路：

1. channel ingress
2. normalized envelope
3. route to `main session` / `project session` / `internal service`
4. `coordinator-agent` 在主会话中做编排、解释、升级与摘要

## Confirmed baseline from Step 1 / 1.5
- `/project --all` 已可用
- `/project <id>` 已可用
- `before_dispatch` 已承载当前 session-aware command path
- `before_prompt_build` 已承载 hall-doc-first context injection
- `/project --save` 已切到 conversational draft -> confirm -> apply
- Step 1.5 continuity baseline 已完成并通过一轮真实工作流验证

## Step 2 问题定义
Step 2 现在要回答的不是“再做一个更大的 project/workflow router”，而是：

1. 人类与 `coordinator-agent` 的默认工作入口应如何保持单一、连续、低噪音？
2. automation / agents / services 的项目执行面应如何与人类主对话面分离？
3. 不同 channel 进入系统后，如何先被标准化，再被最小成本地分发到正确处理面？
4. 哪些结果应留在项目工作面，哪些才应升级回主对话面？

## Current recommendation

### 1. Main session is the only human-facing default entry
Human 与 `coordinator-agent` 的默认工作入口应是单一 `main session`。

当前共识：
- TUI / 微信 / 飞书私聊应归并到同一个连续主会话
- 这是上游 OpenClaw / session adapter 的能力
- Step 2 只消费 canonical main-session identity，不在 router 内部重新实现 channel merge

### 2. `/project` switches focus inside main session
`/project <id>` 的意义是：
- 切换 `main session` 的 `current_project_id`
- 让 `coordinator-agent` 在主会话内按该项目边界理解后续请求
- 需要执行项目动作时，再由 `coordinator-agent` 调度到 `project session` 或 `internal service`

`/project` 不等于：
- 把 Human 送进 `project session`
- 要求 Human 频繁切换不同 session

### 3. Project session is a system-facing work lane
每个 project 应有一个 `project session`，但它不是 Human 的默认工作入口。

当前定义：
- per-project only
- 主要给 automation / other agents / internal services 使用
- 主要承接事件流、状态更新、handoff、执行结果、blocked / review 信号
- Human 可查看，但默认不直接在其中长期对话

这意味着：
- 不按 `workflow` 拆出多个 session
- `workflow` 仍可保留为 envelope / trace / dispatch 提示字段
- 避免 session list 爆炸与项目工作面污染

### 4. Automation does not default to main session
automation message 物理上仍从 channel ingress 进入系统，但它不应默认进入 `main session`。

更准确的处理链路是：
`channel message -> channel adapter -> normalized envelope -> route decision -> project session or internal service`

默认规则：
- Human 私聊消息：进入 `main session`
- automation message：进入 `project session` 或 `internal service`
- 只有 need decision、blocked、review request、high-signal completion 才应升级回 `main session`

### 5. Service-first with fallback is acceptable
对于结构化且低歧义的 automation message，允许：
- channel ingress 后完成 normalization
- 直接路由到 `internal service`
- service 返回 reply payload 或 trace patch
- 必要时写入 `project session`

以下情况再升级给 `coordinator-agent`：
- 参数不完整
- project/action 无法解析
- service 执行失败
- 返回结果需要解释、决策或 review

### 6. ACR should be its own first customer project
`assistant-context-router` 应该成为 ACR 的首个客户项目，而不是只靠 `demo-acr` 这类外部样板来验证设计。

但这条原则有一个硬边界：
- ACR 应通过与普通项目一致的 project-owned contract surface 接入自己
- 不能通过 ACR core 内建特例或 hidden shortcut 完成自验证

这意味着：
- `proj-assistant-context-router` 后续也应拥有自己的项目级 `router.yaml`
- 它应能像普通项目一样产出 high-signal snapshot，并消费 `/project --lane` / `/project --surface-sync` / `/project --save`
- `demo-acr` 仍可继续承担 validation harness 角色，但不应成为唯一验证面

## Step 2 scope（redefined）

### In scope
- channel adapter / normalization 的最小定义
- `main session` / `project session` / `internal service` 三类处理面的边界
- `/project` 在主会话中的 focus-switch 语义
- `project session` 作为 system-facing event lane 的定义
- automation route 与 escalation policy
- 最小 route trace
- 简洁 routing config 的宿主与边界

### Out of scope
- human 默认进入 `project session` 工作
- 按 `workflow` 拆多个 project session
- shared governance / native thread / visible mode
- full orchestration engine
- progress writeback automation
- memory backend redesign
- generic cross-runtime router framework
- 把跨 channel main-session continuity 重新放到 router 内部实现

## Minimal interfaces
Step 2 应先围绕以下最小对象工作，而不是先扩实现面：

### NormalizedEnvelope
建议至少包括：
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

说明：
- `project_ref` 可以是原始消息中携带的项目引用、别名或外部锚点
- `resolved_project_id` 是 router 解析后的规范 project id
- ingress 阶段允许 `project_ref` 或 `resolved_project_id` 为空
- unresolved project 不应被伪造默认值；需要走 safe-fail 或 fallback

### RouteDecision
建议至少包括：
- `target_kind`
  - `main_session`
  - `project_session`
  - `service`
  - `safe_fail`
- `target_id`
- `route_reason`
- `route_evidence`
- `fallback_to_main_session`

### ServiceResult
建议至少包括：
- `status`
- `reply_payload`
- `needs_escalation`
- `escalation_reason`
- `trace_patch`

硬规则建议：
- service 可以产出 channel reply payload，但不直接决定 human-facing final reply policy
- service 可直接写入 `project session`，用于记录执行结果、状态更新与后续事件
- 需要进入 `main session` 的 human-facing reply，默认仍由 `coordinator-agent` 或 route decision 控制
- service 失败时，不应直接把底层错误原样暴露给 Human；需要通过 escalation path 交给 `coordinator-agent` 转译

### ReplyTarget
建议至少包括：
- `target_kind`
  - `channel`
  - `main_session`
  - `project_session`
  - `silent_log`
- `target_id`
- `visibility`
  - `human_facing`
  - `system_facing`
- `reply_mode`
  - `direct`
  - `escalate`
  - `silent_log`

规则建议：
- automation/service 的默认结果可回原 channel，或写入 `project session`
- `main session` 只接收需要 Human 决策、review、blocked 或高信号完成的事项
- `silent_log` 仅用于 system-facing 记录，不等于 human-facing reply

### RouteTrace
建议至少记录：
- `source_type`
- `channel_type`
- `project_ref`
- `resolved_project_id`
- `workflow`
- `target_kind`
- `target_id`
- `route_evidence`
- `safe_fail_reason`

## Config recommendation
Step 2 的配置应采用：
- 文档层说明
- 小 YAML / JSON manifest

推荐边界：

### Global router config
- channel adapter
- canonical main-session alias assumptions
- service registry
- 共用 routing defaults

### Project-level router manifest
- project-scoped action routing
- allowed automation actions
- project session mapping
- escalation / fallback rules

不推荐：
- 全部硬编码到实现里
- 只写 prose 不提供机器可读配置

## Validation focus
Step 2 的验证重点应改成以下几类：

### 1. Main session continuity
- TUI / 微信 / 飞书私聊是否可被视为同一主会话
- `/project` 后主会话是否保持正确项目边界

### 2. Project work lane isolation
- automation / agent 事件是否进入正确 project session
- 普通进度是否不会污染 `main session`

### 3. Service-first automation
- 结构化 automation 是否可不经一轮 `coordinator-agent` ingress 判断而直达 service
- 失败或歧义时是否能正确升级

### 4. Escalation hygiene
- 只有 decision / blocked / review / high-signal completion 才回到主会话
- 普通事件保留在 project lane

## Risks
1. 把 `main session` 与 `project session` 混成同一种工作面
2. 让 automation 默认灌进 Human 主对话面
3. 过早按 `workflow` 拆多个 session，导致 session list 爆炸
4. 把跨 channel 私聊连续性错误地下沉到 router 内部实现
5. 在未定义 envelope / config / escalation contract 前就提前写 execution code

## Needs decision
当前仍应继续收敛或 formalize 的点：
1. channel adapter / normalized envelope 的正式 schema
2. routing config manifest 的正式宿主
3. `project session` 是否只承接 event lane，还是允许少量 agent 多轮对话作为例外
4. `internal service` 的正式返回 contract

## Acceptance
Step 2 策略评审通过的标准应是：
- `main session` 与 `project session` 的职责边界清楚
- `/project` 的 focus-switch 语义固定
- automation 不默认污染 Human 主对话面
- route / escalation / fallback 可以被解释与测试
- 配置宿主与最小接口清楚到足以进入实现切口设计

更可执行的验收检查应至少包括：
- Human DM enters `main session` by default
- `/project` changes focus only, never session identity
- automation event defaults to `project session` or `service`, not `main session`
- unresolved project/action routing must safe-fail with trace
- service failure escalates through `coordinator-agent` or explicit fallback path, not raw user-facing leakage

## Next action
- 由 `coordinator-agent` review 本文，确认这版边界可作为新的 Step 2 策略基线
- 以 [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1) 作为当前最小实施主线
- 再据此重写或收口：
  - `step2-project-context-definition.md`
  - `step2-routing-matrix.md`
  - `step2-context-validation.md`
- implementation 应优先围绕：
  - `current_project_binding`
  - `project_contract_host_matrix`
  - `service-first` orchestrator seam
  - minimal visibility
  - signal / escalation promotion
