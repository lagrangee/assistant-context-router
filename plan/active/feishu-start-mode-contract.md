# Feishu Start Mode Contract

## Purpose
为 Feishu `Tasks / Bugs` work surface 定义 `ACR启动方式 / start_mode` 的最小 contract。

本文档回答：
- 为什么当前需要一个独立的 start policy surface
- `Todo` 默认为什么不能直接等于 execution request
- 如果未来要支持 “创建即调度” 或 “允许 Agent 接单”，应如何表达
- 这个 policy 的 project default 和 row-level override 应放在哪里

本文档不授权：
- 立刻修改 live Base schema
- 立刻新增 `ACR启动方式` 字段
- 立刻把 `Todo` 变成默认自动 dispatch

## Background
当前已采纳的 operating model 见：
- [feishu-work-surface-operating-model.md](<repo-root>/plan/active/feishu-work-surface-operating-model.md:1)

其中核心结论是：
- `Todo` 默认是 backlog
- `Todo -> Doing / Fixing` 才是默认 execution request
- `Reviewing -> Done / Fixed / Todo` 才是默认 acceptance resolution

但未来真实使用里，仍可能出现至少三类不同的启动策略：

1. 仅手动推进
2. 创建即调度
3. 允许 Agent 接单

因此需要把“如何从 `Todo` 进入执行”从状态字段本身剥离出来，放到一个单独 policy surface。

## Core decision
当前正式采纳：

> `start_mode` 必须是显式 policy，  
> 不能通过重新解释 `Todo` 字段语义来隐式承载。

也就是说：
- `Todo` 仍只表示 backlog / 待处理
- 是否自动进入 execution request
  - 取决于 `start_mode`
  - 不取决于 `Todo` 这个状态值本身

## Recommended values

### `manual_only`
中文显示建议：`仅手动推进`

语义：
- 默认值
- 新建 `Todo` 不自动触发 ACR
- 只有 `Todo -> Doing / Fixing` 才触发 execution request

适用：
- 当前大多数项目
- backlog 先整理、再手工挑选执行
- ACR 也可能主动创建 `Todo`，但不希望自激

### `dispatch_on_create`
中文显示建议：`创建即调度`

语义：
- Human 或外部 automation 新建 row 为 `Todo` 时
  - 立即视为 execution request
- 不要求再手动改到 `Doing / Fixing`

当前 guardrail：
- 该模式不应默认适用于 ACR 自己创建的 `Todo`
- 否则会出现：
  - ACR 创建 backlog
  - workflow 把该 row 自动 dispatch
  - ACR 又开始执行自己刚创建的 suggestion

因此当前推荐解释是：

> `dispatch_on_create` 只覆盖 Human / external-created row，  
> 不覆盖 ACR-created row。

### `agent_may_claim`
中文显示建议：`允许Agent接单`

语义：
- `Todo` 仍不是即时 dispatch
- 但 ACR 被允许在满足条件时主动把 `Todo` 提升到 `Doing / Fixing`
- 这代表：
  - 人不必手动推进每一条 row
  - 但执行权仍受 policy 约束

当前说明：
- 该模式不等于 “创建即调度”
- 它更像：
  - row 保持 `Todo`
  - ACR 决定 claim 后再进入执行

## Default
当前安全默认值采纳为：

```yaml
task_bug_policy:
  defaults:
    start_mode: manual_only
```

理由：
- 与当前 operating model 一致
- 不会把 backlog 与 command 混淆
- 不会让 ACR-created `Todo` 自激
- 最贴近当前真实使用方式

## Host selection

### Project default
project default 当前建议放在 project-owned `router.yaml`：

```yaml
task_bug_policy:
  defaults:
    start_mode: manual_only
```

理由：
- 与 `acceptance_mode`
- `completion_notify_mode`

同属同一 policy family，放在一起最清晰。

### Row-level override
若未来进入 live Base schema 讨论，当前建议的字段概念是：

- 字段名：`ACR启动方式`
- 类型：`single select`
- 推荐显示值：
  - `继承默认`
  - `仅手动推进`
  - `创建即调度`
  - `允许Agent接单`

当前仅作为 contract proposal：
- 尚未授权加到 Base
- 若后续要加，仍应先走 `Dict Definition` review

## Behavioral implications

### When `start_mode = manual_only`
- Human 新建 `Todo`
  - 不触发
- ACR 创建 `Todo`
  - 不触发
- `Todo -> Doing / Fixing`
  - 触发 execution request

### When `start_mode = dispatch_on_create`
- Human / external automation 新建 `Todo`
  - 触发 execution request
- `Todo -> Doing / Fixing`
  - 可视为状态对齐，不应重复 dispatch
- ACR 创建 `Todo`
  - 当前不应自动适用，避免自激

### When `start_mode = agent_may_claim`
- Human / external automation 新建 `Todo`
  - 默认不立即 dispatch
- ACR 可在满足 claim policy 时
  - 主动把 row 推进到 `Doing / Fixing`
  - 再进入 execution request

## Interaction with existing workflow
基于当前 contract，后续 workflow 应按以下顺序收口：

1. 先把现有 `review_resolution` workflow 收紧成状态迁移触发  
   当前已完成。

2. 再决定 execution start workflow 是否需要从：
   - `Todo -> Doing / Fixing`
   扩展为：
   - `AddRecordTrigger + start_mode = dispatch_on_create`
   - 或其他更显式的 create-time trigger

3. 若未来引入 `agent_may_claim`
   - 主要逻辑不应先堆在 Feishu workflow
   - 更适合由 ACR runtime / scheduler / queue policy 来控制

## Guardrails
当前明确不采纳：
- 通过重定义 `Todo` 字段来隐式表达 start policy
- 让所有 `Todo` 默认自动触发
- 让 ACR-created `Todo` 自动适用 `dispatch_on_create`
- 在未引入明确 policy surface 之前，就用 workflow 把 “创建 row” 直接接成 dispatch

## Runtime status
当前已新增 runtime parsing：

- `router.yaml`
  - `task_bug_policy.defaults.start_mode`
- `RouterConfig`
  - 已可读出 `manual_only / dispatch_on_create / agent_may_claim`
- `Task/Bug writeback` policy resolution
  - 已会保留 `start_mode`
  - 供后续 execution-start 行为或 observer 消费

当前仍未采纳：
- 直接基于 `start_mode` 改变 live Base row 的状态推进
- 直接新增 `AddRecordTrigger` / create-time dispatch workflow
- 直接新增 live Base 字段 `ACR启动方式`

## Next
基于当前 contract，下一步建议是：

1. 先决定 execution-start workflow 是否要进入 live Base
   - 若要进入，第一优先应是：
     - `Task: Todo -> Doing`
     - `Bug: Todo -> Fixing`
   - 而不是笼统地把 “Doing/Fixing” 本身当触发器
2. 再决定是否需要把 `ACR启动方式` 推进到 live Base schema
3. 最后才把 create-time dispatch workflow 纳入 live Base automation
