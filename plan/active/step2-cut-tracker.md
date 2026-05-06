# Step 2 Cut Tracker

## Purpose
记录 Step 2 当前按 `conversation -> decision -> writeback -> plan -> implement -> validate -> next cut` 推进的执行节奏，避免实施过程中失焦。

本文档不替代：
- [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1)

它只负责回答：
- 当前做到哪个 cut
- 这一 cut 已经完成了什么
- 下一轮 conversation 应该吃掉什么
- 哪些需要 human real-world validation，而不是只靠自动测试

## Loop rule
每个 cut 默认按以下顺序推进：

1. `conversation`
   - 先把这一刀要解决的问题和边界说清
2. `decision`
   - 收成 contract / scope / acceptance
3. `writeback`
   - 把 decision 落回 active docs
4. `plan`
   - 拆成最小实现切口和验证点
5. `implement`
   - 只实现当前 cut 需要的最小代码
6. `validate`
   - 先自动测试
   - 再判断是否需要 human real-world validation
7. `next cut`
   - 只在当前 cut 通过后再切下一刀

## Cut status

### Cut 1 — Binding and writeback foundation
目标：
- 锁死 ACR 侧最基础的 authority 边界

子项：
- `current_project_binding`
- `project_contract_host_matrix`
- `/project --save` preview/apply contract

当前状态：
- `current_project_binding`: `implemented + auto-validated + human-validated`
- `project_contract_host_matrix`: `implemented + auto-validated + human-validated`
- `/project --save` preview/apply contract: `implemented + auto-validated + human-validated`

### Cut 1A — `current_project_binding`
状态：`implemented + auto-validated`

本轮已完成：
- formalize:
  - [current-project-binding-contract.md](<repo-root>/plan/active/current-project-binding-contract.md:1)
- implementation:
  - 新增 binding helper：
    - [current-project-binding.ts](<repo-root>/implementation/core/src/state/current-project-binding.ts:1)
  - `/project`
  - `/project --save`
  - prompt build
  - project lane
  - human main-session route
    都已改为消费 binding 语义，而不是散读裸 `current_project_id`
- validation:
  - implementation tests 全绿：`70/70`

结论：
- `current_project_binding` 已具备继续向下游 cuts 供给 authority 语义的条件
- human real-world validation 已通过：`/project` 表现稳定

下一轮应做：
- `project_contract_host_matrix`
- `/project --save` preview/apply contract formalization

### Cut 1B — `project_contract_host_matrix`
状态：`implemented + auto-validated`

目标：
- 明确 continuity / collab / decision 分别写到哪份 docs
- 避免 `STATUS.md / RESUME.md / COLLAB.md` 双写、漏写、错写

本轮已完成：
- formalize:
  - [project-contract-host-matrix.md](<repo-root>/plan/active/project-contract-host-matrix.md:1)
- implementation:
  - 新增 host matrix helper：
    - [project-contract-host-matrix.ts](<repo-root>/implementation/core/src/save/project-contract-host-matrix.ts:1)
  - `/project --save` dry-run preview 现在会显式带出：
    - default apply hosts
    - source hierarchy / source notes
- validation:
  - host selection tests 已新增并通过

结论：
- 当前默认宿主分工已被正式写清
- `/project --save` 默认只写 `RESUME.md` / `STATUS.md` 的边界已被实现承接
- human real-world validation 已通过：preview/apply 体验可用

### Cut 1C — `/project --save` preview/apply contract
状态：`implemented + auto-validated`

目标：
- 把 `/project --save` 从“能用的功能”提升成正式 continuity contract

本轮已完成：
- formalize:
  - [save-preview-apply-contract.md](<repo-root>/plan/active/save-preview-apply-contract.md:1)
- implementation:
  - `/project --save` 显式消费 source hierarchy / host matrix helper
  - dry-run preview 明确展示 default apply hosts 与 source notes
  - binding mismatch invalidation 仍保持生效
- validation:
  - save tests 全绿

结论：
- `/project --save` 已不再只是“方便的功能”，而有了更清楚的 scope/source/apply 语义
- Gate 2 已通过，下一步不应继续抽象 `/project --save`

### Cut 2 — Route / trace / safe-fail
状态：`implemented + auto-validated`

目标：
- 让 route resolution 可解释、可调试、可保守失败

子项：
- `route_resolution + trace + safe_fail` contract
- route trace 最小字段约束
- 旧 fallback 行为清理
- service-first route 验收链

结论：
- Cut 2 当前已具备进入 Cut 3 的条件
- 结构化 route 已有最小 trace/safe-fail 语义，也有更硬的 service-first 自动化验收
- 下一轮不应继续在 Cut 2 内加抽象，而应转向真实 orchestrator ingress/result seam

### Cut 3 — Service-first orchestrator seam
状态：`in_progress`

目标：
- 正式把 orchestrator 接到 ACR 主路径

子项：
- `service_first_orchestrator_action_result` contract
- 最小 structured service result shell
- 真实 orchestrator ingress/result bridge 第一刀

### Cut 3A — `service_first_orchestrator_action_result`
状态：`implemented + auto-validated`

目标：
- 把 ACR ↔ orchestrator 的主接缝正式写清
- 先稳定最小 action/result 语义，再进入真实 bridge

本轮已完成：
- formalize:
  - [service-first-orchestrator-action-result-contract.md](<repo-root>/plan/active/service-first-orchestrator-action-result-contract.md:1)
- implementation:
  - 给当前 `ServiceResult` 补最小结构化结果壳：
    - `result_kind`
    - `summary`
    - `run_id`
    - `queue_ref`
  - 在 registry / lane 侧统一最小归一化
- validation:
  - 不引入真实 orchestrator repo 依赖
  - 现有 demo/service-first 测试链已验证：
    - result shell 会被统一归一化
    - dispatch/review lane 会保留 `result_kind / summary / run_id / queue_ref`
    - missing handler 仍只会 `safe_fail`

结论：
- ACR 当前已经拥有一个比 `ok/error/needs_escalation` 更稳定的 orchestrator-facing 最小结果壳
- 这为 Cut 3B 的真实 ingress/result bridge 提供了可复用语义

下一轮应做：
- Cut 3B — 真实 orchestrator ingress/result bridge 第一刀
- 目标应保持克制：
  - 先证明 ACR project-owned internal service 可以桥接到 orchestrator ingress
  - 不提前把 signal promotion / business notification / main-session escalation 拉进来

### Cut 3B — project-owned service bridge first slice
状态：`implemented + auto-validated`

目标：
- 证明 `service-first` 不只支持 direct handler，也支持 project-owned bridge
- 在不引入真实 orchestrator repo 依赖的前提下，把接缝做实

本轮已完成：
- formalize:
  - [project-owned-service-bridge-contract.md](<repo-root>/plan/active/project-owned-service-bridge-contract.md:1)
- implementation:
  - `router.yaml` 现支持 `service_binding`
  - 新增通用 service bridge registry：
    - [service-bridge.ts](<repo-root>/implementation/core/src/routing/service-bridge.ts:1)
  - plugin 的 `service` 路径现在按以下优先级执行：
    - `project_id:action_name`
    - `action_name`
    - `service_binding + bridge adapter`
    - 否则保守失败
- validation:
  - router config tests 已覆盖 `service_binding`
  - demo bridge test 已验证：
    - structured `dispatch` 可在无 local handler 时桥接到 external ingress
    - ingress 侧收到 `action_name / resolved_project_id / trace_id / parameters`
    - lane / trace 仍保留 `service-first` 语义

结论：
- ACR 当前已经拥有一个正式的 project-owned service bridge 接缝
- `service-first` 现在不再只等价于“当前进程内 direct handler”
- 这为后续真实 orchestrator repo 接入提供了第一条稳定桥面

下一轮应做：
- Cut 4A — signal promotion / business notification / main-session escalation 先 formalize
- 继续保持克制：
  - 不提前拉 memory / autonomy / 第二 work surface
  - 不把 `service_binding` 过早长成通用 orchestration DSL

### Cut 4 — Minimal visibility and signal promotion
状态：`implemented + auto-validated + human-validated`

目标：
- 让 signal family、promotion 边界和后续 escalation 收口面正式站稳

子项：
- `signal_promotion` contract
- signal family / promotion helper
- business notification / main-session escalation / `COLLAB.md` 的最小边界

### Cut 4A — `signal_promotion`
状态：`implemented + auto-validated`

目标：
- 先 formalize promotion 规则
- 把 signal family 与 promotion 判定从零散字符串逻辑中收出来

本轮已完成：
- formalize:
  - [signal-promotion-contract.md](<repo-root>/plan/active/signal-promotion-contract.md:1)
- implementation:
  - 新增 signal promotion helper：
    - [signal-promotion.ts](<repo-root>/implementation/core/src/routing/signal-promotion.ts:1)
  - `project-session-lane` 现在复用统一的 signal derivation，而不再内嵌零散判断
  - 新增最小 `SignalPromotionDecision` 类型
- validation:
  - 新增 [signal-promotion.test.ts](<repo-root>/implementation/tests/core/signal-promotion.test.ts:1)
  - 已验证：
    - `review_request` 默认走 business/work surface，不自动进主会话
    - 带 human-decision hint 的 `blocked` 可升级 main session
    - `high_signal_completion` 默认不进主会话
  - 整套实现测试全绿

结论：
- 当前 promotion 规则已经首次成为正式 contract，而不是散落在 lane/event 逻辑里的隐含判断
- `business notification / main-session escalation / COLLAB.md` 的边界已经有了最小可执行语义

下一轮应做：
- Cut 4B — minimal escalation record / notification split first slice
- 继续保持克制：
  - 先做 store/object 与分流，不做完整通知平台
  - 先不做 `COLLAB.md` 自动 writeback

### Cut 4B — minimal escalation record / notification split first slice
状态：`implemented + auto-validated`

目标：
- 把 `business notification` 与 `main-session escalation` 从 contract 推进到最小对象层
- 让 main session 有正式 unresolved governance record，而不是只靠 lane/event 摘要

本轮已完成：
- formalize:
  - [main-session-escalation-notification-split-contract.md](<repo-root>/plan/active/main-session-escalation-notification-split-contract.md:1)
- implementation:
  - 新增最小 business notification record
  - 新增最小 main-session escalation store
  - 把 service/signal 路径接到 split 上
  - `before_prompt_build` 可消费 unresolved escalation
- validation:
  - auto tests 覆盖：
    - business notification 与 escalation 分宿主
    - unresolved escalation 可被 main session 看见
  - 整套实现测试全绿

结论：
- `business notification` 与 `main-session escalation` 现在已经不是同一份隐含逻辑，而是两种最小 record/store
- main session 已经有了正式 unresolved governance read path，不再只能靠 lane/event 猜测
- 当前仍保持克制：
  - business notification 只记录，不做完整 delivery bus
  - escalation 先支持 open/resolve object，不扩展成 takeover system

后续判断：
- Gate 5 已通过
- 当前不继续把主线放在 Cut 4C（真实 delivery / evidence polish）
- 当前转入 Cut 5（project session minimal shadow-lane 收口）

Gate 5 validation prep：
- 已新增 validation-only harness contract：
  - [demo-acr-validation-harness-contract.md](<repo-root>/plan/active/demo-acr-validation-harness-contract.md:1)
- `demo-acr/router.yaml` 现通过 `service_binding.runtime_kind=validation_fixture` 接上项目自带 fixture result
- OpenClaw adapter 层现提供极薄的 `validation_fixture` bridge
- 作用仅限 Gate 5 / contract rehearsal，不应被误读成正式项目 service platform

约束：
- 不做完整通知平台
- 不做 `COLLAB.md` 自动 writeback
- 不把 project session 抬成 escalation host

### Cut 5 — Project session minimal shadow lane
状态：`implemented + auto-validated`

目标：
- 把 `project session` 正式锁定为 `shadow lane / read model`
- 收紧 main-session 对 lane summary 的注入边界

子项：
- `project-session-shadow-lane` contract
- lane summary 注入意图收紧
- `/project --lane` 与 main-session hint 的边界校验

### Cut 5A — `project-session-shadow-lane`
状态：`implemented`

目标：
- 先 formalize lane 的职责、非职责、append-only 规则与注入规则

本轮已完成：
- formalize:
  - [project-session-shadow-lane-contract.md](<repo-root>/plan/active/project-session-shadow-lane-contract.md:1)

结论：
- `project session` 当前已被正式定义为：
  - append-only shadow lane
  - execution-facing derived read model
  - `/project --lane` 的 direct inspect 宿主
- lane summary 之后的实现收紧，应以该 contract 为准，而不再以宽泛“状态/最近”词触发为准

下一轮应做：
- Cut 5B — 收紧 `before_prompt_build` 的 lane summary 注入意图
- 用自动测试证明：
  - execution-facing 问题仍会看到 lane summary
  - 泛项目问题不会因为弱关键词而被 lane 历史带偏

### Cut 5B — lane summary injection tightening
状态：`implemented + auto-validated`

目标：
- 把 lane summary 的主会话注入，从“宽泛关键词触发”收紧到“execution-facing intent 触发”

本轮已完成：
- implementation:
  - `before_prompt_build` 的 lane summary 触发词已收紧：
    - 保留 `blocked/review/progress/automation/lane/needs my attention/卡住/阻塞/进度/评审/自动化/需要我处理`
    - 移除单独的 `status/状态/latest/recent/最近` 弱触发
- validation:
  - 新增自动测试证明：
    - 泛项目状态问题不会自动注入 lane summary
    - 显式 automation history 问题仍会注入 lane summary
  - 全量实现测试全绿：`93/93`

结论：
- `project session` 当前仍保留为可读 execution hint 面
- 但主会话不会再因为“状态/最近”这类弱词，过度消费 lane 历史
- 当前 Cut 5 已经具备继续转入下一刀的条件

下一轮应做：
- 评估是否需要 `Cut 5C`
  - 若需要，只做 `/project --lane` summary 展示抛光
  - 若不需要，直接把 Cut 5 结果 writeback 到 hall docs，并切下一主线

### Cut 5C — `/project --lane` summary polish
状态：`implemented + auto-validated`

目标：
- 让 `/project --lane` 的展示更明确地区分：
  - lane event history
  - unresolved governance attention

本轮已完成：
- implementation:
  - `/project --lane` 现在将 count 明确标成 `... events`
  - 新增说明：这些 count 总结的是最近 lane event，不是去重后的 unresolved governance item
- validation:
  - 新增自动测试证明：
    - `blocked` 重复事件会显示为 `blocked events: 2`
    - 展示文本会明确提示“不是 deduped unresolved governance items”
  - 全量实现测试全绿：`94/94`

结论：
- Cut 5 当前已完整收口：
  - `project session` 继续保持 shadow lane / read model
  - main session lane summary 注入边界已收紧
  - `/project --lane` 的展示语义已更贴近 authority map

下一轮应做：
- 将 Cut 5 结果 writeback 到 hall docs
- 切换到下一条 Step 2 主线，而不再继续扩 Cut 5

### Cut 6 — Minimal visibility + evidence
状态：`implemented + auto-validated`

目标：
- 给高信号 execution projection 增加最小 `artifact_ref`
- 让 evidence pointer 沿 lane / notification / escalation / prompt hint 贯通
- 仍然不引入新的 authority host，也不直接做 Feishu adapter

子项：
- `minimal-visibility-evidence` contract
- `artifact_ref` 最小接口
- read-model carry-through

### Cut 6A — `minimal-visibility-evidence`
状态：`implemented + auto-validated`

目标：
- 正式写清 ACR 侧最小 visibility / evidence 边界
- 落下单个 `artifact_ref` 的最小接口与读面贯通

本轮已完成：
- formalize:
  - [minimal-visibility-evidence-contract.md](<repo-root>/plan/active/minimal-visibility-evidence-contract.md:1)
- implementation:
  - `ServiceResult` 新增单个 `artifact_ref`
  - `project session lane` / `business notification` / `main-session escalation` / execution-facing prompt hint 都会保留 `artifact_ref`
  - `/project --lane` 可显示最小 evidence 提示
- validation:
  - completion / review / blocked 的 evidence carry-through 已补自动测试
  - 无 `artifact_ref` 的旧路径继续工作
  - 全量实现测试全绿：`94/94`

结论：
- ACR 当前已经具备最小 evidence pointer 接口
- 这为后续 Feishu/work-surface projection 预留了稳定消费面
- 当前仍保持克制：
  - 不实现 artifact host
  - 不实现 Feishu field/comment 投影
  - 不扩大 prompt 注入边界

下一轮应做：
- 视需要决定是否把 Cut 6 结果 writeback 到 hall docs
- 再选择下一条更靠近真实 work-surface 的最小切口

### Cut 7 — Minimal work-surface projection
状态：`implemented + auto-validated`

目标：
- 在不直接接 Feishu API 的前提下，先让 ACR 产出一个可被 work-surface adapter 消费的最新 high-signal snapshot
- 避免未来 adapter 自己同时去拼 lane / notification / escalation

子项：
- `work-surface-projection` contract
- latest high-signal snapshot per project
- adapter-ready headline / summary / optional `artifact_ref`

### Cut 7A — `work-surface-projection`
状态：`implemented + auto-validated`

目标：
- 正式定义 ACR 给 work-surface adapter 的最小 projection 面
- 让高信号 signal 能稳定沉成单 project 最新 snapshot

本轮已完成：
- formalize:
  - [work-surface-projection-contract.md](<repo-root>/plan/active/work-surface-projection-contract.md:1)
- implementation:
  - 新增 `work-surface-projection` core helper 与 latest snapshot store
  - 高信号 signal 现在会同步更新 project-level latest snapshot
  - snapshot 字段保持极小：
    - `signal_kind`
    - `surface_status`
    - `headline`
    - `summary`
    - `run_id / queue_ref`
    - optional `artifact_ref`
- validation:
  - 新增 core store/build tests
  - completion / review / blocked 场景已验证会更新 snapshot
  - 全量实现测试全绿：`97/97`

结论：
- ACR 当前已经能给未来 Feishu/work-surface adapter 产出单一消费面
- 这仍是 derived snapshot，不是新的 authority host
- 当前机器已验证可通过 `lark-cli` 的 bot identity 读取既有 Feishu Base：
  - `private config host`
  - 表包括 `Projects / Tasks / Bugs / Service Runs Monitor / Dict Definition / Events`
- 下一条主线默认沿用现有 Base，而不是新建 Base
- 但 `Cut 8A` 不应把当前 project-level latest snapshot 直接写进 `Tasks / Bugs`
  - `Tasks / Bugs` 的 meta 设计、字段定义、状态机约束应继承
  - 第一刀 projection 更适合落在同一 Base 内的专用 projection table
  - 当前已采纳的 table name：`Work Surface Snapshots`
  - 当前已采纳的最小 anchor：保留 `project_id` 作为 lookup key，并加入 `project -> Projects` relation
  - `Service Runs Monitor` 当前已明确不作为这个 projection 的默认目标
- 涉及 Feishu 表结构的任何改动，都必须先与 Human 讨论并确认
- 下一轮可以选择：
  - 在新 thread 中开始 `Cut 8A — Feishu Base projection first slice`
  - 先收表结构方案与字段继承判断，再做 adapter 实现

### Cut 8A — Feishu Base projection first slice
状态：`implemented + auto-validated + live-schema-created`

目标：
- 让 ACR 已产出的 per-project latest work-surface snapshot 真正有一个 Feishu work-surface adapter 消费面
- 保持 Feishu 是单向 projection，而不反向决定 ACR / workflow truth

本轮已完成：
- live schema:
  - Human review 通过后，已在 Base `private config host` 创建 `Work Surface Snapshots`
  - 已在 `Dict Definition` 注册 `Work Surface状态`
  - projection table 当前实际字段名已定：
    - `Project ID`
    - `所属项目`
    - `状态`
    - `标题`
    - `摘要`
    - `更新时间`
    - `trace_id / signal_kind / action_name / workflow / run_id / queue_ref / artifact_kind / artifact_label / artifact_target`
- implementation:
  - 已新增基于 `lark-cli base` 的最小 Feishu client 与 work-surface adapter skeleton
  - adapter 默认字段名已对齐 live Base
  - 仍以 `Project ID` 作为 lookup / idempotent upsert key
  - relation 通过 `所属项目 -> Projects` 写入
  - 已新增 manual sync / dry-run 入口
  - OpenClaw plugin 已将 project-scoped 手工 sync 收进 `/project` 参数面
    - 首选入口：`/project [<project_id>] --surface-sync [--apply]`
    - 默认 `dry_run`
    - `--apply` 才真正写 Feishu
    - 未传 `project_id` 时使用当前 `/project` binding
    - `/project` 已成为唯一公开命令入口；不再保留旧命令 alias
    - default runner 会先解析 `<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`
    - 若没有显式 binding 或 `FEISHU_BASE_TOKEN`，work-surface path 会 fail closed
    - TUI command path 会直接返回 friendly sync error text，不再吞成 generic failure
  - plugin 已新增 optional `workSurfaceProjectionObserver`
    - 直接承接真实 signal 链产出的 snapshot
    - observer failure safe-fail，不反向影响 route / service / signal promotion 主链
  - `governance delivery binding` 已接入默认 escalation runtime path
    - 当前先消费 `governance.default_target`
    - 先进入幂等 `governance delivery outbox`
    - 再通过 OpenClaw runtime sender 投递到解析后的 canonical session
    - 依赖 `runtimeBindings.main_sessions` alias 解析 local symbolic target
    - runtime bindings 当前默认发现 `<plugin dataDir>/assistant-context-router/runtime-bindings.yaml`
    - 当前机器已把旧 demo `runtimeBindingsPath` 从 OpenClaw plugin config 中移除
    - 当前仍未直接接 WeChat / Feishu 外部 API
  - 已新增 project-scoped governance inspect 入口
    - `/project [<project_id>] --governance`
    - 默认按当前 project binding 查看
    - 展示的是 governance outbox mirror，而不是 governance truth
- validation:
  - targeted tests 全绿
  - 全量 implementation tests 全绿：`145/145`
  - 真实 Base dry-run 已验证：
    - `proj-bitable-pm-system` 可成功解析到 `Projects` record
    - 可成功生成包含 relation / datetime / artifact fields 的 upsert plan
  - 第一次真实 live upsert 已验证：
    - first apply: `create`
    - second apply: `update`
    - stable record id: `<work-surface-snapshot-record-id>`

结论：
- `Work Surface Snapshots` 已不是纯设计方案，而是当前 live Base 的既有对象
- 第一刀当前已经完成 schema + adapter skeleton + 本地验证 + live dry-run + live create/update 验证 + runtime observer hook + main-session manual sync command + governance outbox wiring
- 当前剩余问题已不再是“能不能写进去”，而是“如何用真实业务 snapshot 覆盖 validation row，以及未来是否值得单独启用 observer 自动 wiring”

下一步：
- 保持 manual sync 为默认入口，并优先通过 `/project --surface-sync` 覆盖 validation row
- observer hook 保留但不默认自动 apply
- 视需要决定 validation row 的自然覆盖或 cleanup 策略

### Cut 8B — Feishu Projects catalog sync first slice
状态：`implemented + auto-validated + live-validated`

目标：
- 为 Feishu `Projects` 提供显式、幂等、单项目的 catalog sync 入口
- 让 `surface-sync`、未来 notification、以及后续 relation 都有正式的 project anchor
- 保持 `Projects` 是 catalog projection，而不被误读成 project truth host

本轮已完成：
- implementation:
  - 新增 Feishu project catalog adapter / runner
  - 当前已支持：
    - local truth 校验
    - live schema preflight
    - duplicate `Project ID` 检测
    - `create / update / noop`
  - OpenClaw plugin 已新增 project-scoped 命令入口：
    - `/project [<project_id>] --catalog-sync [--apply]`
    - 默认 `dry_run`
    - `--apply` 才真正写 Feishu
    - 未传 `project_id` 时使用当前 `/project` binding
  - 当前复用同一份 runtime config host：
    - `<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`
    - 继续读取 `work_surface.table_binding.projects`
    - 继续读取 `field_binding.projects`
  - 当前 write set 严格保持最小：
    - `Project ID`
    - `项目名称`
    - `Source Path`
    - `目标`
    - `Cadence`
    - create 时 `Archived=false`
  - duplicate / drift / schema 缺失当前都会 clear fail，并返回 friendly error text
- validation:
  - targeted tests 全绿
  - plugin 全量 tests 全绿：`160/160`
  - 真实 Base 已验证：
    - `demo-acr` 的 `/project --catalog-sync` 返回 `noop`
    - `/project --catalog-sync --apply` 也保持 `noop`
    - 当前 anchor record id：`<projects-catalog-record-id>`

结论：
- ACR 当前已经不只会在 `surface-sync` 缺 anchor 时 fail；它现在也有了正式的显式 catalog anchor 写入入口
- `Projects` first slice 已从纯 contract 进入可执行状态
- `noop` 不再只是测试语义，而是已经在真实 Base 上验证“对齐时不重复写”
- 当前仍保持克制：
  - 不做 batch backfill
  - 不做 reconcile repair
  - 不写 `Owner / 类型 / 状态`
  - 不做 archive policy apply

下一步：
- `Projects` catalog sync 的真实 Base 验证已完成
- 下一步进入 `Business Notification` 的 Feishu IM delivery

### Cut 8C — Feishu Business Notification IM delivery first slice
状态：`implemented + auto-validated`

目标：
- 让 `business_notification=true` 的高信号事项在保留 ACR truth 的前提下，开始具备 Feishu work-side delivery 能力
- 保持 Feishu 只做 delivery artifact / interaction surface，不反向决定 notification truth
- 为后续真实 Feishu inbound / self-hosted real usage 补齐最小协作可见度闭环

本轮已完成：
- implementation:
  - 新增 `BusinessNotificationDeliveryRecord` outbox
  - plugin 默认 signal path 当前会：
    - append `BusinessNotificationRecord`
    - 再 upsert business notification delivery outbox
    - deliverable Feishu target 才进入 sender
    - 无 target / unsupported target 则落为 `record_only`
  - 当前 sender 采用：
    - `lark-cli im +messages-send`
    - `lark-cli im +messages-reply`
    - 默认 bot identity
    - delivery id 作为 idempotency key
  - 当前只把这些 target 视为可直接投递：
    - `oc_xxx`
    - `ou_xxx`
    - `om_xxx`
    - `feishu:chat:oc_xxx`
    - `feishu:user:ou_xxx`
    - `feishu:message:om_xxx`
    - `feishu:thread:om_xxx`
  - 当前已新增 project-scoped inspect 入口：
    - `/project [<project_id>] --notifications`
    - 默认按当前 `/project` binding 查看
    - 展示 delivery mirror/outbox，而不是 notification truth
- validation:
  - targeted tests 全绿
  - plugin 全量 tests 全绿：`170/170`
  - 已验证：
    - deliverable target 会生成 `lark-cli im` sender plan
    - symbolic / unsupported target 会稳定回落到 `record_only`
    - `/project --notifications` 会区分 `pending` 与 `record_only`

结论：
- `Business Notification` 当前已不再只是 append-only record；它已经有了最小 delivery outbox 与 sender path
- 当前仍保持克制：
  - 不做 notification table
  - 不做 ack / resolve
  - 不做 multi-target fan-out
  - 不把 transport failure 自动升级成 governance escalation
- 当前 interruption point 已从“实现 first slice”切到“做真实 Feishu business/work chat 的 live delivery 验证”

下一步：
- 找一条真实 Feishu ingress traffic，完成 `Business Notification` 的 live IM delivery 验证
- 然后推进 `proj-assistant-context-router` self-hosted real usage

### Cut 8D — Feishu Task/Bug policy schema + writeback first slice
状态：`implemented + live-schema-created + auto-validated`

目标：
- 在不把 `Tasks / Bugs` 拉成 truth host 的前提下，为后续 `dispatch group -> Task/Bug writeback` 闭环准备最小 policy / runtime schema
- 保持 `状态`、completion、验收边界继续受 contract 约束，而不是因为字段已存在就自动越权

本轮已完成：
- decision:
  - [feishu-task-bug-ownership-acceptance-contract.md](<repo-root>/plan/active/feishu-task-bug-ownership-acceptance-contract.md:1)
  - 已正式收敛：
    - `状态` 是 policy-gated shared field
    - `acceptance_mode` 与 `completion_notify_mode` 属于 card policy surface
    - project default 落在 project-owned `router.yaml`
    - 当前系统安全默认值：
      - `manual_acceptance`
      - `no_dm_on_completion_boundary`
- live schema:
  - `Dict Definition` 已新增：
    - `ACR验收模式`
    - `ACR完成提醒`
  - 并已补齐前三条可视化记录：
    - `继承默认 / 继承默认`
    - `人工验收 / 完成边界提醒`
    - `允许Agent完结 / 完成边界不提醒`
  - `Tasks` 已新增：
    - `ACR验收模式`
    - `ACR完成提醒`
    - `ACR开始执行时间`
  - `Bugs` 已新增：
    - `ACR验收模式`
    - `ACR完成提醒`
    - `ACR开始执行时间`
  - `Tasks / Bugs` 上的两个 policy 字段当前都已按既有 Base 模式挂到 `Dict Definition` 的 `dynamic_options_source`
- validation:
  - live field get 已确认：
    - `Tasks.ACR验收模式` -> `Dict Definition.ACR验收模式`
    - `Bugs.ACR完成提醒` -> `Dict Definition.ACR完成提醒`
    - `ACR开始执行时间` 为 `datetime`

结论：
- `Tasks / Bugs` 的这批字段当前已经从 schema proposal 进入 live Base
- 当前已不再停留在 schema / policy 讨论阶段：
  - `row-level writeback adapter` 已实现
  - `service path` 已接上 safe-fail observer
  - `router.yaml` 的 `task_bug_policy.defaults.*` 已进入 runtime
  - `proj-assistant-context-router` 当前也已补上 project-owned self-hosted harness：
    - [router.yaml](<repo-root>/router.yaml:1)
    - [validation/service-results.json](<repo-root>/validation/service-results.json:1)
- 当前仍保持克制：
  - 只接受显式 row anchor，不做 `task_id / resource_key` 推断
  - 不做无 policy / 无显式 action 的终态自主收口
  - 但 `review_resolution` 已支持 Human 决策驱动的终态/回退对齐
  - `complete` 也已进入 runtime：
    - `manual_acceptance -> Reviewing`
    - `agent_can_finalize -> Done / Fixed`
- 当前 live Base workflow 也已扩到 `Bugs`：
  - `<bug-review-accepted-workflow-id>`
    - `Bugs Reviewing -> Fixed => review_resolution / accepted`
  - `<bug-review-rejected-workflow-id>`
    - `Bugs Reviewing -> Todo => review_resolution / rejected`
- 当前 self-hosted `Bug` validation row 已补齐：
  - `<validation-bug-record-id-a>`
    - `[ACR self-host] live validate bug manual 2026-04-23`
  - `<validation-bug-record-id-b>`
    - `[ACR self-host] live validate bug auto 2026-04-23`
- 当前 Feishu 多维表格 work-surface 范式也已单独收敛为：
  - [feishu-work-surface-operating-model.md](<repo-root>/plan/active/feishu-work-surface-operating-model.md:1)
  - 核心新 truth：
    - `Todo` 默认是 backlog，不是 dispatch signal
    - `Todo -> Doing / Fixing` 才是 execution request
    - `Reviewing -> Done / Fixed / Todo` 才是 acceptance resolution
    - ACR 创建的 `Todo` 默认只是 suggestion/backlog，不自动自触发
  - 当前 live Base 的 workflow 当前已扩到 `6` 条：
    - `<task-dispatch-workflow-id>`
      - `Tasks Todo -> Doing => dispatch`
    - `<bug-dispatch-workflow-id>`
      - `Bugs Todo -> Fixing => dispatch`
    - `<task-review-accepted-workflow-id>`
      - `Tasks Reviewing -> Done => review_resolution / accepted`
    - `<task-review-rejected-workflow-id>`
      - `Tasks Reviewing -> Todo => review_resolution / rejected`
    - `<bug-review-accepted-workflow-id>`
      - `Bugs Reviewing -> Fixed => review_resolution / accepted`
    - `<bug-review-rejected-workflow-id>`
      - `Bugs Reviewing -> Todo => review_resolution / rejected`
  - 这 6 条当前都已收紧到“状态迁移触发”：
    - 只有 `Todo -> Doing / Fixing`
    - 或 `Reviewing -> target_status`
    - 才会进入 automation_ingress
- `start_mode / ACR启动方式` 也已进入独立 contract：
  - [feishu-start-mode-contract.md](<repo-root>/plan/active/feishu-start-mode-contract.md:1)
  - 当前推荐默认值：
    - `manual_only`
  - 当前实现进展：
    - `task_bug_policy.defaults.start_mode` 已进入 runtime config parsing
    - 但尚未直接改变 live Base workflow 行为

下一步：
- `proj-assistant-context-router` 的 self-hosted live anchor 当前已补齐：
  - `Projects` row: `<projects-row-record-id>`
  - validation `Task` row: `<validation-task-record-id>`
- `Bugs` 的 live validate 当前也已具备前置条件：
  - workflow 已启用
  - validation bug row 已创建
- 真实 `dispatch group -> Task row` 的 self-hosted live validate 当前已通过：
  - `automation-ingress` 群回执：`Accepted dispatch for proj-assistant-context-router`
  - validation `Task` row `<validation-task-record-id>` 已进入 `Doing / EXECUTE / in_progress`
- 当前新增的 runtime adapter 修复已落地并通过回归：
  - observer 默认直接使用 Human 本机已 auth 的 `~/.lark-cli/config.json`
  - 显式传入 env 时不再把整份 `process.env` merge 回 child-process
  - child-process 当前只带最小白名单 env：
    - `HOME`
    - `USER`
    - `LOGNAME`
    - `SHELL`
    - `PATH`
    - `LANG`
    - `LC_ALL`
    - `TMPDIR`
- 对应 live validate 已通过：
  - `Task: Todo -> Doing => dispatch` 现在会自动补齐 `current_step = EXECUTE`
  - `step_result = in_progress`
- 第一批已真实读取：
  - `ACR验收模式`
  - `ACR完成提醒`
- 第一批已真实写入：
  - `ACR开始执行时间`
  - `current_step / step_result / next_action / last_event_at`
  - `执行摘要`（Task）
  - `修复方式`（Bug）
  - `修复结果`（Bug complete 且显式 `fix_result`）
  - `状态` 的非终态推进
- 当前新增的第一条 human-resolution writeback 已实现并有测试覆盖：
  - `review_resolution / accepted`
    - Task -> `Done`
    - Bug -> `Fixed`
    - `current_step = COMPLETE`
    - `step_result = accepted`
  - `review_resolution / rejected`
    - Task/Bug -> `Todo`
    - `current_step = REPLAN`
    - `step_result = rejected`
  - 对 `Done / Fixed` 的 Human 先手编辑不再被 terminal noop 吞掉
- 当前新增的第一条 policy-gated completion writeback 也已实现并有测试覆盖：
  - `complete / manual_acceptance`
    - Task/Bug -> `Reviewing`
    - `current_step = REVIEW_WAIT`
    - `step_result = need_review`
  - `complete / agent_can_finalize`
    - Task -> `Done`
    - Bug -> `Fixed`
    - `current_step = COMPLETE`
    - `step_result = accepted`
- `实际完成时间`、completion-boundary notify 继续后置到后续 policy-gated writeback
- `修复结果` 当前只由 Bug `complete` 的 explicit `fix_result` 写入，不再用 `Need review` 表达验收状态

### Cut 8E — Semantic execution bridge first slice
状态：`implemented + auto-validated (main-session mediated + boundary capture first slice)`

目标：
- 把当前 `validation_fixture` placeholder 升级成真实语义执行桥
- 让 `dispatch` 不再只按 `action_name` 命中固定结果，而是能基于 `Task / Bug` row 的真实内容进入执行

本轮已完成：
- decision:
  - [semantic-execution-bridge-contract.md](<repo-root>/plan/active/semantic-execution-bridge-contract.md:1)
- implementation:
  - core `ServiceResult.work_surface_action`
  - Feishu semantic bridge adapter `feishu_task_bug_semantic`
  - `Task/Bug writeback` 对显式 `work_surface_action` 的承接
  - OpenClaw plugin 默认注册该 bridge runtime kind
  - OpenClaw main-session mediated executor first slice
    - `dispatch -> trusted system event -> queued`
    - `dispatch -> pending_semantic_execution`
    - `dispatch -> requestHeartbeatNow` when available, without waiting for main-session heartbeat/model execution
    - `complete -> work_surface_action: complete`
    - `complete` without concrete `summary` -> `blocked / needs_escalation`
    - `review/review_request/blocked -> review/block boundary`
  - OpenClaw `llm_output` semantic boundary capture
    - strict `[ACR_AUTOMATION]...[/ACR_AUTOMATION]` wrapper only
    - only when matching `pending_semantic_execution` exists on the main session
    - routes captured `complete / review / review_request / blocked` through the existing service/writeback chain
- validation:
  - targeted semantic bridge + writeback tests passed
  - targeted semantic executor tests passed
  - targeted semantic boundary output tests passed
  - full plugin suite `212/212` passed
  - live preflight passed:
    - Feishu Base table list readable via bot identity
    - `Tasks / Bugs` field list readable
    - runtime binding target `agent:main:main` present
- 当前正式钉住：
  - 当前已打通的是 `work surface closure`，不是 `semantic execution closure`
  - `dispatch -> Doing / Fixing` 之后，不会自动进入 `Reviewing / Done`
  - 只有显式 `complete` 才会再交给 `acceptance_mode`
  - 当前 live router 已不再使用 `validation_fixture`
  - 当前 `dispatch` 会读取真实 `Task / Bug` row 并投递 main-session execution request
  - 当前 `dispatch` 不应等待 main-session execution 完成；ACK / `EXECUTE in_progress` 必须和后续 agent completion 解耦
  - semantic bridge 仍不会在 `dispatch` 时伪造完成，真实完成必须由 agent 后续显式产出
  - complete boundary 不能只复制 schema 或只带 record id；必须带 concrete `summary`，并在 prompt contract 中要求 `evidence`
  - 真实完成不再需要 project owner 手工复制；agent 在 assistant output 中产出 boundary block 后由 `llm_output` 自动捕获

结论：
- 当前 `8D` 已经把 work-surface、policy、acceptance 回流链路打通
- `8E` 才是从“可演练”进入“可真实自运转”的关键切口

下一步：
- live `router.yaml` 已切到 `feishu_task_bug_semantic`
  - target: `agent:main:main`
- 下一刀是重启后的 Human live acceptance：
  - 触发 `Tasks Todo -> Doing` 或 `Bugs Todo -> Fixing`
  - 验证 dispatch 群出现 semantic queued 回执
  - 验证 main session 收到含 card context 的 semantic execution request
  - 验证 agent-output boundary 被自动捕获并推进 card 到 `Reviewing` 或 `Done / Fixed`
- 暂不引入大而全 planner / multi-runtime 抽象

### Cut 2A — `route_resolution + trace + safe_fail`
状态：`implemented + auto-validated`

本轮已完成：
- formalize:
  - [route-resolution-trace-safe-fail-contract.md](<repo-root>/plan/active/route-resolution-trace-safe-fail-contract.md:1)
- implementation:
  - `service` 目标若缺失 handler，不再降级到 `project_session`
  - 改为明确 `safe_fail`
- validation:
  - route-related implementation tests 全绿

结论：
- 当前 route contract 已比 Step 1/旧 fallback 语义更干净
- `project_session` 不再承担“service 缺失时的第二执行入口”

### Cut 2B — `NormalizedEnvelope + trace_id`
状态：`implemented + auto-validated`

目标：
- 让 structured ingress 在 route / trace / service bridge 之间有一个稳定最小交接面

本轮已完成：
- formalize:
  - [normalized-envelope-contract.md](<repo-root>/plan/active/normalized-envelope-contract.md:1)
- implementation:
  - structured automation envelope 若上游未提供 `trace_id`，normalization 层会自动生成
  - plugin store 的 `last_route_trace` 现在显式承接 `trace_id`
- validation:
  - route / plugin tests 已验证：
    - structured ingress 会自动补 `trace_id`
    - 上游给定 `trace_id` 会被保留
    - store 里的 route trace 会持久化该 `trace_id`

结论：
- `trace_id` 已从“最好有”升级成当前 structured ingress 的最小稳定字段
- Cut 2 后续可以开始围绕真实 route/service 链验证 explainability，而不是只验证分支命中

### Cut 2C — service-first route validation chain
状态：`implemented + auto-validated`

目标：
- 用真实 `dispatch/review` fixture 证明当前主路径确实是 `service-first`
- 验证 missing handler 时只会 `safe_fail`，不会回退成 `project_session`

本轮已完成：
- validation hardening:
  - `dispatch` fixture 现在会断言：
    - store 里的 `last_route_trace.trace_id` 保留 upstream trace
    - `target_kind=service`
    - `target_id=<project>:dispatch`
    - `route_source=automation`
  - `missing handler` 场景现在会断言：
    - 返回 `safe-fail`
    - 不写 `project_session` lane
    - store trace 为 `target_kind=safe_fail`
- current scope:
  - 这仍然只是 route/service 验收链
  - 不提前把 `main-session escalation` 或 signal promotion 拉进 Cut 2

结论：
- Cut 2 当前已经能更硬地证明：
  - `service` 是结构化 workflow action 的主路径
  - `project_session` 不再是 service 缺失时的隐式 fallback
  - route/store/lane 三处语义基本一致

下一轮应做：
- 收口 Cut 2，转入 Cut 3
- 正式写清 `service_first_orchestrator_action_result` contract
- 开始真实 orchestrator ingress/result bridge 的第一刀

## Human real-world validation gates
以下情况只靠自动测试不够，必须留给 human 实测：

### Gate 1 — `/project` 的真实使用手感
何时触发：
- Cut 1 完成后

要验证：
- 主会话里连续切多个项目时，focus 是否稳定
- 是否仍出现“我以为切了，但系统其实还在旧项目”的感知偏差

状态：
- passed

### Gate 2 — `/project --save` 的 preview / apply 体验
何时触发：
- Cut 1B / 1C 完成后

要验证：
- preview 是否足够可读
- apply 前是否能一眼看出写回宿主是否正确
- review 成本是否低到值得长期使用

状态：
- passed

### Gate 3 — service-first orchestrator seam
何时触发：
- Cut 3 完成后

要验证：
- 在真实主会话里发 dispatch/review 类动作时，是否真的比当前顺滑
- unresolved target 的 safe-fail 是否清楚而不烦人

### Gate 4 — minimal visibility in Feishu
何时触发：
- Cut 4 完成后

要验证：
- board 上的信息是否足够让人“不盯 TUI”
- 但又不会变成噪音面板

### Gate 5 — escalation hygiene
何时触发：
- Cut 4 完成后

要验证：
- business notification 和 main-session escalation 是否真的分流成功
- 主会话是否只留下高信号事项

参考清单：
- [step2-gate5-escalation-hygiene-checklist.md](<repo-root>/plan/active/step2-gate5-escalation-hygiene-checklist.md:1)

状态：
- passed

实测结果：
- `Scenario 1 — review_request`
  - passed
  - `review_request` 默认停留在 business/work side，不自动污染 main session
  - `/project --lane` 可见对应 `review_request` signal
- `Scenario 2 — blocked + human decision`
  - passed
  - `blocked` 能稳定上浮 main session，且可读
  - 备注：存在轻微 readability 问题，主会话回答仍会混入部分旧 rehearsal 主线
- `Scenario 3 — high_signal_completion`
  - passed
  - completion 不会默认刷主会话
  - `/project --lane` 可见 `high_signal_completion`
- `Scenario 4 — duplicate escalation`
  - passed
  - `/project --lane` 中可出现多个 `blocked` 历史事件
  - main session escalation 只保留一个 unresolved governance item
- `Scenario 5 — escalation hygiene vs normal context`
  - passed
  - 普通项目问题仍以 project docs/context 为主
  - ask-attention 时 escalation 更有存在感，但未劫持主会话

结论：
- Cut 4 当前主目标已经成立：
  - `service result -> signal derivation -> business notification / main-session escalation split -> prompt-time governance hint`
- 因此不继续把当前主线放在 Cut 4C 抛光
- 当前建议：转入 Cut 5，收口 `project session` 的 shadow-lane / read-model 边界

当前准备状态：
- `demo-acr` validation-only service harness 已验证可用
- Gate 5 不再是 pending human validation
- 下一步优先级从 `escalation hygiene` 转为 `Cut 5`

### Cut 5 — Project session minimal shadow lane
状态：`in_progress`

目标：
- 把 `project session` 进一步收紧成 shadow lane / read model
- 避免它继续混入 governance truth、旧 rehearsal 主线、或 workflow-like authority

当前切入点：
- 重新检查 `before_prompt_build` 如何消费 lane summary
- 收紧 lane summary 对主会话的注入边界，避免普通项目问题被旧 rehearsal 叙事牵着走
- 明确 `project session` 只保留：
  - route/service/high-signal digest
  - read-model summary
  - 不保留 escalation truth

下一轮应做：
- formalize `Cut 5` 的最小 contract
- 优先从 read-model boundary / prompt injection hygiene 开始，而不是先加新 surface

## Test hygiene note
当前不把“清理旧测试”作为独立 cut。

规则建议：
- 先保留已有测试资产，优先新增能钉住 authority 边界的新测试
- 只有当某批测试出现以下信号时，再集中清理：
  - 明显覆盖旧语义，已与当前 contract 冲突
  - 同一行为有大量重复测试，只增加维护噪音
  - 测试名称/断言已误导当前设计判断

当前判断：
- 现在还没到做大规模 test cleanup 的时机
- 但从 Cut 2 开始，可以顺手清理“命名仍是旧 framing、但行为已被新 contract 取代”的测试
