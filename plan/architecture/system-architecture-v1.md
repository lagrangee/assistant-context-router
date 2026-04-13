# System Architecture v1

## Purpose
为 `assistant-context-router` 定义一份顶层系统架构说明，明确这不是一个绑定 `OpenClaw + Codex` 的单点方案，而是一套：

- 以 project docs 为真相层
- 以 secretary runtime 为协作入口
- 以专业 agent 为执行面
- 以 memory / orchestration 为可插拔核心模块
- 以 human-in-the-loop 为治理原则

的长期演进架构。

## North Star

> 一个 personal-first 的 AI secretary collaboration system：秘书层维护长期上下文与协作控制，专业 agent 承担项目执行，项目文件作为跨 agent / 跨 runtime 的主真相，人类保留 review、决策与 takeover 权。

默认关系：
- project owner 主要与 coordinator agent 交互
- coordinator agent 负责摘要、编排、转述、收口
- 外部 agents 负责专业执行
- 人类不是消息总线，而是 review / decision / takeover owner

## Layer Model

### 1. Project Truth Layer
稳定真相层，默认包括：
- `README.md`
- `STATUS.md`
- `RESUME.md`
- `execution/COLLAB.md`

职责：
- 定义项目长期身份
- 表达当前阶段
- 提供可恢复工作态
- 承载多 agent 流转对象

约束：
- 这是跨 runtime、跨 session、跨 agent 的主真相
- 任何 adapter 都不能替代这一层

### 2. Project Switching & Recovery Layer
主要入口：
- `/projects`
- `/project`
- `/save`

职责：
- 显式切换项目边界
- 恢复当前项目 working state
- 将当前工作态收回到 project truth host

当前原则：
- hall-doc-first
- bounded by default
- `/project` 负责进入
- `/save` 负责 conversational 收口：先 draft、后确认、再 apply

### 3. Context Assembly Layer
职责：
- 构建默认 project context
- 定义 optional buckets
- 约束默认注入预算

默认方向：
- identity / status / resume first
- optional bucket 按需下钻
- 不把 full conversation 或 collab panel 作为默认注入

### 4. Memory Layer
memory 是一级核心模块，但不能替代真相层。

本层分三类：

#### Project Truth
- 项目文件对象
- 不属于 memory backend

#### Working Memory
- session/project/workflow/recent route trace/current working set

#### Long-Term Memory
- 用户偏好
- 长期关系
- 历史模式
- conversation-derived recall
- archive recall

约束：
- memory backend 只能增强 recall / continuity
- 不能替代 `STATUS.md` / `RESUME.md`
- 不能成为 `/project` 的 authoritative source

### 5. Routing Layer
职责：
- 处理 project / protocol / workflow 分层
- 产出 route trace
- unresolved 时 safe-fail

当前定位：
- Step 2 的主交付层
- 建立在 Step 1.5 recovery baseline 之上

### 6. Execution Mode / Backend Layer
这一层负责“怎么执行”，不是“什么是真相”。

可能后端：
- ACP
- native thread
- LangGraph
- OpenAI Agents SDK
- future workflow runtimes

约束：
- orchestration backend 不得 host project truth
- orchestration backend 不得单独定义 human governance
- collaboration policy layer 不等于 orchestration engine

### 7. Secretary Adapter Layer
当前 / 未来 secretary runtime 适配层：
- OpenClaw today
- Hermes tomorrow
- future secretary runtimes

### 8. Execution Agent Adapter Layer
当前 / 未来专业 agent 适配层：
- Codex today
- Claude / Gemini / future agents

### 9. Visualization / Orchestrator Layer
当前首批宿主：
- `openclaw-feishu-orchestrator`

职责：
- protocol owner / business target 可视化
- workflow visibility
- human observability

### 10. Human Governance Layer
职责：
- escalation
- review checkpoints
- handoff
- takeover rules

默认原则：
- human in the loop, not as the bus
- human can preempt automation
- automation cannot silently preempt human

## Stable Contracts vs Replaceable Adapters

### Stable contracts
这些对象应尽量保持稳定：
- project truth docs
- collaboration policy
- escalation rules
- route semantics
- hall-doc recovery model

### Replaceable adapters
这些层应允许替换：
- secretary runtime
- execution agent runtime
- memory backend
- orchestration backend
- visualization/orchestrator runtime

目标：
- 切换 `OpenClaw -> Hermes`
- 切换 `Codex -> other agent`
- 切换 `OpenClaw memory -> Mem0`
- 切换 `ACP -> LangGraph`

时，不需要重写 project truth / governance / collaboration policy。

## Phase Placement

### Step 1.5
定位：
- 修复 hall-doc recovery baseline
- 不引入 routing / writeback automation / shared collaboration mode

### Step 2
定位：
- 在 Step 1.5 baseline 上叠加 routing policy
- 服务 `proj-openclaw-feishu-orchestrator`

### Step 3+
定位：
- human takeover collaboration
- native thread shared governance
- advanced visibility
- backend replaceability strengthening

## Non-Goals
当前顶层架构明确不做：
- 自研通用 graph runtime
- 替代 LangGraph / OpenAI Agents SDK
- 让所有任务都进入 shared native thread
- 让 memory backend 成为主真相
- 把当前项目直接产品化为通用平台

## Current Recommendation
当前默认 stance：
- personal system first
- project docs as truth
- secretary-mediated collaboration
- ACP as default execution lane
- native thread as opt-in takeover mode
- memory as core module
- orchestration as replaceable execution backend
