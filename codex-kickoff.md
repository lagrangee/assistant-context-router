# Assistant Context Router MVP — Codex Kickoff

## 1. 背景
project owner 正在把 OpenClaw 用在真实的多 channel、多项目、多 workflow 助理场景里。当前已经暴露出两个稳定痛点：

1. **跨 channel / 跨 session 切换后，project context 容易丢失**
   - 在 TUI / webchat / Feishu / WeChat 等入口来回切换时，仅靠语义检索和历史上下文，无法稳定回答“现在属于哪个项目”“应该加载哪套规则/文档”。

2. **结构化来源消息（尤其 Feishu dispatch/review）无法稳定命中正确 project/workflow**
   - `openclaw-feishu-orchestrator` 相关消息目前仍有“看运气”的成分，缺少明确的 project anchor 与 route policy。

这个项目不是在做“大而全 router 平台”，而是在 **不深改 OpenClaw core** 的前提下，做一个基于扩展面的、project-centric 的 MVP。

---

## 2. 已确认的 MVP 定义（不要重做定义）
来源：`projects/delivery/assistant-context-router/project.yaml`

### Objective
交付一个基于 OpenClaw 扩展面的、project-centric 的 assistant routing policy + bridge 层 MVP，支持：
- 显式 project context switch
- 轻量 context loading
- 首批 protocol/project/workflow 路由

### Constraints
- 先做 MVP，优先覆盖：**webchat 主会话、Feishu dispatch 群、Feishu review 群**
- 避免深改 OpenClaw core
- 优先采用：**config / skill / hook / plugin**
- 避免 context loading 爆炸与跨会话污染

### Deliverables
- project registry / project listing 入口（候选：`/projects`）
- 显式 project context switch（候选：`/project XXXX`）
- current project state 的隔离模型与最小实现
- project-centric context loading policy（轻量索引优先、按需追加）
- 首批 protocol/project/workflow route：webchat + Feishu dispatch/review
- route trace / route decision 可解释性

### Acceptance Criteria
- 能稳定列出项目宇宙并进入某个 project context
- 切换 project 后不会发生 context loading 爆炸
- current project state 不会在多 channel/多会话间发生明显污染
- dispatch/review 类消息能比当前更稳定地命中正确 project/workflow
- 对 `openclaw-feishu-orchestrator` 这个首批客户，主会话协作不再明显依赖整段历史回忆
- route decision 可记录、可解释、可保守失败
- 实现建立在 OpenClaw 扩展面上，无需深改 core

### 当前 next action
**不要重新讨论 MVP 是什么。**
直接进入这两个设计决策：
1. `/projects` / `/project` 用什么实现面（skill vs plugin command vs hook 组合）
2. `current project state` 落在哪里、如何隔离

---

## 3. Research 结论摘要（已读，不要重复发散）
来源：
- `projects/exploration/assistant-routing-research/notes/next-phase-plan.md`
- `projects/exploration/assistant-routing-research/suggestions/*.md`

### 3.1 研究阶段给 implementation 的 handoff 原则
研究项目的结论是：
- implementation 阶段不要继续横向扩张研究文档
- 优先从 handoff set 反推设计与开发
- suggestions 文档是参考，不是必须全部实现

### 3.2 Claude 的关键信号（偏战术 / 快速落地）
Claude 认为两个痛点本质不同：
- 痛点 1：没有显式 project context 锁
- 痛点 2：chat / protocol 到 project 的映射没有被显式声明

Claude 倾向：
- 做 `/projects` + `/project <id>`
- 轻量加载 `project.yaml` / README / recent-state
- 尝试用 binding/chatId 绑定解决 dispatch 群问题
- 如果 binding 不够，再让协议消息携带 project anchor

### 3.3 Gemini 的关键信号（偏架构 / 长期演进）
Gemini 的核心反对点：
- **不要用 workspace 根的全局 `CURRENT_PROJECT.md` 作为跨 channel 状态源**
- 多 channel / 多会话场景下，这会造成 context bleeding

Gemini 倾向：
- `current project state` 应归属于 **session/session-metadata 级别**，而不是全局文件
- `/project` 应只更新当前会话的 project binding
- 结构化协议消息要尽量携带自描述 project anchor
- 路由优先顺序应是：显式信号 > 结构化锚点 > 绑定 > 语义猜测

### 3.4 GPT 的关键信号（偏产品定义 / 路线分层）
GPT 认为：
- 这不是 memory 问题，而是 **context selection / routing** 问题
- `project` 应该是一等交互对象
- 应先做一个薄层 MVP：
  1. `/projects`
  2. `/project <id>`
  3. 轻量 context loading
  4. dispatch/review 的 project anchor
- 不建议一开始做大而全 router framework

---

## 4. 给 Codex 的设计边界（很重要）
### In scope
1. 一个可用的 project registry / listing 入口
2. 一个可用的 project switch 入口
3. current project state 的**最小隔离实现**
4. 基于 project 的轻量 context loading 策略
5. Feishu dispatch/review 的第一批 route 规则
6. route trace / explainability 的最小实现

### Out of scope
1. 深改 OpenClaw core
2. 重写 channel/session routing
3. 设计通用 router 平台 / router daemon
4. 一上来做全自动自然语言 project 猜测系统
5. 一次性解决所有 channel 与所有 workflow

---

## 5. 推荐实现方向（作为默认方案，不是绝对指令）
这部分是给 Codex 的默认设计靶心。

### 5.1 `/projects`
推荐实现为：**轻量 skill / command 层入口**

能力：
- 读取 `projects/index.yaml`
- 输出项目列表（至少包含 `project_id/title/type/status/file`）
- 支持最小过滤（可选）：按 type/status

注意：
- 这里只负责“列项目宇宙”，不要顺手做复杂 routing

### 5.2 `/project <project_id>`
推荐实现为：**显式 project context switch 入口**

能力：
- 校验 `project_id` 是否存在于 `projects/index.yaml`
- 读取对应项目入口文件（通常是 `project.yaml`）
- 建立当前 session 的 `current_project`
- 返回简短确认：当前项目、目标、状态、next_action

注意：
- 不要做全量项目文档加载
- 只加载最小上下文包

### 5.3 current project state 的落点
**默认推荐：session 级 / session-metadata 级**

理由：
- 避免多 channel / 多会话污染
- 更符合 Gemini 的架构约束
- 比 workspace 全局 `CURRENT_PROJECT.md` 更安全

如果 OpenClaw 当前扩展面不足以直接写 session metadata，可以接受一个 **过渡实现**，但必须满足：
- 不是全局单实例变量
- 至少能做到“按 sessionKey 或 channel-session 粒度隔离”
- 明确写出风险与后续替换点

### 5.4 context loading policy
采用 **project-first, context-light**：

第一层（默认必载）：
- `projects/index.yaml` 中该项目的 registry entry
- 项目 `project.yaml`

第二层（按存在性追加）：
- 项目 `README.md`
- `docs/recent-state.md` 或等价的“最近状态”文件

第三层（仅按任务需要追加）：
- 研究支撑文档
- 历史 notes
- 外部资源 / memory recall

目标：
- 切换项目时先建立边界，再按需加料
- 避免 context 爆炸

### 5.5 protocol / project / workflow routing MVP
优先做“显式 / 结构化优先”的规则：

优先级建议：
1. 显式 `/project`
2. 协议消息里的 project anchor（若已有）
3. 已知 channel/chat binding
4. protocol family（dispatch/review）
5. 最后才是语义猜测

对于首批客户 `openclaw-feishu-orchestrator`：
- dispatch/review 类消息至少应能：
  - 命中正确的 project family
  - 在不确定时 safe-fail
  - 输出可解释的 route reason

### 5.6 route trace / explainability
MVP 只要做到最小可解释即可：
- 本次 route 命中了哪个 project
- 命中依据是什么（显式命令 / channel binding / protocol anchor / fallback）
- 若未命中，为什么进入 safe-fail

不必一开始做复杂可视化。

---

## 6. 建议 Codex 先回答的设计问题
在真正写代码前，建议 Codex 先形成一个简短实现决策稿，回答：

1. `/projects` 放在哪个实现面最稳？
2. `/project` 放在哪个实现面最稳？
3. session 级 project state 如何落地？
4. 如果无法直接写 session metadata，过渡层怎么设计？
5. dispatch/review 的第一批路由规则怎么编码？
6. route trace 输出放哪一层最合适？

---

## 7. 交付建议（按小步快跑）
建议拆成 3 个小交付，而不是一次做完：

### Step A — Project registry + switch
- `/projects`
- `/project <id>`
- 最小 project state 存储
- 最小 context loading

### Step B — Protocol routing MVP
- Feishu dispatch/review 规则
- project/workflow 命中
- safe-fail
- route trace

### Step C — Hardening
- 污染/误命中测试
- 多 session 场景验证
- trace 优化
- 文档补全

---

## 8. 你（Codex）现在的任务
请不要重新定义需求，也不要扩张成大系统设计。

请按以下顺序推进：
1. 先阅读本文件
2. 再阅读：
   - `projects/delivery/assistant-context-router/project.yaml`
   - `projects/exploration/assistant-routing-research/notes/next-phase-plan.md`
3. 如需补充背景，再按需阅读 suggestions 文档
4. 先产出一个 **实现决策稿 / implementation plan**
5. 得到确认后，再进入原型实现

目标不是“架构最美”，而是：
- 在 OpenClaw 扩展面上做出可跑的 MVP
- 先解决真实痛点
- 不制造新的 context bleeding 和复杂性债务
