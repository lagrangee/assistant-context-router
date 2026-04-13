# 文档治理候选方案（v1）

## 目的
为 `assistant-context-router` 建立可持续扩张的文档管理方式，避免随着 Step、agent 协作、实现与验收推进，项目文档逐步碎片化、重复化、失去当前真相。

本文档当前是**项目内候选方案**，尚未上升为跨项目通用规范或 skill。

## 1. 文档分层

### L0：索引层
回答“从哪开始读、哪些是权威、哪些只是过程文档”。

建议入口：
- `docs/README.md`

### L1：权威结论层
沉淀长期有效、后续实现可引用的稳定结论：
- `plan/`
- `decisions/`
- `contracts/`
- 项目根 `README.md` 的稳定部分

### L2：执行层
承载操作、验证、发布、运行所需材料：
- `runbooks/`
- `checklists/`
- `releases/`

### L3：过程层
承载高频变化、短生命周期、协作过程材料：
- `implementation/plugin/progress/`
- `collab.md`
- `codex-stepN.md`

### Archive：历史层
承载不再作为当前真相、但仍需保留的历史文档：
- `docs/archive/`

## 2. 文档新增规则
新增文档前先回答：

1. 这是稳定结论吗？
- 是：进入 `plan/` / `decisions/`

2. 这是执行说明吗？
- 是：进入 `runbooks/` / `checklists/`

3. 这是过程协作材料吗？
- 是：进入 `progress/`

4. 这是历史资料吗？
- 是：进入 `docs/archive/`

## 3. 文档合并规则
出现以下信号时，应优先合并或升格，而不是继续新增：

- 同一主题已经出现第二份文档
- `progress/` 文档开始承载稳定结论
- `plan/` 文档混入调试流水或协作噪音
- 多个文档重复定义同一范围、边界或 acceptance

### 合并原则
- 稳定结论：从 L3 升格到 L1
- 过程噪音：保留在 L3
- 过时内容：移动到 Archive

## 4. 协作面板规则
`progress/collab.md` 只承载当前有效协作状态，不应成为长期事实源。

### 允许写入的内容
- 当前目标
- 已确认事实
- 开放问题
- request / reply 摘要
- blocked by / needs decision

### 不应写入的内容
- 长聊天记录
- 已稳定但未升格的长期结论
- 大量重复背景

## 5. Step 文档规则
每个 Step 至少应有两类文档：

1. 策略 / 范围 / 验收文档
- 放在 `plan/`

2. 进展 / 收尾 / 实机验证文档
- 放在 `progress/`

### 最小要求
- Step strategy 文档回答：做什么、不做什么、如何验收
- Step closure 文档回答：做成了什么、验证了什么、哪些 caveat 被接受

## 6. 当前项目内的候选边界
本文档当前仅服务于 `assistant-context-router` 项目，不自动外推到其他项目。

只有在以下条件满足后，才考虑升格为通用规范或 skill：
- 已在多个外部 agent 协作回合中稳定使用
- Request / Reply / step handoff 结构被证明足够稳
- 文档分层、升格、归档规则被证明不会产生新的维护负担

## 7. 下一步建议
- 使用本候选方案继续推进 `assistant-context-router` 的 Step 2 文档与协作
- 在当前项目内继续观察其稳定性
- 待 coordinator agent 统一收口后，再判断是否抽象为跨项目 skill
