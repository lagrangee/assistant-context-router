# Feishu Action Ingress Contract

## Purpose
为 Feishu -> ACR 的第一种 human-triggered structured action ingress 定义一份最小 contract。

本文档回答：
- 第一种 Feishu ingress 应该选哪种 surface
- 它与当前 `NormalizedEnvelope` / route / safe-fail 怎样对接
- 为什么当前不应先把 Base 表做成 command bus
- 第一版 ingress object、dedupe、reply、failure policy 应该是什么

本文档不授权：
- 直接实现 Feishu ingress adapter
- 开启任何 callback server / webhook / bot command
- 自动把 Feishu 任意消息解析成 workflow action

## Current live finding
当前已经完成两轮真实 `automation-ingress` 群消息验证。

### First attempt
第一轮结果说明：

- 群里出现的 legacy `ACK_TASK` 回执，不代表消息已经进入 ACR 主链
- 当前若 `trace_id / task_record_id` 没有落入：
  - `project-session-events`
  - `business-notification-delivery-outbox`
  - `governance-delivery-outbox`
  则应判定为“消息未进入 ACR”

### Corrections applied
随后已完成以下收口：
- 全局旧 `dispatch` 群处理规则已由 Human 手工删除
- ACR plugin 的 structured automation parser 已增强：
  - 不再要求 `[ACR_AUTOMATION]` 必须位于文本开头
  - 允许前面存在非括号式宿主前缀 / 群元信息
- implementation tests 当前全绿：`177/177`

### Second attempt
第二轮在 reload OpenClaw / TUI 后重测，已真实通过：

- `automation-ingress` 群收到回执：
  - `Accepted dispatch for proj-assistant-context-router`
- `proj-assistant-context-router` 的 validation task row：
  - `<validation-task-record-id>`
  已真实进入：
  - `状态 = Doing`
  - `current_step = EXECUTE`
  - `step_result = in_progress`

这意味着：
- 当前 `automation-ingress -> OpenClaw plugin -> ACR -> service path -> Task writeback`
  的 first slice 已经 live-validated
- 当前不需要立刻实现额外的 `dispatch ingress bridge`
- 后续只有在更复杂的 Feishu transport / callback / multi-surface 场景下，才需要再引入独立 ingress adapter

### Workflow message normalization finding
随后在 live Base workflow 回流验证中，`invalid_protocol_json` 的更准确 root cause 已被定位：

- workflow 模板本身生成的 `[ACR_AUTOMATION]` 正文是合法 JSON
- 但 Feishu Base workflow 送到 OpenClaw 的 ingress text，并不一定是原始正文：
  - 有时会是简单的 content envelope：`{"text":"[ACR_AUTOMATION] ... [/ACR_AUTOMATION]"}`
  - 更关键的是，当前 live failure 的真实形状是 **Feishu rich post wrapper**
    - `body` 带有 `[message_id: ...]`
    - 后面跟 `sender_open_id: {...post-json...}`
    - 真正的 automation 文本藏在 rich post 的 `elements[].text`
- 之前 ACR 在 `before_dispatch` 里直接把这类 host wrapper 当正文处理
- 于是 parser 实际看到的是宿主包装层，而不是原始 `[ACR_AUTOMATION]` body
- 最终就会误判成：
  - `malformed automation message (invalid_protocol_json)`

因此当前的正确修复不是继续扩大 parser 容忍度，而是：

> 在 transport boundary 先解开已知 host text envelope，
> 再把真正的 message text 交给 structured automation parser。

当前 implementation 已完成两层处理：
- `before_dispatch` 的 `resolveMessageText(...)`
  - 会先识别并解开：
    - `{"text":"..."}` 这类 host text envelope
    - Feishu workflow rich post body wrapper
      - `[message_id: ...]`
      - `ou_xxx: {...post-json...}`
      - `elements[].text`
- structured parser 继续保留对宿主小噪音的最小归一化：
  - 宿主元信息前缀
  - `BOM / zero-width / NBSP / CRLF`

对应 implementation tests 当前已覆盖：
- host preamble
- wrapper payload noise
- Feishu text content envelope
- Feishu workflow rich post body wrapper

并保持全绿。

### Extractor boundary
当前 implementation 已把 transport-specific unwrap 进一步收口成一层明确的 ingress extractor boundary：

- `before_dispatch`
  - 不再直接内联 Feishu-specific wrapper 逻辑
- `protocols/ingress-text.ts`
  - 承接 source-specific text extraction / unwrap
  - 当前内置的 extractor 仅覆盖：
    - Feishu message-id prefix
    - Feishu sender rich-post prelude
    - simple `{"text":"..."}` envelope
    - Feishu rich-post JSON wrapper

这条边界的目的是：

> 未来若接 Discord / Telegram / Slack，
> 应新增 source-specific extractor，
> 而不是继续把 wrapper 特判堆进 ACR core parser 或 plugin 入口主流程。

### Sender policy finding
当前 live 验证还暴露了一个 transport-level 约束：

- 若 workflow 发送人是 `多维表格助手 / bot`
- 而当前 OpenClaw 群设置只响应 Human 自己的消息
- 则结构化 workflow 消息即使内容正确，也可能不会进入 ACR

当前建议分成两层：

- **短期可用策略**
  - 若当前群设置尚未放通可信 automation sender
  - 可以先使用 Human 自己作为 workflow sender
  - 以确保 `automation_ingress` 真实可用

- **长期推荐策略**
  - 不应长期把 automation 伪装成 Human 本人
  - 更稳的做法是把一个显式可信的 automation sender / bot 纳入 `automation_ingress` allow policy
  - 让 provenance 保持清晰：
    - Human action 仍是 Human
    - Base workflow / bot automation 仍是 automation

因此当前 contract 结论是：

> `automation_ingress` 应允许“可信 automation sender”进入，
> 但在 allow policy 尚未显式配置前，先采用能稳定工作的发送人策略；
> 不把“必须由 Human 本人发送”写成 ACR core truth。

### Current binding conclusion
当前进一步采纳一个更稳定的 surface taxonomy：

> `automation_ingress` / `agent_coordination` / `governance_escalation`
> 才是长期语义；`dispatch / review` 只是当前 action/workflow 与默认 binding 的实现期字面量。

这意味着：
- `automation-ingress` 当前应被理解为 `automation_ingress` 的默认 binding
- `agent-coordination` 当前应被理解为 `agent_coordination` 的默认 binding
- `WeChat DM` 当前应被理解为 `governance_escalation` 的默认 binding
- 上述 binding 只是已验证可用的默认 transport，不是 ACR 长期唯一、也不是必须的 transport
- `automation_ingress` 当前应被理解为 multi-source surface：
  - 飞书自动化可通过 Feishu 群进入
  - Discord automation 可通过 Discord 群进入
  - Telegram automation 可通过 Telegram 群进入
- `agent_coordination` 当前则更适合作为单一主工作面：
  - 一个显式配置的 coordination 群足以承接 agent 间流转
  - 需要 Human 关注时再升级到 `WeChat DM`
- 若未来某个外部 automation 只支持 Discord：
  - 仍应进入同一个逻辑 `automation_ingress`
  - 只是 concrete binding 从 Feishu chat 换成 Discord channel
- ACR core 继续只消费归一化后的 ingress object / `NormalizedEnvelope`
  - 不应把 “必须来自飞书某个群” 写进 core truth

## Core decision
当前建议的第一种 Feishu action ingress 是：

> **Feishu IM message transport first**
> `card action` 可作为后续的人机工学增强层，
> `Base table / form` 不作为第一种 workflow ingress。

## Why this is the first slice
### 1. 它与当前 ACR 主链最贴合
当前 ACR / OpenClaw 已经有：
- message-only ingress path
- structured wrapper recognition
- `NormalizedEnvelope`
- route / trace / safe-fail

这意味着第一种 Feishu ingress 若也走 IM message transport，可以最大程度复用当前主链，而不是另起一套 callback / polling / table watcher 体系。

### 2. 它更符合 “Feishu 是 operating surface，不是真相层”
如果第一刀就把 Base 表做成 action ingress：
- 容易让 `Projects / Tasks / Snapshots` 看起来像 command bus
- 容易把“记录存在”误当成“动作已提交”
- 容易把表单编辑态、草稿态、运行态混到同一个 row object

这会让 Feishu 更像 truth host，而不是 interaction surface。

### 3. 它天然具备更好的 safe-fail 回显面
message ingress 的优势是：
- 同一 chat / thread 可原地回执
- malformed payload / unresolved project / unknown action 可即时解释
- 不需要人再去看另一张表或另一个 dashboard 才知道失败原因

### 4. 它更容易尽快形成真实工作闭环
如果目标是尽快让 `Feishu + OpenClaw + Codex` 真正跑起来：
- 先有一个可用、可解释、可 safe-fail 的 message ingress
- 再在它之上叠 card action

这条路径比“先做 Base / form 驱动 workflow ingress”更短、更稳。

## Not recommended as first ingress
### 1. Base table row ingress
当前不建议把 Base 表作为第一种 action ingress。

原因：
- row object 太像 truth / backlog / projection，对边界伤害最大
- 需要定义 draft / submitted / accepted / failed / resolved 的额外状态机
- 需要额外解决 polling、dedupe、编辑态重提、重复 submit
- safe-fail 无法天然原地回显

### 2. Feishu form ingress
表单也不建议作为第一刀。

原因：
- 更适合一次性采集结构化输入，不适合作为日常 workflow ingress front door
- 与主线程上下文、消息回执、后续追问的连接更弱
- 很容易把“采集 UI”误当成长期 action bus

## Transport vs contract
这里要明确区分两层：

### Transport layer
当前 first slice 的 transport 是：
- Feishu IM message
- chat / thread / reply context

但长期 contract 不应把 transport 固定成 Feishu。

更稳的理解是：
- 当前已验证的默认 transport：
  - `automation-ingress`
  - `agent-coordination`
- future-compatible transport：
  - Discord channel
  - Telegram group / chat
  - 其他能把 structured action 送入 OpenClaw / ACR 的 session surface

也就是说：
- transport 可以更换
- workflow surface 不应更换
- binding 应通过显式 config / target object 表达，而不是写死在 runtime 里

### ACR-facing contract layer
真正进入 ACR 的仍应是：
- `NormalizedEnvelope`

也就是说：
- Feishu ingress adapter 负责把 IM message 或 card action payload 归一化
- ACR core 继续只消费统一 `NormalizedEnvelope`

## Relationship to current OpenClaw protocol
当前 OpenClaw plugin 已经支持：
- message-only ingress
- `[ACR_AUTOMATION] ... [/ACR_AUTOMATION]` structured wrapper recognition

因此第一种 Feishu ingress 的推荐路径不是重新发明一套完全不同的 ACR-facing contract，而是：

1. Feishu IM message / card action 进入 adapter
2. adapter 组装结构化 action request
3. adapter 再转成当前 ACR 可消费的 structured ingress object
4. 最终进入现有 `NormalizedEnvelope -> route -> service/safe-fail` 主链

## First-slice ingress surfaces
当前建议把第一版 surface 分成两层。

### Surface A — canonical first slice
- `Feishu IM structured message`

用途：
- 最快打通真实 human-triggered workflow ingress
- 与当前 OpenClaw message-only path 直接兼容

### Surface B — ergonomic upgrade
- `Feishu card action`

用途：
- 提升操作体验
- 让人类不必手写结构化 payload

但当前不建议把它当作第一实现目标，因为：
- 它应建立在已稳定的 message/contract 之上
- 否则容易把 card callback、payload schema、runtime bridge 一次性耦合在一起

## First-slice action scope
第一刀建议只允许已与 ACR 主链自然对齐的动作。

当前已稳定通过 live 验证的 allowlist：
- `dispatch`
- `review`

当前已进入实现态的第一条扩展动作：
- `review_resolution`

后续可再扩：
- project-local workflow actions
- escalation ack / resolve
- explicit sync / reconcile actions

当前不建议第一刀就支持：
- 任意 free-text 解析成 action
- 大量 project-specific custom verbs
- 直接修改 project truth 的动作

补充说明：
- 当前虽然 first slice 是在 Feishu 群里 live-validated
- 但动作 allowlist 应绑定到逻辑 surface，而不是绑定到 “只能从飞书群触发”
- 因此未来若 `dispatch` 或 `review` 由 Discord / 其他 transport 触发，只要能归一化到相同 ingress contract，就不需要重写 ACR core
- 当前第一条已实现的扩展动作是：
  - `review_resolution`
  - 用于承接 Human 在 `Tasks / Bugs` card 上对 `Reviewing` 阶段做出的验收 / 驳回决策
  - 它不是新的 `dispatch`
  - 但它依然属于外部 structured input，因此应进入 `automation_ingress`
  - 不应误送进 `agent_coordination`

当前 live Base 也已启用 `Tasks` 的两条 workflow，作为 `automation_ingress` 的第一个 Base automation source：
- `<task-review-accepted-workflow-id>`
  - `Tasks Reviewing -> Done`
  - 发送 `review_resolution / accepted`
- `<task-review-rejected-workflow-id>`
  - `Tasks Reviewing -> Todo`
  - 发送 `review_resolution / rejected`

当前仍未扩到：
- `Bugs`
- 非 review-boundary 的任意状态编辑
- 其他 transport 的自动化入口

## Ingress object
当前建议在 Feishu adapter 层先引入一个 adapter-local object：

### `FeishuActionIngressRequest`
- `ingress_surface`
  - `im_message | card_action`
- `request_id`
  - 当前 ingress 的稳定幂等键
- `project_ref`
  - 人类输入的原始 project 锚点
- `resolved_project_id`
  - adapter 若已明确解析到规范 project id，可填
- `action_name`
- `workflow`
- `parameters`
- `requested_by`
  - `open_id / user_id / display_name`
- `source_chat_id`
- `source_thread_id`
- `source_message_id`
- `reply_target`
- `trace_id`
- `raw_payload_ref`
- `text`

对于下一条 `review_resolution` use case，当前建议的最小参数扩展是：
- `decision`
  - `accepted | rejected`
- 显式 row anchor
  - `task_record_id`
  - 或 `bug_record_id`
- `actor`
- `comment / reason`（可选）

## Mapping to `NormalizedEnvelope`
第一刀不要求立刻扩 `NormalizedEnvelope` schema。

当前建议映射如下：
- `project_ref -> project_ref`
- `resolved_project_id -> resolved_project_id`
- `action_name -> action_name`
- `workflow -> workflow`
- `parameters -> parameters`
- `reply_target -> reply_target`
- `trace_id -> trace_id`
- `source_message_id -> raw_message_ref`
- `text -> text`
- `source_type = automation`
- `channel_type = feishu`

### Why `source_type=automation` for now
虽然触发者是 Human，但在当前 Step 2 contract 里：
- 结构化 action ingress
- route / safe-fail
- service-first bridge

都是围绕“structured automation-like ingress”建立的。

因此第一刀更稳的做法是：
- 继续复用 `source_type=automation`
- 把 `requested_by` 作为 adapter-local metadata / audit data 保留

若未来 `NormalizedEnvelope` 需要显式区分：
- `human_structured`
- `system_automation`

再单独升级 core contract。

## Dedupe and idempotency
### Stable key
第一刀建议：
- `request_id` 作为 ingress-side stable key

来源优先级：
1. card action callback event id
2. source message id
3. adapter 显式生成的 request id

### Rule
同一个 `request_id`：
- 不应二次触发同一条 workflow ingress
- 可在 safe-fail / ack / audit 中被重放读取

## Reply rule
第一刀的 reply 目标应该尽量是：
- same chat
- same thread / reply chain

也就是说：
- action ingress 的 safe-fail
- accept / reject
- minimal ack

都应优先回到原消息上下文，而不是跳到另一张表或另一个 channel。

## Safe-fail rules
以下情况当前必须 safe-fail，并原地回显：

### 1. malformed structured action
- payload 无法可靠解析
- 缺 `action_name`
- 缺必要参数

### 2. unresolved project
- 该 action 要求 resolved project
- 当前无法从 payload / explicit project_ref 解析到项目

### 3. unknown action
- 不在当前 allowlist
- 或项目侧 manifest 中没有对应 action

### 4. missing service handler
- action 已被声明为 `service` route
- 但当前无可用 handler / bridge

这些规则应直接继承当前：
- [normalized-envelope-contract.md](<repo-root>/plan/active/normalized-envelope-contract.md:1)
- [route-resolution-trace-safe-fail-contract.md](<repo-root>/plan/active/route-resolution-trace-safe-fail-contract.md:1)

## Approval and governance rule
第一刀 ingress 只负责：
- 提交结构化 action request
- 获得 ack / safe-fail

它不负责：
- 绕过 ACR route / service contract
- 直接修改 workflow truth
- 直接修改 project truth

这意味着：
- Feishu IM message 只是 interaction surface
- 真正的 authority 仍在 ACR + orchestrator / project docs

## Audit trail
每条 Feishu ingress 至少应保留：
- `request_id`
- `trace_id`
- `requested_by`
- `ingress_surface`
- `source_chat_id`
- `source_thread_id`
- `source_message_id`
- `project_ref`
- `resolved_project_id`
- `action_name`
- `workflow`
- `result`

这样后续才有可能：
- 做 dedupe
- 做 replay
- 做 reconcile
- 解释“这条动作是从哪来的，为什么失败/成功”

## Recommended first implementation boundary
如果开始做第一版 Feishu action ingress，我建议严格收在下面这条边界内：

1. 只做 `Feishu IM structured message`
2. 只支持 `dispatch / review`
3. 只要求 adapter -> `NormalizedEnvelope` 的稳定转换
4. 只要求原地 safe-fail / minimal ack
5. 不做：
   - Base row ingress
   - form ingress
   - free-text intent parsing
   - generalized natural-language workflow extraction
   - direct workflow truth mutation

## Recommended follow-ups
在这份 contract 之后，最自然的后续讨论顺序是：

1. `card action` 是否作为第二层 ergonomic surface
2. ingress audit trail 的宿主放在哪
3. business notification 的第一种 Feishu delivery surface
4. escalation ack / resolve 是否也走 IM message surface

## Relationship to Feishu sync architecture
本文档是 [feishu-sync-architecture-note.md](<repo-root>/plan/active/feishu-sync-architecture-note.md:1) 中 `Action Ingress` 那一行的第一份细化 contract。
