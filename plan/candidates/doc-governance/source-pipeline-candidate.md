# 文档来源与归档管线候选（v1）

## Purpose
定义 `doc-governance` 主题下的 source pipeline，回答：

- 原始讨论如何保存
- 中间提炼放在哪里
- canonical host 如何与 provenance 解耦
- external archive 与 in-repo index 如何协作

上级总纲：

- [doc-governance-candidate.md](../doc-governance-candidate.md)

## Canonical layer taxonomy
当前正式词表只保留 4 层：

1. `index`
2. `canonical host`
3. `derived notes`
4. `raw transcripts`

说明：

- `working notes` 不再作为正式层级保留
- 当前所有中间提炼对象统一并入 `derived notes`

## Source-to-truth stack
当前完整模型的主链路是：

```text
raw transcript -> derived note -> canonical host
```

其中：

- `raw transcript`
  - 保留原始语义
  - 默认不进入主读取面
- `derived note`
  - 保留提炼结果与 provenance
  - 在需要中间压缩层时，作为 canonical writeback 的直接上游
- `canonical host`
  - 项目内正式宿主层
  - 可以承载 adopted truth，也可以承载 candidate proposal host
  - 是否已 adopted 由 `doc_state` 决定

index layer 不属于内容主链，而是横切承担导航和 authority discovery。

### Operational default
运行时默认不应要求每次都经过 derived layer。

当前更推荐的操作口径是：

- 简单且已明确 adopted 的结论：`raw transcript -> canonical host`
- 需要 provenance compression / review adjudication / competing positions 的讨论：`raw transcript -> derived note -> canonical host`

也就是说：

- `derived notes` 是可选稀疏层
- 不是每个 thread、每次 writeback、每次总结都必须产出一份 derived note

## Filesystem-first, Obsidian-compatible
当前更稳妥的方向不是把 canonical host 建在某个笔记工具里，而是：

- 以 repo 内 plain files 作为 canonical store
- 让 Obsidian 等工具成为可选阅读 / 浏览界面

原因：

- git diff / review / merge 对项目协作最自然
- agent 直接操作 markdown / yaml / json 更稳定
- 不会把真相绑定在某个专有 UI 或插件生态上

## External archive + in-repo index
对于 raw transcript / meeting recording / 原始对话记录：

- 不进入 repo 内默认主读取面
- 不作为 canonical host 宿主
- 本体放在 repo 外的 sidecar archive
- repo 内只保留索引、摘要、引用指针、必要的提炼结果

这个方向的主要理由是：

- 保持项目 repo 的 truth layer 干净
- 避免 transcript 直接放大默认 context loading 成本
- 允许保留原始会议记录，而不把它们混成当前执行依据

## Archive root and storage stance
当前 sidecar archive 的默认落点：

- iCloud Drive 作为 archive root
- 一个跨项目共享的 archive namespace
- 每个项目在 archive 中使用稳定 `project_id` 作为子空间

当前同时采用：

- no-delete-first retention stance

也就是说：

- 默认不主动删除 raw transcript
- 默认不为小体积文本引入复杂 GC 逻辑
- 先把精力放在索引、引用、提炼、按需读取

## Archive locator model
repo 内的 archive 引用，不建议直接写死完整绝对路径。

更合适的最小模型是：

1. archive root locator
2. relative archive ref

当前建议：

- 全局配置一个 `archive_root`
- repo 内只保存相对 `archive_ref`
- 实际解析时由 `archive_root + archive_ref` 拼接得到物理路径

## Transcript object model
当前建议：

- 一个 transcript archive object = 一个目录
- 目录内固定存在 `manifest.yaml`
- payload 如 `messages.jsonl`、`attachments/` 由 manifest 指向
- repo 内 ref 指向 object directory，而不是直接指向 payload 文件

### Recommended directory shape
当前推荐：

- `projects/<project_id>/transcripts/<source>/<yyyy-mm>/<timestamp>--<slug>/`

当前默认不额外引入 `yyyy/` 一级目录。

### Transcript manifest minimal fields
建议最小字段：

- `version`
- `kind`
- `project_id`
- `source`
- `source_ref_kind`（可选）
- `source_ref`（可选）
- `captured_at`
- `title`
- `summary`
- `message_file`
- `attachments_dir`（可选）
- `derived_notes`（可选）
- `tags`（可选）

### Suggested example

```yaml
version: 1
kind: transcript
project_id: assistant-context-router
source: codex
source_ref_kind: thread
source_ref: codex-thread-2026-04-20-doc-governance
captured_at: 2026-04-20T15:20:00+08:00
title: doc governance and archive design
summary: discussed archive model, iCloud root, and relative archive refs
message_file: messages.jsonl
attachments_dir: attachments
derived_notes:
  - extracts/2026-04-20-doc-governance-note.md
tags:
  - doc-governance
  - archive
  - transcript
```

## Source enum and source-side locator
对于 transcript manifest 中的 `source` 字段，当前推荐使用一个很小、很显式的稳定枚举：

- `openclaw`
- `hermes`
- `codex`
- `claude-code`
- `gemini`
- `chatgpt-web`

说明：

- `source` 回答“这段 transcript 来自哪个系统 / runtime”
- `source_ref_kind` 回答“该系统如何命名它的对话容器”
- `source_ref` 回答“该系统给出的具体引用值是什么”

### Allowed `source_ref_kind`
当前建议允许：

- `thread`
- `session`
- `conversation`
- `export`
- `manual`

当前不建议为了表面统一，强行把所有来源都改写成单一术语。

保留原则是：

- `Codex` 更接近 `thread`
- 其他 runtime 很多更接近 `session`
- 某些系统也可能使用 `conversation`

## Runtime-specific capture adapters
当前不建议假设所有 agent tool 都像 OpenClaw 一样支持 plugin capture。

更稳妥的方向是：每个 runtime 各自实现 ingest adapter，但统一落到同一套 canonical event spool / transcript object model。

### OpenClaw

- 首选 plugin hook capture
- 使用 runtime canonical hook + append-only spool

### Codex

- 若有稳定 thread / message export 或官方 hook，优先走官方路径
- 若没有合适 hook，优先在 invocation layer 做 wrapper / adapter
- 不建议依赖内部数据库扫描或 transcript scan

### Claude Code

- 若存在稳定 session / run export，优先走 export adapter
- 若没有，则在 CLI / invocation boundary 做 wrapper capture
- 保留 `source_ref_kind/source_ref` 的来源原语义，不强行统一命名

### Generic fallback

- official export/import adapter
- human-triggered manual import

原则是：

- capture 入口可以因 runtime 不同而不同
- canonical spool schema 与 transcript object schema 应尽量统一
- provenance model 不应依赖某一个特定 runtime 的 plugin 机制

## In-repo archive ref
in-repo archive ref 的职责是：

- 来源追溯
- 讨论依据定位
- 决策出处保留

而不是普通正文内容。

建议最小字段：

- `archive_root_id`
- `archive_ref`
- `kind`
- `source`
- `captured_at`
- `label`

### Suggested example

```yaml
archive_root_id: icloud-main
archive_ref: projects/assistant-context-router/transcripts/codex/2026-04/2026-04-20T15-20-00+08-00--doc-governance/
kind: transcript
source: codex
captured_at: 2026-04-20T15:20:00+08:00
label: codex thread on doc governance and archive design
```

## Provenance placement rule
`in-repo archive ref` 当前应被视为 provenance object。

### Preferred hosts
优先落点：

- meeting note
- extracted note
- adjudication note
- review note

### Secondary host
如果某条 candidate 或 active 结论明显依赖某次具体讨论，且未来可能需要追溯来源，则可以在 topic doc 中保留一个很小的 source/provenance block。

### Default non-hosts
以下文档默认不应常规承载 archive refs：

- `README.md`
- `STATUS.md`
- `RESUME.md`

### Mandatory minimum provenance when skipping derived notes
如果某次 writeback 走的是更轻的 `raw transcript -> canonical host` 路径，而没有经过 derived note，当前建议仍然保留一个最小 provenance pointer。

也就是说：

- derived note 可以跳过
- provenance 不能完全消失

最低要求可以是以下两种之一：

1. canonical host 中保留极小的 source / provenance block
2. registry 中保留该 canonical host 的 `adopted_from` / transcript ref

原则是：

- 简单路径可以少一层文档
- 但不能让 adopted 结论失去最小来源锚点
- 未来如果需要 provenance lookup，至少能一跳定位到 transcript object

## Derived-note promotion and absorption
为了避免 derived note 慢慢长成第二真相层，当前建议给它一套很轻的吸收规则。

### Minimal note states

- `active`
- `absorbed`
- `superseded`

### Suggested minimal fields

```yaml
note_state: active
canonicalized_to:
  - path: plan/candidates/doc-governance/loading-contract-candidate.md
    section: task-classification-prelude
```

### Lightweight adoption pointer on canonical hosts
canonical host 不需要承载长 provenance，但应允许保留一个轻量 adoption pointer：

```yaml
adopted_from:
  - derived_note_id: doc-governance-review-round4
    adopted_at: 2026-04-20
```

原则是：

- derived note 保留详细 provenance
- canonical host 只保留一跳可追溯指针
- `absorbed` 的 derived note 不进入普通 loading，只在 provenance lookup 时读取

## Current unresolved items
以下问题当前仍可继续观察，但不阻塞主模型成立：

- 是否需要 stable `archive_id`
- derived note 是否需要更正式的对象族目录

## Current recommendation
当前最值得坚持的 source pipeline 原则是：

- raw transcript 要保留，但没有默认加载权
- derived note 是 provenance 的默认中间宿主，但不是默认必写层
- canonical host 只保留 topic-level 正式宿主语义
- adopted truth 与 candidate proposal 由 `doc_state` 区分
