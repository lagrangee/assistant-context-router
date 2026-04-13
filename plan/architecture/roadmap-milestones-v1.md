# Roadmap & Milestones v1

## Purpose
按用户闭环而不是按纯技术模块，为 `assistant-context-router` 定义长期推进顺序。

## Roadmap Principle
milestone 应回答真实用户价值闭环，而不是只回答“又多了一个技术模块”。

当前路线默认顺序：
1. 先让项目切换与恢复成立
2. 再让多任务与 delegation 稳定
3. 再进入 routing / visualization
4. 再考虑 memory integration
5. 最后才进入 human takeover collaboration 与 runtime replaceability

## Milestone 1 — Project Switch & Recovery
目标：
- `/project` 真正恢复 hall-doc working state
- `/save` 成为 hall-doc writeback utility

当前阶段：
- in progress via Step 1.5 acceptance fix

通过信号：
- assistant 能在切项目后迅速恢复当前阶段与下一步
- hall-doc recovery 成为可靠 baseline

## Milestone 2 — Multi-Task Projecting
目标：
- 多项目切换稳定
- session/project/task 边界不混
- save/resume 闭环更可信

通过信号：
- 多任务下 project continuity 稳定
- 错 project / stale resume 明显下降

## Milestone 3 — Secretary-to-Agent Delegation
目标：
- coordinator agent 先摘要再执行
- 专业 agent handoff bounded、可解释、可恢复

通过信号：
- handoff 质量稳定
- 人类无需做人肉上下文总线

## Milestone 4 — Protocol Routing & Visualization
目标：
- 服务 `openclaw-feishu-orchestrator`
- 支持 protocol/project/workflow 分层
- 强化 safe-fail 与 trace

通过信号：
- protocol owner / business target 不混用
- unresolved target 不误执行

## Milestone 5 — Memory Integration
目标：
- 将 memory adapter 纳入系统
- 明确 working memory / long-term memory / docs truth 的边界
- 支持 OpenClaw memory / Hermes memory / Mem0 等替换能力

通过信号：
- memory 能增强 recall，但不污染 truth layer
- secretary runtime 可切换，project continuity 仍稳定

## Milestone 6 — Human Takeover Collaboration
目标：
- native thread 作为高价值升级模式落地
- shared thread governance 成型
- takeover / pause / handoff 可治理

通过信号：
- 人类可接管高价值协作 thread
- automation / human 不互相踩写

## Milestone 7 — Runtime / Backend Replaceability
目标：
- secretary runtime 与 orchestration backend 可替换
- 不因切 `OpenClaw/Hermes` 或 `LangGraph/Agents SDK` 而重写核心架构

通过信号：
- 适配层替换成本局部化
- project truth / governance / collaboration policy 不重写

## Current Placement
当前项目位置：
- Milestone 1：进行中
- Milestone 2-4：已有策略材料，未进入正式实现
- Milestone 5-7：顶层架构已定义为后续方向，但未进入当前主线

## Gating Rules
- Milestone 1 未通过，不进入 Milestone 2/3 的工程化推进
- Milestone 4 未通过，不打开 Milestone 6 的 shared collaboration 实现
- memory integration 必须在 truth / working memory / long-term memory 边界明确后才进入
- backend replaceability 只在上层 contracts 稳定后推进
