# System Value And Non-Goals Candidate

## Purpose
从更高层视角回答：

- `assistant-context-router` 及其周边协作系统到底在提供什么价值
- 它与 memory / orchestration / secretary / PM tool 生态的关系是什么
- 当前系统明确不想变成什么

本文档是当前项目内候选判断，不是最终产品宣言。

## Core stance
这套系统的真正目标，不是再做一个更强的聊天 agent，也不是再做一个新的 memory / orchestration framework，而是：

> 为 Human + secretary agent (`coordinator-agent`) + working agents 提供一套可持续运转项目的协作操作模型。

这里的关键不是单次回答质量，而是：
- project continuity
- project switching recovery
- long-running work visibility
- human governance
- chat work 与 board/work-tracking work 的统一协作

## What problem this system is trying to solve
当前真实问题不是单点的。

### 1. Context continuity
Human 与 secretary agent 围绕同一个 project 长期工作时，不能每次都靠回忆整段历史。

### 2. Project switching
多个 project 切换时，系统需要恢复当前阶段、主线、pending、guardrails，而不是重新冷启动。

### 3. Work operations
纯 channel 对话不够支撑 project 运转；实际协作仍需要 task / bug / backlog / status / review 等 work-management 视角。

### 4. Long-running work visibility
agent 任务时长变长后，仅靠盯着 TUI/terminal 看输出对 Human 很不友好；需要一种符合人类习惯的可观察面。

### 5. Human-in-the-loop governance
automation 应增强 Human，而不是把 Human 变成人肉消息总线或被动旁观者。

## Where the value comes from
这套系统的价值不主要来自某一个底层模块，而来自几个层面的组合方式。

### 1. Docs as truth
项目文件是跨 session / 跨 agent / 跨 runtime 的主真相层。

这意味着：
- continuity 不依赖某个 memory backend
- project identity 不依赖某条 thread
- takeover / resume 有稳定锚点

### 2. Secretary-mediated collaboration
Human 不直接对所有 working agents 充当消息总线。

默认关系是：
- Human 主要与 secretary agent 交互
- secretary 负责解释、编排、摘要、升级、收口
- working agents 负责执行

### 3. Routing before execution
系统先回答“这条输入属于哪个 project / workflow / processing surface”，再回答“由谁执行”。

这比把所有输入直接塞给一个 agent 或 graph runtime 更适合多项目协作。

### 4. Work orchestration as a replaceable subsystem
task / bug / board / visibility / run tracking 很重要，但不应该反向成为 project truth host。

这使得：
- `openclaw-feishu-orchestrator` 可以成为首个高价值实现
- Feishu/Trello/Jira/Linear 等可以作为 UI/work-tracking adapter 替换
- ACR core 不必被某个 PM 工具绑定

## Ecosystem positioning
当前公开生态里已经有很多优秀能力层：

- memory layer
- multi-agent orchestration
- workflow persistence
- human-in-the-loop execution
- agent IDE / runtime observability

这套系统不应试图与这些底层能力逐项对打。

更准确的位置应是：

### Stable upper-layer contracts
- project truth
- project switching / recovery
- secretary collaboration model
- route semantics
- human governance
- work visibility boundary

### Replaceable lower-layer capabilities
- memory backend
- execution backend
- runtime adapter
- agent runtime
- orchestration/work-management subsystem
- work-tracking UI adapter

换句话说：

> 本系统的潜在新价值，不在于重新发明 memory/orchestration 本身，而在于定义它们之上的 project operations layer。

## What this system is not
为了避免方向跑偏，当前应明确以下 non-goals。

### 1. Not a better standalone coding agent
这套系统不是为了单仓库 coding assistance 优化到极致。

如果场景只是：
- 一次性代码生成
- 短会话调试
- 单 repo coding loop

那么这套系统通常偏重。

### 2. Not a new general-purpose graph runtime
不做：
- 通用 graph execution engine
- 通用 multi-agent state host
- 替代 LangGraph / Agents SDK / AutoGen / CrewAI 的基础 runtime

### 3. Not a memory-first system
memory 很重要，但它不是主真相层。

系统不应滑向：
- “只要 memory 足够强，docs 就不重要”
- “靠长期 memory 代替 project truth”

### 4. Not a PM tool replacement by itself
Feishu/Trello/Jira/Linear 这类工具在本系统中更适合作为：
- work-tracking surface
- human-friendly visibility surface

而不是整套系统的定义中心。

### 5. Not a full autonomy platform in current stage
当前阶段不应把重点放在：
- agent 自主创建大量 backlog item
- token/budget-aware 的主动运营
- 自主项目启动与扩张

这些方向可以存在，但不应提前吞掉当前边界。

## What feels meaningfully new here
如果要回答“这是不是只是在缝合现成轮子”，当前最合理的判断是：

### It is not new at the primitive layer
底层 primitives 并不新：
- memory
- orchestration
- agent execution
- PM tool integration
- message routing

### It can be new at the operating-model layer
真正可能成立的新层面是：
- 以 project docs 为真相层
- 以 secretary agent 为默认协作入口
- 以 work orchestration subsystem 承载 project 运转
- 以 board visibility 补足长时任务观察面
- 以 human governance 统一 takeover / review / escalation

也就是说，它更像：
- 高质量的系统分层
- 清楚的工作操作模型
- 为长期项目协作设计的 upper-layer contract

而不是单个技术轮子的发明。

## Current blind spots and transitional assumptions
当前思考里至少还有以下需要持续警惕的点。

### 1. Docs maintenance assumption
`docs as truth` 很强，但也默认用户愿意持续维护 hall docs。

这对 power users 可能成立，对更广泛人群未必成立。

### 2. Multiple truths risk
系统现在天然会产生多套状态：
- docs
- board/work items
- runtime queue/store
- memory
- channel history

若没有明确 authoritative boundary，很容易滑向双重甚至多重真相。

### 3. Progress self-report risk
agent 的 progress update 不天然等于真实进展。

如果缺少 artifact / evidence / review 约束，看板可能只是在展示 agent 的自我叙述。

### 4. Productization leap assumption
从 personal-first system 到 public GitHub service，中间有很大鸿沟：
- auth
- RBAC
- secret management
- multi-tenant isolation
- auditability
- billing / quota / abuse prevention

当前不应假设这一步是自然延伸。

## Evaluation hints
后续若要判断系统是否真的有价值，建议尽量观察这些指标：

- project switch 后恢复工作所需时间
- wrong-project / stale-context 发生率
- long-running task 期间 Human 的不确定感是否下降
- board 上高信号与低信号噪音的比例
- Human takeover 的频率与原因
- docs truth 与 work-tracking state 的漂移率

## Recommended next step
1. 在后续候选文档中正式定义 `Task / Run / Event` visibility 边界。
2. 在 orchestrator 接入设计中，把 Feishu 明确降为 UI/work-tracking adapter，而不是系统真相层。
3. 后续如需对外叙述本项目，优先讲“project operations layer”而不是“新的 memory/orchestration framework”。
