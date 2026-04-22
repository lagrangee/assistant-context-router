# Doc Rebuild Mapping Note

## Purpose
基于 `doc-system-rebuild-v1.md` 的对象模型，对当前 `assistant-context-router` 项目现有文档做一次**重构前盘点**，为下一步文档重构执行提供依据。

本说明回答三件事：
1. 每个现有文档当前更适合归属哪个文档角色
2. 它在重构后应保留 / 迁移 / 合并 / 归档中的哪一种处理方式
3. 当前目录结构重构时，先动哪些对象、后动哪些对象

## Confirmed structural decisions
1. `STATUS.md` 定位为 **项目 executive summary / 单入口**，应位于**项目根目录**
2. `RESUME.md` 作为 **独立 working-state / resume 对象** 存在，不与 executive summary 混用
3. skill draft 当前属于 **伴随演化的旁支设计包**，不作为 Step 2 主线文档层
4. discovery / decision / collaboration / validation 需要显式分层，避免长期堆积在单一目录

## Mapping by role

### Identity
#### Keep as top-level project identity
- `README.md`
  - Role: Identity
  - Action: 保留在根目录
- `project.yaml`
  - Role: Identity
  - Action: 保留在根目录

#### Executive summary
- `STATUS.md`
  - Role: Executive summary（高于普通 plan）
  - Action: 保留在根目录
  - Note: 继续承担“当前阶段总收口 / 单入口”，不承担 resume / working-state 职责

### Discovery
#### Likely discovery / exploratory materials
- `codex-kickoff.md`
  - Role: Discovery
  - Action: 从根目录移出；后续进入 discovery 区或 archive
- `feasibility-check.md`
  - Role: Discovery
  - Action: 从根目录移出；后续进入 discovery 区或 archive
- `plan/research-handoff.md`
  - Role: Discovery
  - Action: 从 Step 2 主线区移出；后续进入 discovery 区或 archive

### Decision
#### Keep as current decision-layer docs
- `implementation-decision-v1.md`
  - Role: Decision
  - Action: 暂保留在根目录（高等级决策文档）
- `plan/active/step2-strategy-note.md`
  - Role: Decision
  - Action: 保留，但未来应进入更明确的 decision/planning 层位置
- `plan/active/orchestrator-integration-boundary.md`
  - Role: Decision
  - Action: 保留，作为 Step 2 边界决策补充
- `component-relationship-diagram.md`
  - Role: Decision / Architecture reference
  - Action: 暂保留在根目录，待后续确认是否仍为当前架构真相

#### Needs consolidation review
以下文件很可能包含仍有价值的结论，但不应继续平级并列长期存活：
- `plan/decision-record.md`
- `plan/implementation-strategy.md`
- `plan/interface-decision.md`
- `plan/mvp-architecture-draft.md`
- `plan/mvp-scope.md`
- `plan/work-breakdown.md`

Action:
- 逐个判断是否仍有 current truth
- 将仍有效结论吸收进更少量的正式文档
- 原文件后续归档或降级

### Working State
#### Required new object
- **`RESUME.md`**
  - Role: Working State
  - Action: 新增并保留在根目录
  - Purpose: 表达当前阶段、当前主线、上次中断点、下一步、pending decisions、resume reading order

#### Current partial proxy
- `STATUS.md`
  - 可能包含少量状态判断，但未来不承担 resume / working-state 角色

### Collaboration
#### Keep as execution-side collaboration surface
- `execution/COLLAB.md`
  - Role: Collaboration
  - Action: 保留
  - Note: 继续作为高频协作对象，而不是正式决策文档

### Execution Artifact
#### Keep in implementation layer
- `implementation/README.md`
  - Role: Execution Artifact
  - Action: 保留
- `implementation/adapters/openclaw/plugin/progress/codex-step1.md`
  - Role: Execution Artifact
  - Action: 保留
- `implementation/core/*`
  - Role: Execution Artifact / code
  - Action: 保留
- `implementation/adapters/openclaw/*`
  - Role: Execution Artifact / code
  - Action: 保留

### Validation
#### Needs rewrite/reposition
- `plan/active/step2-validation-design.md`
  - Role: Validation
  - Action: 保留为“待重构对象”，不视为稳定最终真相
  - Note: 基于最新共识，后续可能拆成 project-context / routing 两部分，或被重写

### Meta skill draft bundle
#### Keep, but isolate from project execution surface
- `meta/skill-draft/`

Role:
- Side design bundle / evolving abstraction layer
- 你和 coordinator agent 后台并行维护的长期抽象资产

Action:
- 结构性收拢为独立 bundle
- 不与 Step 2 主线 decision / validation 文档平铺并列
- 默认不暴露给执行 agent（包括 Codex）

### Archive candidates
以下文档是当前最明显的归档/降级候选：
- `codex-kickoff.md`
- `feasibility-check.md`
- `plan/research-handoff.md`
- 一部分已被吸收的 MVP/decision/interface/work-breakdown 早期材料

## Rebuild direction

### Top-level should become the project foyer
根目录应逐步收敛为：
- project identity
- executive summary
- 少量高等级 decision / architecture docs
- 少量稳定子目录入口

### A separate working-state object must be added
working state 是接下来 Step 2A（project context definition）的关键前置，不应缺位。

### Skill draft should become a visible bundle, not a flat set of peer docs
skill draft 需要保留，但应从当前 `plan/` 的主线平铺状态中脱离出来。

### `plan/` should only hold active planning / design problems
后续重构后，`plan/` 不应继续同时承载 discovery、decision overflow、skill draft overflow、validation overflow。

## Suggested rebuild sequence
### Step 1 — create the missing object
- 新增 `RESUME.md`
- 明确它与 `STATUS.md`、`collab.md` 的关系

### Step 2 — promote executive summary
- 采用 `STATUS.md` 作为根目录单入口状态文档
- 更新 docs map / README 中对单入口的引用

### Step 3 — separate the side bundle
- 将 skill draft 结构性收拢为 `meta/skill-draft/`
- 并明确其不属于项目执行面

### Step 4 — reduce root noise
- 将 discovery 型根目录文档移出根目录

### Step 5 — consolidate decision overflow
- 检查 `plan/` 中一组 MVP / interface / implementation / work-breakdown 文档
- 吸收仍有效结论，其他归档

### Step 6 — redesign validation docs after context definition
- 待 Step 2A 的 project context definition 明确后，再重写/拆分 validation 文档

## What this note is not
- 不是最终迁移脚本
- 不是最终目录命名冻结版本
- 不是 Step 2 context 定义本身

它的作用只是：在重构前，把“现在有哪些文档对象、它们各自应该去哪里”先说清楚。
