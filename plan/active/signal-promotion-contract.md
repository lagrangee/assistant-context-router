# Signal Promotion Contract

## Purpose
定义 Step 2 / Cut 4A 当前 `signal promotion` 的最小正式 contract，回答：

- 当前哪些 signal family 是正式支持的
- 什么只留在 local lane / read model
- 什么值得进 business notification
- 什么才应升级成 main-session escalation
- 什么 unresolved 时才有资格进入 `COLLAB.md`

本文档承接：
- [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1)
- [project-contract-host-matrix.md](<repo-root>/plan/active/project-contract-host-matrix.md:1)
- [service-first-orchestrator-action-result-contract.md](<repo-root>/plan/active/service-first-orchestrator-action-result-contract.md:1)
- [project-owned-service-bridge-contract.md](<repo-root>/plan/active/project-owned-service-bridge-contract.md:1)

## Core rule
Step 2 的 `signal promotion` 不是“把所有 noteworthy 事件都推给 Human”，而是：

> 把 workflow/high-signal 事件先压成少量稳定 signal，再决定它属于 business/protocol 协作、main-session 治理，还是只停留在 local read model。

因此必须显式拆开：
- `business notification`
- `main-session escalation`
- `COLLAB.md` persistent collaboration obligation

它们不允许被混成同一件事。

## Current implemented signal family
当前代码层已正式支持的最小 signal family：

- `none`
- `blocked`
- `review_request`
- `high_signal_completion`
- `service_error`

说明：
- 这比长期目标里的 `need_decision / human_override / stale_run` 更窄
- Step 2 先用这组最小信号打通 promotion 闭环

## Signal derivation rule
当前 signal 的来源优先级：

1. delivery failure / unresolved binding
   - => `blocked`
2. service execution error
   - => `service_error`
3. service result `needs_escalation`
   - 根据 reason 映射到：
     - `review_request`
     - `blocked`
4. explicit route escalation reason
   - 根据 reason 映射到：
     - `review_request`
     - `blocked`
5. structured automation `status=ok` 且具有 reply/summary 的 completion-like result
   - => `high_signal_completion`
6. 否则
   - => `none`

## Promotion surfaces

### 1. local lane / read model
默认所有 signal 都先落这里。

它承载：
- route/service trace
- high-signal summary source
- 给 secretary 的恢复提示

它不是：
- business notification
- main-session escalation
- `COLLAB.md`

### 2. business notification
这是 protocol/work channel 侧的外部通知。

它服务于：
- workflow 协作
- review/work chat
- 业务观察面

### 3. main-session escalation
这是 secretary/human governance 面。

它只服务于：
- 需要 project owner/coordinator agent 决策
- 需要 human review/approval
- 需要 takeover / explicit acceptance

### 4. `COLLAB.md`
这是 cross-session unresolved collaboration obligation 的持久化宿主。

它只承接：
- 跨 session 仍未解决
- 需要明确 owner / handoff / review / decision
- 仅靠 local lane 不足以保持 continuity

## Current promotion matrix

### `none`
- business notification: no
- main-session escalation: no
- `COLLAB.md`: no

### `high_signal_completion`
- business notification: yes
- main-session escalation: default no
- `COLLAB.md`: no

说明：
- 完成类高信号默认先通知业务/work surface
- 若未来需要 explicit acceptance，再由更高层规则决定是否升级主会话

### `review_request`
- business notification: yes
- main-session escalation: conditional
- `COLLAB.md`: persistent-only

条件：
- 若 reason 明确指向 project owner/coordinator agent/human approval/decision
  - => 可升级到 main session
- 否则默认停留在 business notification + local lane
- 只有跨 session 仍 unresolved 时，才有资格进入 `COLLAB.md`

### `blocked`
- business notification: yes
- main-session escalation: conditional
- `COLLAB.md`: persistent-only

条件：
- 普通执行阻塞默认只到 business/work surface
- 明确需要 human decision / approval / takeover 时，才升级 main session
- 只有阻塞跨 session 持续 unresolved，才应进入 `COLLAB.md`

### `service_error`
- business notification: yes
- main-session escalation: conditional
- `COLLAB.md`: persistent-only

条件：
- 默认视为高信号问题，但不自动等于主会话升级
- 若错误本质是 human 决策/权限/审批问题，才升级 main session

## Human decision hint rule
当前 Step 2 的最小判断规则允许用 reason hints 区分“只是 workflow 信号”与“真的需要主会话治理”。

以下关键词可视为 human-decision hints：
- `decision`
- `approval`
- `approve`
- `human decision`
- `human approval`
- `project_owner`
- `coordinator-agent`
- `takeover`

说明：
- 这是当前 MVP 级规则，不是最终语义系统
- 目标只是先把 escalation 污染面压住

## `COLLAB.md` hard rule
当前 hard rule：

- `COLLAB.md` 不是 event sink
- `COLLAB.md` 不是 blocked/review 默认归档桶
- 只有 persistent unresolved collaboration obligation 才能进入

因此当前不允许：
- 每个 `blocked`
- 每个 `review_request`
- 每个 `service_error`

默认都直接写入 `COLLAB.md`

## Out of scope
当前不在本 contract 内解决：
- business notification 的真实 delivery adapter
- main-session escalation store / ack / resolve object
- `COLLAB.md` 自动 writeback
- `need_decision / human_override / stale_run` 的完整类型扩展
