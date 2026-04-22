# COLLAB Object Definition

## Purpose
定义 `COLLAB.md` 作为项目级 **multi-agent collaboration object** 的角色、位置、命名、schema，以及它与 `RESUME.md` 的关系。

本文件同时承接一个更高层的协作原则：

> **human in the loop, not as the bus**

也就是说：
- project owner 负责 discovery、review、decision、验收
- coordinator agent 负责编排、收口、维护工作态、驱动其他 agents 协作
- 其他 agents 负责读取项目对象、执行任务、回写结果
- 人类不是消息总线，不再负责在两边人工搬运长上下文

## Why COLLAB is a core object
`COLLAB.md` 不再只是一个临时协作面板，而是：
- 多 agent 协作协议的宿主文档
- handoff / writeback / review / blocked / need decision 的项目级对象
- 让协作从“人肉传话”升级为“文档驱动流转”的核心设施

因此它需要：
- 明确 schema
- 明确位置
- 明确更新规则
- 明确与 `RESUME.md` 的边界

## Recommended location and naming
当前推荐：
- 位置：`execution/COLLAB.md`
- 命名：`COLLAB.md`

理由：
1. 它是项目级 execution object，不应绑死在 plugin/progress 子路径下
2. 它不属于根目录门厅层，不应与 `README.md` / `STATUS.md` / `RESUME.md` 混层
3. 它比 `collab.md` 更像一个正式对象，而不是普通 note

## Role
`COLLAB.md` 回答的是：
- 当前有哪些 agent / 角色在协作
- 谁负责什么
- 正在流转哪些 work items
- 最近 handoff / writeback 是什么
- 哪些事项需要 review / decision / unblock

## Non-role
`COLLAB.md` 不承担：
- 项目长期定义（那是 `README.md`）
- 项目阶段总收口（那是 `STATUS.md`）
- 单一工作线程的最终恢复点（那是 `RESUME.md`）
- 原始对话归档

## Relationship with RESUME
### RESUME
- 写“项目如何继续”
- 面向单线程恢复工作
- 收口当前主线、下一步、pending decisions、guardrails

### COLLAB
- 写“协作如何流转”
- 面向多 agent 分工、handoff、writeback、review、blocked
- 允许出现多个 active work items

### Rule of distinction
若同一信息同时影响两者：
- 在 `COLLAB.md` 中保留**流转版**
- 在 `RESUME.md` 中保留**收口版**

示例：
- `COLLAB.md`：Codex 正在准备 routing matrix cases，待 coordinator agent review
- `RESUME.md`：当前主线将在 Step 2A 之后进入 routing matrix case review

## Schema

### 1. Purpose / Role
简述本文件是什么、不是什么。

### 2. Collaboration model
写清当前协作原则，例如：
- human in the loop, not as the bus
- 谁负责编排
- 谁负责执行
- 谁负责 review / decision

### 3. Participants / Roles
列出当前参与方与职责，例如：
- project owner
- coordinator agent
- Codex
- Claude
- Gemini

### 4. Working agreements
协作约定，例如：
- 何种结论进入正式文档
- 何种内容只留在 COLLAB
- 外部 agent 回复格式
- 何时需要升级到 human review

### 5. Active work items
当前活跃协作事项列表。

每个 item 建议包含：
- `id`
- `title`
- `owner`
- `status`
- `objective`
- `current_state`
- `next_handoff`
- `related_docs`
- `needs_review` / `needs_decision`（可选）

### 6. Recent handoffs / writebacks
记录最近一次有价值交接：
- 谁回写了什么
- 结论去向哪里
- 是否需要 coordinator agent 收口

### 7. Need review / need decision
集中列出当前需要 project owner 或 coordinator agent 决策/评审的点。

### 8. Closed items (optional)
简短保留近期关闭项，防止文件无限膨胀。

## Update frequency
- 高频更新
- 当 multi-agent 协作推进、handoff、blocked、review request 发生时更新

## Should contain
- agent roles
- current work items
- handoff / writeback
- review / decision requests
- structured blocked state

## Should not contain
- 长篇项目背景
- 项目阶段总收口大全
- 单线程 resume 总结
- 原始长聊天记录
- 大量已过时 closed history

## Typical owner
- coordinator agent 负责维护对象结构与正式收口
- 外部 agents 可按协议回写结构化摘要
- project owner 只在需要 review / decision 时介入

## Skill implication
`COLLAB.md` 应被视为未来 collab skill / doc-driven handoff skill 的第四个核心对象，与以下对象并列：
- `README.md`
- `STATUS.md`
- `RESUME.md`
- `COLLAB.md`

这意味着未来 skill 初始化时，除了门厅三件套，还应能建立：
- execution-level collaboration object
- collaboration schema
- handoff / review / decision protocol

## Recommended next step
1. 将现有协作文档从 `implementation/adapters/openclaw/plugin/progress/collab.md` 迁移到 `execution/COLLAB.md`
2. 用本文件定义的 schema 逐步重写协作文档
3. 再让后续 agents 按新对象继续协作
