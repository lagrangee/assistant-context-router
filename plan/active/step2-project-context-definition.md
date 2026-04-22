# Step 2A — Project Context Definition

## Purpose
定义：当 Human 在 `main session` 中通过 `/project <id>` 切换当前项目焦点后，系统应为 assistant 构建什么样的 **最小充分 project context**。

本文件先回答“应该构建什么”，不直接回答“如何实现 routing”或“如何分发 automation”；这些分别由 `step2-routing-matrix.md` 与 `step2-strategy-note.md` 负责。

当前语境下，这个定义首先服务于：
- `main session` 中的 project focus switch
- `coordinator-agent` 在主会话内的项目边界理解与恢复工作

而不是服务于：
- Human 直接进入 `project session` 工作
- project session 内的 automation / agent event lane 设计

## Position in Step 2
Step 2 当前顺序应为：
1. `step2-strategy-note.md`
2. **Step 2A：project context definition**
3. `step2-routing-matrix.md`
4. `step2-context-validation.md`

也就是说，routing 与 validation 设计应建立在本文件的 context baseline 之上，而不是反过来倒逼 context 膨胀。

## Problem statement
Step 1 已证明：session 内显式 `/project` switch 是可行的。

Step 2A 要解决的问题不是“如何喂更多上下文”，而是：

> 当 Human 不切 session、只在 `main session` 中通过 `/project` 切换项目焦点时，什么样的 context 组合足以让 assistant 快速恢复到**正确的项目边界**与**可工作的状态**？

这要求 project context 同时满足：
- enough to orient
- enough to resume
- bounded by default
- stable across turns
- explainable to humans and agents

## Design goals
1. **Correct project boundary first**
   - 先保证 assistant 知道 `main session` 当前正聚焦哪个项目，而不是先追求“更多信息”。
2. **Resume working inside main session**
   - 目标是在主会话中恢复可工作状态，不是把 Human 送进 project session 或重放全部历史。
3. **Bounded by default**
   - 默认只注入最小充分对象，不默认扩展到大量项目文档或完整对话历史。
4. **Document-driven first**
   - 优先依赖项目内稳定文档对象，而不是临时对话记忆。
5. **Degradable by bucket**
   - 如果未来发现缺口，应能按 bucket 增量扩展，而不是整体放大 context。

## Definition: minimum sufficient project context
当前建议，`/project` 后在 `main session` 内默认加载的最小 context 应由三层组成：

### Layer 1 — Project identity
回答：
- 这是什么项目
- 目标是什么
- 当前大阶段是什么

推荐对象：
- `project.yaml`
- `README.md`

作用：
- 建立项目身份
- 建立长期目标与边界
- 避免 assistant 只看到当前任务而失去项目定义

### Layer 2 — Project current status
回答：
- 这个项目当前整体推进到哪了
- 已完成了什么
- 当前主线大致是什么
- 现在最值得先往哪下钻

推荐对象：
- `STATUS.md`

作用：
- 建立项目当前阶段视图
- 提供“当前局面”而不是只有长期定义
- 为后续选择 deeper context bucket 提供导航

### Layer 3 — Project resume state
回答：
- 如果现在继续干活，应从哪里接上
- 上次停在哪
- 当前下一步是什么
- 当前有哪些 pending decisions / guardrails

推荐对象：
- `RESUME.md`

作用：
- 将 project context 从“知道项目是什么”推进到“能够立刻恢复工作”
- 避免 assistant 每次 `/project` 后还要重新从大量文档推断当前工作点

## What this context is for
这个默认 context 是给：
- `main session` 中的 `coordinator-agent`
- 在 Human 执行 `/project` 后继续讨论、判断、规划、解释与推进工作

它不是给：
- automation message 直接消费
- `project session` 中的事件流默认注入
- Human 默认进入另一个工作会话时使用

也就是说：
- `project session` 是 system-facing work lane
- `/project` 后的 default project context 是 human-facing main-session working context

## Why docs map is not in the default minimum trio
`docs/README.md` 很重要，但当前不建议把它列入默认 minimum trio。

原因：
1. 它主要承担导航，而不是项目定义或当前工作态
2. `STATUS.md` 已经可以承担“先往哪看”的一级导航
3. 将 docs map 作为默认第四对象会增加上下文，但不一定增加主会话内任务可完成性

因此当前建议：
- `docs/README.md` = **default available, but not default injected**
- 当 assistant 需要更细的文档导航时，再按需下钻

## Why collab panel is not default injected
`execution/COLLAB.md` 当前不建议默认进入 `/project` 后的主会话 context。

原因：
1. 它是高频协作面板，噪音与时效性都更高
2. 它更适合在明确需要读取多 agent handoff / blocked / review 状态时按需读取
3. 默认注入会把主会话里的项目恢复，从“稳定工作态”拉向“高频过程流”

因此当前建议：
- `execution/COLLAB.md` = **optional execution bucket**
- 只有在明确需要读取协作流转细节时再下钻

## Why full project conversation is not default context
“基于这个 project 的完整对话”有价值，但当前不建议作为默认注入。

原因：
1. 对话历史天然膨胀且噪音高
2. 同一信息可能已被 `STATUS.md` / `RESUME.md` 吸收
3. 默认引入会使 context 难以 bounded
4. 很多失败其实不是“没有历史对话”，而是“没有工作态摘要”

因此当前建议：
- raw project conversation = **non-default optional source**
- 优先把有效状态沉淀到 `RESUME.md`
- 只有当某类主会话任务稳定要求 recent conversational nuance 时，才考虑增加 conversation-summary bucket

## Raw conversation: keep or not?
当前建议：**有必要完整保留 raw project conversation，至少作为可按需加载的底层来源**。

但这里要明确三层区分：

### Layer A — raw conversation archive
作用：
- 完整保留历史 project 对话
- 供未来按需加载、追溯、审计、抽取 compact state

特点：
- 默认不注入
- 不直接作为主会话 resume context
- 更像底层素材层，而不是默认工作层

### Layer B — compacted conversation state
作用：
- 从 raw conversation 中提炼出对恢复工作有价值的状态
- 例如：最近主线、上次中断点、当前 pending、下一步建议、关键 guardrails

特点：
- 可以成为 `RESUME.md` 的来源之一
- 不是原始对话回放
- 应追求短、稳、可恢复工作

### Layer C — default project context in main session
作用：
- `/project` 后默认进入 `main session` 的最小充分上下文

当前建议仍为：
- `project.yaml`
- `README.md`
- `STATUS.md`
- `RESUME.md`

也就是说：
- raw conversation **应保留**，但不默认注入
- compacted state **值得使用**，但应被约束在 resume / optional bucket 层
- default context **继续保持 bounded**

## Resume compaction as a future mechanism
当前可接受的方向是：
- `RESUME.md` 不只是人工静态维护物
- 它也可以由 conversation-derived compact state 更新

但当前不建议直接承诺自动写回。

### More acceptable near-term policy
- **显式或半显式 compaction** 优先
- 例如：
  - 项目阶段收口时建议生成/更新 resume state
  - agent 在阶段收口时更新 `RESUME.md`
  - 用户/agent 明确触发一次 compact-and-write

### Less acceptable near-term policy
- 每次 `/project` 时静默自动写回

原因：
- 写回时机、覆盖策略、错误沉淀风险都还未定义稳定
- 这会把 Step 2A 从 context definition 直接推向 writeback system design

## Context bucket model
当前建议把 `/project` 后主会话里的 project context 理解为以下 buckets：

### Default buckets
1. identity bucket
   - `project.yaml`
   - `README.md`
2. status bucket
   - `STATUS.md`
3. resume bucket
   - `RESUME.md`

### Optional buckets
4. navigation bucket
   - `docs/README.md`
5. execution bucket
   - `execution/COLLAB.md`
   - implementation-side progress / notes
6. validation bucket
   - step2 validation / evaluation docs
7. conversation-summary bucket
   - future optional artifact, not raw chat replay

## Decision rule for bucket expansion
未来只有在以下条件满足时，才应把某个 optional bucket 上升到更强默认地位：
1. 某类主会话任务稳定暴露同一缺口
2. 缺口无法由 identity / status / resume trio 解决
3. 缺口能清楚归因到某个具体 bucket
4. 增加该 bucket 不会显著破坏 bounded context

否则：
- 不因零散失败就扩大默认 context
- 不因“感觉可能更聪明”就增加 bucket

## What a reasonable main-session project context should achieve
在默认 trio 足够时，assistant 应能：
1. 说清当前 `main session` 正在处理哪个项目
2. 说清这个项目的大目标与当前阶段
3. 说清当前主线与下一步
4. 保持项目边界，不误入别的项目
5. 在需要更多细节时，知道下一步应读取哪个 bucket

## What the default context is not expected to solve
默认 trio 不需要直接解决：
- 全部实现细节问题
- 全部历史协作细节
- 所有 project session 事件流
- 全量项目对话细节
- automation dispatch 细节
- complex route semantics beyond `/project`-scoped main-session work

这些属于后续 optional bucket 或 routing / project-work-lane 讨论范围。

## Implication for Step 2 routing design
一旦接受本定义，routing design 就应建立在以下前提上：
1. `/project` routing 先只负责让 `main session` 聚焦到正确 project
2. 进入 project 后，默认先装载 identity + status + resume
3. 更细粒度文档与协作细节由后续 bucket resolution 处理
4. routing matrix 不应以“多塞文档”为主要修复手段
5. `project session` 的 event lane 不应反向决定 Human 主会话默认装载什么

## Open questions
当前仍待后续讨论的问题：
1. `project.yaml` + `README.md` 是否都需要默认注入，还是其中一个可摘要化
2. `RESUME.md` 是否需要更模板化，确保跨项目可复用
3. 是否需要一个正式的 conversation-summary artifact，作为 future optional bucket
4. 当项目缺少 `STATUS.md` 或 `RESUME.md` 时，safe-fail / fallback 行为应是什么

## Current recommendation
当前推荐先将以下定义视为 Step 2A baseline：
- **Default minimum trio** = `project.yaml` + `README.md` + `STATUS.md` + `RESUME.md`
- 它服务于 `/project` 后 `main session` 内的项目恢复与继续工作
- 其中按角色理解仍是三层：identity / status / resume
