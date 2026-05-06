# Step 2 Implementation Plan

## Purpose
把当前 Step 2 已收敛的范围、authority 边界与外部评审裁决，压缩成一份可执行的最小实施计划。

本文档回答：
- Step 2 现在到底做什么
- 哪些 contract 必须先写清
- 两边 repo 的第一批实现任务是什么
- 实施顺序应如何安排

本文档承接：
- [step2-strategy-note.md](<repo-root>/plan/active/step2-strategy-note.md:1)
- [step2-cut-tracker.md](<repo-root>/plan/active/step2-cut-tracker.md:1)
- [orchestrator-integration-boundary.md](<repo-root>/plan/active/orchestrator-integration-boundary.md:1)
- [feishu-sync-architecture-note.md](<repo-root>/plan/active/feishu-sync-architecture-note.md:1)
- [feishu-adapter-config-host-contract.md](<repo-root>/plan/active/feishu-adapter-config-host-contract.md:1)
- [feishu-project-catalog-sync-contract.md](<repo-root>/plan/active/feishu-project-catalog-sync-contract.md:1)
- [feishu-action-ingress-contract.md](<repo-root>/plan/active/feishu-action-ingress-contract.md:1)
- [feishu-business-notification-surface-contract.md](<repo-root>/plan/active/feishu-business-notification-surface-contract.md:1)
- [feishu-escalation-surface-contract.md](<repo-root>/plan/active/feishu-escalation-surface-contract.md:1)
- [feishu-task-bug-ownership-acceptance-contract.md](<repo-root>/plan/active/feishu-task-bug-ownership-acceptance-contract.md:1)
- [semantic-execution-bridge-contract.md](<repo-root>/plan/active/semantic-execution-bridge-contract.md:1)
- [orchestrator-acr-integration-contract-candidate.md](<repo-root>/plan/candidates/orchestrator-acr-integration-contract-candidate.md:1)
- [task-run-event-visibility-candidate.md](<repo-root>/plan/candidates/task-run-event-visibility-candidate.md:1)
- [external-review-round4-step2-adjudication-note.md](<repo-root>/plan/candidates/external-review-round4-step2-adjudication-note.md:1)

本文档是当前 Step 2 的 active implementation baseline。

## Step 2 goal
Step 2 的目标不是补齐所有层，而是打通这一条最小闭环：

`/project`
-> `current_project_binding`
-> route / safe-fail / trace
-> service-first ACR ↔ orchestrator seam
-> orchestrator 持有 task/run/queue/runtime/notification authority
-> Feishu 提供最小 Task/Run/Event 可见度
-> high-signal promotion 到 business notification / main-session escalation
-> `/project --save` 通过 host matrix 正确回写 `STATUS.md / RESUME.md / COLLAB.md`

只要这条闭环成立，Step 2 就算通过。

## In scope now
- `/project` 的显式 focus switch
- `current_project_binding` 作为 ACR runtime-side authority object
- `route_trace` 与 safe-fail
- `service-first` orchestrator ingress
- orchestrator authority boundary 的正式约束
- 最小 Feishu work surface
- 最小 `Task / Run / Event` visibility
- `business_notification`
- `main_session_escalation`
- `/project --save` preview/apply
- `project_contract_host_matrix`
- `cross-agent writeback obligation`
- 极薄 `orchestratorctl`
- 让 `proj-assistant-context-router` 逐步成为 ACR 的首个 self-hosted customer project

## Defer
- memory backend integration
- external worker runtime experiment
- advanced takeover / shared-thread collaboration
- 正式 `acrctl`
- `STATUS.md / RESUME.md` 的终局合并/分拆争论

## Drop from Step 2 backlog
- autonomy / proactive tasking
- replaceability engineering
- 第二个 work surface
- 独立 progress cockpit / dashboard
- generic runtime / board / memory abstraction
- 独立 artifact platform

## Self-hosting principle
`assistant-context-router` 当前不应只依赖 `demo-acr` 作为验证样板。

当前采纳的原则是：
- `proj-assistant-context-router` 应逐步成为 ACR 的首个客户项目
- 但必须通过与普通项目一致的 project-owned integration surface 接入
- 不允许在 ACR core 中为自身项目加入特判、内建 demo 路径或 hidden shortcut

这条原则的直接实现后果是：
- 短期内可先用 `demo-acr` 验证主链是否跑通
- 随后应为 `proj-assistant-context-router` 补最小 `router.yaml + validation_fixture`
- 再让 ACR 自己的真实迭代逐步替换 validation-only harness

当前这一步已落地：
- [router.yaml](<repo-root>/router.yaml:1)
- [validation/service-results.json](<repo-root>/validation/service-results.json:1)

## Must-have contracts
正式进入实现前，必须先把下面 7 个 contract 写清。

当前已先落第一份：
- [current-project-binding-contract.md](<repo-root>/plan/active/current-project-binding-contract.md:1)
- [project-contract-host-matrix.md](<repo-root>/plan/active/project-contract-host-matrix.md:1)
- [save-preview-apply-contract.md](<repo-root>/plan/active/save-preview-apply-contract.md:1)
- [route-resolution-trace-safe-fail-contract.md](<repo-root>/plan/active/route-resolution-trace-safe-fail-contract.md:1)
- [normalized-envelope-contract.md](<repo-root>/plan/active/normalized-envelope-contract.md:1)
- [service-first-orchestrator-action-result-contract.md](<repo-root>/plan/active/service-first-orchestrator-action-result-contract.md:1)
- [project-owned-service-bridge-contract.md](<repo-root>/plan/active/project-owned-service-bridge-contract.md:1)
- [signal-promotion-contract.md](<repo-root>/plan/active/signal-promotion-contract.md:1)
- [project-session-shadow-lane-contract.md](<repo-root>/plan/active/project-session-shadow-lane-contract.md:1)
- [minimal-visibility-evidence-contract.md](<repo-root>/plan/active/minimal-visibility-evidence-contract.md:1)
- [work-surface-projection-contract.md](<repo-root>/plan/active/work-surface-projection-contract.md:1)

| contract | why now | what breaks if missing |
| --- | --- | --- |
| `current_project_binding` | Step 2 第一 authority object；必须明确谁能改、何时改、route 是否可碰它 | `/project`、route、`/project --save` 会互相猜当前 project，导致跨项目污染 |
| `project_contract_host_matrix + writeback obligation` | 必须明确 continuity / collab / decision 分别写到哪份 docs，谁负责写 | `STATUS.md / RESUME.md / COLLAB.md` 会双写、漏写、冲突 |
| `/save_preview_apply` | `/project --save` 是 continuity 收口口径；必须明确 scope、source、preview/apply、no silent write | `/project --save` 会退化成随意总结，或 silent write 污染 docs truth |
| `route_resolution + trace + safe_fail` | Step 2 核心就是 route 可解释、可回退、可测试 | unresolved project/action 会被硬猜，误入错误 project/workflow |
| `service_first_orchestrator_action_result` | ACR ↔ orchestrator 的主接缝；必须有最小 action/result schema | structured ingress 会回退成 free-text/project-session-first |
| `signal_promotion` | 必须明确什么留在 orchestrator，什么发 business notification，什么进 main session，什么 unresolved 才进 `COLLAB.md` | blocked/review/decision 会在 kernel、board、主会话、`COLLAB.md` 四处打架 |
| `projection_contract` | 必须明确 Feishu board、project session、minimal evidence gate 如何只做 surface/read model | board 会长成真相层，project session 会回涨成 workflow host，visibility 会变成无证据自述 |

## Implementation order
推荐按 5 个 implementation cuts 推进，而不是多线同时铺开。

### Cut 1. Binding and writeback foundation
目标：
- 先锁死 ACR 侧的 authority 边界

输出：
- `current_project_binding` contract
- `project_contract_host_matrix`
- `/project --save` preview/apply contract

完成标准：
- `/project` 是唯一修改 current binding 的显式入口
- `/project --save` 总能以 current binding 为边界形成 draft
- continuity/collab change 都能回答“写哪份 docs”

### Cut 2. Route / trace / safe-fail
目标：
- 让 route decision 可解释、可调试、可失败

输出：
- 最小 `NormalizedEnvelope`
- 最小 `RouteDecision`
- 最小 `RouteTrace`
- unresolved project / action safe-fail

完成标准：
- 每次结构化 route 都有 `trace_id`
- unresolved target 不硬猜
- trace 足以解释 route outcome

### Cut 3. Service-first orchestrator seam
目标：
- 正式把 orchestrator 接到 ACR 主路径

输出：
- `router.yaml` 或等价 manifest
- project-owned orchestrator service bridge
- action/result contract
- 极薄 `orchestratorctl`

完成标准：
- `dispatch` / `review` 一类动作默认走 structured service path
- 结果只返回最小 `accepted/queued/rejected/needs_escalation`
- 不再通过 project session 二次解释 workflow ingress

### Cut 4. Minimal visibility and signal promotion
目标：
- 让长时工作最小可见，但不制造第二真相层

输出：
- Feishu task/run summary projection
- `artifact_ref` 最小字段
- business notification path
- main-session escalation object
- signal promotion rules

完成标准：
- 人能在 Feishu 看见 task status / current run / current step / blocked-review-completed
- completion/review/block 等高信号事项可附 evidence ref
- business notification 与 main-session escalation 明确分流

### Cut 5. Project session minimal shadow lane
目标：
- 给 secretary 一个 derived read model，但不回涨成 workflow host

输出：
- `project-session-shadow-lane` contract
- append-only emission contract
- route/service/high-signal digest entries
- project session minimal summary rule

完成标准：
- project session 只承接 read-model / shadow-lane entries
- 零个 workflow state transition 由 project session authority 生效

### Cut 6. Minimal visibility + evidence
目标：
- 在不引入新 authority host 的前提下，为高信号 execution projection 增加最小 evidence pointer

输出：
- `minimal-visibility-evidence` contract
- `artifact_ref` 最小字段
- lane / notification / escalation / prompt hint evidence carry-through

完成标准：
- `artifact_ref` 可沿高信号链路稳定透传
- 普通项目问答不因 evidence 增加而扩大 prompt 注入范围
- 仍不实现 Feishu/board 真实投影

### Cut 7. Minimal work-surface projection
目标：
- 在不直接做 Feishu API 的前提下，产出一个可被 work-surface adapter 消费的最新 high-signal snapshot

输出：
- `work-surface-projection` contract
- latest high-signal snapshot per project
- adapter-ready `headline + summary + optional artifact_ref`

完成标准：
- ACR 能为每个 project 产出一个最新 work-surface snapshot
- snapshot 不改变 lane / notification / escalation authority
- 后续 Feishu adapter 只需要消费 snapshot，而不是自己拼多个宿主

### Cut 8. Feishu work-surface adapter first slice
目标：
- 在沿用既有 Feishu Base 设计资产的前提下，落第一刀真正的 work-surface adapter 消费实现

约束：
- 通过 FEISHU_BASE_TOKEN 或 config host 绑定既有 Base：private config host
- 第一刀不把当前 project-level latest snapshot 直接写入 `Tasks / Bugs`
- `Tasks / Bugs` 的 meta 设计、字段契约、状态流转逻辑作为继承参考
- `Service Runs Monitor` 不作为当前 projection 的默认目标
- 任何新增或调整 Feishu 表结构的动作都必须先与 Human 讨论确认

输出：
- [feishu-work-surface-adapter-scope-note.md](<repo-root>/plan/active/feishu-work-surface-adapter-scope-note.md:1)
- 同一 Base 内的最小 projection table 方案
- 基于 `lark-cli base` 的最小 read + upsert adapter 实现

当前已落地：
- Human review 通过后，已在同一 Base 内真实创建：
  - `Dict Definition.Work Surface状态`
  - `Work Surface Snapshots`
- adapter 默认字段名已与 live Base 对齐：
  - `Project ID`
  - `所属项目`
  - `状态`
  - `标题`
  - `摘要`
  - `更新时间`
- 已新增 manual sync / dry-run 入口
- main-session plugin 已将 project-scoped 手工 sync 收进 `/project` 参数面
  - 首选入口：`/project [<project_id>] --surface-sync [--apply]`
  - 默认 `dry_run`
  - `--apply` 才真正写 Feishu
  - 未传 `project_id` 时使用当前 `/project` binding
  - `/project` 已成为唯一公开命令入口；不再保留旧命令 alias
  - default runner 当前会先解析统一的 `work-surface binding`
    - 支持 env + optional local config host
    - 若未显式指定，则默认尝试发现 `<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`
    - 若没有显式 binding，现阶段仍保守回退到已确认的 Base token
  - `FEISHU_BASE_TOKEN` 仍可作为最直接的 env override
  - TUI command path 会直接返回 friendly sync error text，不再吞成 generic failure
- 真实 Base dry-run 已通过：`proj-bitable-pm-system`
- 第一次真实 live upsert 已通过：
  - `create` -> `update` 都已验证
  - stable record id：`<work-surface-snapshot-record-id>`
- plugin 已新增 optional `workSurfaceProjectionObserver`
  - observer 直接消费真实 signal 链产出的 snapshot 对象
  - failure safe-fail，不反向影响 ACR 主链
- implementation tests 当前全绿：`123/123`

当前下一步：
- 保持 project-scoped manual sync 作为默认入口，并优先通过 `/project --surface-sync` 覆盖 validation row
- observer hook 继续存在，但不默认自动 apply
- 决定 validation row 何时被真实业务 snapshot 覆盖，或是否需要 cleanup 策略
- 当前 Feishu 主线的 authoritative design host 继续是 [feishu-sync-architecture-note.md](<repo-root>/plan/active/feishu-sync-architecture-note.md:1)；在 live governance delivery 已验证后，后续实现顺序已收敛为：
  - `Projects` catalog sync first slice（已 implemented + auto-validated + live-validated）
  - `Business Notification` 的 Feishu IM delivery（已 implemented + auto-validated）
  - `proj-assistant-context-router` self-hosted real usage
  - 第一种 `Feishu Action Ingress`
  - 最后再进入 `card action / reconcile / backlog projection`
- 其中 `Projects` catalog sync 的第一份落地 contract 已单独收敛为 [feishu-project-catalog-sync-contract.md](<repo-root>/plan/active/feishu-project-catalog-sync-contract.md:1)，当前已明确 stable key、source precedence、first-slice write set 与 failure policy
- `Projects` catalog sync first slice 当前已落地：
  - `/project [<project_id>] --catalog-sync [--apply]`
  - 默认 `dry_run`
  - 当前已支持 `create / update / noop`
  - duplicate / drift / schema 缺失会 clear fail，而不是 silent degrade
  - `demo-acr` 已在真实 Base 上验证：
    - `dry_run = noop`
    - `apply = noop`
    - 当前 anchor record id：`<projects-catalog-record-id>`
- `Action Ingress` 的第一份落地 contract 已单独收敛为 [feishu-action-ingress-contract.md](<repo-root>/plan/active/feishu-action-ingress-contract.md:1)，当前已明确 first surface 选 `IM message transport`，`card action` 后置为 ergonomic upgrade，`Base / form` 不作为第一刀 workflow ingress
- `Business Notification` 的第一份落地 contract 已单独收敛为 [feishu-business-notification-surface-contract.md](<repo-root>/plan/active/feishu-business-notification-surface-contract.md:1)，当前已明确 first surface 选 `Feishu IM message delivery`，默认优先回原 business/work chat/thread，不先做 notification table
- `Business Notification` 的 Feishu IM delivery first slice 当前已落地：
  - 新增 `BusinessNotificationDeliveryRecord` outbox
  - plugin 默认 signal path 现在会：
    - 先 append `BusinessNotificationRecord`
    - 再 upsert delivery outbox
    - deliverable target 才走 `lark-cli im` sender
    - 无 target / unsupported target 则回落为 `record_only`
  - 当前只把下面这些 Feishu target 视为可直接投递：
    - `oc_xxx`
    - `ou_xxx`
    - `om_xxx`
    - `feishu:chat:oc_xxx`
    - `feishu:user:ou_xxx`
    - `feishu:message:om_xxx`
    - `feishu:thread:om_xxx`
  - 当前已新增 project-scoped inspect 入口：
    - `/project [<project_id>] --notifications`
  - plugin implementation tests 全绿：`170/170`
  - 当前仍未做真实 Feishu business/work chat 的 live delivery 验证
- `Tasks / Bugs` 的 writeback ownership 与 acceptance policy 边界已开始单独收敛为 [feishu-task-bug-ownership-acceptance-contract.md](<repo-root>/plan/active/feishu-task-bug-ownership-acceptance-contract.md:1)，当前已明确：
  - `状态` 是 policy-gated shared field，不是纯 Human-owned 或纯 ACR-owned
  - `acceptance_mode` 与 `completion_notify_mode` 应属于 card policy surface
  - 它们应支持 `project default + row-level override`
  - project default truth 当前建议落在 project-owned `router.yaml`：
    - `task_bug_policy.defaults.acceptance_mode`
    - `task_bug_policy.defaults.completion_notify_mode`
  - 当前 live Base 已完成第一批 schema 变更，row-level 字段名已真实落地：
    - `ACR验收模式`
    - `ACR完成提醒`
  - 当前也已同批补一个低争议 runtime 字段：
    - `ACR开始执行时间`
    - 类型：datetime
    - 语义：row 首次进入 `Doing / Fixing` 时写入
  - 当前推荐的系统安全默认值：
    - `acceptance_mode = manual_acceptance`
    - `completion_notify_mode = no_dm_on_completion_boundary`
  - `AI 任务风险判断` 当前不进入 ACR writeback contract
  - `resource_key` 当前冻结，不应作为第一刀幂等键或 truth anchor
    - 当前 `Task/Bug writeback first slice` 也已 implemented + auto-validated：
      - hook 点位于真实 `service path`
      - 只接受显式 row anchor：
        - `task_record_id / taskRecordId`
        - `bug_record_id / bugRecordId`
    - project default 当前已真实从 project-owned `router.yaml` 读取：
      - `task_bug_policy.defaults.acceptance_mode`
      - `task_bug_policy.defaults.completion_notify_mode`
    - 第一批真实 write set：
      - `current_step`
      - `step_result`
      - `next_action`
      - `last_event_at`
      - `ACR开始执行时间`
      - `执行摘要`（Task）
      - `修复方式`（Bug）
      - `修复结果`（Bug complete 且显式 `fix_result`）
      - `状态` 的非终态推进：`Todo -> Doing/Fixing -> Reviewing`
    - 当前 guardrails：
      - terminal row 默认 noop
      - 避免 `Reviewing -> Doing/Fixing` 回退
      - 不自动写 `实际完成时间`
      - 不在缺少 explicit `fix_result` 时猜测 `修复结果`
    - 当前已完成一轮 live enum audit：
      - 已对齐：
        - `Task状态`
        - `Bug状态`
        - `ACR验收模式`
        - `ACR完成提醒`
      - 曾缺失但现已补齐：
        - `current_step.COMPLETE`
        - `current_step.REPLAN`
        - `step_result.accepted`
        - `step_result.rejected`
    - 当前 writeback 已新增 enum preflight guard：
      - 若 live select options 缺少即将写入的值，会在 ACR 侧直接报：
        - `missing-feishu-enum-options:...`
      - 不再等 Feishu 返回晚到的 `validation_error`
    - 当前 validation task `<validation-task-record-id>` 已在 live Base 上重新 apply 成功：
      - `状态 = Done`
      - `current_step = COMPLETE`
      - `step_result = accepted`
    - 当前已补上第一条 `review_resolution` writeback：
      - `accepted -> Done / Fixed`
      - `rejected -> Todo`
      - 对 Human 先手改到 `Done / Fixed` 的 row 不再误触发 terminal noop
    - 当前已补上第一条 `complete` writeback：
      - `manual_acceptance -> Reviewing / REVIEW_WAIT / need_review`
      - `agent_can_finalize -> Done / Fixed / COMPLETE / accepted`
    - 当前 live Base workflow 已从 `Tasks` 扩到 `Bugs`：
      - `<bug-review-accepted-workflow-id>`
        - `Bugs Reviewing -> Fixed => review_resolution / accepted`
      - `<bug-review-rejected-workflow-id>`
        - `Bugs Reviewing -> Todo => review_resolution / rejected`
    - 当前 `proj-assistant-context-router` 也已新增两条 validation `Bug` row：
      - `<validation-bug-record-id-a>`
        - `[ACR self-host] live validate bug manual 2026-04-23`
      - `<validation-bug-record-id-b>`
        - `[ACR self-host] live validate bug auto 2026-04-23`
    - implementation tests 当前全绿：`186/186`
- `Feishu` 多维表格 work surface 的工作范式已单独收敛为 [feishu-work-surface-operating-model.md](<repo-root>/plan/active/feishu-work-surface-operating-model.md:1)，当前新采纳的 truth 是：
  - `Todo` 默认是 backlog，不是 dispatch signal
  - `Todo -> Doing / Fixing` 才是默认 execution request
  - `Reviewing -> Done / Fixed / Todo` 才是默认 acceptance resolution
  - ACR 可主动创建 `Todo`，但默认只作为 suggestion/backlog，不自动自触发
  - 若未来要支持 “创建即调度 / 允许Agent接单”，应通过新的 policy surface 表达，而不是重定义 `Todo`
  - 当前 live Base 的 4 条 `review_resolution` workflow 也已按此方向收紧：
    - 必须由 `Reviewing` 迁移到目标状态才触发
- `start_mode / ACR启动方式` 的最小 contract 已单独收敛为 [feishu-start-mode-contract.md](<repo-root>/plan/active/feishu-start-mode-contract.md:1)，当前已明确：
  - project default 推荐落在 `router.yaml`
    - `task_bug_policy.defaults.start_mode`
  - 当前安全默认值：
    - `manual_only`
  - 未来的 row-level override 仅先停留在 proposal：
    - `ACR启动方式`
    - `继承默认 / 仅手动推进 / 创建即调度 / 允许Agent接单`
  - runtime config parsing 当前已落地：
    - `RouterConfig` 已能解析 `task_bug_policy.defaults.start_mode`
    - `Task/Bug writeback` policy resolution 也已会透传 `start_mode`
  - 当前尚未采纳：
    - 直接基于 `start_mode` 改变 live Base 行为
    - 直接新增 create-time dispatch workflow
- `Escalation Surface` 的第一份落地 contract 已单独收敛为 [feishu-escalation-surface-contract.md](<repo-root>/plan/active/feishu-escalation-surface-contract.md:1)，当前已明确 first surface 选 `Feishu IM governance alert mirror`，只做 secondary visibility mirror，不让 Feishu 先成为 ack/resolve host
- 跨 channel 的全局 default `governance target` 当前先定为 `WeChat DM`
- 但这必须走显式 config binding，不得 hardcode 在 runtime / adapter 代码里；未来 project-owned override 再覆盖
- `Feishu` 相关 config-like 值的第一份宿主 contract 已单独收敛为 [feishu-adapter-config-host-contract.md](<repo-root>/plan/active/feishu-adapter-config-host-contract.md:1)，当前已明确 global runtime binding / project-owned override 的两层模型，以及最小迁移顺序
  - 当前新增一条 live runtime truth：
    - OpenClaw runtime 下依赖 `lark-cli` 的 adapter / observer 不能假设宿主 env 完整
    - 当前已在 `lark-cli` runner 侧补齐最小 env 白名单：
      - `HOME`
      - `USER`
      - `LOGNAME`
      - `SHELL`
      - `PATH`
      - `LANG`
      - `LC_ALL`
      - `TMPDIR`
  - 当前默认 auth source 已明确收口为 Human 本机已 auth 的 `~/.lark-cli/config.json`
  - 对应的 `Task: Todo -> Doing => dispatch` writeback 已完成 live validate
- 当前下一工作切口已进一步收敛为 [semantic-execution-bridge-contract.md](<repo-root>/plan/active/semantic-execution-bridge-contract.md:1)：
  - 当前 `service_binding` 已从 `validation_fixture` 切到 `feishu_task_bug_semantic`
  - `dispatch` 会基于 `task_record_id / bug_record_id` 读取真实 row
  - bridge 会组装 execution context 并投递 main-session execution request
  - bridge 会在目标 main session 写入 `pending_semantic_execution`
  - 后续真实完成仍必须由 agent 显式产出 `complete / review_request / blocked`
  - agent-output boundary 已由 OpenClaw `llm_output` hook 自动捕获，不再需要 project owner 手工复制 `complete`
  - 下一步是重启后的 Human live acceptance：
    - 验证 `dispatch -> semantic context system event -> main session`
    - 验证 `agent-output boundary -> service/writeback -> Reviewing/Done`
- 当前已新增第一版 runtime skeleton：
  - `work-surface base binding` 已接入默认 runtime path
  - `governance delivery binding` 已接入默认 escalation runtime path
    - 当前先进入幂等 `governance delivery outbox`
    - 再通过 OpenClaw runtime sender 投递到解析后的 canonical session
    - 依赖 `runtimeBindings.main_sessions` alias 解析，例如：
      - `local:human_dm`
      - -> `wechat:dm:human`
      - -> `agent:main:main`
    - 当前仍未直接接 WeChat / Feishu 外部 API
  - 当前已新增 project-scoped governance inspect 入口：
    - `/project [<project_id>] --governance`
    - 默认按当前 project binding 查看
  - live governance delivery 已真实验证通过：
    - `demo-acr` 的 `blocked` 信号已成功送达 `WeChat DM`
    - `/project --governance` 与 live delivery 状态已对齐
    - 展示的是 governance outbox mirror，而不是 governance truth
  - 当前机器的默认 runtime host 已创建：
    - `<openclaw-acr-data-dir>/feishu-adapter.yaml`
    - 已显式包含 `work_surface` 与 `governance.default_target`
  - workflow surface binding 也已有默认发现宿主：
    - `<plugin dataDir>/assistant-context-router/workflow-bindings.yaml`
    - 当前机器已创建 `<openclaw-acr-data-dir>/workflow-bindings.yaml`
    - 当前默认 binding：
      - `dispatch -> oc_d634b4327cb362b612c29d60a92c0fef`
      - `review -> oc_81be1bc8e3ec8950adefda095ebf7a7a`
    - 当前只先实现 `default_reply_target`
      - 让 `dispatch / review` 在缺少显式 `reply_target` 时仍能回到 workflow-scoped target
  - runtime bindings 也已有默认发现宿主：
    - `<plugin dataDir>/assistant-context-router/runtime-bindings.yaml`
    - 当前机器已创建 `<openclaw-acr-data-dir>/runtime-bindings.yaml`
    - OpenClaw plugin config 已去掉旧的 demo `runtimeBindingsPath`

## First implementation tasks
下面这批任务足够支持 Step 2 第一轮真实落地。

| priority | slice | repo | task | expected output |
| --- | --- | --- | --- | --- |
| P0 | contract | ACR | 写 `current_project_binding` contract | 一个明确的 authority object 定义，回答谁能改、何时改、谁不能改 |
| P0 | contract | ACR | 写 `project_contract_host_matrix` | continuity/collab/decision -> docs host mapping |
| P0 | contract | ACR | 写 `/project --save` preview/apply contract | source/scope/apply/no-silent-write 规则 |
| P0 | contract | ACR + orchestrator | 写 `service_first_orchestrator_action_result` contract | 最小 action payload / result schema |
| P0 | implementation | ACR | 落 `current_project_binding` runtime store | 读/写 binding 的最小 store + inspect path |
| P0 | implementation | ACR | 落 route trace / safe-fail 最小对象 | 有 `trace_id`、有 unresolved fail path |
| P0 | implementation | orchestrator | 暴露最小 ACR-facing ingress | 能稳定接 `dispatch/review` 类 action |
| P1 | implementation | orchestrator | 补最小 `artifact_ref` 附着位 | run/event 可挂最小 evidence ref |
| P1 | implementation | ACR + orchestrator | 定义 signal promotion rules | blocked/review/completed/need_decision 的 promotion matrix |
| P1 | implementation | Feishu/orchestrator | 落最小 Feishu projection | task status + run summary + high-signal state |
| P1 | implementation | ACR | 落最小 work-surface projection snapshot | project-level latest high-signal visibility payload |
| P1 | implementation | ACR | 落 main-session escalation object | 最小 ack/resolve record |
| P1 | implementation | ACR | 落 `/project --save` host-matrix-backed draft generation | `STATUS/RESUME/COLLAB` draft 有稳定宿主 |
| P2 | implementation | ACR | 落 project session append-only emission | route/service/high-signal digest 只读投影 |
| P2 | implementation | orchestrator | 做极薄 `orchestratorctl` | `task show / dispatch / run show / blocked / review-request / complete / fail` |

## Minimal CLI surface
当前只建议正式推进极薄 `orchestratorctl`。

### Must-have now
- `orchestratorctl task show <task_id>`
- `orchestratorctl task dispatch ...`
- `orchestratorctl run show <run_id>`
- `orchestratorctl run blocked <run_id> ...`
- `orchestratorctl run review-request <run_id> ...`
- `orchestratorctl run complete <run_id> ...`
- `orchestratorctl run fail <run_id> ...`

### Hard requirements
- 支持结构化输出，至少 `--json`
- 稳定 exit code
- 不把自然语言输出当 integration contract

### Not now
- 正式 `acrctl`
- plan split / create-from-plan
- memory sync
- board sync-all
- generic multi-backend / multi-runtime commands

## Minimal visibility scope
Step 2 只做最小 visibility，不扩成更大的对象体系。

### Current Cut 4B contract
- [main-session-escalation-notification-split-contract.md](<repo-root>/plan/active/main-session-escalation-notification-split-contract.md:1)

### Board should show
- active task status
- current run summary
- concise current step
- blocked / review / completed / failed
- optional `artifact_ref`

### Board should not show
- heartbeat spam
- retry/backoff noise
- internal plan decomposition
- terminal replay
- every event as a card update

### High-signal events
- `blocked`
- `review_requested`
- `need_decision`
- `completed`
- `failed`
- `human_override`
- `stale_run` only when threshold crossed

### `COLLAB.md` rule
只有跨 session 仍未解决的 collaboration obligation 才进 `COLLAB.md`。

不要把：
- blocked
- review
- decision
- event

默认都写进去。

## Validation scenarios
Step 2 第一轮实现至少要通过这 6 类场景。

### 1. Focus switch
- Human 在 main session 内执行 `/project`
- `current_project_binding` 明确变化
- 后续 route 与 `/project --save` 都按新 binding 工作

### 2. Safe-fail on unresolved business target
- protocol owner 已知
- business target project unresolved
- route 必须 safe-fail，而不是伪造 resolved project

### 3. Service-first dispatch
- 结构化 `dispatch` 默认直达 orchestrator service ingress
- 不经 project session 二次解释

### 4. Visibility with evidence
- run 到达 `review_requested` / `completed` / `blocked`
- Feishu 能看到最小状态
- 高信号事项能挂 `artifact_ref`

### 5. Escalation hygiene
- business notification 发到 protocol/work channel
- main-session escalation 只在真正需要 project owner/coordinator agent 介入时出现

### 6. Correct save host selection
- 执行后产生 continuity / collab change
- `/project --save` 能把内容分别草拟到正确 docs host

## Definition of done
Step 2 通过，不是因为系统“接了更多东西”，而是因为：

1. 同一个人可以在主会话里显式切到正确 project
2. 结构化工作可以稳定送进 orchestrator kernel
3. 人能在 Feishu 看到最小但可信的 task/run/signal/evidence
4. 需要时事项能被正确升级回 main session
5. continuity 能通过 `/project --save` 正确收口回 project contract docs
6. project session、board、memory 都没有长成第二真相层

## Next action
按以下顺序继续推进：

1. 先把 7 个 must-have contracts 写成正式 active docs
2. 再按 `Cut 1 -> Cut 5` 顺序拆分实现任务
3. 先打一条 `dispatch -> visibility -> escalation/save` 的最小贯通链路
4. 跑第一轮真实场景验证，再决定是否需要扩大 implementation surface
