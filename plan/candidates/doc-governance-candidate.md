# 文档治理候选方案（v3）

## Purpose
为 `assistant-context-router` 定义一套可持续扩张、面向多 agent 协作的项目文档治理模型。

本文档当前是 `doc-governance` 主题的 **umbrella host**，只保留：

- 顶层问题定义
- 统一词表
- source-to-truth 总模型
- 已拍板方向摘要
- 子契约文档导航

详细契约已拆到独立子文档，避免本文件继续膨胀成新的“文档失控”样本。

## Why this doc was split
此前这条文档线已经同时承载：

- lifecycle rules
- archive / source pipeline
- loading policy
- metadata / registry design
- runtime tooling design
- header rollout

继续堆在同一文件里，会带来：

- writeback 宿主不清晰
- 未来 agent 难以判断哪个段落才是当前权威
- 单文件阅读面和变更面继续扩大

因此当前保留本文件作为总纲，同时将具体契约拆分到：

- [lifecycle-contract-candidate.md](doc-governance/lifecycle-contract-candidate.md)
- [source-pipeline-candidate.md](doc-governance/source-pipeline-candidate.md)
- [loading-contract-candidate.md](doc-governance/loading-contract-candidate.md)
- [metadata-registry-candidate.md](doc-governance/metadata-registry-candidate.md)
- [runtime-architecture-candidate.md](doc-governance/runtime-architecture-candidate.md)

## Core problem
当前项目的文档体系会天然面对三类压力：

1. 文档数量快速增长
2. token / context window 成本快速上升
3. agent 与人类的定位、恢复、追溯成本持续变高

因此文档治理的目标不只是“目录整齐”，而是：

- 让 source of truth 稳定
- 让 writeback 宿主清楚
- 让默认读取面保持很小
- 让原始讨论可追溯但不污染主读取面

## Canonical vocabulary
当前正式词表只保留以下 4 类对象：

### 1. Index layer
用于导航、authority discovery、按需加载入口。

示例：

- `docs/README.md`
- 后续的 doc registry
- provenance lookup 入口

### 2. Canonical hosts
项目内正式宿主层。

说明：

- `layer: canonical` 表示文档属于正式宿主层
- 它不自动等于“已 adopted 的执行真相”
- candidate proposal host 与 adopted truth host 都可以位于这一层
- 两者的区别由 registry 中的 `doc_state` 决定

示例：

- `README.md`
- `STATUS.md`
- `RESUME.md`
- `execution/COLLAB.md`
- `plan/active/*`
- `plan/candidates/*`

### 3. Derived notes
从讨论、review、meeting 中提炼出的结构化中间物。

示例：

- meeting note
- extracted note
- adjudication note
- review note

### 4. Raw transcripts
原始对话、会议记录、完整 transcript。

说明：

- 默认不进入主读取面
- 默认不直接充当 adopted truth

## Terminology decision
`Working notes` 不再作为正式层级继续保留。

如果后续还需要口头描述“仍在演化的中间材料”，统一并入 `derived notes`，避免：

- `working notes`
- `derived records`
- `derived notes`

三套词并存。

## Source-to-truth stack
当前完整模型的主链路是：

```text
raw transcript -> derived note -> canonical host
```

但运行时默认不要求每次都经过 derived layer。

更准确地说：

- 完整 provenance 模型允许 `raw -> derived -> canonical`
- 日常默认路径应尽量更轻：`raw -> canonical`
- 只有当 provenance compression、review adjudication、竞争性方案比较等需求出现时，才启用 derived note

其中：

- index layer 是横切导航层
- provenance 默认落在 derived note
- canonical host 默认不直接挂 raw transcript

## Current adopted directions
截至当前，这条设计线上已收敛的方向包括：

### Document system
- 先设计信息分层，再设计目录
- candidate / active / archive 目录分层不足以单独解决规模问题
- 默认应优先更新已有宿主，而不是新开文档

### Source pipeline
- 采用 external archive + in-repo index
- repo 内 canonical host 继续用 plain files
- 原始 transcript 放 repo 外 sidecar archive
- `transcript -> derived note -> canonical host` 是完整升格路径
- `transcript -> canonical host` 应作为更轻的默认运行路径
- derived note 是可选稀疏层，而不是默认必写层

### Archive
- archive root 当前默认使用 iCloud Drive
- 采用跨项目共享 archive namespace
- 当前采用 no-delete-first stance
- archive 引用采用 `archive_root + relative archive_ref`
- transcript object 默认用 object directory + manifest 表达

### Loading
- agent loading 应 task-driven，而不是 directory-driven
- 默认读取路径必须最小化
- provenance 需求出现时才下钻到 derived note
- 只有确实需要原始语义时才读 transcript

### Metadata
- 采用 `human-facing header + machine-friendly registry` 双面设计
- registry 是 machine-authoritative
- header 是 human-facing mirror
- registry 第一版采用单文件 YAML
- candidate host 与 adopted truth 由 `doc_state` 区分，而不是仅靠 `layer`

### Runtime implementation
- 参考 `inbox-archiving` 的工程模式，而不是直接复用其最终产物
- 允许直接升级现有 capture plugin
- 必须保证 `memory/inbox` 现有 aggregator 效果继续成立
- 为 doc-governance 新增 transcript builder / resolver / linter
- 多 runtime 采用各自 ingest adapter，而不是假设所有 agent tool 都有 plugin hook
- event 必须能稳定路由到 `project_id`，且 candidate-only topic 不得被 resolver 伪装成 adopted truth

### Relationship to external SDD tools
- `OpenSpec` / `Spec Kit` 这类 SDD 工具与本方案有重叠，但不完全同层
- 它们更适合承载 feature / change 级别的 proposal / spec / plan / tasks / implementation workflow
- 本方案更关注跨 agent 的 source capture、provenance、authority discovery、loading discipline、doc lifecycle 与 runtime archive
- 当前不建议用外部 SDD 工具替代 doc-governance；更合理的方向是把它们作为 implementation planning / change-spec layer 的候选应用层
- 若后续要引入，应优先小范围试点 `OpenSpec` 或 `Spec Kit` 来承载某个 active implementation change，而不是迁移整套文档治理体系

## Child contract map

### Lifecycle contract
[lifecycle-contract-candidate.md](doc-governance/lifecycle-contract-candidate.md)

承载：

- new-doc gate
- update-by-default
- merge-before-archive
- per-round output budget

### Source pipeline contract
[source-pipeline-candidate.md](doc-governance/source-pipeline-candidate.md)

承载：

- transcript / derived / canonical 关系
- archive object model
- source enum / source_ref model
- provenance placement rules

### Loading contract
[loading-contract-candidate.md](doc-governance/loading-contract-candidate.md)

承载：

- task-based reading paths
- stop-early rule
- load prohibitions
- escalation gates

### Metadata / registry contract
[metadata-registry-candidate.md](doc-governance/metadata-registry-candidate.md)

承载：

- doc registry schema
- header v1
- precedence rule
- registry physical shape

### Runtime architecture contract
[runtime-architecture-candidate.md](doc-governance/runtime-architecture-candidate.md)

承载：

- plugin / spool / aggregator / builder 分层
- authority discovery implementation
- header / registry drift handling
- transcript / derived / canonical provenance chain

## Recommended reading paths

### If the topic is lifecycle or writeback discipline
先读：

- [lifecycle-contract-candidate.md](doc-governance/lifecycle-contract-candidate.md)

### If the topic is archive, transcript, provenance, or source pipeline
先读：

- [source-pipeline-candidate.md](doc-governance/source-pipeline-candidate.md)

### If the topic is agent reading behavior
先读：

- [loading-contract-candidate.md](doc-governance/loading-contract-candidate.md)

### If the topic is doc registry, metadata, or header format
先读：

- [metadata-registry-candidate.md](doc-governance/metadata-registry-candidate.md)

### If the topic is capture plugin, aggregator compatibility, or implementation tooling
先读：

- [runtime-architecture-candidate.md](doc-governance/runtime-architecture-candidate.md)

## Current open questions
当前仍值得继续观察，但不阻塞结构收口的点包括：

- 是否需要 stable `archive_id`
- derived notes 是否需要更正式的对象族目录
- 单文件 registry 何时需要拆分
- OpenClaw baseline 之后，第二个优先接入的 runtime 是 `Codex` 还是 `Claude Code`

## Rollout recommendation
当前更推荐的落地顺序是：

1. 先冻结这 5 份子契约设计
2. 后续真正实施时，先做最小 registry 原型
3. 再给少量核心文档加 header v1
4. 再实现 OpenClaw-first 的 plugin / aggregator / transcript builder 最小 runtime 原型
5. 再补 resolver / linter / derived scaffold 的实现基线
6. 用 `resume / continue-topic / writeback-decision` 这几类任务验证 contract 是否足够

## Current status
当前这套方案在设计层已经基本完成，并且已经形成 `Phase 1 scheduling candidates`。

当前更准确的状态是：

- 继续抽象设计已经不是主路径
- `runtime-architecture-candidate.md` 已经给出 `S1` 到 `S4` 的排期候选切法
- `S1 OpenClaw capture compatibility baseline` 已于 2026-04-21 升格到 [doc-governance-openclaw-capture-baseline.md](../active/doc-governance-openclaw-capture-baseline.md)
- 下一步更适合围绕 `S1` 进入 implementation planning，并在其稳定后再判断 `S2` 的实际切分

## Non-goal
本文件不再继续承载：

- 完整 lifecycle 细节
- archive object schema 细节
- loading policy 全文
- registry/header 的所有字段与示例
- runtime tool 的具体代码实现

这些都应继续回写到各自子契约文档，而不是再堆回本文件。
