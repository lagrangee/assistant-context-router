# Docs Map

## Start here
- **项目当前状态：`../STATUS.md`**
- 项目入口：`../README.md`
- 当前恢复点：`../RESUME.md`
- 当前实现说明：`../implementation/README.md`
- 当前协作对象：`../execution/COLLAB.md`

## By scenario

### Resume working
如果目标是“快速恢复当前主线并继续推进”，建议按这个顺序：
1. `../STATUS.md`
2. `../RESUME.md`
3. `../execution/COLLAB.md`
4. `../plan/active/step2-strategy-note.md`（如当前工作已进入 Step 2）

### Save / writeback
如果目标是“判断当前工作态该如何收口、该写回哪里”，建议按这个顺序：
1. `../RESUME.md`
2. `../execution/COLLAB.md`
3. `../plan/architecture/system-architecture-v1.md`
4. `../plan/candidates/doc-governance-candidate.md`

### Architecture review
如果目标是“判断系统边界、可替换模块与长期演进方向”，建议按这个顺序：
1. `../plan/architecture/system-architecture-v1.md`
2. `../plan/architecture/roadmap-milestones-v1.md`
3. `../plan/architecture/memory-architecture-note.md`
4. `../plan/architecture/execution-backend-boundary.md`

### Step 2 planning
如果目标是“理解当前 Step 2 设计与验证边界”，建议按这个顺序：
1. `../plan/active/step2-strategy-note.md`
2. `../plan/active/step2-project-context-definition.md`
3. `../plan/active/step2-routing-matrix.md`
4. `../plan/active/step2-context-validation.md`

## By role

### Human
- `../STATUS.md`
- `../README.md`
- `../execution/COLLAB.md`

### OpenClaw agent (coordinator-agent)
- `../STATUS.md`
- `../RESUME.md`
- `../execution/COLLAB.md`
- `../plan/architecture/system-architecture-v1.md`

### External agents
- `../STATUS.md`
- `../RESUME.md`
- `../docs/README.md`
- `../execution/COLLAB.md`

## Project foyer docs
- `../README.md`：项目长期定义、目标、边界、目录角色
- `../STATUS.md`：项目当前阶段总收口 / 单入口摘要
- `../RESUME.md`：当前工作主线、上次中断点、下一步

## Current source of truth
- `../plan/architecture/system-architecture-v1.md`：顶层系统架构（north star / truth layer / adapters / phase placement）
- `../plan/architecture/roadmap-milestones-v1.md`：roadmap 与 milestone 入口
- `../plan/architecture/memory-architecture-note.md`：memory 分层与 adapter 边界
- `../plan/architecture/execution-backend-boundary.md`：ACP / native thread / LangGraph / Agents SDK 边界
- `collab-system-definition-v1.md`：当前协作系统定义（project state / ACP / native thread / visibility / governance）
- `../implementation-decision-v1.md`：MVP 决策、Step 1 现实修正、Step 2 layering decision
- `../plan/active/step2-strategy-note.md`：Step 2 策略说明（当前主入口）
- `../plan/active/orchestrator-integration-boundary.md`：与 orchestrator 的边界与 Step 2 语义分层
- `../plan/candidates/doc-governance-candidate.md`：项目内文档治理与协作机制候选方案
- `../plan/active/doc-system-rebuild-v1.md`：文档体系重建原则说明
- `../plan/active/doc-rebuild-mapping-note.md`：当前文档重构前盘点与迁移建议

## Execution / validation docs
- `../implementation/plugin/progress/codex-step1.md`：Step 1 收尾与验收
- `../plan/active/step2-validation-design.md`：Step 2 验证设计草稿（待按最新共识重构）

## Progress / collaboration docs
- `../execution/COLLAB.md`：当前协作对象（多 agent handoff / review / writeback 面）

## Meta parallel assets
- `../meta/skill-draft/`：你和 OpenClaw agent (`coordinator-agent`) 后台并行维护的长期抽象资产（非项目执行面，默认不暴露给执行 agent）

## Archive
- `archive/`：历史文档与不再作为当前真相的材料
- `archive/discovery/`：早期研究、kickoff、feasibility、handoff 等探索材料
- `archive/plan-overflow/`：已降级的早期 planning / decision overflow 材料

## Update rule
- 顶层门厅文档使用：`README.md` / `STATUS.md` / `RESUME.md`
- 顶层系统定义优先进入 architecture / roadmap / memory / backend boundary 文档
- 稳定结论进入当前有效的 decision / strategy 文档
- 协作过程停留在 `execution/COLLAB.md` 或实现侧 progress 文档
- 过时或被吸收的材料移动到 `docs/archive/`
- 不在多个文件中重复维护同一条当前结论
