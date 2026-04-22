# Save Mode Contract Candidate

## Purpose
定义 `/save` 的候选执行契约，明确它在当前项目中的角色不是“从零重建上下文”，而是：

- 利用 OpenClaw agent (`coordinator-agent`) 已经持有的当前工作上下文
- 将这些上下文约束到 **当前绑定 project**
- 产出适合写入 `STATUS.md` / `RESUME.md` 的 continuity-first draft

本文档当前是项目内候选规范，不是最终通用 skill。

## Core stance
`/save` 的主要问题不是“coordinator-agent 没有上下文”，而是“coordinator-agent 可能把同一 session 中不属于当前 project 的内容一起总结进去”。

因此 save mode 的首要职责是：
- project scoping
- output shaping
- writeback safety

而不是：
- 冷启动补课
- 全量重读历史
- 自动生成完整项目纪要

## Save mode assumptions
默认前提：
- Human 触发 `/save` 时，通常已经和 OpenClaw agent (`coordinator-agent`) 在当前 project 上工作了一段时间
- `coordinator-agent` 已经拥有足够的近期工作上下文
- hall docs 的职责主要是：
  - truth anchor
  - writeback host
  - continuity correction

因此 `/save` 默认不应被设计成重 handoff 或冷启动 compaction。

## Save mode goals
当 `/save` 被触发时，save mode 应帮助 `coordinator-agent`：

1. 识别当前唯一有效的 project boundary
2. 只保留与当前 project 一致的工作态
3. 将工作态压缩成适合下次恢复工作的 hall-doc draft
4. 明确等待 human confirm，再 apply

## Save mode inputs
### Primary sources
- 当前 project binding
- 当前对话中的近期有效工作上下文
- 当前项目 hall docs：
  - `STATUS.md`
  - `README.md`
  - `RESUME.md`

### Secondary sources
- 当前 session state
- route trace
- 必要时少量近期 archive / inbox 片段

### Default non-sources
- 全量 conversation log
- 全量 inbox archive
- `execution/COLLAB.md` 作为默认 save source
- 其他 project 的 docs

## Save mode rules
### 1. Project boundary rule
`/save` 只允许为当前绑定 project 生成 draft。

若同一 session 中讨论过多个 project：
- 默认只保留与当前绑定 project 一致的内容
- 其他内容视为噪音，除非它们被明确重新锚定到当前 project

### 2. Current-conversation-first rule
当前对话是主来源。

hall docs 的作用是：
- 校正当前 draft
- 防止与 project truth 冲突
- 作为最终 writeback 宿主

hall docs 不是 save mode 的主叙述来源。

### 3. Continuity-first rule
输出优先服务“下次如何继续工作”，而不是“本轮聊了什么”。

优先保留：
- 当前阶段
- 当前主线
- 下一步
- 必要的待决策 / 风险
- guardrails

默认不保留：
- 长对话复述
- 情绪性 chatter
- 大量治理性背景
- 非当前项目内容

### 4. Preview-in-chat rule
`/save` 默认应先在对话里展示 summary + draft，而不是直接落盘。

`/save apply` 才真正写入：
- `RESUME.md`
- `STATUS.md`

### 5. No silent write rule
在当前项目阶段，`/save` 不能 silent write。

原因：
- hall docs 是 truth host
- continuity writeback 对后续恢复影响很大
- 需要 human-in-the-loop

## Output contract
### Conversational summary
`coordinator-agent` 的对话式说明应回答：
- 我准备更新哪些文件
- 这次 save 保留的核心点是什么
- 如果 Human 不满意，可以如何纠偏

### Draft blocks
draft 必须可提取、可 apply、可审查。

建议保留：
- `RESUME.md` draft
- `STATUS.md` draft

机器可提取 block 只是实现细节；真正重要的是：
- 可明确区分 summary 和 draft
- 可确认后写入
- 失败时不落盘

## Quality bar
一个合格的 save draft 不一定“总结得漂亮”，但必须满足：

1. 不跨 project 污染
2. 能帮助下次恢复工作
3. 能看出当前主线和下一步
4. 不把旧 baseline / 过时共识误写成当前主线

## Relationship with hall docs
### `RESUME.md`
更偏“重新开工入口”：
- 当前阶段
- 当前主线
- 下一步
- guardrails

### `STATUS.md`
更偏“当前阶段总收口”：
- TL;DR
- 当前处在哪个阶段
- 下一步往哪里推

因此 save mode 不应把两者写成两份相似总结。

## Relationship with external agents
默认情况下，`/save` 由 OpenClaw agent (`coordinator-agent`) 执行。

外部 agents 的职责是：
- 设计或 review save policy
- 改进 save frame
- 协助提升 summary / draft 质量

外部 agents 不应成为默认 save executor。

## Open questions
1. save mode 是否需要显式“当前 project boundary summary”而不是只给 project id
2. 什么时候应允许少量 archive / inbox recall 进入 save source
3. 何时才算 save draft “足够差”，值得升级给外部 agent 辅助 compaction

## Recommended next step
1. 将 save frame 与 save-mode hook 对齐到本候选契约
2. 用真实 `/save` 实机测试继续观察：
   - 是否仍有跨项目污染
   - 是否还能保留真正的当前主线
3. 通过若干真实工作日后，再决定是否升格为正式 contract
