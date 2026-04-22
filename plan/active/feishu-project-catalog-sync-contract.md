# Feishu Project Catalog Sync Contract

## Purpose
为 Feishu `Projects` 表定义一份最小可执行的 catalog sync contract。

本文档回答：
- `Projects` 表在 ACR 里到底是什么对象
- 本地 `index.yaml` / `project.yaml` 各自负责什么 truth
- 当前哪些字段可以进入 ACR-owned write set
- 哪些字段必须继续保持 Human-owned 或后置
- catalog sync 的 mode、幂等键与 failure policy 应该是什么

本文档不授权：
- 自动批量写入 `Projects`
- 自动归档或删除项目记录
- 在未 review 的情况下改 `Projects` 表结构

## Current implemented first slice
当前已完成的 first slice 如下：
- OpenClaw plugin 已新增显式命令入口：
  - `/project [<project_ref>] --catalog-sync [--apply]`
  - 默认 `dry_run`
  - `--apply` 才真正写 Feishu
  - 未传 `<project_ref>` 时使用当前 `/project` binding
- 当前实现复用同一份 Feishu runtime config host：
  - `<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`
  - 继续沿用 `work_surface.table_binding.projects` 与 `field_binding.projects`
- 当前实现已包含：
  - live schema preflight
  - 本地 truth 校验
  - duplicate `Project ID` 检测
  - `create / update / noop` plan
  - friendly error surface
- 当前实现仍未包含：
  - batch backfill
  - reconcile repair
  - archive apply
  - `Owner / Members` relation 写入
- 当前 live 验证已通过：
  - `demo-acr` 的 `/project --catalog-sync` 在真实 Base 上返回 `noop`
  - `/project --catalog-sync --apply` 也保持 `noop`
  - 说明现有 `Projects` row 已与 local truth 对齐，不会重复创建第二行
  - 当前已验证 record id：`<projects-catalog-record-id>`

## Role
`Projects` 在当前架构里的定位不是 backlog truth，也不是 project truth。

它是：
- Feishu Base 内的 project catalog projection
- relation target anchor
- human-facing project directory
- 后续 `Work Surface Snapshots`、notification、escalation、Tasks/Bugs projection 的统一项目锚点

它不是：
- 项目长期身份的 authoritative host
- `/project` 的 authority source
- workflow state truth host

## Truth sources
当前建议把本地 truth sources 划分成两层。

### 1. `index.yaml`
它是项目宇宙与 registry presence 的 authority。

对 catalog sync 而言，`index.yaml.projects[]` 负责：
- `project_id`
- `title`
- `type`
- `status`
- `owner`
- `file`
- `cadence`

### 2. `project.yaml`
它是单项目局部详情的 authority。

对 catalog sync 而言，`project.yaml` 负责：
- `objective`
- 以及对 `project_id / title / owner / status` 的局部一致性校验

## Source precedence
catalog sync 当前建议采用下面的 precedence。

### Canonical registry fields
下面这些字段以 `index.yaml` 为准：
- `project_id`
- `title`
- `type`
- `status`
- `owner`
- `file`
- `cadence`

原因：
- `Projects` catalog 的核心职责是表达“这个项目是否在当前项目宇宙中”
- 这类字段天然属于 registry layer，而不是 project-local narrative

### Project-local detail field
下面这个字段以 `project.yaml` 为准：
- `objective`

原因：
- 它属于单项目说明，而不是 registry listing

### Drift rule
若 `project.yaml` 中的 `project_id / title / owner / status` 与 `index.yaml` 不一致：
- `project_id` mismatch：`hard-fail`
- `title / owner / status` mismatch：默认进入 `reconcile-required`

当前不建议 silent pick-one 并继续 apply。

## Live Base alignment
当前 live Base：
- base token: `private config host`
- table: `Projects`
- table id: `<projects-table-id>`

当前已确认的 live 字段如下：
- `项目名称`
- `Project ID`
- `Source Path`
- `目标`
- `Archived`
- `Cadence`
- `复盘节奏`
- `Owner`
- `类型`
- `状态`
- `工作方式`
- `项目截止时间`
- `对应任务`
- `Bugs`
- `成员`
- `任务数量`
- `Bug数量`
- `任务完成度`
- `最近运行时间`
- `连续失败次数`
- `WIP上限`
- `7日成功率`

其中需要特别注意：
- `类型`
- `状态`
- `工作方式`

当前通过 `lark-cli base` + bot identity 读取时会返回 `not_support` / dynamic options unsupported。

这意味着在当前链路下，它们**不适合直接进入第一版 ACR-owned write set**。

## Stable key and row semantics
当前建议：
- stable key：`Project ID`
- row semantics：one row per project

Catalog sync 不应使用：
- `项目名称` 做 fuzzy match
- `Source Path` 做主键
- relation existence 反推 project identity

若 `Project ID` 为空、缺失或重复：
- 不继续 apply
- 进入 `reconcile-required`

## Field ownership classes
当前建议把 `Projects` 字段分成三类。

### A. ACR-owned writable now
这些字段可进入第一版 catalog sync write set。

| Feishu field | local source | owner | rule |
| --- | --- | --- | --- |
| `Project ID` | `index.yaml.projects[].project_id` | ACR | stable key，create/update 都可写 |
| `项目名称` | `index.yaml.projects[].title` | ACR | canonical display title |
| `Source Path` | `"projects/" + index.yaml.projects[].file` | ACR | repo-relative source anchor |
| `目标` | `project.yaml.objective` | ACR | project detail summary |
| `Cadence` | `index.yaml.projects[].cadence` | ACR | free-text cadence summary |

### B. ACR-owned but not writable in first slice
这些字段在本地是有 truth 的，但当前不应进入第一版 write set。

| Feishu field | local source | why defer |
| --- | --- | --- |
| `类型` | `index.yaml.projects[].type` | 当前为 dynamic select，bot + `lark-cli base` 不适合稳定写入 |
| `状态` | `index.yaml.projects[].status` / `project.yaml.status` | 当前为 dynamic select，且更容易引入“Feishu 看起来像 truth”错觉 |
| `Owner` | `index.yaml.projects[].owner` / `project.yaml.owner` | 需要先有稳定 `Members` catalog / relation 解析 |
| `Archived` | derived lifecycle policy | 需要先定义 bulk reconcile / archive policy，不能在单项目 apply 里偷归档 |

### C. Human-owned or system-derived
这些字段不应由 catalog sync 默认覆写。

| Feishu field | owner | reason |
| --- | --- | --- |
| `复盘节奏` | Human / governance process | 当前不是本地 registry 的稳定 canonical field |
| `工作方式` | Human | 当前非 registry truth，且为 dynamic select |
| `项目截止时间` | Human | 项目 planning 信息，不是当前 registry truth |
| `WIP上限` | Human / workflow governance | 不属于 project catalog baseline |
| `对应任务` | system-derived | backlog relation |
| `Bugs` | system-derived | backlog relation |
| `成员` | system-derived / lookup | 来自 `Owner` 与 `Members` 关系 |
| `任务数量` / `Bug数量` / `任务完成度` / `最近运行时间` / `连续失败次数` / `7日成功率` | system-derived | runtime / workflow projection |

## Archived policy
`Archived` 当前不建议直接纳入单项目 `apply` write set。

原因：
- 它实际上承载的是 lifecycle / registry-presence policy
- 一旦写错，容易让项目“看起来被归档”
- 单项目 apply 很难判断“本地不存在”到底是删除、改名、迁移，还是临时不在当前视野

当前建议：
- create path：默认写 `Archived = false`
- single-project update：默认不碰 `Archived`
- bulk `reconcile/backfill`：可以提出 archive suggestion
- 只有 Human review 通过后，才执行真实 archive apply

## Minimum local inputs
当前建议 catalog sync 至少要求下面这些本地输入：
- `project_id`
- `title`
- `file`
- `cadence`
- `objective`

若缺其中任一项：
- `project_id / title / file` 缺失：`hard-fail`
- `cadence / objective` 缺失：默认 `hard-fail`

当前不建议为了“先写进去一行”而默默降级成半残 row。

## Sync modes
### `inspect`
用途：
- 读取 `Projects` live schema
- 确认字段是否齐全
- 查找 stable key 是否唯一
- 比较 local truth 与 Feishu row 是否一致

输出：
- 只读报告
- 不写记录

### `dry_run`
用途：
- 为单个项目或显式项目集生成 create / update / no-op / reconcile-required plan

输出至少应包含：
- stable key
- target row state
- planned patch
- skipped fields
- reconcile blockers

### `apply`
用途：
- 对单个项目或显式批准的批次，执行真实 create / update

约束：
- 只写当前 `ACR-owned writable now` 字段
- 不 silent archive
- 不顺带写 `Owner / 类型 / 状态`

### `reconcile`
用途：
- 发现并处理：
  - duplicate `Project ID`
  - local/Feishu drift
  - missing local source file
  - stale row
  - archive candidates

输出：
- 修复建议
- 显式 apply plan

### `backfill`
用途：
- 显式把整个 local registry 补齐到 `Projects`

约束：
- 必须是显式批量操作
- 不应被 `/project --surface-sync` 隐式触发

## Trigger rules
当前采纳的 trigger rule：
- `surface-sync` 不得隐式创建 `Projects` row
- `surface-sync` 遇到缺 catalog anchor 时，应 preflight fail，并明确引导先做 catalog sync
- catalog sync 必须是显式动作，不能作为其他 surface 的 side effect

## Failure policy
### Hard-fail
遇到下面情况时直接失败：
- 缺 `Projects` 表
- 缺 `Project ID / 项目名称 / Source Path / 目标 / Cadence` 任一目标字段
- 本地 `index.yaml` 没有该项目
- `project.yaml` 缺失
- `project_id` mismatch

### Reconcile-required
遇到下面情况时不继续 apply：
- 同一 `Project ID` 有多条记录
- `title / owner / status` 在 `index.yaml` 与 `project.yaml` 之间不一致
- Feishu 已有 row，但 ACR-owned writable fields 与 local truth 冲突
- 目标 row 缺 `Project ID`，只能靠人工判断是否为同一项目

### Warning-only
下面这些情况可以 warning，但不阻止第一版 apply：
- `Owner` 尚未建立 relation
- `类型 / 状态 / 工作方式` 当前不可写
- `复盘节奏` 与 `Cadence` 语义不一致

## Current first-slice boundary
当前已实现的第一版 catalog sync 严格收在下面这条边界内：

1. 仅支持显式单项目 `inspect / dry_run / apply`
2. stable key 固定为 `Project ID`
3. 仅写：
   - `Project ID`
   - `项目名称`
   - `Source Path`
   - `目标`
   - `Cadence`
   - create 时 `Archived=false`
4. 遇到 duplicate / drift / 缺行时，不自动修复为别的对象
5. 不碰：
   - `Owner`
   - `类型`
   - `状态`
   - `工作方式`
   - `复盘节奏`
   - 任意 backlog / runtime-derived 字段

## Current implementation notes
- `Source Path` 当前规则：
  - registry `file` 为相对路径时，写入 `projects/<file>`
  - registry `file` 为绝对路径时，暂按原值写入
- 本地 drift 校验当前已落地：
  - `project.yaml.project_id` 缺失或与 registry 不一致：`hard-fail`
  - `title / owner / status` 若在 `index.yaml` 与 `project.yaml` 之间不一致：`reconcile-required`
- `noop` 当前已成为正式 plan 结果之一：
  - 说明 Feishu row 的 ACR-owned writable fields 已与 local truth 对齐
  - `apply` 下不会重复 upsert
  - 当前该语义已在真实 Base 上被 `demo-acr` live 验证

## Recommended follow-ups
完成这份 contract 后，最自然的后续讨论顺序是：

1. `Members` catalog / owner relation 是否需要先行
2. 第一种 Feishu action ingress 选消息、表单还是 Base 表
3. business notification 在 Feishu 的第一落点
4. escalation surface 的 ack / resolve 语义

## Relationship to Feishu sync architecture
本文档是 [feishu-sync-architecture-note.md](<repo-root>/plan/active/feishu-sync-architecture-note.md:1) 中 `Project Catalog` 那一行的第一份细化 contract。
