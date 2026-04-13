# Project Doc Object Schemas

## Purpose
为当前 `assistant-context-router` 项目定义三类核心 doc objects 的 schema：
- `README.md`
- `STATUS.md`
- `RESUME.md`

本文件的目标是：
1. 防止三个门厅文档职责漂移
2. 为 Step 2A 的 project context definition 提供稳定对象定义
3. 为未来 collab skill / doc-driven handoff skill 提供可提升的初始化模板基础

## Design principle
对于文档驱动、多 agent 协作型项目：
- `README.md`
- `STATUS.md`
- `RESUME.md`
- `execution/COLLAB.md`

应被视为**核心 doc objects**，而不是随意命名的普通 markdown 文件。

它们需要：
- 明确角色
- 明确 schema
- 明确更新频率
- 明确写入责任
- 明确禁止混入的信息类型

---

# 1. README.md schema

## Role
`README.md` 是项目的 **long-lived identity doc**。

它回答：
- 这个项目是什么
- 为什么存在
- 当前解决什么问题
- 长期目标与边界是什么
- 这个项目的主要入口和目录角色是什么

## Update frequency
- 低频更新
- 只在项目定义、边界、入口结构、阶段 framing 明显变化时更新

## Recommended sections
### 1. What this project is
项目定义、核心目标、长期方向。

### 2. What this README does
说明 README 的职责与非职责。

### 3. Current phase
当前大阶段（只需大阶段，不写高频执行状态）。

### 4. Project goals
项目当前要解决的核心问题。

### 5. Non-goals (current stage)
当前明确不做什么，避免范围漂移。

### 6. Top-level reading order
门厅级阅读顺序。

### 7. Key project docs
当前关键文档入口。

### 8. Directory roles
主要目录承担什么角色。

### 9. Upstream context
如有必要，列出上游研究或依赖背景。

## Should contain
- 长期稳定的项目定义
- 长期边界
- 顶层导航
- 目录角色说明

## Should not contain
- 高频 next actions
- 临时中断点
- 高频协作细节
- 每轮工作进展日志
- 细粒度 handoff 内容

## Typical owner
- coordinator agent 负责收口
- project owner 可 review / 拍板

---

# 2. STATUS.md schema

## Role
`STATUS.md` 是项目的 **executive summary / current state entry**。

它回答：
- 这个项目现在整体进行到哪了
- 已完成了哪些主要块
- 当前主线是什么
- 还缺什么
- 新加入者下一步应该往哪看

## Update frequency
- 中频更新
- 在阶段变化、里程碑完成、当前入口变化、已确认结论更新时更新
- 不要求每轮小动作都更新

## Recommended sections
### 1. File role statement
说明 STATUS 的职责与非职责。

### 2. TL;DR
一句话说明当前状态。

### 3. Current phase
项目当前所在阶段。

### 4. Completed by module
按模块总结已完成事项。

### 5. Confirmed conclusions
当前已确认、用于防止回滚的结论。

### 6. Remaining gaps
仍未完成的重要缺口。

### 7. Next step
从当前阶段回到主线后，下一步应做什么。

### 8. Reading order
给新加入者/未来自己的推荐阅读顺序。

## Should contain
- 项目阶段总收口
- 已完成的大块内容
- 当前主线总结
- 已确认边界
- 进入下钻的导航

## Should not contain
- 实时中断点
- 临时 task list
- 高频 pending 小问题
- 大量 execution chatter
- 原始对话摘抄

## Typical owner
- coordinator agent 负责收口与更新
- project owner 可 review / 拍板
- 其他 agent 不直接把高频工作细节写成 STATUS 主体内容

---

# 3. RESUME.md schema

## Role
`RESUME.md` 是项目的 **resume point / working-state doc**。

它回答：
- 如果我现在要继续这个项目，应该从哪里接上
- 当前主线任务是什么
- 最近刚完成了什么
- 上次停在哪
- 接下来先做什么
- 当前有哪些 pending decisions / guardrails

## Update frequency
- 高频更新
- 在主线推进、中断点变化、handoff、阶段性收口时更新
- 可以成为 conversation compaction 的落点之一

## Recommended sections
### 1. Purpose
说明 RESUME 的职责与非职责。

### 2. Current phase
当前工作所处阶段。

### 3. Current mainline
当前实际主线任务是什么。

### 4. Recently completed
最近已经完成了什么。

### 5. Last interruption point
上次中断点 / 当前恢复点。

### 6. Immediate next actions
从这里继续时，优先做什么。

### 7. Pending decisions
当前仍待拍板的问题。

### 8. Resume reading order
恢复前应先读哪些文档。

### 9. Guardrail
继续推进前不能越过哪些边界。

## Should contain
- 当前主线
- 最近完成
- 中断点
- next actions
- pending decisions
- 恢复工作所需最小提示

## Should not contain
- 长篇项目背景介绍
- 阶段总收口大全
- 原始 conversation transcript
- 高频协作原始噪音
- 过度细碎的逐条日志

## Typical owner
- coordinator agent 负责维护与收口
- 其他 agent 可以提供 compacted state 候选
- 若未来引入 compaction 机制，可作为主要落点之一

---

# 4. Relationship between the core docs

## README → STATUS → RESUME → COLLAB
推荐理解顺序：
1. `README.md`
   - 这个项目是什么
2. `STATUS.md`
   - 这个项目现在整体怎么样
3. `RESUME.md`
   - 这个项目现在从哪里接着干
4. `execution/COLLAB.md`
   - 多个 agents 现在如何协作流转

## They are not substitutes
这些不是重复文档，而是连续层：
- README = identity layer
- STATUS = current-state layer
- RESUME = working-state layer
- COLLAB = collaboration layer

---

# 5. Write responsibility rules

## Rule 1
高频协作过程不要直接污染 `README.md` / `STATUS.md`。

## Rule 2
需要恢复工作的细节优先沉淀到 `RESUME.md`，而不是堆到 `STATUS.md`。

## Rule 3
项目定义与长期边界的变化只应写入 `README.md`。

## Rule 4
阶段结论与当前总收口应优先写入 `STATUS.md`。

## Rule 5
如果某段对话内容对恢复工作有价值，应优先 compact 后进入 `RESUME.md`，而不是直接复制 raw conversation。

---

# 6. Skill implication
本文件中的核心 doc object schema，应被视为未来 collab skill / doc-driven handoff skill 的候选初始化模板。

也就是说，未来对这类项目进行初始化时，skill 应能帮助建立：
- `README.md`
- `STATUS.md`
- `RESUME.md`
- `execution/COLLAB.md`

以及它们的：
- 默认 section 模板
- 更新职责
- 文档角色说明
- 与其他 bucket（docs map / collab / conversation archive）的关系

## Not yet
当前阶段，这些 schema 仍先作为项目内定义运行；
不在本轮直接打包成正式 skill。
