# Feishu Adapter Config Host Contract

## Purpose
为当前 Feishu 各类 adapter / surface 涉及的“配置类信息”定义一份最小 contract，回答：

- 哪些值不应继续 hardcode 在 runtime / adapter 代码里
- 这些值的配置宿主应该分几层
- 第一版最小配置面先收哪些字段
- 哪些值当前仍可暂留为 code-level default

本文档不授权：
- 立即实现完整配置系统
- 引入通用 secret manager / admin UI / 多租户配置平台
- 把所有当前常量一次性迁出代码

## Why this exists now
`Cut 8A` 已证明 work-surface adapter 路径可行，但也暴露出典型的配置债：

- 默认 Base token fallback 仍存在于代码
- work-surface adapter 对 live table / field binding 仍以内置默认值表达
- governance target 已经做出运行决策，但不能继续靠代码常量承接

如果不在这里先收一道最小 contract，后面继续扩 `Projects / notification / escalation / ingress` 时，很容易把：
- target
- token
- binding
- table/field mapping

再次复制成散落的 hardcode。

## Core stance
当前采纳的最小立场是：

> **Feishu config host 采用两层模型：**
> 1. **global runtime binding**
> 2. **project-owned override**

并且遵守下面两条规则：

1. **跨环境 / 跨 Base / 跨 channel / 含 secret 的值**
   - 进入 `global runtime binding`
2. **项目特有、非 secret、可显式声明的 override**
   - 进入 `project-owned override`

这意味着：
- 不需要先造一整套大配置平台
- 但也不能再把运行环境值写死在 adapter 代码里

## Config host layers

### 1. Global runtime binding
这是第一层，也是当前最先需要的配置宿主。

它负责：
- environment-scoped 值
- channel / target binding
- Base binding
- secret reference
- surface 的默认 delivery / identity 选择

它不负责：
- project truth
- workflow truth
- hall docs continuity

当前推荐形态：
- runtime-side explicit config object
- 可由本地 env + local config file 组合解析
- 但解析后的结果应表现为统一的 binding object

当前还补出了一条 runtime execution 约束：
- 依赖 `lark-cli` 的 default adapter / observer
  - 不应直接裸用运行进程继承到的稀疏 env
  - 至少应先归一化：
    - `HOME`
    - `USER`
    - `LOGNAME`
    - `SHELL`

原因：
- 当前 live OpenClaw runtime 已暴露出一种真实失败模式：
  - lane / snapshot / 本地 state 落盘都成功
  - 但 `lark-cli base` / `lark-cli im` 因 runtime env 不完整而失败
- 因此：
  - adapter config host 不只影响 token / target / binding 的读取
  - 也影响 adapter process 在 runtime 中能否稳定找到 CLI 配置宿主

当前进一步确认的一条 live truth 是：
- `lark-cli auth login` 仍然是独立 CLI 的标准认证路径。
- runtime observer 的默认 auth source 应直接使用 Human 本机已 auth 的 `~/.lark-cli/config.json`。
- runtime observer 的默认路径应直接复用 Human 本机已经可用的 `lark-cli local workspace`。

因此当前已采纳并实现的最小修复是：
- 当调用方已经显式提供 env 时，`buildNormalizedLarkCliEnv(...)` 只负责补全缺失字段，不再隐式继承整份 `process.env`。
- runtime child-process 只带最小白名单 env：
  - `HOME`
  - `USER`
  - `LOGNAME`
  - `SHELL`
  - `PATH`
  - `LANG`
  - `LC_ALL`
  - `TMPDIR`
- runtime env 归一化仍是必要条件，但它服务的是 Human 本机已经可用的 `lark-cli local workspace`，而不是额外 materialize 出另一套 observer 专用 workspace。

当前这条修复已经完成 live validate：
- Human 在宿主终端重新完成 `lark-cli auth login` 后，直接执行：
  - `lark-cli config show`
  - `lark-cli base +table-list --as bot`
  - 都已恢复成功。
- 在同一台机器上的真实 OpenClaw/TUI 中，`Task: Todo -> Doing => dispatch` 现在也已能自动补齐：
  - `current_step = EXECUTE`
  - `step_result = in_progress`

当前已采纳的最小默认发现路径是：
- 若未显式传 `feishuConfigPath`
- 且未设置 `ACR_FEISHU_CONFIG_PATH`
- 则默认尝试发现：`<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`

当前进一步采纳的 sibling runtime host 是：
- 若未显式传 `workflowBindingsPath`
- 且未设置 `ACR_WORKFLOW_BINDINGS_PATH`
- 则默认尝试发现：`<plugin dataDir>/assistant-context-router/workflow-bindings.yaml`

两者分工应保持清晰：
- `feishu-adapter.yaml`
  - 承接 adapter-scoped binding
  - 例如 `work_surface`、`governance.default_target`
- `workflow-bindings.yaml`
  - 承接 transport-agnostic 的 workflow surface binding
  - 例如 `dispatch` / `review` 的默认 target
  - 这些 target 当前可以是 Feishu chat，将来也可以替换成 Discord / Telegram / 其他 transport

当前不要求先决定它最终是：
- 单独 yaml/json 文件
- env-only
- env + local file composition

但要求先固定：
- **runtime 只能消费显式 binding object**
- 不能直接在业务代码里散读多个临时常量再自己拼配置

### 2. Project-owned override
这是第二层，用于承接少量项目级 override。

它负责：
- 项目特有的 target override
- 项目特有的非 secret adapter declaration

它不负责：
- 全局 secret
- 全局默认 Base 选择
- tenant 级默认 delivery policy

当前推荐宿主：
- project-owned manifest
- 优先与项目既有 integration surface 对齐
- 若未来需要正式落盘，优先考虑 `router.yaml` 或同级 integration manifest

当前已进一步采纳一条更具体的结论：
- `Tasks / Bugs` 的 project-level acceptance / completion policy default
  - 应落在 project-owned `router.yaml`
  - 不应落在 `project.yaml`
  - 也不应落在 runtime-global `feishu-adapter.yaml`

当前推荐 shape：

```yaml
task_bug_policy:
  defaults:
    acceptance_mode: manual_acceptance
    completion_notify_mode: no_dm_on_completion_boundary
```

当前推荐约束：
- project-owned override 只承接 **non-secret** 值
- override 默认语义是 `replace global default`
- 不默认做 merge / fan-out

### 3. Contract docs
像本文档、`feishu-sync-architecture-note`、各 surface contract 的作用是：
- 定义 shape
- 定义 ownership
- 定义 default semantics

它们不是：
- 运行时 secret host
- 真实 target id / token 的落盘处

## Minimal config taxonomy

### A. Must move into explicit config host
下面这些值不应继续扩散为 runtime hardcode。

#### A1. Base binding
- `base_token` 或 `base_token_ref`
- default Base selection
- future multi-Base binding name

原因：
- 它是 environment-scoped
- 可能跨环境变化
- 含 secret / secret reference 语义

#### A2. Delivery target binding
- global governance target
- future global business notification default target
- future target channel / chat / DM binding

原因：
- 它是运营决策
- 可能跨 channel / chat / tenant 变化
- 后续可能出现 project override

#### A3. Explicit target identifiers
- `target_id`
- `thread_id`
- `chat_id`
- `binding_id`

原因：
- 它们属于典型的环境实例值
- 不应嵌入代码常量

### B. Should have a migration path, but not urgent to externalize today
下面这些值当前可先保留 code-level default，但要承认它们是“绑定债”。

#### B1. Table binding
- `Work Surface Snapshots`
- `Projects`

#### B2. Field binding
- `Project ID`
- `所属项目`
- `状态`
- `标题`
- `摘要`
- `更新时间`

原因：
- 当前只有一份已 review 的 live Base
- 第一刀继续以内置默认值表达，复杂度最低
- 但如果后续出现第二份 Base、结构升级、或不同 tenant 版本，这些绑定就应进入显式 config host

### C. May stay as code-level defaults for now
下面这些当前可以继续留在代码里：

- parser grammar
- command help text
- `relation_write_mode` 的默认值
- tests / fixtures literal
- contract-level logical field names

原因：
- 它们表达的是代码语义默认值
- 不是环境实例值
- 也不属于 secret / target binding

## Minimal first-slice binding shape
当前建议只先定义两个最小 binding object。

### 1. `FeishuWorkSurfaceBinding`

```yaml
work_surface:
  base_token_ref: env:FEISHU_BASE_TOKEN
  identity: bot
  table_binding:
    projection: Work Surface Snapshots
    projects: Projects
  field_binding:
    project_id: Project ID
    project: 所属项目
    surface_status: 状态
    headline: 标题
    summary: 摘要
    updated_at: 更新时间
  relation_write_mode: record_id_array
```

说明：
- 第一版只要求把真正会跨环境变化的值留出宿主
- `table_binding / field_binding` 当前可以先由默认值填充
- 但 binding object 的 shape 先固定，避免后面继续把值散落在调用栈里

### 2. `GovernanceDeliveryBinding`

```yaml
governance:
  default_target:
    channel_type: wechat
    target_kind: dm
    target_ref: local:human_dm
    delivery_mode: direct
```

说明：
- 当前已采纳的默认 target 是 `WeChat DM`
- 但实际 `target_ref` 必须来自显式 binding host
- runtime 只消费解析后的 target object

### 3. `WorkflowSurfaceBindings`

```yaml
dispatch:
  default_reply_target:
    channel_type: feishu
    target_kind: channel
    target_id: oc_dispatch_group_id
    visibility: system_facing
    reply_mode: direct
review:
  default_reply_target:
    channel_type: feishu
    target_kind: channel
    target_id: oc_review_group_id
    visibility: system_facing
    reply_mode: direct
```

说明：
- 这是 transport-agnostic 的 workflow surface binding
- 当前 first slice 只先实现 `default_reply_target`
- `dispatch` 当前应被理解为多来源逻辑 ingress：
  - 飞书群
  - Discord 群
  - Telegram 群
  都可以同时存在
- `review` 当前更适合先有一个主工作面
  - 用于 agent 间 review 流转
  - 需要 governance 时再升级到 `WeChat DM`

## Current adopted defaults
当前已采纳、但不得视为代码常量的运行默认值包括：

- global default governance target: `WeChat DM`
- workflow binding host: `<plugin dataDir>/assistant-context-router/workflow-bindings.yaml`

当前已存在、但应视为实现期临时默认值的项包括：

- work-surface default Base token fallback
- work-surface live table / field binding default

## Current implementation status
当前第一版 runtime skeleton 已经落下来了：

- 新增 shared config loader：
  - [config-host.ts](<repo-root>/implementation/adapters/feishu/src/config-host.ts:1)
- `work-surface` 默认 runner 已改为先解析显式 binding object，再调用 manual sync：
  - [index.ts](<repo-root>/implementation/adapters/openclaw/plugin/src/index.ts:103)
- `manual-sync` 已能接受解析后的：
  - `baseToken`
  - `tableNames`
  - `fieldNames`
  - `relationWriteMode`
  - [manual-sync.ts](<repo-root>/implementation/adapters/work-surfaces/feishu/src/manual-sync.ts:1)
- `work-surface` 的 table / field 默认绑定也已集中到 config host：
  - 不再散落在多个调用点

当前已落地的最小能力包括：
- `global runtime binding` 可由 env + optional local YAML config 解析
- 若无显式配置，则默认发现 `<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`
- 若无显式 workflow binding 配置，则默认发现 `<plugin dataDir>/assistant-context-router/workflow-bindings.yaml`
- `work-surface base binding` 已接入默认 runtime path
- `governance delivery binding` 已接入默认 escalation runtime path
  - 当前默认实现先进入幂等的 `governance delivery outbox`
  - 尚未直接接 WeChat / Feishu sender
- `workflow surface default_reply_target` 已接入 business notification delivery path
  - 当 envelope 没有显式 `reply_target` 时
  - 可按 `dispatch / review` workflow 回退到显式 workflow binding
  - 当前若 binding 指向非 Feishu transport，会安全退回 `record_only`

当前仍保留的实现期债务包括：
- 若没有 `FEISHU_BASE_TOKEN` 或显式 config host，work-surface path 会 fail closed
- table / field binding 目前仍以内置 default 为主，只是已有统一宿主
- 当前 `governance default_target` 仍只覆盖 global runtime binding，project-owned override 尚未进入实现

## Current runtime host status
当前已确认的运行时宿主包括：

- 默认发现路径：`<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`
- sibling 宿主：`<plugin dataDir>/assistant-context-router/workflow-bindings.yaml`
- 初始化脚本：
  - [init-feishu-config.ts](<repo-root>/implementation/adapters/openclaw/plugin/scripts/init-feishu-config.ts:1)
  - [init-workflow-bindings.ts](<repo-root>/implementation/adapters/openclaw/plugin/scripts/init-workflow-bindings.ts:1)
- 当前机器已创建真实运行时文件：
  - `<openclaw-acr-data-dir>/feishu-adapter.yaml`
  - `<openclaw-acr-data-dir>/workflow-bindings.yaml`

当前运行时文件已显式承接：
- `work_surface` binding
- `governance.default_target`
  - `channel_type=wechat`
  - `target_kind=dm`
  - `target_ref=local:human_dm`
  - `delivery_mode=direct`
- `dispatch.default_reply_target`
  - `channel_type=feishu`
  - `target_kind=channel`
  - `target_id=oc_d634b4327cb362b612c29d60a92c0fef`
- `review.default_reply_target`
  - `channel_type=feishu`
  - `target_kind=channel`
  - `target_id=oc_81be1bc8e3ec8950adefda095ebf7a7a`

当前这份 `governance.default_target` 的运行语义已进一步明确为：
- 它不是直接写死 session key
- 当前默认会先解析到 `runtimeBindings.main_sessions` alias
- 典型第一版路径：
  - `local:human_dm`
  - -> `wechat:dm:human`
  - -> canonical main session（例如 `agent:main:main`）

同时，runtime bindings 自身当前也已有独立默认宿主：
- 默认发现路径：`<plugin dataDir>/assistant-context-router/runtime-bindings.yaml`
- 当前机器已创建真实运行时文件：
  - `<openclaw-acr-data-dir>/runtime-bindings.yaml`
- OpenClaw plugin 已不再继续显式指向 demo `runtimeBindingsPath`

## Host recommendation

### Global runtime binding host
当前推荐：
- 不放在 hall docs
- 不放在 project truth docs
- 不放在 project repo 的公开 manifest 中存 secret

更合适的是：
- adapter runtime 的显式 config host
- 由 env / local file 解析成统一 binding object

### Project-owned override host
当前推荐：
- 放在项目侧 integration manifest
- 只放 non-secret override

典型未来用途：
- 某项目单独覆盖 governance target
- 某项目单独指定 business notification target

## Precedence rule
当前建议 precedence 如下：

1. project-owned override
2. global runtime binding
3. code-level contract default

但有一个例外：
- **secret / target id / token / chat binding 不允许回退到 code-level default**

也就是说：
- code default 只能承接语义默认值
- 不能承接环境实例值

## Failure policy

### 1. Missing required binding
如果某个 surface 所需的显式 binding 不存在：
- preflight fail
- 不 silent downgrade
- 不临时拼装 guessed target

### 2. Missing project override
若项目未声明 override：
- 回退到 global runtime binding

### 3. Missing global binding for non-critical mirror surface
若未来像 Feishu escalation mirror 这类 secondary surface 缺 binding：
- 可以保守地“不投递”
- 但不得把运行时常量伪装成默认 target

## Migration order
当前建议的迁移顺序如下：

1. `global governance target binding`
   - 因为已经有明确默认值，而且最容易误写成 hardcode
2. `work-surface base binding`
   - 把 default Base fallback 从代码常量提升为显式配置来源
3. `work-surface table / field binding`
   - 只在出现多 Base / schema drift / second tenant 时再正式外置
4. `business notification default target binding`
   - 等该 surface 进入实现再收

## Out of scope now
当前不在这份 contract 内解决：
- 完整 secret management
- binding UI
- config hot reload
- multi-tenant registry
- 全 surface 的统一 mega schema
- project-owned override 的最终 manifest 文件名

## Relationship to other docs
本文档是下面这些文档的配置宿主补充：

- [feishu-sync-architecture-note.md](<repo-root>/plan/active/feishu-sync-architecture-note.md:1)
- [feishu-work-surface-adapter-scope-note.md](<repo-root>/plan/active/feishu-work-surface-adapter-scope-note.md:1)
- [feishu-project-catalog-sync-contract.md](<repo-root>/plan/active/feishu-project-catalog-sync-contract.md:1)
- [feishu-business-notification-surface-contract.md](<repo-root>/plan/active/feishu-business-notification-surface-contract.md:1)
- [feishu-escalation-surface-contract.md](<repo-root>/plan/active/feishu-escalation-surface-contract.md:1)
