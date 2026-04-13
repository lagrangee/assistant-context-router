# Collaboration System Definition v1

## Purpose

这份文档定义 assistant-context-router 项目当前采用的协作系统基线，用来统一 Human、OpenClaw agent (`coordinator-agent`) 与外部 agents 之间的项目协作方式。

本文件现在被定位为：
- 协作子系统定义
- 不是整个项目的最高层架构说明

更高一层的系统定义见：
- `../plan/architecture/system-architecture-v1.md`
- `../plan/architecture/roadmap-milestones-v1.md`

目标不是发明新的通用 agent framework，而是把以下三件事收成一个稳定工作系统：

- project-centric 的工作入口与切换
- 基于文件状态的可恢复协作
- ACP / native thread 双模执行与人机协作治理

不解决：

- 通用 graph runtime / generic orchestration engine
- 替代 LangGraph / OpenAI Agents SDK 这类底层编排框架
- 让所有任务都进入 shared native thread

## System Summary

当前 collab system 的核心由四部分组成：

1. `/project` / `/projects`
2. project state as files
3. execution modes: ACP + native thread
4. human collaboration policy

一句话概括：

> 这套系统把“项目文件状态 + 多执行通道 + 人机协作协议”收成一个可切换、可恢复、可接管的工作系统。

在顶层架构中的位置：
- 它主要覆盖 `Execution Mode / Backend Layer`
- `Secretary Adapter Layer`
- `Human Governance Layer`
- 与 `Project Truth Layer` 的协作关系

## 1. Project Entry

### `/projects`

用于列出项目宇宙，帮助 Human / OpenClaw agent (`coordinator-agent`) / 外部 agent 在项目层面完成定位。

### `/project <id>`

用于显式切换当前工作 project context。

这层的作用不是“打开一个聊天话题”，而是：

- 绑定当前项目语义
- 切换当前恢复点
- 切换当前 project state 的读取/写入对象
- 为后续 context loading 和 route decision 提供稳定锚点

## 2. Project State As Source Of Truth

当前系统明确采用：**文件状态优先**。

也就是：

- 不把长期协作状态寄托在某个 agent 的脑内 session
- 不依赖主会话长历史来“回忆项目现状”
- project 当前状态、恢复点、关键结论尽量落盘

这样做的意义：

- 可跨 session / 跨 channel / 跨 agent 恢复
- 降低 context switch 成本
- 降低 session 污染与历史绑定
- 让 OpenClaw agent (`coordinator-agent`) 与外部 agents 围绕同一份项目状态协作

### Design rule

项目协作中的“当前真相”优先落在 project 文件上，而不是仅存在于：

- 主会话上下文
- 某个 ACP session
- 某个 native Codex thread

Session/thread 是协作通道，不是唯一真相容器。

## 3. Execution Modes

当前执行通道分为两类：

- `ACP`
- `native thread`

### 3.1 ACP

ACP 是默认执行通道。

适合：

- 一次性任务
- 批处理 / 自动化 / cron
- 不需要 Human 直接接手的任务
- 过程价值低、结果价值高的任务
- 需要更干净隔离的执行任务

定位：

> ACP = default execution lane

### 3.2 Native Thread

native thread 是高级协作模式，不是默认模式。

适合：

- 高价值、长期协作任务
- Human 很可能亲自接手继续推进
- 需要共享同一条真实 agent thread
- 需要保留完整协作轨迹
- 需要在 Codex CLI 中直接可见并继续

定位：

> native thread = opt-in takeover mode for high-value collaborative work

### 3.3 Default Rule

默认规则：

- 默认：`ACP`
- 只有在“Human 大概率要亲自接手同一条 agent 对话”时，才启用 `native thread`

## 4. Human Collaboration Policy

当前协作系统的基本关系不是“Human 直接操作所有 agent”，而是：

- Human 主要对 OpenClaw agent (`coordinator-agent`) 说
- OpenClaw agent (`coordinator-agent`) 负责编排与代理协作
- 外部 agents 通过 ACP 或 native thread 参与执行/协作

也就是：

> 默认是 mediated collaboration，不是 fully direct collaboration。

### Why

这样做的好处：

- Human 保持对系统的低频介入
- OpenClaw agent (`coordinator-agent`) 负责整理、转述、收敛、停顿与回报
- 减少人类直接操作外部 runtime 带来的上下文分裂

## 5. ACP Visible Mode

ACP 不应是纯黑盒。

当前共识：Human 看到 OpenClaw agent (`coordinator-agent`) 与外部 agent 的中间过程是有价值的，价值包括：

- 学习 agent 协作方式
- 跟踪实际进度
- 在必要时纠偏

但 Human 直接进入 ACP runtime 对话的频率应该很低。

### v1 visibility levels

- `quiet`: 只看最终结果
- `progress`: 看阶段性进度回执（默认）
- `transcript`: 看关键轮次，必要时展开更多

### v1 implementation baseline

优先复用现有 OpenClaw ACP 能力：

- `streamTo: "parent"`：用于进度摘要回流
- `streamLogPath`：用于 transcript 级补充来源
- `tasks`：用于状态与生命周期可见性
- `resumeSessionId`：用于持续 ACP session
- `sessions_history`：用于任务后关键历史摘录

### UX rule

ACP 模式下：

- Human 可以看见进度
- 但主要仍然对 OpenClaw agent (`coordinator-agent`) 发指令
- OpenClaw agent (`coordinator-agent`) 决定是否把 Human 的意见转写给 ACP agent

## 6. Native Thread Shared Collaboration

native thread 的价值，不在于替代 ACP，而在于降低高价值任务中的人工接管成本。

### Positioning

native thread 不是默认容器，而是：

- shared collaboration container
- manual takeover optimized mode
- high-value / low-frequency capability

### When it matters

只有在这些场景下才真正值钱：

- 长任务、多轮协作
- Human 预计会中途 takeover
- 过程本身也有价值（学习 / 审计 / 复盘）
- 不想在 OpenClaw 与原生 agent thread 之间重复转述

## 7. Shared Thread Protocol

当启用 native thread 时，必须启用 shared thread protocol。

### 7.1 Speaker Protocol

MVP 采用前缀协议：

- OpenClaw agent (`coordinator-agent`) 发言前缀：`[coordinator-agent]`
- 无此前缀的用户发言，默认视为 Human

推荐进一步细化为：

- `[coordinator-agent][instruction]`
- `[coordinator-agent][summary]`
- `[coordinator-agent][question-for-agent]`
- `[coordinator-agent][pause]`

### 7.2 Thread Contract

shared native thread 开头应存在一段短协作约定，至少说明：

- 这是多人协作 thread
- `[coordinator-agent]` 前缀代表 OpenClaw agent (`coordinator-agent`) 的编排发言
- 无此前缀的发言默认来自 Human
- agent 应把双方视为共享讨论参与者
- 若出现 `[coordinator-agent][pause]`，应停下等待下一步指令
- 若 Human 与 OpenClaw agent (`coordinator-agent`) 指令冲突，以最近的 Human 明确指令为准

### 7.3 Ownership / Lock / Handoff

最小治理规则：

- single active writer
- explicit owner
- write requires lock
- human can preempt automation
- automation cannot preempt human
- owner change requires explicit handoff

### 7.4 Automation Rule

- `cron / automation / unattended run` 默认不得进入 human-owned native thread
- 遇到冲突时默认：`fallback to ACP`

## 8. Current Product Stance

当前这套 collab system 的产品立场是：

- project state 是协作真相的主锚点
- ACP 是默认执行通道
- native thread 是可选 takeover mode
- Human 对 agent 的介入默认低频
- OpenClaw agent (`coordinator-agent`) 是默认代理协作者
- visible mode 是协作能力，不只是 debug 功能

## 9. Non-Goals

当前不做：

- 自研通用多 agent graph runtime
- 替代 LangGraph / OpenAI Agents SDK
- 让 native thread 成为默认工作模式
- 让所有自动化直接写入 shared thread
- 把 raw transcript 默认直播到主对话

## 10. Implication For Assistant Context Router

对 assistant-context-router 项目而言，这套协作系统意味着：

1. `/project` / `/projects` 不是附属功能，而是项目协作入口
2. router 不只负责消息分流，还要考虑 project state / execution mode / visibility mode
3. current project state 必须尽量文件化，避免把协作真相锁死在某个 session/thread 中
4. agent execution 需要明确区分：
   - ACP default lane
   - native thread takeover lane
5. route decision 不只回答“去哪一个 project”，还应在必要时回答：
   - 用哪个执行通道
   - 采用什么可见性
   - 是否允许 shared thread

## 11. Current Decision Snapshot

当前已确认的决策：

- 使用 `/project` / `/projects` 做项目级状态切换
- project state 采用文件状态优先
- 默认执行通道为 ACP
- native thread 作为 opt-in takeover mode
- ACP 默认可见性采用 `progress`
- automation 遇到 human-owned native thread 时默认 fallback 到 ACP
- shared thread 采用 speaker protocol + owner/lock/handoff 最小治理

## 12. Next Step

基于这份定义，assistant-context-router 接下来的实现应优先推进：

- `/projects` / `/project` 的可用实现面
- current project state 的最小落点
- route decision 中 execution mode / visibility mode 的最小判定
- assistant-context-router 作为首个采用这套 collab system 的项目客户

## 13. Relationship to Top-Level Architecture
本文件默认遵守以下顶层结论：
- project docs 是主真相
- memory 是核心模块，但不替代真相层
- orchestration backend 是可替换执行后端，不是系统主轴
- native thread 继续保持高价值升级模式
