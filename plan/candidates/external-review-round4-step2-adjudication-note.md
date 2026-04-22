# External Review Round 4 Step 2 Adjudication Note

## Purpose
记录一次基于外部 ChatGPT Round 4 Step 2 scope discipline / minimal valuable system review 的裁决结果，回答：

- 哪些 Step 2 范围判断可以直接吸收
- 哪些判断需要修正或加边界
- 哪些内容已足够作为 Step 2 实施计划的范围基线

本文档承接：
- Round 1 adjudication
- Round 2 authority matrix adjudication
- Round 3 stack adjudication

不替代正式 implementation plan。

## Overall judgment
本轮外部评审质量很高，且已经足够接近一份可执行的 Step 2 scope baseline。

最重要的价值不是它又补了多少概念，而是它明确把 Step 2 收成了一条最小闭环：

`/project`
-> ACR runtime-side binding
-> route / safe-fail / trace
-> service-first orchestrator ingress
-> orchestrator 持有 task/run/queue/runtime/notification authority
-> Feishu 提供最小 Task/Run/Event 可见度
-> high-signal promotion 到 business notification / main-session escalation
-> `/save` 正确回写 project contract docs

当前判断：
- 这条闭环应直接作为 Step 2 scope baseline
- 超出这条闭环的能力，默认应 `defer` 或 `drop`
- 本轮已经足够支持从“外部评审模式”切到“内部实施计划模式”

## Accepted

### 1. Step 2 应只打通一条最小闭环
这条判断应直接吸收。

Step 2 不应理解为：
- 把所有层都做完
- 提前补齐 memory / autonomy / replaceability
- 做出通用平台

Step 2 应只负责把：
- binding
- writeback
- service-first seam
- minimal visibility
- escalation

这几个关键接缝打通。

### 2. `/project`、`current_project_binding`、`/save` 都是 must-have
这组判断应直接吸收。

原因很简单：
- `/project` 是 continuity 入口
- `current_project_binding` 是第一个 runtime-side authority object
- `/save` 是 continuity 收口

少了任一项，闭环都不成立。

### 3. `project_contract_host_matrix` 必须先 formalize
这条判断应直接吸收。

Step 2 如果不先回答：
- 哪类结论写 `STATUS.md`
- 哪类结论写 `RESUME.md`
- 哪类 unresolved collaboration obligation 才写 `COLLAB.md`

那么 writeback 一定会飘。

### 4. `service-first ACR ↔ orchestrator ingress` 是 Step 2 最核心 seam
这条判断应直接吸收。

当前不应再保留：
- project-session-first ingress
- 结构化动作重新落回 free-text 二次解释

Step 2 的主接缝应该是：
- normalized structured action
- internal service bridge
- orchestrator action/result contract

### 5. orchestrator authority 必须被严格尊重
这条判断应直接吸收。

被 orchestrator 纳入 scope 的对象：
- task
- run
- queue/runtime state
- notification record

其 authority 都应留在 kernel。

Feishu 和 project session 都不应反向长成真相层。

### 6. minimal visibility 是 Step 2 的必要组成，不是可有可无的附加项
这条判断应直接吸收。

Step 2 若没有最小 visibility：
- 人仍要盯 terminal / TUI
- orchestrator 的价值会被削弱
- 长时工作不可见的问题仍未被解决

但 visibility 必须克制：
- 只做 minimal Task/Run/Event
- 不 replay terminal
- 不污染 backlog

### 7. `business notification` 与 `main-session escalation` 必须拆开
这条判断应直接吸收。

这已经不是观点分歧，而是 authority matrix 的硬边界。

### 8. `autonomy` 和 `replaceability engineering` 应从 Step 2 backlog 删除
这两条判断应直接吸收。

原因：
- autonomy 会立刻打乱 backlog / signal / authority
- replaceability engineering 会立刻膨胀抽象层和接口税

它们都不该占用 Step 2 的实现预算。

## Accepted With Correction

### 1. `project session shadow lane` 应保留，但优先级应低于 binding / seam / writeback / escalation
外部评审把它列入 `keep_now`，方向是对的。

但需要补边界：
- 它是 Step 2 闭环里需要存在的 derived read model
- 但它不应成为最先做、最重做的对象

更准确的优先级应是：
1. binding
2. host matrix + `/save`
3. service-first seam
4. signal promotion / escalation
5. minimal board visibility
6. 最后才是 project session minimal append-only lane

也就是说：
- 要保留
- 但不要让它吞掉过多 Step 2 工程量

### 2. `evidence / artifact_ref` 是 keep-now，但只应做最小字段，不应演化成独立模块
外部评审这里方向很对。

需要补的边界是：
- Step 2 不是“做 evidence system”
- Step 2 只需要最小 `artifact_ref`
- 且只要求高信号事项逐步 evidence-backed

因此：
- keep `artifact_ref`
- 不 keep 一个独立 evidence subsystem

### 3. `CLI boundary` 应保留，但当前更应理解为极薄 `orchestratorctl`
这条判断我同意。

补充边界：
- 当前不需要正式 `acrctl`
- ACR 侧可先用内部接口或少量 dev-only inspect 命令
- 不要把 CLI 反过来做成第二套平台层

### 4. `cross-agent writeback obligation` 应保留为规则和流程，不应上升成复杂 enforcement 功能
这条判断是对的，但要收口。

Step 2 当前更适合做：
- host matrix
- preview/apply
- writeback checklist
- external agent obligation rule

不适合做：
- 重型自动 enforcement
- 复杂 writeback orchestration engine

### 5. Feishu board integration 应保留，但只保留一个 work surface
外部评审已经明确：
- 当前不应新增第二个 surface

我同意。

再补一句：
- Step 2 的目标不是“把 Feishu 做得很强”
- 而是“用 Feishu 验证 minimal work visibility + write-through surface”

## Deferred

### 1. external worker runtime experiment
当前应 defer。

Round 3 已经把：
- OpenAI Agents SDK

收敛为未来 isolated worker-side experiment 候选。

这件事不应进入 Step 2 正式实施计划。

### 2. advanced takeover / shared-thread collaboration
当前应 defer。

Step 2 需要的是：
- minimal main-session escalation
- minimal override / ack / resolution semantics

不是完整 shared-thread collaboration 模式。

### 3. memory backend integration
当前应 defer。

这与现有 roadmap 以及 authority matrix 一致。

### 4. `STATUS.md` / `RESUME.md` 终局结构
本轮外部评审也明确提醒：
- 当前不要再把 Step 2 预算花在终局结构争论上

这条应继续 defer。

## Rejected

### 1. Step 2 期间引入新的 durable substrate
本轮外部评审实际上也没有推荐这么做。

因此这里的 hard rule 应继续成立：
- 不把 Temporal / LangGraph / Prefect 接入主路径

### 2. Step 2 做 generic replaceability abstraction
应继续拒绝。

当前最多保留：
- seam naming
- ownership clarity
- minimal contracts

不应进入：
- generic runtime abstraction
- generic board abstraction
- generic memory abstraction

## Step 2 baseline after adjudication

### Keep Now
- `/project` focus switch
- `current_project_binding`
- `/save` preview/apply
- `project_contract_host_matrix`
- `route_trace`
- `service-first ACR ↔ orchestrator ingress`
- orchestrator task/run/queue authority boundary
- minimal Feishu work surface
- minimal Task/Run/Event visibility
- `business_notification`
- `main_session_escalation`
- minimal `artifact_ref`
- thin `orchestratorctl`
- cross-agent writeback obligation rules

### Keep But Sequence Later
- minimal project session append-only shadow lane

### Defer
- memory integration
- external worker runtime experiment
- advanced takeover/shared-thread collaboration
- `acrctl` as formal operator surface
- `STATUS.md` / `RESUME.md` end-state debate

### Drop From Step 2 Backlog
- autonomy / proactive tasking
- replaceability engineering
- second work surface
- progress cockpit/dashboard
- generic board/runtime/memory abstraction

## Key corrections to preserve

### 1. `project session` 要做，但不是 Step 2 第一优先级
如果实现节奏上必须压缩范围：
- 宁可先保 binding / seam / escalation / save
- 也不要先重做 project session

### 2. `artifact_ref` 是最小 schema，不是独立系统
实现时要防止：
- 先把 evidence 设计成一大套对象模型

### 3. `COLLAB.md` 只应承接跨 session 未解决的 collaboration obligation
不应把：
- blocked
- review
- decision
- event

默认都写进去。

### 4. CLI 只做最小命令面
不应在 Step 2 里演化出：
- 第二条聊天协议
- 通用 agent control plane

## Recommended next move
本轮之后，不建议再继续做外部“愿景评审”。

下一步更合适的是：
- 把 Step 2 范围收成正式 implementation plan
- 先写 5-7 个 must-have contracts
- 再拆成最小执行任务

当前最适合进入实施计划的主线可以浓缩成一句：

> Step 2 不是要把所有层补齐，而是只把 current project binding、project writeback、service-first orchestrator seam、minimal visibility、signal/escalation promotion 这条闭环打通。

