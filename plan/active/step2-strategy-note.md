# Step 2 Strategy Note

## 目标
在 Step 1 已确认的 bounded、session-owned、document-driven baseline 之上，定义 Step 2 的最小策略范围与验证方法；先完成策略评审，不直接进入实现。

## Step 2 问题定义
Step 2 需要回答的不是“再做一个更大的 router”，而是：

1. Step 1 的 minimal project context 是否已足够支撑真实多轮协作？
2. protocol/project/workflow routing 应如何在现有架构上分层叠加？
3. 在以 `proj-openclaw-feishu-orchestrator` 为首批客户的前提下，哪些能力是当前交付真正需要的？
4. 哪些能力应明确留在 Step 2 之外，避免范围失控？

## Confirmed baseline from Step 1
- `/projects` 已可用
- `/project <id>` 已可用
- 当前 tested runtime 下，session-aware 路径依赖 `before_dispatch`
- `before_prompt_build` 已可用于 project context 注入
- Step 1 已被本地 live validation 验收通过

## Step 2 设计原则
1. layering over replacement
   - Step 2 只能在 Step 1 上叠加 routing policy，不重写 Step 1 的 command/store/context 基线。
2. bounded by default
   - 新增能力必须继续遵守 bounded context，不能以“更聪明”为名放大默认上下文。
3. project-state-anchored first
   - 当前 project / workflow / trace 应优先锚定在项目文件对象与 project-scoped state 上，而不是仅依赖 session 内历史。
   - Step 2 不引入 workspace-global memory redesign，但也不将 session-owned state 视为唯一主状态源。
4. safe-fail before convenience
   - unresolved 或冲突场景必须优先保守失败，不能为了“自动化体验”牺牲正确性。
5. protocol-specific before generic
   - 先覆盖一个已知 protocol family，不做大而全 router framework。

## Step 2 scope（建议）
### In scope
- Step 1 minimal context adequacy validation
- protocol/project/workflow routing policy note
- route trace schema 的最小扩展
- unresolved business target project 的 safe-fail policy
- 至多一个首批 protocol family（例如 dispatch/review）

### Out of scope
- progress writeback implementation
- full context engine
- generic router framework
- cross-project memory redesign
- autonomous project inference from vague natural language
- TUI autocomplete patching
- daemonized routing service
- ACP visible mode productization
- native thread shared collaboration mode
- shared thread governance (`owner` / `lock` / `handoff`)
- human takeover protocol
- transcript / progress visibility framework beyond minimal current-session reporting

## Step 2 Deliverables
本阶段策略评审完成时，至少应产出以下文档或文档更新：
1. `step2-strategy-note.md`
   - 作为 Step 2 的正式策略基线
2. `implementation-decision-v1.md` 增补 Step 2 layering decision
   - 明确 Step 2 是 policy layering，不是 architecture replacement
3. `orchestrator-integration-boundary.md` 增补 protocol owner / business target distinction
   - 供首批 protocol family 集成对齐

## Assumptions
- 首批 protocol family 仍以 `dispatch/review` 为候选
- 首批 protocol owner project 仍优先考虑 `proj-openclaw-feishu-orchestrator`
- Step 2 的北极星是让 assistant-context-router 与 `openclaw-feishu-orchestrator` 这类真实服务协作更稳定，而不是提前扩展为完整协作基础设施
- Step 2 讨论的 context bucket 是 workflow-scoped optional bucket，而不是默认全局注入
- 当前不假设 OpenClaw native plugin command handler 会补上 `sessionKey`

## Strategy A — Minimal context adequacy validation
### 目标
验证当前 bounded context 是否已经足够，而不是默认增加更多上下文。

### 建议验证任务
至少选择三类真实任务：
1. project orientation
   - 询问当前项目 objective / next action / constraints
2. task continuation
   - 在已切 project 的 session 内继续推进一项具体实现或分析任务
3. state sensitivity
   - 连续两到三轮对话后，检查 assistant 是否仍保持正确项目边界

### 对照方式
每类任务至少做两组：
- A：仅 Step 1 minimal context
- B：人工补充更多 project docs

建议记录结构：
- task id
- project id
- session key
- task kind
- A/B 模式
- expected answer traits
- observed success / failure
- failure classification
  - context missing
  - routing wrong
  - state stale
  - model reasoning issue
  - unclear task framing

### 验收观察点
- 是否答对当前项目边界
- 是否给出可执行下一步
- 是否出现稳定缺口
- 缺口是否真的来自 context 不足，而不是模型推理问题

### 通过标准
- 至少 3 类任务中，A 模式在大多数场景下可维持正确项目边界
- 不出现“系统性遗漏同一类关键信息”的模式
- 若失败，能归因到明确 bucket 缺失，而不是宽泛地说“上下文不够”

### 决策规则
- 若 A 与 B 表现接近：Step 2 不增加默认 context bucket
- 只有当某类固定 workflow 稳定暴露同一缺口时，才考虑增加 workflow-scoped context bucket

### 不通过后的处理
- 不直接扩大默认 project context
- 先提出具体缺失字段或缺失文档来源
- 只有能描述成“某 workflow 缺某类稳定信息”时，才允许进入 Step 2 设计

## Strategy B — Routing policy layering
### 原则
Step 2 不是重写架构，而是在 Step 1 上叠加 routing policy。

### 最小 routing 顺序建议
1. explicit `/project <id>`
2. explicit project anchor in message/payload
3. known binding
4. protocol family only
5. unresolved -> safe-fail

### 语义分层要求
Step 2 必须显式区分三层语义，不允许混用：
1. protocol owner project
   - 谁拥有这套 protocol / contract / runtime
2. business target project
   - 这条任务真正针对哪个业务项目
3. workflow family
   - dispatch / review / other future family

### 最小状态与 trace 扩展
在不改变 Step 1 store 主结构的前提下，Step 2 可以最小扩展：
- `current_workflow`
- `last_route_trace.protocol_family`
- `last_route_trace.protocol_owner_project`
- `last_route_trace.business_target_project`
- `last_route_trace.route_evidence`

### Step 2 最小能力
- protocol family recognition
- project anchor resolution
- workflow family tagging
- safe-fail + trace 扩展

### 建议 trace 扩展字段
- `protocol_family`
- `protocol_owner_project`
- `business_target_project`
- `route_evidence`

### 首批 routing acceptance 示例
- 有显式 project anchor 的 dispatch/review 消息能 resolve 到 business target project
- 无 anchor 但来自已知 protocol channel 的消息，最多 resolve 到 protocol owner project + workflow family
- 任何需要 business target project 才能继续的动作，在 unresolved 时必须 safe-fail

## Strategy C — Progress writeback（仅作为策略问题，不进入实现）
### 当前建议
默认不进入 Step 2 主 scope。

### 原因
- 会把系统从“读侧路由”升级成“读写协作系统”
- 会引入触发时机、误写风险、目标文件选择、冲突处理、审计成本
- 与 Step 2 当前主问题并不相同

### 仅在以下条件满足时才进入后续阶段
- 已验证 major gap 来自“最近状态无法沉淀”
- 已有明确宿主文件（例如稳定存在的 hall docs truth host）
- 能接受显式触发优先，而非自动隐式写回

### 如果未来进入后续阶段，建议边界
- 只允许显式触发，不允许隐式自动写
- 只允许写入项目内预定义宿主文件
- 必须生成可审计 trace
- 必须有 safe-fail，不因 writeback 失败污染主对话流程

## Candidate Validation Matrix
建议用下表作为 Step 2 评审时的最小验证矩阵：

| Area | Scenario | Expected | Fail means |
| --- | --- | --- | --- |
| Minimal context | orientation | correct objective / next action | Step 1 context not sufficient |
| Minimal context | continuation | keeps project boundary over turns | context drift or stale state |
| Routing | anchored dispatch | resolves target project | project anchor parsing not enough |
| Routing | owner-only dispatch | resolves owner + workflow only | semantics mixed or over-routed |
| Safe-fail | unresolved target | asks/halts safely | high-risk misrouting |
| Trace | every route | trace is explainable | route policy not debuggable |

## Risks
1. protocol owner / business target 被混用
   - 会让路由“看似成功、实际上错项目”
2. minimal context 验证不严谨
   - 会导致后续错误地扩大默认 context
3. writeback 诱惑过早进入
   - 会把 Step 2 从策略层推成读写系统
4. workflow bucket 先于证据
   - 会让 Step 2 范围滑向 context engine

## Needs Decision
1. Step 2 首批 protocol family 是否锁定 `dispatch/review`
2. 首批 protocol owner project 是否锁定 `proj-openclaw-feishu-orchestrator`
3. minimal context adequacy validation 由谁主导记录
   - coordinator agent
   - 外部 agent
   - 或两者协作
4. Step 2 是否先出正式文档再允许任一 agent 编码

## Acceptance
Step 2 策略评审通过的标准：
- 能清楚区分 protocol owner project 与 business target project
- 能在 unresolved 时保守失败，而不是误路由
- 能证明 Step 1 minimal context 在真实任务上是否足够
- 若引入 workflow context bucket，必须能说明它解决了哪个已验证缺口
- Deliverables、Assumptions、Risks、Needs Decision 均已明确，足以给后续实现设边界

## Next action
- 先完成本策略文档评审
- 再由 coordinator agent 统一收口成最终 Step 2 评审版本
- 未经过 coordinator agent 收口前，不将本策略直接抽象成跨项目通用 skill
- 若继续推进，实现必须严格遵守本文件中的 in-scope / out-of-scope
