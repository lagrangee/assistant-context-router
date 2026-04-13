# Step 2A — Project Context Definition

## Purpose
定义：当用户在 session 中切换到某个 project 后，系统应为 assistant 构建什么样的 **最小充分 project context**。

本文件先回答“应该构建什么”，不直接回答“如何实现注入”或“如何验证 routing”。

当前语境下，这个定义首先服务于 `proj-openclaw-feishu-orchestrator` 这类真实客户协作稳定性，而不是提前扩展为完整的人机多-agent 协作容器设计。

## Position in Step 2
Step 2 当前顺序应为：
1. **Step 2A：project context definition**
2. routing matrix design
3. validation design rewrite

也就是说，routing 与 validation 设计应建立在本文件的定义之上，而不是反过来倒逼 context 膨胀。

## Problem statement
Step 1 已证明：session 内显式 project switch 是可行的。

Step 2A 要解决的问题不是“如何喂更多上下文”，而是：

> 当 project 已明确后，什么样的 context 组合足以让 assistant 快速恢复到**正确的项目边界**与**可工作的状态**？

这要求 project context 同时满足：
- enough to orient
- enough to resume
- bounded by default
- stable across turns
- explainable to humans and agents

## Design goals
1. **Correct project boundary first**
   - 先保证 assistant 知道自己正在处理哪个项目，而不是先追求“更多信息”。
2. **Resume working, not full replay**
   - 目标是恢复可工作状态，不是重放全部历史。
3. **Bounded by default**
   - 默认只注入最小充分对象，不默认扩展到大量项目文档或完整对话历史。
4. **Document-driven first**
   - 优先依赖项目内稳定文档对象，而不是临时对话记忆。
5. **Degradable by bucket**
   - 如果未来发现缺口，应能按 bucket 增量扩展，而不是整体放大 context。

## Definition: minimum sufficient project context
当前建议，project switch 后的默认最小 context 应由三层组成：

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
- 避免 assistant 每次切换 project 后还要重新从大量文档推断当前工作点

## Why docs map is not in the default minimum trio
`docs/README.md` 很重要，但当前不建议把它列入默认 minimum trio。

原因：
1. 它主要承担导航，而不是项目定义或当前工作态
2. `STATUS.md` 已经可以承担“先往哪看”的一级导航
3. 将 docs map 作为默认第四对象会增加上下文，但不一定增加任务可完成性

因此当前建议：
- `docs/README.md` = **default available, but not default injected**
- 当 assistant 需要更细的文档导航时，再按需下钻

## Why collab panel is not default injected
`execution/COLLAB.md` 当前不建议默认进入 project context。

原因：
1. 它是高频协作面板，噪音与时效性都更高
2. 它更适合在 execution-heavy 或 multi-agent handoff 场景下按需读取
3. 默认注入会把 project context 从“稳定工作态”拉向“高频过程流”

因此当前建议：
- `collab.md` = **optional execution bucket**
- 只有在明确需要读取多 agent 协作进度 / handoff 细节时再下钻

## Why full project conversation is not default context
“基于这个 project 的对话”是有价值的，但当前不建议作为默认注入。

原因：
1. 对话历史天然膨胀且噪音高
2. 同一信息可能已被 `STATUS.md` / `RESUME.md` 吸收
3. 默认引入会使 context 难以 bounded
4. 很多失败其实不是“没有历史对话”，而是“没有工作态摘要”

因此当前建议：
- raw project conversation = **non-default optional source**
- 优先把有效状态沉淀到 `RESUME.md`
- 只有当某类任务稳定要求 recent conversational nuance 时，才考虑增加 conversation-summary bucket

## Raw conversation: keep or not?
当前建议：**有必要完整保留 raw project conversation，至少作为可按需加载的底层来源**。

但这里要明确三层区分：

### Layer A — raw conversation archive
作用：
- 完整保留历史 project 对话
- 供未来按需加载、追溯、审计、抽取 compact state

特点：
- 默认不注入
- 不直接作为 resume context
- 更像底层素材层，而不是默认工作层

### Layer B — compacted conversation state
作用：
- 从 raw conversation 中提炼出对恢复工作有价值的状态
- 例如：最近主线、上次中断点、当前 pending、下一步建议、关键 guardrails

特点：
- 可以成为 `RESUME.md` 的来源之一
- 不是原始对话回放
- 应追求短、稳、可恢复工作

### Layer C — default project context
作用：
- project switch 后默认进入的最小充分上下文

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
  - project 切换时建议生成/更新 resume state
  - agent 在阶段收口时更新 `RESUME.md`
  - 用户/agent 明确触发一次 compact-and-write

### Less acceptable near-term policy
- 每次 project 切换时静默自动写回

原因：
- 写回时机、覆盖策略、错误沉淀风险都还未定义稳定
- 这会把 Step 2A 从 context definition 直接推向 writeback system design

## Context bucket model
当前建议把 project context 理解为以下 buckets：

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
1. 某类任务稳定暴露同一缺口
2. 缺口无法由 identity / status / resume trio 解决
3. 缺口能清楚归因到某个具体 bucket
4. 增加该 bucket 不会显著破坏 bounded context

否则：
- 不因零散失败就扩大默认 context
- 不因“感觉可能更聪明”就增加 bucket

## What a reasonable project context should achieve
在默认 trio 足够时，assistant 应能：
1. 说清当前在处理哪个项目
2. 说清这个项目的大目标与当前阶段
3. 说清当前主线与下一步
4. 保持项目边界，不误入别的项目
5. 在需要更多细节时，知道下一步应读取哪个 bucket

## What the default context is not expected to solve
默认 trio 不需要直接解决：
- 全部实现细节问题
- 全部历史协作细节
- 所有验证记录
- 全量项目对话细节
- 复杂 protocol owner / business target routing 歧义

这些属于后续 optional bucket 或 routing matrix 讨论范围。

## Implication for Step 2 routing design
一旦接受本定义，routing design 就应建立在以下前提上：
1. project routing 先只负责把 assistant 带到正确 project
2. 进入 project 后，默认先装载 identity + status + resume
3. 更细粒度文档与执行细节由后续 bucket resolution 处理
4. routing matrix 不应以“多塞文档”为主要修复手段
5. advanced collaboration mode（例如 native thread、shared thread governance）不在当前 Step 2A 默认设计范围内

## Open questions
当前仍待后续讨论的问题：
1. `project.yaml` + `README.md` 是否都需要默认注入，还是其中一个可摘要化
2. `RESUME.md` 是否需要更模板化，确保跨项目可复用
3. 是否需要一个正式的 conversation-summary artifact，作为 future optional bucket
4. 当项目缺少 `STATUS.md` 或 `RESUME.md` 时，safe-fail / fallback 行为应是什么

## Current recommendation
当前推荐先将以下定义视为 Step 2A baseline：
- **Default minimum trio** = `project.yaml` + `README.md` + `STATUS.md` + `RESUME.md`
- 其中按角色理解仍是三层：identity / status / resume
- `docs/README.md` 与 `collab.md` 暂不默认注入
- project conversation 暂不默认注入

## Next step
本定义通过后，下一步应进入：
1. Step 2 routing matrix design
2. 重写 `step2-validation-design.md`
3. 基于真实任务验证 default trio 是否足够
