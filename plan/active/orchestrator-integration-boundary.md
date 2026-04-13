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
