# Orchestrator Integration Boundary（v0）

## 目标
明确 `assistant-context-router` 与 `openclaw-feishu-orchestrator` 的关系，避免在 MVP 实现阶段边界模糊。

---

## 1. 关系定义
`assistant-context-router` **不是** `openclaw-feishu-orchestrator` 的替代品。

两者关系应定义为：
- `openclaw-feishu-orchestrator`：Task/Bug 调度与工作流治理内核
- `assistant-context-router`：其上层的 project/context/protocol 路由与协作入口增强层

也就是说：
- orchestrator 继续负责 runtime / queue / state machine / writeback / notify
- router 负责让人类会话与 protocol message 更稳定地命中正确 project/workflow/context

---

## 2. MVP 中 orchestrator 的角色
`openclaw-feishu-orchestrator` 应作为 `assistant-context-router` MVP 的**首批客户 / 首个高价值试点场景**。

原因：
1. 有明确项目边界
2. 有明确 protocol（dispatch/review）
3. 当前已有真实痛点
4. 可观测性强
5. 验收标准清晰

---

## 3. assistant-context-router 对 orchestrator 的支持范围（MVP）

### 应支持
1. 在主会话中显式进入 `openclaw-feishu-orchestrator` project context
2. 让围绕 orchestrator 的讨论不再每次从零启动
3. 对 dispatch/review 类 protocol message 更稳定地命中 orchestrator project/workflow
4. 对 route decision 提供 trace 与 safe-fail

### 不负责
1. orchestrator daemon / queue / sqlite / ingest / writeback 的内部实现
2. orchestrator 自身业务状态机
3. 取代 orchestrator 的 protocol contract

---

## 4. 对 orchestrator 协议侧的最小要求
为使 MVP 达到最佳效果，建议 orchestrator 协议侧配合最小变更：

### 推荐要求
dispatch/review 结构化消息尽量携带：
- `project_id` / `project_key`
- protocol type
- record/resource anchor

### 原因
- 降低 router 猜测成本
- 提高 route 稳定性
- 更利于 trace 与 debug

---

## 4.1 Step 2 中必须区分的两类 project
在 Step 2 的 routing policy 中，必须显式区分以下两类 project，不允许混用：

### protocol owner project
拥有 protocol、contract、runtime 与治理职责的项目。

对于当前首批试点，通常是：
- `proj-openclaw-feishu-orchestrator`

### business target project
具体任务、记录或业务动作真正归属的项目。

它可能：
- 与 protocol owner project 相同
- 也可能不同（例如某条 dispatch 消息由 orchestrator 协议承载，但目标工作属于其他业务项目）

### 约束
- 已知 protocol channel / message family 最多只能帮助 router 稳定命中 `protocol owner project`
- 若没有明确的 project anchor，不应假定已 resolve `business target project`
- 当后续动作必须依赖 `business target project` 才能继续时，若其 unresolved，则必须 safe-fail

---

## 5. MVP 验收中与 orchestrator 相关的明确条件
MVP 至少应满足：
1. 能在主会话中显式切换到 `openclaw-feishu-orchestrator` project context
2. 在该 project context 中，围绕 orchestrator 的协作不再明显依赖“回忆整段历史”
3. 对 dispatch/review 类消息，能比当前更稳定地命中 orchestrator 相关 project/workflow
4. 若 project/workflow route 不清楚，能够 safe-fail，而不是误入其他项目
5. route trace 能解释与 orchestrator 相关的关键 route decision

---

## 6. 当前阶段结论
对于 MVP 而言，`openclaw-feishu-orchestrator` 不只是一个相关项目，而应被视为：

> **Assistant Context Router MVP 的首批客户与首个验收场景。**

---

## 7. 当前脱节点（基于两边仓库现状）

最近重新对照后，当前真正的脱节点主要不在“功能没接上”，而在“职责模型曾经不一样”：

### 7.1 orchestrator 的历史 framing 更像 control-plane + execution-plane
`openclaw-feishu-orchestrator` 的历史 proposal 中，曾把 main chat/operator 视为 control-plane，把 ACP/worker session 视为 execution-plane。

而 ACR 当前的顶层架构已经把：
- human-facing `main session`
- project truth
- collaboration / governance
- runtime / orchestration backend

明确拆开。

这意味着：
- orchestrator 不再适合继续承担“主聊天控制平面”的语义中心
- orchestrator 当前更准确的定位应是：**workflow/runtime kernel**
- human governance / secretary coordination 应回到 ACR 所在的上层协作体系

### 7.2 ACR 的 `project session` 与 orchestrator 的 queue 不能竞争主真相
ACR 当前的 `project session`：
- 是 system-facing event lane
- 主要承担 routing trace、handoff、summary read-model、fallback lane

orchestrator 当前的 queue / sqlite / writeback：
- 才是 workflow 执行 transport 与 runtime state 的主执行面

因此必须避免把两者混成双重状态系统：
- `project session` 不是 orchestrator queue
- `project session` 不是 business workflow state source
- orchestrator queue 也不是 human-facing continuity source

更准确的关系应是：
- orchestrator queue 负责“动作是否被执行、状态是否推进”
- ACR `project session` 负责“这次路由/执行发生了什么、是否需要上浮给主会话”

### 7.3 当前 ACR core 已定义 project-side integration 边界，但还没把扩展契约做实
文档上，ACR 已经明确：
- project-specific ingress mapper
- project-specific service implementation
- project-specific runtime/business semantics

应留在项目 repo。

但在当前实现里，`internal service` 仍主要通过 plugin 创建时注入 handler 完成，缺少一个更正式的 project-owned integration loading contract。

这会导致真实接入 orchestrator 时出现尴尬：
- 从边界上看，adapter 应留在 orchestrator repo
- 从实现上看，ACR core 还没有把“项目 repo 如何优雅接入这些 handler”彻底打通

所以这里不是 orchestrator 单方面问题，ACR core 也确实还差一小段。

### 7.4 orchestrator 的 direct notify 与 ACR 的 main-session escalation 语义尚未拆清
当前 orchestrator runtime 会直接向 Feishu review chat 发通知。

这件事可以存在，但它的语义应被重新命名清楚：
- 这是 **business/protocol notification**
- 不是 ACR 意义上的 `main session escalation`
- 也不应自动等同于 secretary/human governance 的唯一入口

否则系统会再次把：
- 业务群通知
- secretary 主会话升级
- project lane 高信号摘要

混为同一件事。

### 7.5 protocol owner / business target 已在文档中提出，但 ACR core 还没正式进类型系统
当前文档已经明确：
- orchestrator 常常是 `protocol owner project`
- 真正工作可能属于另一个 `business target project`

但 ACR 当前的核心对象仍主要只有：
- `project_ref`
- `resolved_project_id`

这对 orchestrator 首批场景够做 MVP safe-fail，但对长期模型仍偏弱。

特别是当：
- 某条 dispatch 消息通过 orchestrator 协议进入
- 但最终动作归属另一个业务项目

仅靠单一 `resolved_project_id` 很容易把两层语义混在一起。

---

## 8. 推荐的目标关系（当前建议）

### 8.1 ACR 负责上层协作入口与路由
ACR 应负责：
- human-facing `main session`
- `/project` focus switch
- ingress normalization
- route decision / safe-fail / trace
- 是否升级回主会话
- project-lane 的高信号摘要与可见性

### 8.2 orchestrator 负责 workflow kernel
orchestrator 应继续负责：
- dispatch/review 协议的 runtime ingress
- queue / sqlite / dedupe
- workflow transition
- writeback
- protocol/business notification
- runtime observability

### 8.3 对 orchestrator 的默认接线应是 service-first，而不是 project-session-first
对于 orchestrator 这类已经有稳定 runtime kernel 的项目，ACR 更合适的默认接法应是：

`normalized envelope -> internal service -> orchestrator ingress`

而不是：

`normalized envelope -> ACR project session -> 再靠对话理解是否要调 orchestrator`

原因：
- orchestrator 已经有明确 action contract（`dispatch` / `execute_success` / `execute_blocked` / `review_done` / `review_fix`）
- 这些动作天然更像结构化 service ingress
- 如果先落到 project session 再靠 agent 二次理解，会重复做 ingress 判断
- 会把“路由系统”和“workflow 内核”重新揉回一起

因此当前建议是：
- `dispatch` / `execute_success` / `execute_blocked` / `review_done` / `review_fix`
  - 默认走 `service`
- `append_note` / `handoff` / `ops_summary` / `high_signal_event_log`
  - 可以走 `project_session`

### 8.4 `project session` 对 orchestrator 更适合作为 shadow lane / visibility lane
对 orchestrator 场景，ACR 的 `project session` 更适合承载：
- 路由结果日志
- service 执行回执摘要
- blocked/review/high-signal completion 的聚合读面
- 给 `coordinator-agent` 的高信号恢复入口

不适合承载：
- 主 queue
- authoritative workflow state
- 对 `dispatch` 是否生效的唯一判断

### 8.5 项目 repo 应显式拥有自己的 ACR 接入面
当 orchestrator 作为 ACR 首批客户时，项目 repo 里至少应显式拥有：
- `router.yaml`
- ACR-facing service contract
- project-owned service implementation / adapter module

而不应继续把这些接线隐含在 ACR core 内部。

---

## 9. Refactor 责任拆分（建议）

### 9.1 更像 orchestrator repo 要做的事
1. 把剩余的 control-plane / execution-plane 旧 framing 继续降级为历史材料，不再作为当前语义中心。
2. 显式补上 ACR 接入面：
   - `router.yaml`
   - action -> ingress mapping
3. 定义稳定的 ACR-facing ingress contract：
   - 至少覆盖 `dispatch` / `execute_success` / `execute_blocked` / `review_done` / `review_fix`
4. 把“业务通知”与“secretary escalation”拆成两种不同语义，不再混称为同一种上浮。

### 9.2 更像 ACR core 要做的事
1. 正式化 project-side integration loading contract：
   - 让项目 repo 可以注册 service handler / mapper，而不是只能在 plugin 创建时手写注入
2. 把 `protocol owner` / `business target` 从文档概念推进到正式模型
3. 进一步澄清：
   - direct channel reply
   - business notification
   - main-session escalation
   三者的 contract 边界
4. 继续守住 `project session` 的定位：
   - shadow lane / visibility lane
   - 不膨胀为第二个 workflow engine

### 9.3 哪些事情当前不该做
- 不把 orchestrator 的 queue/writeback 迁进 ACR
- 不让 ACR core 硬编码 orchestrator 的业务 action/payload
- 不把 `project session` 设计成 orchestrator 的 authoritative dispatch inbox
- 不在尚未明确 project-owned integration contract 前，让每个项目各自复制一份 runtime adapter

---

## 10. 当前建议的推进顺序

建议按这个顺序推进，而不是两边同时大改：

1. 先确认 integration seam：
   - orchestrator 对 ACR 采用 `service-first` 还是 `project-session-first`
   - 当前建议选 `service-first`
2. 在 orchestrator repo 补一个最小 `router.yaml` 与 action contract 草案
3. 在 ACR core 收口 project-side integration loading contract
4. 再决定是否需要把 `protocol owner` / `business target` 正式推进到 core 类型系统
5. 最后再处理 blocked/review/high-signal completion 的上浮路径如何统一

---

## 11. 当前判断
如果只给一个短判断，当前更像是：

- **orchestrator 需要收掉旧 control-plane 余味，明确自己是 workflow kernel**
- **ACR core 需要把 project-side integration 与双层 project 语义补完整**

也就是说：

> 不是“谁设计错了”，而是这两个项目分别诞生在不同阶段，现在需要一次正式对齐，才能从“能接”升级成“边界清楚、可长期演进地接”。 
