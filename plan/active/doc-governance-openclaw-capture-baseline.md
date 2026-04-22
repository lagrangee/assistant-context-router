# Doc Governance OpenClaw Capture Baseline

## Purpose
将 `doc-governance` Phase 1 中的 `S1 OpenClaw capture compatibility baseline` 从 candidate 排期项升格为 active planning host。

本文件当前负责：

- 收口 `capture plugin v2 + aggregator compatibility patch` 的实现边界
- 作为 `S1` 的当前权威 planning host
- 为后续 `S2 Transcript builder baseline` 提供稳定输入基线

本文件当前不负责：

- transcript builder 详细实现
- registry resolver / drift linter 详细实现
- derived note / canonical writeback 模板细节

## Promotion context
当前升格依据：

- `runtime-architecture-candidate.md` 中的 `Candidate S1`
- `project-todo-candidates.md` 中的 `doc-governance-phase1-runtime-rollout`
- 2026-04-21 当前 thread 中 Human 已明确同意先升格 `S1`

## Why this host exists
当前 `doc-governance` 设计层已经基本完成，下一步不再是继续抽象讨论，而是进入最小 runtime 原型。

在这一阶段，最先需要被证明的不是：

- registry schema 是否足够优雅
- derived note 模板是否足够完整
- 多 runtime adapter 是否已经统一

而是最基础的一条运行链是否成立：

```text
OpenClaw capture plugin
-> canonical event spool v2
-> inbox aggregator compat path
```

如果这条链不稳定，后续 transcript builder 与 provenance path 都无法可靠验证。

## Scope
当前 `S1` 仅包含两部分：

1. `Capture substrate v2`
2. `Aggregator compatibility patch`

### In scope

- 升级现有 OpenClaw `inbox-capture-plugin`
- 定义并落地兼容 v1 的 canonical event spool v2
- 让现有 inbox aggregator 明确接受 v2 event
- 保持 `memory/inbox/YYYY-MM-DD.conversation.log` 产物不退化
- 明确 plugin / spool / aggregator 之间的 compatibility contract

### Out of scope

- transcript archive object builder
- derived note 自动化
- registry resolver / drift linter 实现
- 多 runtime 接入
- attachment pipeline
- 任何直接写 canonical host 的自动化逻辑

## Deliverables
当前希望 `S1` 至少产出：

- `capture plugin v2` 设计确认
- event spool v2 字段契约
- plugin 配置化 path 方案
- aggregator compat patch
- 一组最小回归检查样例

## Acceptance
`S1` 当前的完成标准是：

1. 新 capture 事件能写出 v2 扩展字段
2. 旧字段不丢失，现有 dedupe / noise filtering 语义不退化
3. 旧 v1 event 仍可生成 `memory/inbox` conversation log
4. 新 v2 event 也可生成 `memory/inbox` conversation log
5. 输出路径、头部字段、正文格式不退化
6. `memory/inbox` 不依赖 transcript builder 才能继续工作

## Work sequence
当前更推荐的推进顺序是：

1. 明确 event spool v2 字段与兼容边界
2. 修改 plugin，使其写出新增字段但保留旧字段
3. 修改 aggregator，使其显式接受 v2 扩展字段
4. 用 v1/v2 混合样例做回归检查
5. 在确认 `memory/inbox` 不退化后，再为 `S2` 打开 transcript builder baseline

## Key risks
当前最需要盯住的风险是：

- plugin v2 新字段破坏现有 aggregator 假设
- path 配置化引入新的环境差异
- 升级过程中噪音过滤或 dedupe 语义漂移
- 为 transcript builder 预埋字段时过度设计，反而增加 capture 复杂度

## Guardrails
当前 `S1` 的实现必须遵守：

- 直接升级现有 plugin，不再造第二条 capture 链
- 保持现有 canonical spool 作为 append-only ingest substrate
- `memory/inbox` 的日级 conversation log 继续是 aggregator 的主产物
- 不把 transcript builder 变成 aggregator 的前置依赖
- 不在 plugin 或 aggregator 内做 derived note / canonical writeback 决策

## Next promotion
当 `S1` 满足 acceptance 后，下一步更自然的升格对象是：

- `S2 Transcript builder baseline`

在那之前，`S3 Registry tooling baseline` 可继续作为并行 planning candidate 保留在 candidate 宿主中。

## Related hosts
- [runtime-architecture-candidate.md](../candidates/doc-governance/runtime-architecture-candidate.md)
- [doc-governance-candidate.md](../candidates/doc-governance-candidate.md)
- [project-todo-candidates.md](../candidates/project-todo-candidates.md)
