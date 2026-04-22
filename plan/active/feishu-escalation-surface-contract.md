# Feishu Escalation Surface Contract

## Purpose
为 ACR 的 `main-session escalation` 在 Feishu 里的第一种 surface 定义一份最小 contract。

本文档回答：
- 第一种 Feishu escalation 应该是什么形态
- 它与当前 `main-session escalation store` 的 authority 边界是什么
- target 选择、去重、失败策略与 lifecycle mirror 应该是什么
- 为什么第一刀不应直接做 Feishu-side ack / resolve queue

本文档不授权：
- 直接实现 Feishu escalation delivery adapter
- 让 Feishu 成为 `acknowledged / resolved` 的 authority host
- 自动把 Feishu alert 反向当成 governance truth

## Core decision
当前建议的第一种 Feishu escalation surface 是：

> **Feishu IM governance alert mirror first**  
> 它只是 `main-session escalation` 的 secondary visibility mirror，  
> 不是 primary control plane，也不是 ack / resolve host。

当前同时已采纳一个更上层的运行结论：

> **全局 default governance target 当前先定为 `WeChat DM`。**  
> 但这必须来自显式的 global governance binding / adapter config，  
> 不能 hardcode 在 runtime / adapter 代码里。

这意味着：
- Feishu escalation surface 当前不是默认 primary landing
- 它更适合作为 future secondary mirror，或少数项目的 override target
- 即便未来支持多 channel，first slice 仍不默认 fan-out

## Why this is the first slice
### 1. 当前治理真相已经有宿主
当前 ACR 已经有：
- `main-session escalation store`
- `open / acknowledged / resolved`
- `canonical_session_key`
- `before_prompt_build` governance hint

所以第一刀在 Feishu 侧最稳的角色不是再造一个 queue，而是：
- mirror unresolved governance attention
- 提醒 Human
- 不抢 authority

### 2. 它必须比 business notification 更保守
`business notification` 可以是 work/business side 的即时通知。  
但 `main-session escalation` 更接近：
- human decision
- review / approval
- takeover
- unresolved governance obligation

因此它不能像普通通知一样，默认回原 business/work chat。

### 3. 它不能反客为主
如果第一刀就做：
- Feishu table queue
- Feishu-side ack / resolve
- card button 直接改 escalation 状态

很容易把：
- Feishu alert
- ACR governance truth
- Human resolution workflow

重新揉成一层。

## Truth boundary
### Truth host
真正的 escalation truth 仍然是：
- ACR `MainSessionEscalationRecord`

当前最小字段包括：
- `escalation_id`
- `canonical_session_key`
- `project_id`
- `signal_kind`
- `source`
- `target=main_session`
- `status`
- `reason`
- `summary`
- `trace_id`
- `action_name`
- `workflow`
- `run_id`
- `queue_ref`
- `artifact_ref`
- `resolution`

### Feishu mirror
Feishu escalation surface 只是：
- visibility mirror
- governance alert channel
- Human attention assist

它不是：
- escalation truth host
- unresolved queue authority
- ack / resolve source of truth

## Relationship to other surfaces
### 1. 与 `Business Notification`
两者都可以走 Feishu IM message，但必须分开：

- `Business Notification`
  - 面向 business/work side
  - 默认可回原 business/work chat
  - 不要求 governance state

- `Escalation Surface`
  - 面向 Human governance
  - 不应默认回原 business/work chat
  - 面向 `main-session escalation store` 的 visibility mirror

当前进一步采纳的 operating-surface 分工是：
- `automation-ingress`
  - 只承接 `dispatch` workflow 的 automation ingress 与 business notification
- `agent-coordination`
  - 只承接 `review workflow` 的 business notification / review 流转
- `WeChat DM`
  - 只承接 `main-session escalation`

这意味着：
- `agent-coordination` 不是 `WeChat DM` 的替代品
- `WeChat DM` 也不是 review workflow 的默认工作面
- `WeChat DM` 是 governance overlay，而不是 workflow chat

### 2. 与 `Work Surface Snapshots`
`Work Surface Snapshots` 表达的是：
- per-project latest state

它不是：
- unresolved governance queue

所以 escalation 不应复用 `Work Surface Snapshots`。

### 3. 与 `Action Ingress`
如果未来 Human 想在 Feishu 中执行：
- ack
- resolve
- accept
- reject

那应作为新的 structured ingress action 进入 ACR，而不是让 alert 消息本身直接成为 truth mutation host。

## First-slice eligible escalations
当前第一刀只承接已经被判定为：
- `main_session_escalation = true`

且当前 store 中状态为：
- `open`

第一刀当前不要求在 Feishu 里主动展示：
- `acknowledged`
- `resolved`

这些状态仍由 ACR 主宿主管理。

## First-slice surface
### Surface A — canonical first slice
- `Feishu IM governance alert`

推荐形态：
- project owner 私聊
- dedicated governance/review chat
- 明确的 secretary governance thread

补充说明：
- 从跨 channel 的总体治理视角看，当前全局默认 target 已定为 `WeChat DM`
- 因此这里的 `Feishu IM governance alert` 更应被理解为 Feishu 侧的 mirror / override surface
- 而不是当前唯一默认 primary landing

### Surface B — later extensions
- card-rendered escalation alert
- Feishu-side ack/resolve action
- escalation dashboard / table

这些都属于后续增强，不应抢在第一刀前面。

## Not recommended as first escalation surface
### 1. Reusing business/work chat
当前不建议默认把 escalation 发回原 business/work chat。

原因：
- 会把 business notification 与 governance escalation 再次混层
- 会让“需要主会话决策”的事项看起来只是普通业务消息

### 2. Escalation table
当前也不建议先做 Feishu escalation table。

原因：
- 很容易被误当成 unresolved truth queue
- 需要额外定义 ack / resolve / assignment / stale cleanup
- 会与 ACR 当前 main-session governance store 竞争 authority

## Target selection rule
当前建议 escalation target 采用下面的优先级。

### 1. Global default governance binding
当前推荐的默认模型是：
- 先有一个全局 `governance target` 绑定
- 它默认承接所有 `main-session escalation` 的 primary governance delivery

这个 target 可以是：
- project owner DM
- 一个固定 governance/review chat
- 未来的跨 channel target（例如 WeChat / Feishu）

当前已采纳的默认值是：
- `WeChat DM`

但这个默认值必须满足下面的配置规则：
- 它属于显式 `global governance binding`
- 不应被 hardcode 到 Feishu adapter、route logic、或 OpenClaw command path
- runtime 只消费配置解析后的 target object
- 后续若默认值变更，应通过配置迁移，而不是代码改常量

但第一刀当前建议：
- 只启用一个 `primary governance target`
- 不默认做 multi-channel fan-out

原因：
- escalation 本质上是 Human governance attention，不宜同时在多个地方扩散
- 一旦多 channel 同发，很容易出现重复提醒、责任分散、以及后续 `ack / resolve` 语义混乱

补充的 operating rule 是：
- `review_request` 默认不因为是 review 就自动发 `WeChat DM`
- 只有当同一事项被提升为 `main-session escalation` 时，才进入 `WeChat DM`
- 因此 `agent-coordination` 与 `WeChat DM` 不是默认双发关系

### 2. Project-owned override
未来应允许单个项目声明：
- `project-owned governance target override`

当前推荐语义是：
- override 默认 **replace** 全局 default target
- 不做“默认 merge/fan-out”

这能保留：
- 大多数项目走统一治理入口
- 少数项目可单独覆盖

### 3. Future multi-channel capability
当前建议在模型层预留：
- `channel_type`
- `target_kind`
- `target_id`
- `delivery_mode`

也就是说：
- schema 可以为未来多 channel 做准备
- 但 first slice runtime 不需要真的做多 target 广播

### 4. No Feishu mirror
如果没有明确 governance target：
- 保留 ACR `main-session escalation store`
- 继续依赖 OpenClaw main-session governance hint
- 不强行向某个 business/work chat 发送 escalation alert

## Config host rule
`governance target` 属于配置，不属于代码常量。

当前建议：
- 全局 default target 放在显式的 global governance binding / adapter config host
- project-owned override 放在项目侧显式配置面
- runtime / adapter 只读取解析后的 target object，不内嵌具体 channel / id

当前已采纳的默认值：
- `WeChat DM`

但这只代表：
- 当前环境的运行配置默认值

不代表：
- `WeChat DM` 可以被写死在代码里
- Feishu escalation contract 自身变成跨 channel governance truth host

## Delivery object
当前建议在 adapter/runtime 边界上先引入一个局部 delivery object：

### `GovernanceDeliveryRecord`
- `escalation_id`
- `canonical_session_key`
- `project_id`
- `signal_kind`
- `reason`
- `summary`
- `trace_id`
- `action_name`
- `workflow`
- `run_id`
- `queue_ref`
- `artifact_ref`
- `channel_type`
- `target_kind`
- `target_ref`
- `delivery_mode`
- `rendered_message`
- `status`
  - `pending | delivered | queued | failed`
- `runtime_target_id`
- `error_reason`
- `trace_patch`

当前这层 object 的职责是：
- 承接 `main-session escalation` 到治理投递面的幂等记录
- 让 runtime 真正消费 `governance.default_target`
- 为后续 WeChat / Feishu sender、delivery audit、reconcile 留出稳定宿主

它当前不是：
- governance truth host
- ack / resolve host
- 真正的 channel sender result host

## Dedupe rule
### Stable alert key
当前建议：
- `escalation_id + channel_type + target_kind + target_ref + delivery_mode`

这意味着：
- 同一个 unresolved escalation 对同一 governance target 不应重复刷屏
- repeated open upsert 默认更新 delivery record，不默认再次重复 fan-out

### Why this is conservative
当前 main-session escalation store 已能：
- 去重
- upsert
- 保留最新 trace / artifact

因此 Feishu mirror 第一刀更适合做：
- single alert per unresolved obligation

而不是实时镜像每一次 upsert 变化。

## Lifecycle mirror rule
第一刀当前只建议镜像：
- `open`

当前不强制要求：
- `acknowledged` 时发更新
- `resolved` 时发 closure message

原因：
- 这些都更接近 control-plane 行为
- 过早实现容易让 Feishu 反向变成 governance workflow host

## Failure policy
### 1. Missing governance target
若当前没有明确 governance target：
- 不发送 Feishu alert
- escalation truth 继续只存在于 ACR main-session store
- `before_prompt_build` 仍然是默认主读面

### 2. Delivery failure
若 Feishu alert 投递失败：
- 不改变 escalation truth
- 不自动标记为 `acknowledged` / `resolved`
- 不回退成 business notification

### 3. Persistent delivery failure
若未来要处理持续失败：
- 应进入 delivery audit / reconcile
- 而不是自动改变 escalation record 的 governance state

## Governance rule
第一刀的 Feishu escalation surface 是：
- visibility mirror
- not control plane

因此当前不在 Feishu 上直接做：
- ack
- resolve
- assign owner
- close escalation

如果未来要做这些动作：
- 应通过 `Action Ingress` 进入 ACR
- 再由 ACR main-session escalation store 落真相

## Identity rule
当前第一刀建议：
- Feishu mirror 使用 bot identity

原因：
- 这是 adapter / alert delivery，更接近系统行为
- 不应把 Human 自己伪装成 alert sender

## Recommended first implementation boundary
如果开始做第一版 Feishu escalation surface，我建议严格收在下面这条边界内：

1. 只做 `Feishu IM governance alert mirror`
2. 只镜像 `open` escalations
3. 只发往一个明确的 `primary governance target`
4. 无 target 时不强行投递
5. 不做：
   - Feishu-side ack / resolve
   - escalation table
   - business/work chat fallback
   - repeated open-alert spam
   - 默认 multi-channel fan-out

## Current implementation status
当前已经落地的是一条更保守的 runtime path：

- `main-session escalation store` 仍是 truth host
- plugin 主链在 `promotion.main_session_escalation=true` 时：
  - 先 `upsertOpen`
  - 再消费 `governance.default_target`
  - 生成 / 更新一条幂等的 `governance delivery outbox` record
  - 并通过 OpenClaw runtime sender 尝试投递到 canonical main-session target
- 当前 outbox 宿主：
  - [governance-delivery-outbox.ts](<repo-root>/implementation/core/src/state/governance-delivery-outbox.ts:1)
- 当前默认 target 解析宿主：
  - [config-host.ts](<repo-root>/implementation/adapters/feishu/src/config-host.ts:1)
- 当前默认 runtime sender：
  - [governance-delivery.ts](<repo-root>/implementation/adapters/openclaw/runtime/src/governance-delivery.ts:1)
- 当前已新增主会话 inspect 入口：
  - `/project [<project_ref>] --governance`
  - 默认按当前 project binding 查看
  - 读取的是 `governance delivery outbox`
  - 用于 human inspect / preview，不是 governance truth read model

这意味着：
- `governance target binding` 已不再只是 loader skeleton
- 当前第一版 sender 已打通的是：
  - `escalation truth -> binding resolution -> runtime target resolution -> OpenClaw system event delivery -> outbox status update`
- 当前仍未直接接到微信外部 API / Feishu 外部 API

## Current target resolution rule
当前默认 target resolution 采用：

1. 先按 `target_ref` 直接匹配 `runtimeBindings.main_sessions`
2. 若 `target_ref` 是 `local:*` symbolic ref，则尝试映射到 main-session alias
3. 命中后再解析到 canonical session key

当前默认例子：
- `target_ref=local:human_dm`
- `runtimeBindings.main_sessions.aliases` 中有 `wechat:dm:human`
- 最终会解析到例如 `agent:main:main`

这意味着：
- 第一步 WeChat sender 依赖 runtime bindings alias，而不是硬编码 session key
- 如果 alias 缺失，delivery 会记为 `failed`，`error_reason=unresolved_governance_target:*`
- 当前运行时也已不再继续依赖 demo fixture；默认 runtime bindings host 已收口到 `<plugin dataDir>/assistant-context-router/runtime-bindings.yaml`

## Recommended follow-ups
在这份 contract 之后，最自然的后续讨论顺序是：

1. 全局 `governance target` 的配置宿主放在哪里，如何避免 hardcode
2. project-owned override 的配置面放在哪里
3. `ack / resolve` 是否要作为第二层 `Action Ingress`
4. escalation delivery audit 的宿主放在哪

## Relationship to Feishu sync architecture
本文档是 [feishu-sync-architecture-note.md](<repo-root>/plan/active/feishu-sync-architecture-note.md:1) 中 `Escalation Surface` 那一行的第一份细化 contract。
