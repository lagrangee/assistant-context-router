# Feishu Task/Bug Ownership and Acceptance Contract

## Purpose
为当前 Feishu `Tasks / Bugs` 表定义一份最小 ownership 与 acceptance policy contract。

本文档回答：
- `Tasks / Bugs` 里哪些字段应由 ACR 写，哪些字段应继续由 Human 或 workflow role 维护
- `状态` 为什么不能简单视为纯 Human-owned 或纯 ACR-owned
- `acceptance_mode` 与 `completion_notify_mode` 是否应进入 card 字段
- project default 与 row-level override 应如何配合
- 在不先改表结构的前提下，当前应先把哪些结论钉住

本文档不授权：
- 直接修改 `Tasks / Bugs` 表结构
- 自动新增字段、枚举或 relation
- 直接把 `Tasks / Bugs` 变成 ACR / workflow truth host

补充：
- 关于 `Todo / Doing / Fixing / Reviewing / Done / Fixed` 的 work-surface 语义，以及哪些状态迁移才应触发 automation ingress，当前以 [feishu-work-surface-operating-model.md](<repo-root>/plan/active/feishu-work-surface-operating-model.md:1) 为准
- 本文档更聚焦字段 ownership、acceptance policy、以及 writeback/runtime 行为

## Current implemented schema slice
当前已在 live Base `private config host` 完成第一批 schema 变更：

### `Dict Definition`
已新增：
- `ACR验收模式`
  - field id: `fldZVRwh9D`
- `ACR完成提醒`
  - field id: `fldVqYRVGN`

并已按当前约定补齐前三条可视化记录：
- `继承默认 / 继承默认`
- `人工验收 / 完成边界提醒`
- `允许Agent完结 / 完成边界不提醒`

### `Tasks`
已新增：
- `ACR验收模式`
  - field id: `fldXclABEl`
  - `dynamic_options_source -> Dict Definition.ACR验收模式`
- `ACR完成提醒`
  - field id: `fldWkXqGSu`
  - `dynamic_options_source -> Dict Definition.ACR完成提醒`
- `ACR开始执行时间`
  - field id: `fldhwGhwH7`
  - type: `datetime`

### `Bugs`
已新增：
- `ACR验收模式`
  - field id: `fldunzIP1a`
  - `dynamic_options_source -> Dict Definition.ACR验收模式`
- `ACR完成提醒`
  - field id: `fldKgFKH1q`
  - `dynamic_options_source -> Dict Definition.ACR完成提醒`
- `ACR开始执行时间`
  - field id: `fldnOeCVPf`
  - type: `datetime`

这意味着：
- 这一轮 schema 讨论已经不再只是 proposal
- 后续 adapter / automation 可以开始稳定读取这些字段
- 但 row-level writeback policy 仍需继续按本文档约束推进，不应因为字段已存在就自动越权收口

## Current implemented writeback slice
当前 repo 已落地第一批 `Task/Bug writeback` runtime slice：

### Runtime hook
- writeback 现在接在真实 `service path` 上
- 触发点：
  - structured automation 进入 ACR
  - route 到 `service`
  - `serviceResult` 返回后
  - append lane event 之后
  - 执行 `Task/Bug writeback observer`
- observer failure 采用 safe-fail 语义，不反向打断 ACR 主链

### Row anchor rule
第一刀只接受显式 row anchor，不做猜测式匹配。

当前支持：
- `task_record_id`
- `taskRecordId`
- `bug_record_id`
- `bugRecordId`

当前明确不做：
- 根据 `task_id` 反查 row
- 根据 `resource_key` 反查 row
- fuzzy title match

### Project default host
project default 当前已真实接入 project-owned `router.yaml`：

```yaml
task_bug_policy:
  defaults:
    acceptance_mode: manual_acceptance
    completion_notify_mode: no_dm_on_completion_boundary
```

当前 loader / merge 语义已实现：
- global / project router config merge 后，`task_bug_policy.defaults` 会进入 runtime
- row-level override 继续通过：
  - `ACR验收模式`
  - `ACR完成提醒`

### Self-hosted harness status
`proj-assistant-context-router` 当前也已从 validation-only harness 进入 semantic bridge harness：

- repo root 已新增 [router.yaml](<repo-root>/router.yaml:1)
- validation fixture [validation/service-results.json](<repo-root>/validation/service-results.json:1) 仍保留为旧 rehearsal fixture，但当前 live router 不再使用它

当前 shape 保持克制：
- `dispatch`
  - `target_kind: service`
  - `workflow: dispatch`
- `review`
  - `target_kind: service`
  - `workflow: review`
- `review_resolution`
  - `target_kind: service`
  - `workflow: review`
- `append_project_note`
  - `target_kind: project_session`
  - `workflow: general`
- `service_binding.runtime_kind = feishu_task_bug_semantic`
- `service_binding.target_ref = agent:main:main`
- `task_bug_policy.defaults.*` 与当前 contract 保持一致：
  - `manual_acceptance`
  - `no_dm_on_completion_boundary`

这意味着：
- ACR 项目本身已不再缺 project-side router contract
- `dispatch` 已不再按 fixture 返回固定结果，而是会读取真实 `Task/Bug` row 并投递 main-session execution request
- 当前 self-hosted live anchor 也已就位：
  - `Projects` row:
    - `proj-assistant-context-router`
    - record id: `<projects-row-record-id>`
  - validation `Task` row:
    - title: `[ACR self-host] live validate Task writeback`
    - record id: `<validation-task-record-id>`
- 当前下一条最小动作已收敛为重启后的 Human live acceptance：
  - 从 Feishu card 触发 `Todo -> Doing/Fixing`
  - 验证 dispatch 群收到 semantic queued 回执
  - 验证 main session 收到含 card context 的 semantic execution request
  - 验证该 row 是否保持执行中并写入：
    - `current_step`
    - `step_result`
    - `next_action`
    - `last_event_at`
    - `ACR开始执行时间`
  - 验证 agent 在 assistant output 中产出的 boundary block 会由 ACR 自动捕获，并按 `acceptance_mode` 推进到 `Reviewing` 或 `Done / Fixed`

当前这轮 self-hosted live validate 已真实通过：
- `automation-ingress` 群收到：
  - `Accepted dispatch for proj-assistant-context-router`
- validation `Task` row `<validation-task-record-id>` 已真实进入：
  - `状态 = Doing`
  - `current_step = EXECUTE`
  - `step_result = in_progress`

这说明：
- 当前 `Task/Bug writeback first slice` 不再只是 implementation/test 通过
- 它已经在 `proj-assistant-context-router` 自己身上完成了一轮真实 self-hosted live validate

### Current write set
第一刀当前已真实写入：

#### Common
- `current_step`
- `step_result`
- `next_action`
- `last_event_at`

#### Runtime milestone
- `ACR开始执行时间`
  - 只在 row 首次进入 `Doing / Fixing` 时写入
  - 已有值则不覆盖

#### Task-only
- `执行摘要`

#### Status
当前只推进非终态状态：
- Task:
  - `Todo -> Doing`
  - `Doing/Pending -> Reviewing`
- Bug:
  - `Todo -> Fixing`
  - `Fixing -> Reviewing`

当前也已补上第一条 human-resolution 对齐：
- `review_resolution / accepted`
  - Task -> `Done`
  - Bug -> `Fixed`
  - `current_step = COMPLETE`
  - `step_result = accepted`
- `review_resolution / rejected`
  - Task -> `Todo`
  - Bug -> `Todo`
  - `current_step = REPLAN`
  - `step_result = rejected`

### Current mapping semantics
当前内建映射保持克制：
- `dispatch / accepted / queued`
  - Task -> `Doing`
  - Bug -> `Fixing`
  - `current_step = EXECUTE`
  - `step_result = in_progress`
- `review workflow`
  - `状态 = Reviewing`
  - `current_step = REVIEW_WAIT`
  - `step_result = need_review`
- `review_resolution / accepted`
  - `状态 = Done / Fixed`
  - `current_step = COMPLETE`
  - `step_result = accepted`
- `review_resolution / rejected`
  - `状态 = Todo`
  - `current_step = REPLAN`
  - `step_result = rejected`
- `blocked / needs_escalation`
  - `状态 = Reviewing`
  - `current_step = REVIEW_WAIT`
  - `step_result = blocked` 或 `need_review`
- `service error / rejected`
  - 不自动推进终态
  - `current_step = REPORT`
  - `step_result = failed`

### Current guardrails
当前实现已明确：
- terminal row 默认 noop：
  - Task: `Done / Archived`
  - Bug: `Fixed / Archived`
- `review_resolution` 是例外：
  - 对 `Done / Fixed` 不做 terminal noop
  - 允许 Human 先改 card，再由 ACR 对齐 `current_step / step_result / next_action`
- 避免把已在 `Reviewing` 的 row 回退成 `Doing / Fixing`
- 无显式 `complete / review_resolution` 语义时，当前仍不自动写：
  - Task `Done`
  - Bug `Fixed`
  - `实际完成时间`
  - `修复结果`

补充说明：
- 上述 “当前仍不自动写 Task `Done` / Bug `Fixed`” 指的是没有 explicit boundary 的自主推进终态
- 不包括 Human 已明确给出 `review_resolution`，或 agent 已明确给出 `complete` 且 `acceptance_mode = agent_can_finalize` 的场景

### Validation
当前 implementation tests 已覆盖并全绿：`184/184`

已覆盖：
- `task_bug_policy.defaults` 解析与 merge
- explicit row anchor 检测
- Task in-progress writeback
- Bug review / blocked writeback
- terminal row noop
- `review_resolution / accepted` 可在 Human 已先将 row 置为 `Done / Fixed` 后继续对齐字段
- `review_resolution / rejected` 可把 row 对齐回 `Todo`
- live enum drift 现在会在 writeback preflight 阶段 clear fail
- service path observer 能收到 project-level policy default

## Current enum drift audit
当前已对 live Base `private config host` 的 `Dict Definition` 与 `Tasks / Bugs` 动态下拉源做了一轮完整对账，并已完成最小修复。

### 已对齐
- `Task状态`
  - `Todo / Doing / Done / Pending / Reviewing / Archived`
- `Bug状态`
  - `Todo / Fixing / Reviewing / Fixed / Archived`
- `ACR验收模式`
  - `继承默认 / 人工验收 / 允许Agent完结`
- `ACR完成提醒`
  - `继承默认 / 完成边界提醒 / 完成边界不提醒`

这些字段与当前 ACR 已实现的 write/read 语义是一致的，不构成当前 blocker。

### 曾经缺失、现已补齐
- `current_step`
  - 当前 live options：
    - `ACK / PLAN / EXECUTE / REPORT / REVIEW_WAIT / FINALIZE`
  - 当前 ACR writeback 已真实需要：
    - `EXECUTE / REVIEW_WAIT / REPORT`
    - 以及 `review_resolution` 引入的 `COMPLETE / REPLAN`
  - 当前已补齐：
    - `COMPLETE`
    - `REPLAN`

- `step_result`
  - 当前 live options：
    - `success / failed / need_review / blocked / in_progress`
  - 当前 ACR writeback 已真实需要：
    - `in_progress / need_review / blocked / failed`
    - 以及 `review_resolution` 引入的 `accepted / rejected`
  - 当前已补齐：
    - `accepted`
    - `rejected`

这意味着先前的 live blocker 已解除。

### `修复结果`
当前采纳为 Bug agent 的 proposed result，而不是 Human 验收状态。

推荐有效值：
- `Fixed`
- `Won't fix`
- `Can't rep`

关键边界：
- `Need review` 不应作为 `修复结果` 的业务枚举继续使用
- `need_review` 只属于 ACR runtime 字段 `step_result`
- Human 是否接受 agent 的 proposed result，由 `Reviewing -> Fixed / Todo` 的状态迁移表达
- ACR 只在 Bug `complete` 明确携带 `fix_result` 时写入 `修复结果`
- 若 Bug `complete` 缺少 `fix_result`，ACR 应 fail closed，不默认猜成 `Fixed`

- `Work Surface状态`
  - 当前存在于 `Dict Definition`
  - 但 `Work Surface Snapshots.状态` 当前是独立 select，不依赖该动态源
  - 结论：
    - 它不是当前 `Task/Bug writeback` 路径的 blocker
    - 也不应与 `Task状态 / Bug状态` 混为同一类 drift

## Runtime guardrail for enum drift
当前已新增一条实现期 guardrail：

- `Task/Bug writeback` 在生成 `nextFields` 后、真正调用 Feishu upsert 前，会先做 select option coverage 预检
- 若 live field options 缺少即将写入的枚举值，会直接 clear fail，错误形如：
  - `missing-feishu-enum-options:task:current_step=COMPLETE,step_result=accepted`
  - `missing-feishu-enum-options:bug:step_result=rejected`
- 这条 guardrail 当前已经进入实现与测试覆盖

这意味着：
- 问题会在 ACR 侧被更早暴露
- 不再需要等 Feishu 返回模糊 `validation_error` 才知道是 enum drift
- 也避免下一次把问题误判成“消息没进 ACR”或“进程没 reload”

### Why this still does not replace schema review
这条 guardrail 只负责更早暴露 drift，不会替代 schema 治理。

也就是说：
- 它不会自动往 `Dict Definition` 填选项
- 它不会偷偷修改 live Base
- 真正的修复仍然是先 review 再补齐缺失 enum

### Resolution status
当前 live Base 已真实新增两条 `Dict Definition` 记录：

- `current_step = REPLAN`
  - `step_result = rejected`
  - record id: `<dict-definition-record-id-a>`
- `current_step = COMPLETE`
  - `step_result = accepted`
  - record id: `<dict-definition-record-id-b>`

补齐后已重新使用当前仓库代码对 validation task `<validation-task-record-id>` 做 live writeback，当前 row 已对齐为：
- `状态 = Done`
- `current_step = COMPLETE`
- `step_result = accepted`
- `next_action = 已验收通过: Review resolution recorded for proj-assistant-context-router`
- `执行摘要 = Review resolution recorded for proj-assistant-context-router`

## Human acceptance resolution ingress
当前进一步采纳一个关键判断：

> Human 在 card 上对 `Reviewing` 阶段做出的验收/驳回动作，  
> 应触发一条 structured automation 回流到 ACR，  
> 但这不是新的 `dispatch`；它属于外部 structured input，当前应通过 `automation_ingress` 回流到 ACR。

### Why this must re-enter ACR
如果 Human 在 Base 上手动把 row：
- `Reviewing -> Done / Fixed`
- `Reviewing -> Todo`

但这个动作没有回流到 ACR，就会出现：
- Base card 本地状态已经变化
- ACR lane / notification / governance 并不知道 Human 已做决策
- Feishu card 看起来像 truth host，而 ACR truth 落后

因此当前采纳的最小规则是：
- **manual review decision 应重新进入 ACR**
- 由 ACR 再决定：
  - 是否正式收口
  - 是否 reopen
  - 是否继续通知 / 升级

### Surface rule
这类回流动作不应被误送进 `agent_coordination`。

原因：
- 它不是 agent 间内部流转
- 它不是内部 review 协作消息
- 它本质上是 Human / 外部系统对 ACR 给出的结构化决策输入

当前推荐：
- 通过 Feishu 自动化将这类事件送入 `automation_ingress`
- 当前默认 binding 仍是 `automation-ingress`
- 若需要 Human governance，再由 ACR 升级到 `WeChat DM`

### Canonical transitions
当前建议只对 review 边界的手动状态变化触发 automation：

- `Reviewing -> Done`
  - 视为 `accepted`
- `Reviewing -> Fixed`
  - 视为 `accepted`
- `Reviewing -> Todo`
  - 视为 `rejected` 或 `reopened`

当前不建议第一刀就对所有手动状态编辑都触发 automation。

### Live Base workflow status
当前 live Base 已为 `Tasks` 与 `Bugs` 都落下并启用最小 workflow：

- `<task-review-accepted-workflow-id>`
  - `Tasks Reviewing -> Done`
  - 自动发送 `review_resolution / accepted` 到当前 `automation_ingress`
- `<task-review-rejected-workflow-id>`
  - `Tasks Reviewing -> Todo`
  - 自动发送 `review_resolution / rejected` 到当前 `automation_ingress`
- `<bug-review-accepted-workflow-id>`
  - `Bugs Reviewing -> Fixed`
  - 自动发送 `review_resolution / accepted` 到当前 `automation_ingress`
- `<bug-review-rejected-workflow-id>`
  - `Bugs Reviewing -> Todo`
  - 自动发送 `review_resolution / rejected` 到当前 `automation_ingress`

当前仍保持克制：
- 只覆盖 `Reviewing -> Done/Todo/Fixed`
- 只覆盖 `review_resolution` 的 accepted/rejected 回流
- 不把其他手动状态编辑一并自动化

### Minimum ingress shape
当前建议的最小 payload 语义是：
- `workflow = review`
- `action_name = review_resolution`
- `decision = accepted | rejected`
- 显式 row anchor：
  - `task_record_id`
  - 或 `bug_record_id`
- `project_id`
- `actor`
- `comment / reason`（可选）
- `trace_id`
- `message_id`

### Loop guards
为了避免 Base 自动化与 ACR writeback 打架，当前建议同时采纳以下 guardrails：

- 只对 **Human 手动编辑** 触发
- 只对 **review boundary transition** 触发
- 不因 ACR-owned 字段更新触发
  - 例如：
    - `current_step`
    - `step_result`
    - `next_action`
    - `last_event_at`
    - `执行摘要`
    - `ACR开始执行时间`
- 不因普通 `Doing / Fixing` 中间态编辑触发

如果 Feishu 自动化在“编辑人类型 / 边界状态过滤”上做不到足够可靠，当前更稳的替代方案是：
- 先引入一个显式的人类验收动作字段
- 再由该字段触发 `review_resolution`
- 而不是对任意 `状态` 变更一概触发

### Relationship to acceptance_mode
这类 `review_resolution` 的意义，与 `acceptance_mode` 直接相关：

- `manual_acceptance`
  - Human 的 `accepted / rejected` 决策应重新进入 ACR
  - ACR 不应越过这一步自动写终态
- `agent_can_finalize`
  - ACR 可以自行收口到终态
  - Human 若仍手动改 card，则应视为显式 override / reopen decision

补充：
- `complete`
  - 是 ACR / agent 在执行侧发出的“已完成”结构化信号
  - 必须携带 concrete `parameters.summary`
    - ACR 不再用 card title / headline 兜底成执行摘要
    - 缺少 summary 或复制 placeholder 时，应 fail closed 为 blocked / escalation，而不是推进完成边界
  - 应携带 `parameters.evidence` 描述 changed records / files / commands / verification evidence
  - 若 `acceptance_mode = manual_acceptance`
    - `complete` 只推进到 `Reviewing / REVIEW_WAIT / need_review`
  - 若 `acceptance_mode = agent_can_finalize`
    - `complete` 才可直接推进到 `Done / Fixed / COMPLETE / accepted`

## Why this note exists now
当前关于 Feishu 的真实产品闭环，已经不再只是：
- latest snapshot 写回 `Work Surface Snapshots`
- business notification 发到群
- governance escalation 发到 `WeChat DM`

更接近用户实际工作流的是：
1. Human 在 Feishu `Tasks / Bugs` 里维护工作对象
2. Feishu 自动化把 row 事件送入当前 `automation_ingress` binding
   - 当前默认值是 `automation-ingress`
3. ACR / Codex 执行后回写 card 上的 ACR-owned 字段
4. 若进入 agent 间协作 / governance 事项，再分流到 `agent_coordination` 或 `WeChat DM`

这要求我们先把 `Tasks / Bugs` 的字段 ownership 与 completion policy 明确下来，否则：
- ACR 容易误改 Human planning 字段
- `状态` 会在 Human / ACR 之间来回打架
- “哪些事项需要你手动验收、哪些可以 agent 自动收口” 无法稳定表达

## Core decisions
当前采纳的最小判断如下：

1. `Tasks / Bugs` 仍然首先是 Human-facing work object，不是 ACR truth host。
2. ACR 第一刀只应写 runtime projection 字段，不应覆写业务定义、计划与责任字段。
3. `状态` 应视为 **policy-gated shared field**，而不是整体归给单一 owner。
4. `acceptance_mode` 与 `completion_notify_mode` 应进入 card policy surface，但应支持：
   - `project default`
   - `row-level override`
5. 第一刀不应依赖 `resource_key`。
6. `AI 任务风险判断` 不进入 ACR writeback contract。

## Ownership classes
当前建议把 `Tasks / Bugs` 字段分成五类：

### 1. Human-owned
业务定义、计划、责任、验收标准，默认不应由 ACR runtime 覆写。

### 2. ACR-owned
运行态 projection 字段，由 ACR 单向写入。

### 3. Policy-gated shared
允许 ACR 在受 policy 约束时写入，但不应默认无条件接管。

### 4. External / ignore
外部系统或其他 agent 维护；ACR 当前忽略或只读。

### 5. Frozen / undecided
当前设计意图不清，第一刀不依赖、不覆写。

## Tasks field ownership
当前对 live `Tasks` 字段的建议分类如下。

### Human-owned
- `任务`
- `优先级`
- `截止时间`
- `DoD`
- `开始时间`
- `任务执行人`
- `依赖任务`
- `所属项目`
- `Bugs`

### ACR-owned
- `current_step`
- `step_result`
- `next_action`
- `last_event_at`
- `执行摘要`

### Policy-gated shared
- `状态`
- `实际完成时间`

### External / ignore
- `AI 任务风险判断`

### Frozen / undecided
- `resource_key`

## Bugs field ownership
当前对 live `Bugs` 字段的建议分类如下。

### Human-owned
- `描述`
- `复现方式`
- `预期结果`
- `实际结果`
- `优先级`
- `Assignee`
- `验证人`
- `所属项目`
- `关联task`

### ACR-owned
- `current_step`
- `step_result`
- `next_action`
- `last_event_at`
- `修复方式`
- `修复结果`

### Policy-gated shared
- `状态`

### Frozen / undecided
- `resource_key`

### System-owned
- `创建时间`
- `更新时间`

## Clarified field meanings
### `开始时间`
当前应视为 planning 字段，表达计划上的开始/创建时间，而不是 runtime 实际开始时间。

因此：
- `开始时间` 继续视为 Human-owned
- 若后续需要表达 ACR 执行实际启动时间，应新增独立 runtime 字段
- 推荐名称：`runtime_started_at`

### `resource_key`
当前设计意图不清，先冻结处理：
- 不拿它做幂等键
- 不拿它做外部 truth anchor
- 不纳入第一刀 writeback

### `AI 任务风险判断`
当前视为 Feishu / 外部 agent-owned：
- ACR 忽略或只读
- 不应纳入 ACR-owned write set

### `验证人`
当前视为 Human / workflow role 字段：
- 表达多 Human / 多 agent 协作下的验收或验证责任
- 第一刀 ACR 只读，不应覆写

## State ownership is phase-based
`状态` 当前不建议整体归类为某一个 owner，而建议按流转阶段分段定义 ownership。

### Task state path
参考既有 Base 设计资产，当前建议仍沿：
- `Todo -> Doing -> Reviewing -> Done`

第一刀 ownership 语义：
- `Todo -> Doing`
  - ACR 可写
- `Doing -> Reviewing`
  - ACR 可写
- `Reviewing -> Done`
  - 仅在 `acceptance_mode = agent_can_finalize` 时 ACR 可写
  - 否则由 Human 在验收后写入

### Bug state path
当前建议仍沿：
- `Todo -> Fixing -> Reviewing -> Fixed`

第一刀 ownership 语义：
- `Todo -> Fixing`
  - ACR 可写
- `Fixing -> Reviewing`
  - ACR 可写
- `Reviewing -> Fixed`
  - 仅在 `acceptance_mode = agent_can_finalize` 时 ACR 可写
  - 否则由 Human 在验收后写入

## Policy fields
当前采纳：`acceptance_mode` 与 `completion_notify_mode` 应作为 card policy surface 的字段概念存在，而不是只靠代码常量或全局 hardcode。

但它们不应只有 row-level value；更稳的模型是：
- `project default`
- `row-level override`

## `acceptance_mode`
作用：
- 决定 ACR 是否有权跨过 `Reviewing -> Done/Fixed` 这道边界

建议值：
- `inherit`
- `manual_acceptance`
- `agent_can_finalize`

语义：
- `manual_acceptance`
  - ACR 最多推进到 `Reviewing`
  - 最终 `Done / Fixed` 由 Human 验收后写入
- `agent_can_finalize`
  - ACR 可在满足既有 workflow 约束时直接写终态

## `completion_notify_mode`
作用：
- 决定当 row 到达“完成边界”时，是否额外发 `WeChat DM`

这里的“完成边界”不固定等于 `Done / Fixed`，而取决于 `acceptance_mode`：
- 若 `acceptance_mode = manual_acceptance`
  - 完成边界是进入 `Reviewing`
- 若 `acceptance_mode = agent_can_finalize`
  - 完成边界是进入 `Done / Fixed`

建议值：
- `inherit`
- `dm_on_completion_boundary`
- `no_dm_on_completion_boundary`

这样可以覆盖两类真实需求：
- 需要 Human 手动验收的 row：到 `Reviewing` 时就 DM
- 可由 agent 自动收口的 row：只有真正完成时才决定是否 DM

## Default and override model
当前建议采用：
- `project default`
- `row-level override`

解析顺序：
1. row 字段若为显式值，则使用 row override
2. row 字段若为 `inherit` 或空，则回退到 project default
3. project default 若缺失，则使用系统安全默认值

当前建议的系统安全默认值：
- `acceptance_mode = manual_acceptance`
- `completion_notify_mode = no_dm_on_completion_boundary`

这样做的原因：
- alpha 阶段先偏保守，避免 agent 默认越权收口
- `WeChat DM` 继续保持高信噪比，不默认被 completed spam 污染

## Project default host
当前采纳：

> **project default 应落在 project-owned `router.yaml`，而不是 `project.yaml` 或 `feishu-adapter.yaml`。**

原因：
- `acceptance_mode` 与 `completion_notify_mode` 决定的是 runtime execution / writeback 行为
- 它们属于 project-owned integration policy，而不是项目 identity metadata
- `project.yaml` 更适合继续承接 `project_id / title / owner / objective` 这类项目定义信息
- `feishu-adapter.yaml` 更适合继续承接 runtime-global binding，例如：
  - Base 选择
  - channel / target binding
  - tenant 级默认 delivery policy

当前推荐的 project default shape：

```yaml
task_bug_policy:
  defaults:
    acceptance_mode: manual_acceptance
    completion_notify_mode: no_dm_on_completion_boundary
```

说明：
- 这里的 key 使用稳定的 contract literal
- 它是 project-owned truth
- Feishu card 上的 row-level 字段只负责 override，不负责承接 project default truth

## Proposed row-level field names
当前建议若后续进入 Base schema 讨论，`Tasks` 与 `Bugs` 两张表都统一新增同名 policy 字段：

- `ACR验收模式`
- `ACR完成提醒`

原因：
- 二者都属于 ACR policy surface
- 不是纯业务字段，也不是纯 runtime projection 字段
- 使用 `ACR` 前缀能降低与 Human planning 字段混淆
- `Tasks / Bugs` 统一同名字段，后续 adapter 逻辑最简单

补充：
- 若后续需要新增 runtime 开始时间字段，当前推荐名称：
  - `ACR开始执行时间`

## Proposed enum display values
当前建议 card 上的枚举显示值与 contract 语义对应如下。

### `ACR验收模式`
建议值：
- `继承默认`
- `人工验收`
- `允许Agent完结`

对应 semantic value：
- `inherit`
- `manual_acceptance`
- `agent_can_finalize`

### `ACR完成提醒`
建议值：
- `继承默认`
- `完成边界提醒`
- `完成边界不提醒`

对应 semantic value：
- `inherit`
- `dm_on_completion_boundary`
- `no_dm_on_completion_boundary`

说明：
- 显示值保持面向 Human 可读
- semantic value 保持在 contract / code 内部稳定
- `完成边界提醒` 不直接写死成“微信提醒”，以便后续 governance target 仍由配置绑定决定

## Dict Definition requirement
若后续 Human review 通过并决定真的把这两个字段加到 Base：
- 应先在 `Dict Definition` 中注册对应枚举
- 再创建 `Tasks / Bugs` 上的 select 字段

当前推荐的注册对象：
- `ACR验收模式`
- `ACR完成提醒`

这一点属于 schema 变更前置条件，不应由 runtime 偷偷创建。

## Minimum schema proposal
若下一轮进入真实 Base schema review，当前建议把 `Tasks / Bugs` 的第一批 ACR policy / runtime 字段一次讨论清楚，但仍分成：
- **必需字段**
- **强烈建议同批加入**

### A. 必需字段
| table | field | type | owner | purpose |
| --- | --- | --- | --- | --- |
| `Tasks` | `ACR验收模式` | single select | policy surface | row-level acceptance override |
| `Tasks` | `ACR完成提醒` | single select | policy surface | row-level completion-boundary notify override |
| `Bugs` | `ACR验收模式` | single select | policy surface | row-level acceptance override |
| `Bugs` | `ACR完成提醒` | single select | policy surface | row-level completion-boundary notify override |

### B. 强烈建议同批加入
| table | field | type | owner | purpose |
| --- | --- | --- | --- | --- |
| `Tasks` | `ACR开始执行时间` | datetime | ACR-owned | runtime 实际开始时间 |
| `Bugs` | `ACR开始执行时间` | datetime | ACR-owned | runtime 实际开始时间 |

原因：
- `开始时间` 已明确是 planning 字段
- `ACR开始执行时间` 是低争议的 ACR-owned runtime 字段
- 若把它留到更后面，后续 adapter / automation 很容易再次偷用 `开始时间`
- 它不依赖 Dict Definition，也不引入新的状态机复杂度

## Field-type recommendation
### `ACR验收模式`
- 类型：single select
- 允许为空：是
- 空值语义：等同 `inherit`
- 当前不建议用 checkbox / text / formula

原因：
- 它表达离散 policy 选择，而不是自由文本
- single select 最贴合 `inherit -> override` 模型

### `ACR完成提醒`
- 类型：single select
- 允许为空：是
- 空值语义：等同 `inherit`
- 当前不建议用 checkbox

原因：
- 未来 completion-boundary 不一定只对应单一 delivery 行为
- checkbox 会过早把语义压扁成“提醒 / 不提醒”

### `ACR开始执行时间`
- 类型：datetime
- 允许为空：是
- 写入规则：ACR 在 row 首次进入 `Doing / Fixing` 时写入；已有值则不回写历史覆盖

原因：
- 它是 runtime milestone，不是滚动更新时间
- 若每次都覆盖，会丢掉“第一次真正开始执行”的信息

## Dict Definition proposal
若 Human review 通过并决定真的建枚举，当前推荐先在 `Dict Definition` 注册以下对象。

### `ACR验收模式`
推荐选项：
- `继承默认`
- `人工验收`
- `允许Agent完结`

### `ACR完成提醒`
推荐选项：
- `继承默认`
- `完成边界提醒`
- `完成边界不提醒`

当前不建议在第一轮就加入：
- 更多 channel-specific 选项
- `仅群提醒 / 仅微信提醒 / 双发`
- `仅失败提醒 / 仅blocked提醒`

这些都应后置到更细的 delivery policy，而不是先塞进 card policy surface。

## Schema package status
第一批 schema package 当前已完成：

1. `Dict Definition`
   - `ACR验收模式`
   - `ACR完成提醒`
2. `Tasks / Bugs`
   - `ACR验收模式`
   - `ACR完成提醒`
   - `ACR开始执行时间`
3. runtime first slice
   - 已开始稳定读取 `ACR验收模式 / ACR完成提醒`
   - 已开始真实写入 `ACR开始执行时间`
   - 已开始真实写入：
     - `current_step`
     - `step_result`
     - `next_action`
     - `last_event_at`
     - `执行摘要`（Task）
     - `修复方式`（Bug）
     - `修复结果`（Bug complete 且显式 `fix_result`）

当前继续后置的仍是：
- `实际完成时间`

当前已进入实现态并通过 live validation：
- `completion_notify_mode` 驱动的 completion-boundary DM
  - 仅在 row / project policy 明确要求 `dm_on_completion_boundary` 时触发
  - 生成 business notification delivery，不创建 governance truth
  - target 仍通过配置化 binding 解析，不 hardcode 微信账号或 session key
  - WeChat direct channel 失败时可 fallback 到 OpenClaw main session delivery

## Relationship to escalation and notification
### 1. `completion_notify_mode` 不是 governance truth
它只决定是否额外发一条 completion-boundary DM。

真正的 governance truth 仍然在：
- `main-session escalation store`

### 2. `manual_acceptance` 不等于自动 escalation
如果 row 进入 `Reviewing`，是否进一步形成：
- `review_request`
- `main-session escalation`

仍应由 signal promotion / governance rule 决定，而不是仅凭 card policy 字段直接判定。

### 3. 普通完成不应默认污染 WeChat
只有当 row 或 project policy 明确要求时，完成边界才额外 DM。

## First-slice writeback implications
在不先改表结构的前提下，当前建议把第一刀 Task/Bug writeback 目标收口为：

### Safe now
- `current_step`
- `step_result`
- `next_action`
- `last_event_at`
- `执行摘要`（Task）
- `修复方式`（Bug）
- `修复结果`（Bug complete 且显式 `fix_result`）
- `状态` 的非终态推进：`Todo -> Doing/Fixing -> Reviewing`
- policy-gated completion first slice：
  - `complete + manual_acceptance`
    - `Reviewing / REVIEW_WAIT / need_review`
  - `complete + agent_can_finalize`
    - `Done / Fixed / COMPLETE / accepted`
  - `complete` missing concrete `summary`
    - `blocked / needs_escalation`
  - `review_resolution / accepted`
    - `Done / Fixed / COMPLETE / accepted`
  - `review_resolution / rejected`
    - `Todo / REPLAN / rejected`
- `completion_notify_mode = dm_on_completion_boundary`
  - 只在 writeback plan 产生 `completion_boundary` 更新时触发
  - 生成 business notification，而不是 governance truth
  - delivery target 使用配置化 human DM target；当前默认可解析到 `governance.default_target`
  - WeChat direct delivery failure 会 fallback 到 OpenClaw main-session delivery，并保留 delivery outbox audit
  - OpenClaw `llm_output` regression 已覆盖 Bug complete boundary：
    - pending `bug_record_id` 合并回 boundary envelope
    - `fix_result` 保留到 service/writeback 链
    - completion boundary DM 不会创建 governance delivery
  - 当前 live validation 已确认 completion-boundary WeChat DM 可收到

### Policy-gated later
- `实际完成时间`

### Defer until schema discussion
- `runtime_started_at`
- `acceptance_mode`
- `completion_notify_mode`

## Dispatch-loop implication
这份 contract 的直接用途是为后续这条闭环提供稳定边界：

`Feishu Task/Bug card`
-> `Feishu automation`
-> current `automation_ingress` binding
-> `ACR / Codex execution`
-> `Task/Bug writeback`
-> optional current `agent_coordination` binding
-> optional `WeChat DM`

在这条闭环里：
- `automation_ingress`
  - 当前默认 binding：`automation-ingress`
  - 负责外部 structured input 与对应结果回执
- `agent_coordination`
  - 当前默认 binding：`agent-coordination`
  - 负责 review / 协作工作面
- `governance_escalation`
  - 当前默认 binding：`WeChat DM`
  - 只负责 completion-boundary / governance escalation 的高信号提醒

## Not authorized yet
当前这份 contract 仍不授权：
- 无显式 `complete / review_resolution` 语义的终态推进
- 绕过 `acceptance_mode` 的自动终态推进
- 自动写 `实际完成时间`
- 缺少 explicit `fix_result` 时自动猜测 `修复结果`
- 根据 `task_id` / `resource_key` / title 做隐式 row 匹配
- 调整 `Tasks / Bugs` 现有状态枚举
- 把 `Tasks / Bugs` 接成 ACR truth host

补充：
- 当前已授权并实际创建的 Base workflow，仅限：
  - `Tasks Reviewing -> Done => review_resolution / accepted`
  - `Tasks Reviewing -> Todo => review_resolution / rejected`
  - `Bugs Reviewing -> Fixed => review_resolution / accepted`
  - `Bugs Reviewing -> Todo => review_resolution / rejected`
- 且当前这 4 条 workflow 都已完成一轮收紧：
  - 必须由 `Reviewing` 迁移到目标状态才触发
  - 不再把任意 `-> Todo` 自动解释成 `rejected`

这些仍应在后续 Human review 后，作为独立 writeback / policy slice 进入实现。
