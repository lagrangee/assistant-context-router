# Feishu Work Surface Operating Model

## Purpose
为 Feishu 多维表格上的 `Tasks / Bugs` 定义一份更稳定的 work surface operating model。

本文档回答：
- `Todo / Doing / Fixing / Reviewing / Done / Fixed` 在 work surface 上分别代表什么
- 哪些状态变化应触发 ACR automation ingress
- 为什么 `Todo` 不应默认等于 “请 ACR 立刻执行”
- Human 手工创建 / ACR 主动写入 / 外部 automation 同步进来的 row，应该如何共存
- 未来若要支持 “创建即调度” 或 “允许 Agent 自动接单”，应落在哪层 policy surface

本文档不直接授权：
- 立刻修改 live Base workflow
- 立刻新增 `ACR启动方式` 字段
- 让 `Tasks / Bugs` 回涨成 ACR truth host

## Core decision
当前采纳的核心范式是：

> `Todo` 是 backlog / 待处理对象；  
> `Doing / Fixing` 才代表一次明确的 execution request；  
> `Reviewing -> Done / Fixed / Todo` 才代表人工验收决策的回流。

这意味着：
- `Todo` 默认不自动 dispatch
- `Todo -> Doing`
  - 才代表 `Task` 进入执行
- `Todo -> Fixing`
  - 才代表 `Bug` 进入修复
- `Reviewing -> Done / Fixed`
  - 才代表 `accepted`
- `Reviewing -> Todo`
  - 才代表 `rejected` 或 `reopened`

## Why this model

### 1. `Todo` 是 work object，不是 command
在真实使用里，`Todo` 可能来自：
- Human 手工新建 backlog
- ACR 主动写入建议项
- 外部系统同步进来的事项

若默认把 “存在一个 `Todo`” 直接视为 dispatch signal，会把：
- backlog
- suggestion
- imported item
- real execution request

全部混成一类，导致：
- row 一创建就被自动执行
- ACR 自己写出的 `Todo` 触发自激循环
- Human 无法安全地先整理 backlog 再手工推进

### 2. 状态迁移比状态值更适合作为 signal
当前真正有动作含义的是迁移，而不是静态值：
- `Todo -> Doing`
- `Todo -> Fixing`
- `Reviewing -> Done`
- `Reviewing -> Fixed`
- `Reviewing -> Todo`

因此，workflow / automation 不应只看“目标状态是什么”，而应优先建模成：

> 哪个 row 从什么状态迁移到了什么状态。

### 3. 这更符合 ACR 的三层 surface split
- `automation_ingress`
  - 接收外部世界对 ACR 的明确请求或决策
- `agent_coordination`
  - 承接 agent 间内部流转
- `governance_escalation`
  - 只承接真正需要 project owner 进入主会话处理的事项

在这个模型下：
- Human 在 card 上把 `Todo -> Doing / Fixing`
  - 属于 `automation_ingress`
- Human 在 card 上把 `Reviewing -> Done / Fixed / Todo`
  - 也属于 `automation_ingress`
- `agent-coordination`
  - 不再承载 Human 对 card 的验收编辑本身
  - 它继续主要承接 agent coordination

## State semantics

### `Tasks`
- `Todo`
  - backlog / 待处理 / 待确认
- `Doing`
  - 已明确进入执行
- `Reviewing`
  - 执行完成，等待 Human 或 policy-gated 验收
- `Done`
  - 已验收通过，或在允许 agent 完结时由 ACR 自动收口
- `Archived`
  - 非活跃 / 归档

### `Bugs`
- `Todo`
  - backlog / 待处理 / 待修复
- `Fixing`
  - 已明确进入修复
- `Reviewing`
  - 修复完成，等待验证
- `Fixed`
  - 已验证通过，或在允许 agent 完结时由 ACR 自动收口
- `Archived`
  - 非活跃 / 归档

## Trigger model

### Default trigger transitions
当前建议作为标准触发器的仅有以下几类：

#### Execution start
- `Task: Todo -> Doing`
  - 触发 `dispatch`
- `Bug: Todo -> Fixing`
  - 触发 `dispatch`

#### Acceptance resolution
- `Task: Reviewing -> Done`
  - 触发 `review_resolution / accepted`
- `Bug: Reviewing -> Fixed`
  - 触发 `review_resolution / accepted`
- `Task/Bug: Reviewing -> Todo`
  - 触发 `review_resolution / rejected` 或 `reopened`

### Not a default trigger
下面这些默认不应自动触发 ACR：
- 新建 row 且状态为 `Todo`
- ACR 自己创建一条 `Todo`
- 在 `Todo` 状态下修改标题、描述、优先级、DoD、验证人等业务字段
- 任何不带明确执行或验收含义的普通字段编辑

## ACR-created Todo
当前明确允许：

> ACR 可以基于工作进展主动写入 `Todo`。

但默认语义必须保持为：
- suggestion / backlog item
- 不是自动 dispatch
- 不是“只要出现就开始执行”

否则会产生自激问题：
- ACR 创建 `Todo`
- workflow 把 `Todo` 当 execution request
- ACR 又开始执行自己刚创建的待办

因此，ACR-created `Todo` 默认仍应等待：
- Human 手工推进到 `Doing / Fixing`
- 或明确 policy 允许自动接单

## Policy surface
当前已采纳：
- `acceptance_mode`
- `completion_notify_mode`

下一批建议新增但尚未授权的概念是：

### `start_mode` / `ACR启动方式`
建议作为 `project default + row-level override` 的 policy surface。

推荐值：
- `仅手动推进`
  - 默认值
  - `Todo` 不会自动触发
  - 只有 `Todo -> Doing / Fixing` 才触发
- `创建即调度`
  - 新建 `Todo` 后即可自动进入 execution request
- `允许Agent接单`
  - ACR 可在满足条件时把 `Todo` 主动提升到 `Doing / Fixing`

当前结论：
- 这个 policy 现在只应先进入 contract
- 不应在没有 formal review 的情况下直接加到 live Base

## Current live workflow implication
基于上述 operating model，当前 live Base workflow 的语义应这样理解：

### Already good
- `Tasks Todo -> Doing => dispatch`
- `Bugs Todo -> Fixing => dispatch`
- `Tasks Reviewing -> Done => review_resolution / accepted`
- `Tasks Reviewing -> Todo => review_resolution / rejected`
- `Bugs Reviewing -> Fixed => review_resolution / accepted`
- `Bugs Reviewing -> Todo => review_resolution / rejected`

这些当前都已进入 live Base workflow，并且都符合当前 operating model。

补充边界：
- `Todo -> Doing / Fixing` workflow 只负责发起 execution request
- semantic completion 不应再由 Feishu workflow 伪造或由 Human 手工复制
- 当前标准路径是 main session agent 在 assistant output 中产出 strict `[ACR_AUTOMATION]` boundary block
- ACR 只在同一 main session 存在 `pending_semantic_execution` 时，通过 `llm_output` 自动捕获该 boundary 并继续 writeback

### Needs tightening later
当前最小闭环已经收紧到“状态迁移触发”：
- `Todo -> Doing / Fixing`
- `Reviewing -> Done / Fixed / Todo`

后续仍需克制的点是：
- 不要把 create-time row insertion 直接接成 dispatch
- 不要在未引入正式 `start_mode` row-level policy 前，就让 `Todo` 本身重新承担 command 语义
- 若未来要支持 `dispatch_on_create`
  - 应单独作为 policy + workflow 组合引入
  - 不应污染当前 `manual_only` 的默认范式

## Ownership implication
这套模型与 `Tasks / Bugs` ownership 边界一致：

- Human-owned
  - backlog 定义、业务字段、验收动作本身
- ACR-owned
  - `current_step`
  - `step_result`
  - `next_action`
  - `last_event_at`
  - `ACR开始执行时间`
- Policy-gated shared
  - `状态`
  - `Done / Fixed` 的自主收口权限

因此：
- Human 手动编辑 `状态`
  - 不是天然越权
- 但 ACR 对这些状态编辑的解释
  - 必须遵守本文档定义的 operating model

## Adopted standard
当前正式采纳的 Feishu work surface 标准是：

1. `Todo` 默认是 backlog，不是 dispatch signal。
2. `Todo -> Doing / Fixing` 才是默认 execution request。
3. `Reviewing -> Done / Fixed / Todo` 才是默认 acceptance resolution。
4. ACR 可以主动创建 `Todo`，但默认只是 suggestion/backlog，不自动自触发。
5. 若未来要支持 “创建即调度 / 允许 Agent 接单”，必须通过显式 policy surface 表达，而不是把 `Todo` 本身重新定义成 command。

## Next
基于这份 operating model，下一步最合理的是：

1. 继续保持当前 live workflow 只覆盖“状态迁移触发”的最小闭环
2. 再决定是否把 `ACR启动方式` 推进到 live Base schema
3. 最后才引入 create-time dispatch 的 workflow 或其他自动 claim 机制

补充：
- 当前 live Base 的 `review_resolution` workflow 已完成第一轮收紧：
  - `Tasks/Bugs Reviewing -> Done/Fixed/Todo`
  - 现在都要求修改前状态必须是 `Reviewing`
  - 不再把任意 `-> Todo` 一律解释成 `rejected`
