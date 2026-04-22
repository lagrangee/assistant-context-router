# Execution Backend Boundary

## Purpose
定义 `assistant-context-router` 如何看待 agent-to-agent collaboration / workflow orchestration：

> execution backend 是可替换后端，不是系统真相层，也不是协作治理层。

## Backend Candidates
当前 / 未来可能的 execution backends：
- ACP
- native thread
- LangGraph
- OpenAI Agents SDK
- future workflow runtimes

## Current Position

### ACP
默认执行通道。

适合：
- 隔离执行
- 一次性任务
- 自动化 / cron
- 人类不预期直接 takeover 的任务

### Native Thread
高价值升级模式。

适合：
- project owner 很可能接手同一条 thread
- 多轮协作
- 过程本身也有价值

### LangGraph / OpenAI Agents SDK / Future Runtimes
后续可引入的 execution backend 候选。

定位：
- orchestration / workflow runtime
- interrupt / persistence / tool execution host
- multi-agent backend option

不等于：
- project truth host
- collaboration policy host
- human governance source of truth

## Boundary Rules
1. collaboration policy layer 不等于 orchestration engine
2. orchestration backend 不能 host project truth
3. orchestration backend 不能单独定义 human governance
4. 引入新 backend 时，不能反向吞掉 secretary layer 与 truth layer
5. backend 替换应只影响 adapter 和 execution integration，不应重写 docs truth / recovery / governance
6. runtime adapter layer 与 project-side integration 必须分开：前者 runtime-shared，后者 project-owned

## Why This Boundary Matters
如果不区分边界，系统会滑向：
- 双重状态系统
- graph state / session state / native thread state 互相竞争主真相
- 人类治理规则被 runtime 行为隐式接管

因此当前 stance 是：
- 你们定义 collaboration policy
- 现成框架只做 execution backend

## Runtime Adapter Note
execution backend 之外，还存在一层独立的 runtime adapter layer。

示例：
- OpenClaw runtime adapter
- Hermes runtime adapter

这一层负责：
- 消费 runtime 的 session binding / session identity 结果
- 把 ACR 的 `main session` / `project session` 通用语义映射到 runtime target
- 执行 runtime-specific delivery

当前 OpenClaw runtime adapter MVP 已具备：
- OpenClaw plugin host 的同步注册兼容
- `openclaw_session` 作为首个 runtime-shared adapter
- 通过 `system.enqueueSystemEvent(...)` 将事件排入目标 OpenClaw session，并优先 `runHeartbeatOnce(target=last)` 立即驱动 continuation
- shadow lane 继续作为 fallback / summary / trace read model，而非 authoritative runtime session

这一层不负责：
- project-specific action/payload/business logic
- project-side binding 数据治理

这些应留在 project-side integration。

## Current Recommendation
在 Step 2 前后继续保持：
- ACP = default execution lane
- native thread = opt-in takeover mode
- LangGraph / Agents SDK = future backend candidates
- backend integration defer until higher-level contracts stabilize
