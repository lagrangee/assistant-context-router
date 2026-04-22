# Task Run Event Visibility Candidate

## Purpose
定义一套候选 visibility model，回答：

- agent 做长时工作时，如何让 Human 获得友好的可观察性
- 如何把 progress 同步到 orchestrator / board，而不污染 backlog
- 如何避免 agent 因可见度需求而疯狂刷卡、造任务、更新噪音

本文档当前是项目内候选方案，不是最终 data model。

## Core problem
随着 agent 的工作时长变长，单靠 channel/TUI 输出会越来越不适合 Human：

- Human 不可能长时间盯着 terminal 看
- 进展只停留在对话里，不利于 project-level observability
- 任务是否卡住、做到哪一步、是否需要 review，很难快速理解

但如果直接让 agent 把内部 plan 全部映射成 backlog item，又会产生新的问题：

- backlog 膨胀
- 看板噪音失控
- project board 失去 Human 可读性

因此 visibility 需要有明确对象分层。

## Core stance
`visibility` 应增强 work observability，而不是把 agent 的内部思维直接变成 project backlog。

推荐分成三层：

1. `Task`
   - 表达“要做什么”
2. `Run`
   - 表达“正在怎么做”
3. `Event`
   - 表达“哪些事项值得记录、升级或触发人类介入”

## Layer model

### 1. Task
`Task` / `Bug` / `WorkItem` 是 Human 与 secretary 共同维护的 backlog 对象。

它回答：
- 这件事是什么
- 优先级如何
- 当前状态是什么
- 谁负责
- 是否已完成

它不回答：
- agent 当前内部分成了几步
- 每一步执行到了哪个临时节点
- 每一次小进展的细节

推荐字段方向：
- `task_id`
- `project_id`
- `kind`
- `title`
- `status`
- `priority`
- `owner`
- `next_action`
- `acceptance`

### 2. Run
`Run` 是一次执行尝试或一次被调度的工作过程。

它回答：
- 当前是谁在做
- 当前做到哪一步
- 最后一次心跳是什么时候
- 当前是否 blocked / waiting review / completed

它更像：
- execution session
- work attempt
- progress container

它不等于：
- backlog item
- project truth
- final business state

推荐字段方向：
- `run_id`
- `task_id`
- `project_id`
- `executor_type`
- `executor_id`
- `status`
- `current_step`
- `summary`
- `started_at`
- `last_heartbeat_at`
- `completed_at`

推荐约束：
- 一个 `Task` 生命周期内可以有多个 `Run`
- 默认同一 `Task` 最多只有一个 active `Run`
- 人工重开 / 再次派发时，创建新 `Run`，而不是覆盖历史 `Run`

### 3. Event
`Event` 是结构化的状态信号或里程碑记录。

它回答：
- 发生了什么
- 这是不是高信号事项
- 是否需要升级给 Human

推荐类型方向：
- `run_started`
- `step_changed`
- `progress_milestone`
- `blocked`
- `review_requested`
- `completed`
- `failed`
- `human_override`

推荐字段方向：
- `event_id`
- `run_id`
- `task_id`
- `signal_kind`
- `summary`
- `details`
- `artifact_ref`
- `created_at`
- `visibility`

## Human-facing views
这三层对象不应以同一种方式暴露给 Human。

### Backlog view
默认给 Human 看的主视图应仍是 `Task`。

它回答：
- 现在有哪些待办
- 哪些在进行中
- 哪些需要我 review

### Run detail view
`Run` 应作为二级展开视图存在。

它回答：
- 这张卡当前跑到哪一步
- 最近有没有心跳
- 是不是卡住了

### Event feed / signal view
`Event` 更适合作为：
- 时间线
- 高信号动态
- 通知输入源

默认不应把所有 event 平铺到 backlog 主板上。

## What should sync to orchestrator / board
如果未来 agent 把 progress 同步给 orchestrator，建议同步的是：

### Task-level sync
- status change
- assignee / owner
- priority
- next_action

### Run-level sync
- current_step
- run status
- last heartbeat
- concise progress summary

### Event-level sync
- blocked
- need review
- high-signal completion
- failure
- human override

不建议同步：
- agent 的每个小推理动作
- 过于细碎的 plan decomposition
- 每一次微小文件变更
- 高频“我正在继续工作”的噪音 heartbeat

## Progress update rules
为了避免刷板，visibility 必须有节流规则。

### Rule 1. Progress is milestone-based, not token-based
不按 token 消耗、循环次数或每个工具调用都写更新。

优先记录：
- current step changed
- meaningful milestone reached
- blocked
- review requested
- completion / failure

### Rule 2. Internal plan does not automatically become backlog
agent 的内部 plan 默认只属于 `Run` 的 progress 语义，不自动变成新的 `Task`。

若 agent 认为需要新增 backlog item：
- 当前阶段应先 `propose`
- 不应默认直接创建

### Rule 3. High-signal items can escalate; ordinary progress stays local
默认只有以下事项值得升级到主会话或更醒目的 human-facing surface：
- blocked
- review requested
- need decision
- high-signal completion

普通进展应优先停留在 `Run` / `Event` 层。

### Rule 4. Board should summarize, not replay terminal output
board 的职责是提供 project-level observability，而不是成为 terminal replay。

## Step 2 minimum scope
Step 2 可以考虑支持最小 visibility，但不应过宽。

### In scope
- `Task` 维持 backlog / status / owner / review 状态
- `Run` 记录当前执行状态
- `Event` 记录高信号事项
- Human 能在 board 上看见：
  - 哪张卡正在跑
  - 最近做到哪一步
  - 是否 blocked / waiting review / completed

### Out of scope
- agent 自主批量创建 backlog item
- agent 把全部 plan 自动拆成若干 todo
- 对每个工具调用写一条 progress event
- 用 visibility 代替 docs truth

## Relationship with ACR
ACR 不需要亲自承载全部 board data model，但需要定义边界。

ACR 更适合负责：
- main session / project session / service 的 route semantics
- 哪些高信号事项应升级到主会话
- 与 orchestrator 的 integration boundary

orchestrator 更适合负责：
- task/run/event 的 lifecycle
- board visibility
- human-friendly observability
- work-management UI adapter integration

## Failure modes to avoid
- 把 `Task` 与 `Run` 混成同一个对象
- 把 `Event` feed 当成 backlog 主板
- agent 每做一点事就刷一条 board update
- 长任务可见度依然不足，Human 只能继续盯 TUI
- 为了可见度而让 agent 隐式创建大量新 task

## Open questions
1. `Run` 是否需要独立持久化对象，还是可以先作为 orchestrator 的 runtime-side record 存在
2. `Event` 是否需要统一 schema，还是先保持最小 signal family
3. 不同 UI adapter（Feishu/Trello/Jira）下，`Run` 详情最适合落在 card 字段、comment 还是独立表/面板

## Recommended next step
1. 在 orchestrator 接入设计里，把 `Task / Run / Event` 作为正式候选对象模型。
2. 先定义 Step 2 最小信号集：
   - `blocked`
   - `review_requested`
   - `completed`
   - `failed`
   - `step_changed`
3. 后续真实试跑时重点观察：
   - Human 是否更容易理解长时工作进展
   - board 噪音是否仍然可控
   - backlog 与 progress 是否发生语义污染
