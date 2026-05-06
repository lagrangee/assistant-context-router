# Feishu Work-Surface Adapter Scope Note

## Purpose
把 `Cut 8A — Feishu work-surface adapter first slice` 的最小实现边界收成一份可执行说明，避免第一刀在 Feishu Base 上重新长成 backlog truth 或 workflow truth。

当前 note 只回答：
- 第一刀往哪张表投
- 最小字段方案是什么
- `Projects` relation 是否进入最小方案
- adapter 的 lookup / upsert key 应该是什么

当前 note 默认不授权任何表结构改动。
若需要新增或调整表、字段、枚举、view，仍需先与 Human 讨论确认。

## Confirmed decisions
- 通过 FEISHU_BASE_TOKEN 或 config host 绑定既有 Base：`private config host`
- 第一刀不把当前 project-level latest snapshot 直接写入 `Tasks / Bugs`
- `Tasks / Bugs` 的 meta 设计、字段契约、状态流转逻辑只作为继承参考
- `Service Runs Monitor` 不作为当前 projection 的默认目标
- 第一刀 projection table 名称定为：`Work Surface Snapshots`
- 最小字段方案应包含一个指向 `Projects` 的 relation 字段
- 即使引入 `project -> Projects` relation，adapter 仍保留独立 `project_id` 字段作为稳定 lookup / upsert key

## Live Base status
经 Human review 确认后，当前 Base 已完成第一刀真实落地：

- Base 仍通过私有 config host 绑定
- `Dict Definition` 已注册枚举字段：`Work Surface状态`
- 已新建 projection table：`Work Surface Snapshots`
- table id：`<work-surface-table-id>`
- 真实 live dry-run 已通过
- 第一次 live snapshot upsert 已通过：
  - project: `proj-bitable-pm-system`
  - create record id: `<work-surface-snapshot-record-id>`
  - second upsert 已命中同一 record 的 update path

当前 live table 的实际字段名如下：
- `Project ID`
- `所属项目`
- `状态`
- `标题`
- `摘要`
- `更新时间`
- `trace_id`
- `signal_kind`
- `action_name`
- `workflow`
- `run_id`
- `queue_ref`
- `artifact_kind`
- `artifact_label`
- `artifact_target`

补充说明：
- `所属项目` 是 link -> `Projects`
- `状态` 当前是静态 select，选项为 `blocked / in_review / completed / failed`
- `Dict Definition.Work Surface状态` 已同步注册同一组选项
- `ID` 为 Base 自动生成的 auto-number 字段，不参与 adapter lookup / idempotency

## Why this table
`Cut 7` 当前产出的是 **per-project latest high-signal snapshot**，不是 backlog item，也不是 runtime event log。

因此第一刀不应写入：
- `Tasks`
- `Bugs`
- `Service Runs Monitor`

更合适的落点是：
- 同一 Base 内
- 单独一张 projection table
- 一行表达一个 project 的最新 work-surface snapshot

这能保持：
- Feishu 仍是 work-surface adapter
- project/workflow truth 不被 Feishu 反向定义
- ACR adapter 只消费 latest snapshot，而不是自己再去拼 lane / notification / escalation

## Minimal scope
第一刀只做：
- 读取既有 Base metadata
- 读取 projection table 里的现有记录
- 以单 project latest snapshot 为单位执行幂等 upsert
- 使用 `lark-cli base` 完成最小 read + update/create

第一刀不做：
- delete
- comment/card/view automation
- 多行 event feed
- 写回 `Tasks / Bugs`
- 从 Feishu 反向决定 ACR / workflow truth

## Projection row semantics
`Work Surface Snapshots` 当前语义是：
- one row per project
- latest high-signal snapshot only

它不是：
- backlog board
- unresolved governance queue
- run history stream
- authoritative workflow state host

## Minimal field scheme
下面是当前采纳的最小字段方案。

### Required
- logical `project_id` -> physical `Project ID`
  - type: single line text
  - role: stable adapter lookup / upsert key
- logical `project` -> physical `所属项目`
  - type: relation -> `Projects`
  - role: human-facing project anchor inside the same Base
- logical `surface_status` -> physical `状态`
  - type: single select
  - role: work-surface display status
  - expected values: `blocked | in_review | completed | failed`
- logical `headline` -> physical `标题`
  - type: single line text
  - role: adapter-ready title
- logical `summary` -> physical `摘要`
  - type: multiline text
  - role: concise latest execution summary
- logical `updated_at` -> physical `更新时间`
  - type: datetime
  - role: latest snapshot update time

### Recommended in first slice
- `trace_id`
  - type: single line text
- `run_id`
  - type: single line text
- `queue_ref`
  - type: single line text
- `artifact_label`
  - type: single line text
- `artifact_target`
  - type: url or single line text

### Optional, can stay deferred if schema discussion prefers smaller first cut
- `signal_kind`
  - type: single line text
- `action_name`
  - type: single line text
- `workflow`
  - type: single line text
- `artifact_kind`
  - type: single line text

## Relation rule
当前确认 `project -> Projects` relation 应进入最小方案，因为它能带来：
- 同一 Base 内更自然的人类浏览体验
- 更稳定的 project anchor 呈现
- 后续 lookup / rollup 能力的保留

但 relation 当前 **不替代** `project_id` 的作用。

原因：
- `Project ID` 承接的是 ACR snapshot 的天然稳定键
- relation 写法更依赖 Feishu record 表达形式
- adapter 做幂等更新时，用 `project_id` 查找最直接、最稳定

因此第一刀的推荐规则是：
- `project_id` 负责 lookup / idempotency
- `project` relation 负责同 Base 内的人类可读 anchor

## Inheritance from existing Base assets
第一刀应继承的不是 `Tasks / Bugs` 的 object authority，而是它们的设计纪律：
- contract-first
- human-managed structure
- runtime-side record write discipline
- field semantics 尽量清楚且克制

第一刀不应把 `Task/Bug` 的状态机硬套到 snapshot row 上。

## Immediate implementation consequence
当前 adapter skeleton 已与 live Base 对齐：
- table target name: `Work Surface Snapshots`
- row lookup key: `Project ID`
- relation field: `所属项目`
- status field: `状态`
- title / summary / updated_at fields: `标题 / 摘要 / 更新时间`

如果目标表或字段尚不存在：
- fail clearly
- 不静默改表
- 不回退写入 `Tasks / Bugs`

## Current next step
当前最自然的下一步不是继续讨论表名或最小字段。manual sync / dry-run 入口已经存在，且已在真实 Base 上完成验证：
- `proj-bitable-pm-system` 的 live dry-run 已成功解析 `Projects` relation
- `Project ID / 所属项目 / 状态 / 标题 / 摘要 / 更新时间` 的字段映射已真实通过
- `更新时间` datetime 与 optional artifact fields 也已成功生成 upsert plan
- 后续 live apply 也已通过：
  - 首次 apply 走 `create`
  - 第二次 apply 走 `update`
  - 当前单行记录仍保持 one-row-per-project 语义
- plugin 主链现在也已暴露一个 optional `workSurfaceProjectionObserver`
  - observer 在真实 signal -> snapshot 落盘之后触发
  - observer failure 只记日志并 safe-fail，不反向影响 ACR 主链
  - 这允许后续直接消费内存中的 snapshot 对象，而不必先从文件系统读回
- OpenClaw plugin 已将 project-scoped 手工同步收进 `/project` 参数面
  - 首选入口：`/project [<project_id>] --surface-sync [--apply]`
  - 默认执行 `dry_run`
  - 传 `--apply` 时才真正写入 Feishu
  - 未显式传 `project_id` 时，优先使用当前 `/project` binding
  - `/project` 现已成为唯一公开命令入口；不再保留旧命令 alias
  - default runner 当前会先解析显式 `work-surface binding`
    - 支持 env + optional local config host
    - 若未显式指定，则默认尝试发现 `<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`
    - 再把解析后的 `baseToken / tableNames / fieldNames / relationWriteMode` 传给 adapter
  - 若当前没有显式 config host 或 `FEISHU_BASE_TOKEN`，work-surface path 会 fail closed
  - `FEISHU_BASE_TOKEN` 仍可作为最直接的 env source
  - TUI command path 现在会把 sync failure 直接回显为友好文本，而不是 generic command failure
  - 这让 Feishu 继续保持 work-surface adapter 身份，而不是默认变成 runtime 自动 sink

补充 guardrail：
- 上面这条 default Base token fallback 当前仍应视为实现期临时默认值，而不是长期 hardcode 策略
- `work-surface` 默认 runtime path 现在已经先走统一 config host；后续应继续减少对 code-level fallback 的依赖
- 新增其他 surface 时，不应继续复制“把 target / token / binding 直接写死在代码里”的模式

因此当前剩余的下一步是：
- 继续把 `/project --surface-sync` 作为主会话默认手工入口，用真实业务 snapshot 覆盖当前 validation row
- 保持 observer hook 存在但不默认自动 apply；若未来要启用自动 wiring，再单独讨论
- 决定 validation row 何时由真实业务 snapshot 自然覆盖，或是否需要额外 cleanup 策略
- 再决定是否需要补 delete / cleanup 策略；这不属于第一刀默认范围
