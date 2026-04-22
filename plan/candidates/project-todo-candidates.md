# Project TODO Candidates

## Purpose

保存当前项目中已经过讨论、值得在未来排期时重新评审的 TODO 候选项。

本文件的目标是：

- 不让高价值的 TODO 讨论遗失在 thread 历史里
- 不把尚未承诺的未来想法混入当前 Step 2 主线
- 为后续 scope review / roadmap review / 排期讨论提供统一候选池

本文件当前是项目内候选池，不等于当前 backlog，也不等于已承诺范围。

## Positioning

本文件承接的是：

- 已在协作讨论中形成最小共识的未来事项
- 暂不进入当前主线、但值得保留的方向
- 未来可能进入 roadmap / active plan / execution plan 的候选

本文件不承接：

- 纯发散 brainstorm
- 只在当前 thread 临时有价值的想法
- 已经进入当前主线的工作项
- 纯实现细节或一次性调试记录

## Writeback rule

当当前 thread 对某个未来 TODO 形成了以下结论时，应该写回本文件：

- 该事项值得保留，未来应再次评审
- 该事项为什么现在不做，已经有了相对清晰的判断
- 该事项进入主线前需要满足哪些前置条件
- 该事项大致属于哪个 phase / milestone / review 窗口

如果讨论只停留在“可想想看”，但没有形成最小收敛，则不强制写回。

## Promotion rule

候选项在以下情况下，应该从本文件升格到别的权威宿主：

- 已决定纳入当前主线：
  - 写入对应 `plan/active/*.md`
- 已改变 roadmap / milestone 判断：
  - 写入 `plan/architecture/roadmap-milestones-v1.md`
- 已形成稳定 architecture / strategy boundary：
  - 写入对应 architecture / strategy doc
- 已影响当前 continuity：
  - 额外镜像到 `STATUS.md` / `RESUME.md`

本文件只保留“尚未正式升格”的候选真相。

## Candidate item schema

每个候选项建议按以下结构记录：

- `id`：稳定引用名，便于后续 thread 继续讨论
- `title`：候选项标题
- `status`：`candidate` / `parked` / `ready-for-review` / `promoted` / `rejected`
- `summary`：一句话说明是什么
- `why_it_matters`：为什么值得保留
- `why_not_now`：为什么当前不进入主线
- `phase_guess`：更适合在哪个阶段或 milestone 再打开
- `dependencies`：前置条件或依赖
- `promotion_trigger`：什么信号出现后值得升格
- `notes`：只保留对排期判断有价值的补充

## Current working agreement

从当前 thread 开始，凡是“我们讨论后认为值得保留、但暂不纳入当前主线”的 TODO 候选，都应优先写回本文件。

写回时遵循以下约束：

- 记录讨论结论，不记录整段对话
- 记录“为什么先不做”，避免未来重复判断
- 记录“何时再看”，方便后续排期
- 若候选已影响当前主线判断，再补写对应主线文档

## Candidate Pool

### 1. `doc-governance-phase1-runtime-rollout`

- `id`：`doc-governance-phase1-runtime-rollout`
- `title`：`doc-governance` Phase 1 runtime implementation rollout
- `status`：`ready-for-review`
- `summary`：将 `doc-governance` 已完成的设计层收成 OpenClaw-first 的第一阶段实现排期，并按 capture / transcript / registry / agent authoring 分阶段推进。
- `why_it_matters`：这条设计线已经从“继续抽象讨论”进入“可以开始最小 runtime 原型”的状态；如果不形成明确排期候选，设计成果会继续停留在文档层，无法验证 authority discovery、provenance chain 与 runtime adapters 的真实可行性。
- `why_not_now`：当前仍未正式进入实现阶段，且 `S1` 到 `S4` 的切分、先后顺序、资源投入和风险处置需要在排期时再确认；因此暂不直接升格为当前主线。
- `phase_guess`：更适合在下一轮 implementation planning / roadmap review 时打开。
- `dependencies`：`doc-governance` 设计收口已完成；OpenClaw `capture plugin` 与 `inbox-archiving` aggregator 需作为 Phase 1 的基线；详细工作包与依赖关系见 `plan/candidates/doc-governance/runtime-architecture-candidate.md`。
- `promotion_trigger`：当项目准备从设计阶段切换到 runtime 原型实现，或需要正式安排 `S1 OpenClaw capture compatibility baseline` 时，应升格到具体 active plan / implementation plan。
- `notes`：当前 `S1 OpenClaw capture compatibility baseline` 已于 2026-04-21 升格到 `plan/active/doc-governance-openclaw-capture-baseline.md`；`S2-S4` 仍继续由 `plan/candidates/doc-governance/runtime-architecture-candidate.md` 的 `Phase 1 scheduling candidates` 统一维护，本文件只保留项目级入口。

后续每次讨论出新的 adopted candidate，再按上述 schema 增量补充。
