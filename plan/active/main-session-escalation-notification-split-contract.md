# Main-session Escalation / Notification Split Contract

## Purpose
定义 Step 2 / Cut 4B 当前 `business notification` 与 `main-session escalation` 的最小正式拆分，回答：

- 哪些对象只属于 work/business surface
- 哪些对象属于 ACR 自己持有的 governance 面
- Step 2 第一刀最小需要哪些 record/store
- 如何在不引入完整通知平台的前提下，让 split 真正落地

本文档承接：
- [signal-promotion-contract.md](<repo-root>/plan/active/signal-promotion-contract.md:1)
- [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1)
- [project-owned-service-bridge-contract.md](<repo-root>/plan/active/project-owned-service-bridge-contract.md:1)

## Core rule
Step 2 当前不做完整 notification platform，也不做完整 takeover system。

这一刀只要求：

1. `business notification` 与 `main-session escalation` 不再共享同一宿主
2. `main-session escalation` 有最小 unresolved record，可被 main session 看见
3. `business notification` 有独立 record，可证明它没有被误当成 main-session escalation
4. `project session` 继续只做 derived read model，不承担 escalation authority

## Object split

### 1. Business notification record
这是 protocol / work surface 侧的外部通知记录。

它的作用：
- 表示某个 high-signal item 已被上浮到 business/work side
- 给后续真实 delivery adapter 留稳定记录面
- 明确它不是 ACR governance object

Step 2 第一刀只要求：
- append-only
- project-scoped
- 不要求 ack / resolve
- 不要求真实 channel delivery bus

最小字段：
- `notification_id`
- `created_at`
- `project_id`
- `signal_kind`
- `source`
- `trace_id`
- `action_name`
- `workflow`
- `reason`
- `summary`
- `run_id`
- `queue_ref`
- `status`

当前最小 `status`：
- `recorded`

### 2. Main-session escalation record
这是 ACR 自己持有的 governance object。

它的作用：
- 表示某个事项已正式升级为“需要 main session 关注/处理”
- 作为 secretary / main session 的 unresolved attention queue
- 让 escalation 不再依附于 business channel、project session、或 free-text

Step 2 第一刀只要求：
- unresolved record store
- 最小 dedupe / upsert
- 最小 open list
- 先不要求完整 command surface

最小字段：
- `escalation_id`
- `created_at`
- `updated_at`
- `canonical_session_key`
- `project_id`
- `signal_kind`
- `source`
- `target`
- `status`
- `reason`
- `summary`
- `trace_id`
- `action_name`
- `workflow`
- `run_id`
- `queue_ref`
- `resolution`

当前最小 `target`：
- `main_session`

当前最小 `status`：
- `open`
- `acknowledged`
- `resolved`

## Source rule
当前 Step 2 第一刀只允许这三类 source：

- `route_decision`
- `service_result`
- `delivery_result`

说明：
- 若 signal 主要由 `needs_escalation` / `status=error` 导出，优先记为 `service_result`
- 若 signal 主要来自 project-session delivery failure / unresolved binding，记为 `delivery_result`
- 若 signal 主要来自 route 层显式 escalation / safe-fail，记为 `route_decision`

## Promotion rule in Cut 4B
Cut 4B 当前只实现以下最小闭环：

1. 先 derive `signal_kind`
2. 再算 `SignalPromotionDecision`
3. 若 `business_notification=true`
   - 写入 business notification record
4. 若 `main_session_escalation=true`
   - upsert unresolved main-session escalation record

当前仍不做：
- 真正 channel delivery orchestration
- main-session escalation 的复杂 resolve workflow
- `COLLAB.md` 自动 writeback
- `human_override / stale_run / need_decision` 完整类型扩展

## Read model rule
Step 2 第一刀的读面规则：

- `project session` 仍只读 high-signal event/log，不裁 escalation truth
- `before_prompt_build` 可以消费 unresolved main-session escalation records
- main-session escalation block 应被视为 governance hint，不替代 docs truth

## Hard rules

### 1. business notification 不等于 main-session escalation
即使两者都由同一个 signal 导出，也必须分别记录。

### 2. project session 不得 host escalation authority
它最多只保留 signal/event 摘要。

### 3. business notification record 不反向决定 main-session escalation
两者都由 `SignalPromotionDecision` 决定，不互相推导。

### 4. unresolved main-session escalation 必须是 session-scoped
它服务的是当前 main session front door，而不是某个 generic project feed。

## Out of scope
Cut 4B 当前不解决：

- 真正的 business notification delivery adapter
- escalation ack/resolve command surface
- escalation metrics / analytics
- second work surface
- `COLLAB.md` promotion automation
