# Cross-Agent Writeback Candidate

## Purpose
定义一套项目内候选规范，回答：

- 当 OpenClaw agent (`coordinator-agent`) 与 external agents 分别在不同 thread/session 中推进工作时
- 哪些结论必须回写
- 回写到哪里
- 如何降低 Human 充当“人肉消息总线”的概率

本文档当前是项目内候选方案，不是通用 skill。

## Core problem
如果 `coordinator-agent` 和 external agents 的协作只依赖 Human 在两边复制粘贴：
- 协作会失真
- continuity 会断裂
- `/save` 只能保存 `coordinator-agent` 自己知道的那部分上下文

因此，协作系统必须包含：

> external agent -> truth docs / collaboration object 的 writeback obligation

## Core stance
需要区分两类“知道了某件事”：

1. **只在当前 thread 有价值**
   - 可以停留在对话中
2. **会影响后续 continuity / scope / collaboration**
   - 必须回写到正式宿主

如果第 2 类信息没有回写，就不应视为“真正完成”。

## What must be written back
以下变化默认需要 writeback：

### Project continuity changes
- 当前阶段变化
- 当前主线变化
- 下一步变化
- guardrail / scope boundary 变化
- 当前恢复路径变化

建议宿主：
- `STATUS.md`
- `RESUME.md`

### Collaboration flow changes
- owner 变化
- handoff 变化
- blocked / need review / need decision
- agent 分工变化

建议宿主：
- `execution/COLLAB.md`

### Long-lived architecture / strategy changes
- 顶层边界变化
- milestone / roadmap 变化
- collaboration policy 变化
- memory / backend boundary 变化

建议宿主：
- 对应 architecture / strategy / candidates docs

## What does not require writeback by default
- 一次性的探索性想法
- 尚未成型的备选方向
- 不影响当前 continuity 的局部讨论
- 仅影响某个临时调试回合的小细节

## Role obligations
### Human
不负责长期充当上下文总线。

主要职责：
- review
- decision
- acceptance
- 指出“这条结论值得正式回写”

### OpenClaw agent (`coordinator-agent`)
默认 continuity owner。

主要职责：
- 维护 `STATUS.md` / `RESUME.md`
- 维护 `execution/COLLAB.md`
- 在 `/save` 或阶段收口时主动回写 continuity 相关结论

### External agents
不是默认 truth host owner，但负有 writeback obligation。

主要职责：
- 当本轮产出改变了项目 continuity / collaboration / architecture
- 必须把建议回写宿主说明清楚
- 在合适时直接更新正式文档，或至少在回复中明确“应写到哪里”

## Writeback host matrix
### `STATUS.md`
适合写：
- 当前阶段总收口
- 当前阶段最新判断
- 当前阶段下一步

### `RESUME.md`
适合写：
- 下次如何继续工作
- 当前卡点
- 当前主线
- 具体下一刀

### `execution/COLLAB.md`
适合写：
- handoff
- ownership
- review / decision / blocked
- multi-agent flow

### Architecture / strategy docs
适合写：
- 稳定边界
- 分层设计
- long-term direction

## Minimum operational rule
每轮重要协作结束时，至少应判断一次：

1. 这轮有没有改变当前 continuity？
2. 这轮有没有改变协作流转？
3. 这轮有没有形成需要长期保留的设计结论？

若答案为 yes，则必须：
- 指明 writeback host
- 执行 writeback，或显式创建待回写项

## Checkpoints
建议在以下时机强制做 writeback check：
- 外部 agent 完成一轮重要策略评审后
- `coordinator-agent` 执行 `/save` 前后
- 项目阶段切换时
- owner / collaboration flow 变化时
- 准备恢复另一个 project 前

## Failure modes to avoid
- Human 被迫反复在 coordinator agent/Codex 间复制粘贴
- external agent 给出关键结论，但没人回写
- `coordinator-agent` 继续按旧文档工作
- hall docs 与真实协作状态分叉

## Enforcement ideas
当前先不做自动 enforcement，只保留候选规则：
- 回复收尾时主动声明“建议回写到哪里”
- `COLLAB.md` 中为高价值事项记录 writeback status
- `STATUS.md` / `RESUME.md` 被视为 continuity acceptance 对象

以后如需增强，可以考虑：
- writeback checklist
- save-time reminder
- collab item schema 中增加 `writeback_required` / `writeback_done`

## Recommended next step
1. 在 `execution/COLLAB.md` 中为当前 Step 1.5 continuity 主线显式记录 writeback expectation
2. 让后续 external-agent 策略回复明确建议 writeback host
3. 继续观察一段时间，再决定是否升格成正式 collab contract
