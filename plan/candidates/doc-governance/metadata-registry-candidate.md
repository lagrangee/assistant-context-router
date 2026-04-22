# 文档元数据与注册表契约候选（v1）

## Purpose
定义 `doc-governance` 主题下的 metadata / registry contract，回答：

- 每份核心文档如何自描述
- registry 放在哪里、长什么样
- header 和 registry 各自负责什么
- 哪一层是 authority

上级总纲：

- [doc-governance-candidate.md](../doc-governance-candidate.md)

## Two metadata surfaces
当前推荐采用两层 metadata 面：

### Surface A: Human-facing doc header
每份核心文档顶部保留一个很轻的自然语言自描述区块，用于回答：

- 我是什么 role
- 我是不是当前权威宿主
- 什么问题下应该读我
- 读我前后通常还要读什么

### Surface B: Machine-friendly doc registry
另外维护一份 repo 内的 registry / manifest，用于承载稳定、可 parse 的字段。

## Authority rule
这是当前必须定死的 precedence 规则：

- `doc registry` 是 machine-authoritative
- `doc header` 是 human-facing mirror

如果两者出现漂移或冲突：

- 以 registry 为准
- header 应被视为需要同步修正的镜像层

这样做的原因是：

- registry 负责 runtime / tool / automation
- header 负责人类快速理解
- 如果不声明 authority，漂移会不可避免

## Why not header-only or registry-only

### Why not header-only
- 机器解析不稳定
- 字段容易漂移
- 难以做统一扫描和 load-rule enforcement

### Why not registry-only
- 人类打开单个文档时不知道它的角色
- 文档本身失去自解释能力
- registry 与正文更容易长期漂移

因此当前更合适的方向是：

- 轻 header
- 小 registry
- 两者职责不同，但语义对齐

## Registry v1 minimal fields
当前建议 registry 先只覆盖：

- role-based entry docs
- core canonical hosts
- 高频使用的 candidate / active hosts
- 后续需要默认加载控制的 derived notes

### Required fields
- `doc_id`
- `path`
- `role`
- `layer`
- `doc_state`
- `authority`
- `source_of_truth_for`
- `entry_mode`
- `load_when`
- `prerequisites`
- `read_next`

### Optional fields
- `owner`
- `update_frequency`
- `supersedes`
- `superseded_by`
- `notes`

## Semantics of required fields

### `doc_id`
稳定短名，用于 registry 内引用，不随 path 小改动而频繁变化。

### `path`
文档物理路径字段。

当前建议：

- 使用 repo-relative path，而不是绝对路径

原因：

- 避免把某一台机器的 clone / worktree 路径硬编码进 committed artifact
- 与前面 archive locator 的 portability 原则保持一致
- 更适合后续跨 worktree / clone / relocate

示例：

- `STATUS.md`
- `RESUME.md`
- `docs/README.md`
- `plan/candidates/doc-governance-candidate.md`

### `role`
回答“这份文档在文档系统里扮演什么角色”。

当前建议使用小而稳定的枚举，例如：

- `identity`
- `executive-summary`
- `working-state`
- `collaboration`
- `architecture`
- `strategy`
- `candidate`
- `validation`
- `derived-note`
- `index`

### `layer`
回答“这份文档属于哪一层”。

当前建议使用：

- `index`
- `canonical`
- `derived`
- `archive-index`

补充说明：

- `layer: canonical` 只表示它属于正式宿主层
- 它不自动等于 adopted execution truth
- candidate proposal host 与 adopted truth host 都可以位于这一层
- 两者的区分应交给 `doc_state`

### `doc_state`
回答“这份文档当前处于什么状态”。

当前建议使用：

- `candidate`
- `adopted`
- `superseded`
- `archived`

其中：

- `candidate` 表示该文档可以是某个 topic 的正式 proposal host
- `adopted` 才表示它是当前默认可执行的正式 truth host
- implementation / execution 类任务不得把 `candidate` 默认当作 adopted truth

### `authority`
回答“这份文档是不是某个 topic 的当前权威宿主”。

当前建议使用：

- `primary`
- `supporting`
- `reference`

补充约束：

- 同一 `source_of_truth_for` topic，最多只能有一个 `authority: primary` 且 `doc_state: adopted` 的文档
- 多个 `candidate` 文档可以并行讨论同一 topic，但不应同时都被视为 adopted primary

### `source_of_truth_for`
回答“这份文档对哪些主题边界拥有权威性”。

它应是 topic 列表，而不是泛泛描述。

### `entry_mode`
回答“在没有特别说明时，这份文档是否应该默认进入读取面”。

当前建议使用：

- `global-entry`
- `task-entry`
- `topic-match`
- `manual-only`

### `load_when`
回答“哪些任务类型命中时，这份文档可进入默认读取路径”。

建议直接复用 loading contract 中的任务名，例如：

- `resume-working`
- `continue-topic`
- `writeback-decision`
- `architecture-review`
- `provenance-lookup`
- `open-ended-exploration`

### `prerequisites`
回答“进入我之前，通常应该先读哪些文档”。

### `read_next`
回答“如果读完我还不够，通常下一步去哪里”。

## Header v1
当前推荐的第一版 header：

- 纯 Markdown
- 非 frontmatter-first
- 固定 4 行
- 放在标题之后、正文之前

推荐形态：

```md
Role: <role>
Authority: <authority statement>
Read this when: <task / question / trigger>
Read next: <next doc(s) or next layer>
```

## Header writing rules
为了避免 header 退化成自由散文，当前建议：

- `Role` 用短名
- `Authority` 用一句短句
- `Read this when` 只写主要触发场景
- `Read next` 只写最自然的下一跳

当前不建议在 header 中加入：

- provenance refs
- update history
- owner / review status
- detailed non-goals

这些应继续留在正文或 registry 中。

## Mapping between header and registry
当前建议的映射关系是：

- `Role` -> `role`
- `Authority` -> `authority + doc_state + source_of_truth_for`
- `Read this when` -> `entry_mode + load_when`
- `Read next` -> `read_next`

也就是说：

- header 是人类友好的压缩表达
- registry 是 machine-friendly 的结构表达

两者应语义一致，但不要求逐字镜像。

## Registry physical shape and location
当前更推荐的第一版 physical design 是：

- 单文件
- YAML
- repo 内
- 放在 `docs/` 层

具体推荐路径：

- `docs/doc-registry.yaml`

## Why this shape first

### Why YAML
- 与当前项目 manifest / config / registry 的表达习惯一致
- 人类可读性足够好
- 对小规模 registry 的 diff / review 很自然

### Why single-file first
当前不建议一开始就做：

- 每份文档一个 metadata file
- 一个复杂 registry 目录树
- 按 role / layer 再拆多个 registry 文件

原因：

- 初期覆盖范围本来就小
- 单文件更方便 review 和整体校验
- 更符合“小 registry”原则

### Why `docs/` as location
当前不建议把 doc registry 放在：

- `plan/`
- `implementation/`
- 项目根目录

因为它本质上是 docs system 的横切索引设施，而不是某个 topic 的 canonical host。

## Suggested top-level shape

```yaml
version: 1
defaults:
  registry_scope: core-docs
docs:
  - doc_id: status
    path: STATUS.md
    role: executive-summary
    layer: canonical
    doc_state: adopted
    authority: primary
    source_of_truth_for:
      - project-current-state
      - phase-summary
    entry_mode: global-entry
    load_when:
      - resume-working
      - open-ended-exploration
    prerequisites:
      - docs-map
    read_next:
      - resume
      - collab
```

## Example registry entries

### `STATUS.md`

```yaml
doc_id: status
path: STATUS.md
role: executive-summary
layer: canonical
doc_state: adopted
authority: primary
source_of_truth_for:
  - project-current-state
  - phase-summary
entry_mode: global-entry
load_when:
  - resume-working
  - open-ended-exploration
  - continue-topic
prerequisites:
  - docs-map
read_next:
  - resume
  - collab
```

### `RESUME.md`

```yaml
doc_id: resume
path: RESUME.md
role: working-state
layer: canonical
doc_state: adopted
authority: primary
source_of_truth_for:
  - current-mainline
  - interruption-point
  - immediate-next-actions
entry_mode: global-entry
load_when:
  - resume-working
  - continue-topic
  - writeback-decision
prerequisites:
  - status
read_next:
  - collab
  - step2-strategy-note
```

### `doc-governance-candidate.md`

```yaml
doc_id: doc-governance-candidate
path: plan/candidates/doc-governance-candidate.md
role: candidate
layer: canonical
doc_state: candidate
authority: primary
source_of_truth_for:
  - doc-governance-proposal-current
entry_mode: topic-match
load_when:
  - continue-topic
  - architecture-review
prerequisites:
  - status
  - resume
read_next:
  - doc-governance-loading-contract
  - doc-governance-source-pipeline
```

## Example headers

### `STATUS.md`

```md
Role: executive summary
Authority: primary truth host for current project state and phase summary
Read this when: you need the fastest current-state entry before resuming, reviewing, or orienting
Read next: RESUME.md, execution/COLLAB.md
```

### `RESUME.md`

```md
Role: working-state
Authority: primary truth host for current mainline, interruption point, and immediate next actions
Read this when: you are about to continue work and need the minimum context to pick up from the last stop
Read next: execution/COLLAB.md, relevant active truth host
```

### `docs/README.md`

```md
Role: index
Authority: reference index for docs navigation and common reading entrypoints
Read this when: you need to discover where to start reading for a given task or topic
Read next: STATUS.md, README.md
```

## Registry invariants
为了让 registry 真正承担 machine-authoritative 角色，当前建议至少定死以下 invariant：

1. `doc_id` 必须唯一
2. `path` 必须使用 repo-relative path，且目标文件存在
3. 同一 `source_of_truth_for` topic，最多只能有一个 `authority: primary` 且 `doc_state: adopted`
4. `doc_state: candidate` 文档不得被默认当作 adopted execution truth
5. 未注册文档默认不能被视为 primary authority

## Header sync discipline
由于人类通常先看到 header，而不是 registry，当前建议增加一条很轻的同步纪律：

- 文档新增、移动或重命名时，同时更新 registry
- 如果文档存在 header，至少检查 `Role / Authority / Read next` 是否与 registry 语义一致
- 如两者冲突，以 registry 为准，并把 header 视为 stale mirror

## Rollout recommendation
当前不建议一次性为所有文档补 metadata。

更推荐的 rollout 顺序是：

1. `docs/README.md`
2. `README.md`
3. `STATUS.md`
4. `RESUME.md`
5. `execution/COLLAB.md`
6. 当前主线最常读的 `active` host
7. 1-2 份高频 `candidate` host

## Future split trigger
只有在以下情况下，才建议把单文件 registry 再拆开：

- entry 数量明显增大，单文件 review 已经变差
- 不同 layer 的 metadata 结构开始显著分化
- 需要把 derived-note registry 与 canonical registry 分开治理
- automation / tool 已经证明多文件结构带来明确收益

## Current recommendation
当前最值得坚持的约束是：

- registry 要小
- header 要轻
- registry authoritative，header advisory
- path 使用 repo-relative，而不是绝对路径
