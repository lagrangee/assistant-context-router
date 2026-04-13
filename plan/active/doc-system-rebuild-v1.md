# Project Doc System Rebuild v1

## Purpose
为 `assistant-context-router` 重建一套更适合 **文档驱动、多 agent 协作、可恢复工作** 的项目文档体系。

本说明先定义原则与对象模型，再反推目录与重构动作；不以当前 `plan/`、`implementation/` 等历史结构为前提。

## Confirmed principles
### Principle 1
文档体系按 **项目生命周期** 与 **文档角色** 设计，而不是按当前历史文件分布设计。

### Principle 2
必须单独存在一个 **working state** 对象，作为任何 agent 恢复工作的第一入口之一。

### Principle 3
`discovery / decision / collaboration / validation` 必须显式分层，不能长期混在一个 `plan` 目录里堆积。

## Design center
本项目的文档体系不是主要为“人类 PM 汇报”设计，而是为以下对象服务：
- coordinator agent
- Codex
- Claude
- Gemini
- 未来其他 agent
- project owner（用于 review、拍板、恢复上下文）

因此设计目标不是“看起来整齐”，而是：
1. 任一 agent 能快速知道当前项目处于哪个阶段
2. 任一 agent 能找到当前 source of truth
3. 任一 agent 能恢复当前工作态并继续推进
4. 任一 agent 能把新结论沉淀回正确层级
5. 不让阶段性讨论材料长期污染执行入口

## Lifecycle model
### Phase A — Discovery
用于承载：
- brainstorming
- research
- feasibility
- alternatives
- problem framing

特点：
- 允许发散
- 允许多个候选方向并存
- 不应直接充当执行依据

### Phase B — Planning & Decision
用于承载：
- goals
- milestones
- scope / out-of-scope
- architecture / structure definition
- testing / validation requirements
- success criteria
- major decisions
- risk / boundaries

特点：
- 将探索结果压缩成可执行约束
- 是从开放探索进入受控执行的收口层

### Phase C — Execution & Collaboration
用于承载：
- current working state
- agent collaboration rules / handoff
- implementation progress
- execution-side outputs
- pending decisions during active work

特点：
- 面向多 agent 接力与 resume working
- 需要高频更新，但不能污染上层决策文档

### Phase D — Validation & Release
用于承载：
- validation matrix
- acceptance results
- go / no-go judgement
- release readiness
- post-validation notes

特点：
- 回答“这一阶段能否收官 / 进入下一阶段”
- 不等同于实现记录

## Document role model
每个项目文档应被理解为以下角色之一：

### 1. Identity
项目是谁、做什么、当前阶段是什么。

### 2. Exploration
探索材料：research / brainstorm / feasibility / alternatives。

### 3. Decision
已收口结论：策略、架构、边界、阶段决策。

### 4. Working State
当前工作态：当前主线、进展、中断点、下一步、待决问题。

### 5. Collaboration
多 agent 协作面：handoff、panel、working agreements。

### 6. Execution Artifact
实现产物：实现记录、测试记录、代码侧说明。

### 7. Validation
验收与评估：validation design、结果、release judgement。

### 8. Archive
历史材料：不再作为当前真相，但可保留追溯价值。

## The working-state object
### Why it is required
对于 agent 来说，resume working 最需要的不是“所有历史文档”，而是一个 **可恢复工作态对象**。

### It should answer
- 当前阶段是什么
- 当前主线任务是什么
- 最近完成了什么
- 上次停在哪
- 当前推荐下一步是什么
- 还缺哪些 decision
- 继续前必须先看哪些文档

### Design requirement
working state（在当前项目中命名为 `RESUME.md`）应是：
- 短
- 明确
- 以恢复工作为目标
- 不替代正式决策文档
- 不承担高频协作噪音

## Implications for assistant-context-router
针对当前项目，至少应明确分开以下对象：

### Identity layer
- `project.yaml`
- 项目 README

### Discovery layer
- brainstorm / feasibility / kickoff / exploratory materials

### Decision layer
- Step 2 strategy
- implementation decisions
- 结构/边界类正式说明

### Working-state layer
- 当前阶段
- 当前主线
- 上次中断点
- 下一步
- pending decisions

### Collaboration layer
- `collab.md` 这类高频协作面板

### Validation layer
- Step 2 context / routing validation design
- acceptance / evaluation notes

### Archive layer
- 被吸收或不再作为当前真相的旧材料

## Rebuild direction
后续文档重构应遵守：
1. 先按对象与角色分类，再决定放在哪个目录
2. 先确定 working-state 宿主，再定义 Step 2 project context
3. 先把 discovery / decision / collaboration / validation 分开，再做导航优化
4. 任何单个目录都不应长期同时承载“探索、决策、协作、验证”四种角色

## Immediate next step
下一步不是直接定义 Step 2 context，而是：
1. 基于本说明，对当前项目现有文档做角色盘点
2. 确认哪些文档属于 identity / discovery / decision / working-state / collaboration / validation / archive
3. 基于盘点结果提出新的目录与迁移方案
4. 再进入重构执行与 review
