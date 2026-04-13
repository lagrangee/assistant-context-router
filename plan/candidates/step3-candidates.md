# Step 3 Candidates

## Purpose

保存 Step 2 之外、但已在协作讨论中形成较清晰方向的后续候选能力。

本文件不是 Step 3 承诺范围，也不是当前开发计划。
它的作用是：

- 防止高质量讨论遗失在聊天历史里
- 明确哪些内容**不应塞进 Step 2**
- 为 Step 2 完成后的下一阶段评审提供候选池

## Positioning

当前项目节奏：

- Milestone 1：Project Switch & Recovery
- Milestone 2-4：Multi-tasking / delegation / routing & visualization
- Milestone 5：Memory Integration
- Milestone 6+：Human Takeover Collaboration / Runtime Replaceability

因此，本文中的内容统一视为：

> post-Milestone-4 collaboration architecture candidates

## Candidate Group A — ACP Visible Mode

### Why

project owner 认为看到 coordinator agent 与外部 agent 的中间过程有价值，价值包括：

- 学习 agent 协作方式
- 了解推进进度
- 在必要时纠偏

但 project owner 直接进入 ACP runtime 的频率应保持很低。

### Candidate items

- ACP visible mode v1
- visibility levels:
  - `quiet`
  - `progress`
  - `transcript`
- `streamTo: "parent"` 作为进度回流基础
- `streamLogPath` 作为 transcript 补充来源
- `tasks` 作为状态外壳
- transcript 摘录 / replay 策略

### Why not in Step 2

因为它会把当前项目从 project/routing 稳定性问题，扩展成 user-facing collaboration productization。

## Candidate Group B — Native Thread Takeover Mode

### Why

验证表明：

- OpenClaw 可以通过 native Codex session 与 Codex 做持续多轮协作
- project owner 可以在 Codex CLI 中看到并接手同一条 thread

这使 native thread 成为高价值协作中的 takeover 优化模式。

### Candidate items

- native thread 作为 opt-in takeover mode
- 何时应从 ACP 升级到 native thread
- execution mode 作为显式产品概念
- `ACP` / `native-thread` 双模调用策略

### Why not in Step 2

因为当前客户目标并不要求把 execution mode 做成第一等用户产品能力。

## Candidate Group C — Shared Thread Governance

### Why

如果未来允许 project owner、coordinator agent、agent 围绕同一条 native thread 协作，就必须有最小治理协议。

### Candidate items

- speaker protocol
  - `[coordinator-agent]`
  - `[coordinator-agent][instruction]`
  - `[coordinator-agent][summary]`
  - `[coordinator-agent][pause]`
- shared thread contract
- owner / lock / handoff
- single active writer
- human preempts automation
- automation fallback to ACP
- shared thread lifecycle / rotate / stale lock handling

### Why not in Step 2

因为这已经进入 shared collaboration container 设计，不属于当前客户协作稳定性的最小策略层。

## Candidate Group D — Human Collaboration UX Layer

### Why

当前已形成一个清晰的偏好：

- project owner 主要对 coordinator agent 发指令
- coordinator agent 负责代理与收敛
- project owner 低频介入，但需要可见性

### Candidate items

- mediated collaboration UX
- progress-first, transcript-on-demand
- decision checkpoint / pause-and-report pattern
- human takeover optimized mode
- visible collaboration as product capability, not debug feature

## Candidate Group E — Future Backend Integration

### Why

已讨论过：未来不必自研通用 orchestration engine，可考虑把现有框架作为执行后端。

### Candidate items

- LangGraph as optional orchestration backend
- OpenAI Agents SDK as optional execution backend
- Collaboration policy layer vs orchestration engine boundary
- unified execution backend interface

### Warning

若未来进入这一方向，必须避免：

- 双重状态系统
- 同时维护 OpenClaw session / graph state / native thread state 为主真相
- 把协作层误做成新的通用 runtime

## Current Recommendation

当前建议：

1. Milestone 1-4 不吸收本文内容进入主 scope
2. 仅将其中少数最小约束写回 Step 2 文档
   - 例如：默认 ACP、advanced collaboration defer
3. Milestone 4 完成后，再统一评审这些 candidates 是否值得组成 Milestone 6+

## Candidate Snapshot

当前较值得保留、后续再评审的候选：

- ACP visible mode v1
- native thread takeover mode
- shared thread governance
- mediated human-visible collaboration UX
- optional LangGraph / Agents SDK backend integration

## Next Review Trigger

建议仅在以下条件满足后，再正式打开 Step 3 讨论：

- Milestone 4 已完成并验收
- `openclaw-feishu-orchestrator` 作为首批客户已稳定受益
- 确认真正存在“Step 2 无法解决，但协作层升级能解决”的明确缺口
