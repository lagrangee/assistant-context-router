# Feishu Business Notification Surface Contract

## Purpose
为 ACR 的 `business notification` 在 Feishu 里的第一种 delivery surface 定义一份最小 contract。

本文档回答：
- 第一种 Feishu business notification 应落在哪种 surface
- 它与当前 `BusinessNotificationRecord` / `signal promotion` / `work surface` 的边界是什么
- target 选择、幂等、回显与失败策略应是什么
- 为什么当前不应先做 notification table / feed board

本文档不授权：
- 直接实现 Feishu notification delivery adapter
- 自动创建 notification table
- 自动把通知失败升级成 main-session escalation

## Core decision
当前建议的第一种 Feishu business notification surface 是：

> **Feishu IM message delivery first**  
> 默认优先回到原 business/work chat 或 thread，  
> 而不是先做 notification table / feed board。

## Why this is the first slice
### 1. 它最符合 notification 的本质
`business notification` 的本质是：
- 把高信号事项推到 work/business side
- 让协作面及时看到
- 但不要求变成 governance queue

这天然更像：
- message delivery
- thread reply
- chat-visible alert

而不像：
- backlog row
- feed table
- persistent unresolved state host

### 2. 它与 current split 最一致
当前 ACR 内部已经明确：
- `business notification` 是 append-only record
- `main-session escalation` 才是 governance object

如果第一刀就做 notification table，很容易重新把：
- notification
- escalation
- snapshot

混到一起。

### 3. 它与现有 `reply_target` 模型天然贴合
当前 `NormalizedEnvelope` 已有：
- `reply_target`
- `channel_type`
- `trace_id`

这意味着当 signal 来源本来就在 Feishu business/work chat 中时，最自然的第一刀就是：
- 沿当前 thread / chat 做原地回执式通知

### 4. 它能最快形成真实协作闭环
目标如果是尽快让 `Feishu + OpenClaw + Codex` 真正可用：
- signal 出来
- business/work side 立刻收到
- 人在同一上下文里看到并继续操作

这条链路比“先建通知表再让人自己去看”更短。

## Truth boundary
当前必须明确区分：

### Truth host
真正的 business notification truth 仍然是：
- ACR `BusinessNotificationRecord`

它当前最小字段已经存在于 core：
- `notification_id`
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
- `artifact_ref`
- `status=recorded`

### Feishu message
Feishu 消息只是：
- delivery artifact
- interaction surface
- 人类可见回显

它不是：
- business notification truth host
- unresolved queue
- workflow state host

## Relationship to other Feishu surfaces
### 1. 与 `Work Surface Snapshots`
`Work Surface Snapshots` 是：
- one-row-per-project
- latest snapshot

它不是：
- append-only notification stream

所以：
- notification 不应复用 `Work Surface Snapshots`
- snapshot 负责“现在总体是什么状态”
- notification 负责“刚刚发生了什么高信号事项”

### 2. 与 `Action Ingress`
`Action Ingress` 负责：
- Human -> ACR structured request

`Business Notification` 负责：
- ACR -> business/work side signal delivery

两者可以都走 IM message surface，但语义完全不同。

### 3. 与 `Escalation Surface`
`Escalation Surface` 负责：
- Human review / decision / ack / resolve

`Business Notification` 第一刀只负责：
- 通知
- 不要求 ack
- 不要求 unresolved queue

## First-slice eligible signals
当前第一刀应只承接已经被 `SignalPromotionDecision` 判定为：
- `business_notification = true`

也就是当前最小 signal family 里的：
- `high_signal_completion`
- `review_request`
- `blocked`
- `service_error`

说明：
- 是否需要同时 main-session escalation，是另一条独立判断
- business notification 不应反向决定 escalation

## First-slice delivery surface
### Surface A — canonical first slice
- `Feishu IM message`

推荐形态：
- same chat reply
- same thread reply
- same work channel message

这是当前最推荐的第一刀。

当前进一步采纳的 operating-surface 分工是：
- `automation_ingress`
  - 当前默认 binding：`automation-ingress`
  - 承接外部 structured input 的进入面
  - 以及与这类外部请求同上下文的 result reply / business notification
- `agent_coordination`
  - 当前默认 binding：`agent-coordination`
  - 承接 agent 间流转、协作和 review 过程中的工作面消息
- `governance_escalation`
  - 当前默认 binding：`WeChat DM`
  - 承接需要 project owner 进入主会话处理的事项

这意味着：
- `automation-ingress` 不应膨胀成通用工作群，它只是 `automation_ingress` 的当前默认 transport
- `agent-coordination` 不是“只给 human”或“只给 agent”，而是 `agent_coordination` 的当前默认工作面
- 上述两个群都属于 workflow-scoped operating surface，不是真相层

补充边界：
- 上述 binding 当前只是已验证可用的默认 transport，不是 ACR core 的硬约束
- `automation_ingress` 当前应被理解为 multi-source surface：
  - 同时存在 Feishu、Discord、Telegram 等多个来源是合理的
  - 只要它们最后归一化到同一个 `automation_ingress`
- `agent_coordination` 当前则更适合作为一个单一主工作面：
  - 一个显式配置的 coordination 群即可承接 agent 间流转
  - 需要 Human 关注时，再额外升级到 `WeChat DM`
- 若未来外部 automation 只支持 Discord：
  - `automation_ingress` 仍可绑定到 Discord channel
  - `agent_coordination` 也可绑定到 Discord / 其他 transport，但不要求一开始就多入口
- 真正稳定的应是：
  - `automation_ingress` 侧的 result notification
  - `agent_coordination` 侧的协作通知
  而不是某个 Feishu chat id

### Surface B — possible later extensions
- digest channel
- dedicated notification chat
- card-rendered notification
- notification ledger table

这些都可以后续再做，但不建议抢在第一刀前面。

## Not recommended as first delivery surface
### 1. Notification table
当前不建议先做一张 `Notifications` / `Signals` 表。

原因：
- append-only log 容易被误看成 pending work queue
- 容易和 `Work Surface Snapshots` 重叠
- 需要额外解决已读、归档、去重、清理
- message-style 原地上下文会丢失

### 2. Reusing `Tasks / Bugs`
更不应先把 notification 投到 `Tasks / Bugs`。

原因：
- 它会把 signal delivery 误装成 backlog truth
- 会让 workflow kernel 与 visibility adapter 再次混层

## Target selection rule
当前建议 target 选择采用下面的优先级。

### 1. Explicit reply target
若 signal 来源的 envelope 已携带可用 `reply_target`，且：
- `target_kind = channel`
- `channel_type` 属于当前 runtime 已支持的 chat transport

则优先回到这个 target。

这是当前第一刀的默认路径。

当存在 workflow-scoped operating chat 时，当前推荐的具体落点是：
- 外部 structured request 的结果回执
  - 优先回当前 `automation_ingress` binding
  - 当前默认值是 `automation-ingress`
- agent 间 review / 协作流转消息
  - 优先回当前 `agent_coordination` binding
  - 当前默认值是 `agent-coordination`

这里的关键不是把群名 hardcode 到 runtime，而是：
- 这些群应作为显式 `reply_target` 或 future binding 的 target
- runtime 只消费解析后的 target object
- 业务语义上保持：
  - `dispatch` traffic 不污染 `review` 协作面
  - `review` traffic 不污染 `dispatch` automation ingress 面

当前 first slice 的 live delivery 仍然以 Feishu 为主；但 target selection rule 已不应被理解为“只能回 Feishu 群”。更准确地说：
- 当前默认 binding：
  - `automation_ingress -> automation-ingress`
  - `agent_coordination -> agent-coordination`
- future binding：
  - 可替换为 Discord / 其他 transport target
  - 只要 runtime 能解析并投递到对应 channel object

### 2. Future project-owned business binding
若未来项目 repo 声明了显式 business notification binding：
- 可将其作为第二优先级 target

但这一层当前不属于第一刀前置条件。

### 3. Record-only fallback
如果当前没有明确可用的 Feishu target：
- 保留 `BusinessNotificationRecord`
- 不强行发 live Feishu message

这比“猜一个 channel 再发”更安全。

## Delivery object
当前建议在 adapter 层引入一个局部 object：

### `FeishuBusinessNotificationDeliveryRequest`
- `notification_id`
- `project_id`
- `signal_kind`
- `summary`
- `reason`
- `action_name`
- `workflow`
- `trace_id`
- `run_id`
- `queue_ref`
- `artifact_ref`
- `target`
  - chat / thread / message reply target
- `delivery_mode`
  - `reply | thread_reply | channel_message`

## Message payload rule
第一刀消息内容应做到：
- 高信号可读
- 可定位项目
- 可追踪 trace/run
- 必要时能带最小 artifact pointer

当前不建议第一刀就塞进消息里的内容：
- 大段原始日志
- 大量 lane 历史
- 完整 workflow state dump
- 复杂 ack / resolve 控件

## Dedupe and idempotency
### Stable delivery key
当前建议：
- `notification_id + target_id`

这意味着：
- 同一 notification 对同一 target 不应重复发送
- 若一个 notification 需要发多个 target，那是多个 delivery attempt

### Relationship to core record
`notification_id` 本身继续由 ACR record 保持稳定；Feishu delivery 不应自造另一套 notification truth id。

## Failure policy
### 1. Missing target
若没有明确可用的 Feishu target：
- 不发送 live message
- 保留本地 `BusinessNotificationRecord`
- 返回 `record-only` 结果

### 2. Delivery failure
若 Feishu live delivery 失败：
- 不回写 workflow truth
- 不把该消息自动升级成 main-session escalation
- 应记录 delivery failure audit

原因：
- 通知投递失败 ≠ governance escalation
- 否则会把 transport failure 和 business significance 混为一谈

### 3. Persistent failure
若未来存在明确的 delivery retry / reconcile 机制：
- 可把持续失败列为 reconcile item
- 但仍不应默认等于 main-session escalation

## Governance rule
business notification 第一刀不要求：
- ack
- resolve
- ownership handoff
- takeover

如果后续需要这些语义：
- 应优先进入 `Escalation Surface`
- 而不是把 notification surface 扩成 governance queue

补充的 operating rule 是：
- `review_request` 默认进入当前 `agent_coordination` binding
  - 当前默认值是 `agent-coordination`
- 只有当同一事项同时触发 `main-session escalation` 时，才额外进入 `WeChat DM`
- 不默认把所有 review traffic 双发到 `WeChat DM`

## Identity rule
当前第一刀建议：
- Feishu delivery 使用 bot identity

原因：
- 更稳定
- 更符合 adapter / runtime bot 语义
- 不把 human identity 混入 automation delivery

若未来某些场景必须 user identity，再单独扩展。

## Recommended first implementation boundary
如果开始做第一版 Feishu business notification surface，我建议严格收在下面这条边界内：

1. 只做 `Feishu IM message` delivery
2. 只支持已有 `business_notification=true` 的 signal
3. 只优先用显式 `reply_target`
4. 无 target 时只保留 record，不强发
5. 不做：
   - notification table
   - ack / resolve
   - multi-target routing bus
   - automatic escalation on delivery failure

## Current first-slice implementation status
当前第一刀已经从 contract 进入实现态，但还没有做真实 Feishu work chat / thread 的 live validation。

### 已落地
- core 仍保留 append-only `BusinessNotificationRecord` 作为 truth host
- 新增 `BusinessNotificationDeliveryRecord` outbox mirror
  - 当前状态最小集合为：
    - `record_only`
    - `pending`
    - `delivered`
    - `queued`
    - `failed`
- plugin 的真实 signal promotion 路径当前已新增默认 observer：
  - 先 append `BusinessNotificationRecord`
  - 再写幂等 delivery outbox
  - 若 target 可投递，则走 runtime sender
  - 若 target 不可投递，则保持 `record_only`
- 当前已新增 project-scoped inspect 入口：
  - `/project [<project_ref>] --notifications`
  - 默认按当前 `/project` binding 查看
  - 展示的是 delivery mirror/outbox，不是 notification truth

### 当前 target 解析边界
第一刀当前只把下面这些 target 视为可直接投递的 Feishu target：
- `oc_xxx`
- `ou_xxx`
- `om_xxx`
- `feishu:chat:oc_xxx`
- `feishu:user:ou_xxx`
- `feishu:message:om_xxx`
- `feishu:thread:om_xxx`

其余 target 当前统一走：
- `record_only`

这意味着当前像 `feishu:thread:demo-dispatch-1` 这种 validation-style symbolic ref：
- 会保留 notification truth
- 会留下 delivery outbox record
- 但不会尝试做 live Feishu send

### 当前 sender 形态
第一刀 sender 当前采用：
- `lark-cli im +messages-send`
- `lark-cli im +messages-reply`
- 默认 `--as bot`
- 以 delivery id 作为 idempotency key

这符合当前 contract：
- 使用 bot identity
- 不让 Feishu 成为 truth host
- 不把 transport failure 自动升级成 governance escalation

### 当前验证状态
- auto-validation 已完成：
  - core / plugin 全量 tests 当前全绿：`170/170`
- 当前已验证：
  - deliverable target 会生成 `lark-cli im` sender plan
  - unsupported / missing target 会稳定落成 `record_only`
  - `/project --notifications` 能正确区分 `pending` 与 `record_only`
- 当前尚未验证：
  - 真实 Feishu business/work chat 或 thread 的 live delivery

### 当前 interruption point
这条线当前的自然下一步是：
1. 用真实 Feishu ingress traffic 跑一次 live `Business Notification` IM delivery
2. 再把主线推进到 `proj-assistant-context-router` self-hosted real usage

## Recommended follow-ups
在这份 contract 之后，最自然的后续讨论顺序是：

1. `Escalation Surface` 的第一种 Feishu 落点
2. 是否需要 project-owned business notification binding
3. notification delivery audit 的宿主放在哪
4. 是否需要 card-rendered notification 作为第二层 UX

## Relationship to Feishu sync architecture
本文档是 [feishu-sync-architecture-note.md](<repo-root>/plan/active/feishu-sync-architecture-note.md:1) 中 `Business Notification` 那一行的第一份细化 contract。
