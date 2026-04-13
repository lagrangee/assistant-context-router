# STATUS

> 本文件是项目的 **current status / executive summary / 单入口**。
>
> 它回答：**这个项目现在整体处于什么状态？**
>
> 它不承担：高频工作恢复点（那是 `RESUME.md`）、项目长期定义（那是 `README.md`）、高频协作面板（那是 `execution/COLLAB.md`）。
>
> 目标：把 Step 1 baseline、Step 1.5 验收修复、Step 2 策略文档、顶层架构设计与文档治理候选，压成一个**单入口可导航摘要**。
>
> **建议后续所有人只先读本文**；需要细节再按链接下钻。

## TL;DR（一句话）
Step 1 baseline 已完成，当前主线正在完成 Step 1.5 的 continuity 收口：`/project` 已对齐 hall-doc recovery，`/save` 正切到 conversational draft -> confirm -> apply 模型，为后续 Step 2 / Step 3 演进提供更稳的工作恢复基础。

## 当前阶段（你现在在哪）
- **Step 1：Baseline done**（实现 + 本地验证完成）
- **Step 1.5：In progress**（hall-doc recovery + conversational save）
- **Step 2：Planned**（待在 Step 1.5 通过后恢复 kickoff）
- **文档治理：Rebuild stabilized**（门厅、docs map、协作对象已收口）
- **顶层架构：Now formalized**（system architecture / roadmap / memory / backend boundary 已成型）
- **Step 3：Candidates only**（ACP / native thread / visible mode 仍后移，不进入当前主 scope）

## 已完成（按模块收口）

### A. Step 1 / Step 1.5
- Commands：
  - `/projects` ✅
  - `/project <id>` ✅
  - `/save` / `/save apply` / `/save cancel` / `/save --dry-run` ✅
- 验收：
  - Step 1 已作为本地 MVP baseline 通过
  - 当前正在补 Step 1.5 hall-doc recovery 缺口
- 收尾落盘：`implementation/plugin/progress/codex-step1.md`

### B. 协作机制（已稳定）
- 协作对象：`execution/COLLAB.md`
- 已验证协作分工：
  - Human：最小唤醒 + 拍板
  - OpenClaw agent (`coordinator-agent`)：正式文档收口者与编排者
  - 外部 agent：读取/回写协作文档（按约定格式）
- 协作子系统说明：`docs/collab-system-definition-v1.md`
- Step 3 候选池：`plan/candidates/step3-candidates.md`

### C. 顶层架构（已收口）
- `plan/architecture/system-architecture-v1.md`
  - 定义 system north star、stable truth layer、replaceable adapters
- `plan/architecture/roadmap-milestones-v1.md`
  - 将项目演进改为按用户闭环组织
- `plan/architecture/memory-architecture-note.md`
  - 将 memory 升为一级核心模块，但明确不得替代 project truth
- `plan/architecture/execution-backend-boundary.md`
  - 明确 ACP / native thread / LangGraph / Agents SDK 是 execution backend，不是主真相层

### D. 文档导航与治理（已进入重建执行）
- docs map：`docs/README.md`
- 文档治理候选：`plan/candidates/doc-governance-candidate.md`
- 文档体系重建原则：`plan/active/doc-system-rebuild-v1.md`
- 重构前盘点说明：`plan/active/doc-rebuild-mapping-note.md`
- 顶层门厅文档已收敛为：`README.md` / `STATUS.md` / `RESUME.md`

### E. Step 2 策略（主入口已就绪）
- 策略主入口：`plan/active/step2-strategy-note.md`
- 关键现实修正 & layering decision：`implementation-decision-v1.md`
- orchestrator 集成边界：`plan/active/orchestrator-integration-boundary.md`
- 已确认：
  - Step 2 北极星仍是 `proj-openclaw-feishu-orchestrator`
  - ACP visible mode / native thread / shared governance 不进入 Step 2 主 scope

## 已确认结论（边界钉死，避免回滚）
1. **Step 1 baseline 已完成，但 Step 1.5 必须先补 hall-doc recovery 验收缺口。**
2. **Step 2 在 Step 1.5 通过前不恢复 implementation kickoff。**
3. **memory 是顶层核心模块，但不替代 project truth。**
4. **orchestration 视为可替换 execution backend，而不是系统主轴。**
5. **文档驱动 + 多 agent 协作机制仍可继续打磨，但当前不直接打包成正式 skill。**
6. **文档分层 / 协作对象 / docs map / 升格规则已成为默认工作方式。**

## 未完成（下一步要补的洞）
1. Step 1.5 需完成 conversational save 的真实 OpenClaw 工作流验证
2. `/save` 当前已具备 draft -> confirm -> apply 闭环，但更强的 coordinator-agent-native LLM compaction 仍待后续增强
3. `step2-context-validation.md` / validation rewrite 仍需和最新边界对齐
4. Step 2 正式开发仍需从 project context loading 与 routing 主线开始落地
5. 通用 skill 仍缺少多项目、多 agent、多任务类型的验证样本

## 下一步（从这里继续推进主线）
当前应按以下主线推进：
- 先完成 Step 1.5 hall-doc recovery acceptance fix
- 让 `/project` 与 `/save` 真正对齐门厅恢复模型
- 在 OpenClaw 中验证 `/save -> /save apply` 的日常工作流是否顺手
- 在 Step 1.5 通过后，再恢复 Step 2 的 context loading 与 routing 主线

## 阅读顺序（新加入者 / Codex / 未来自己）
1. `STATUS.md`（本文，单入口）
2. `README.md`（项目长期入口与定义）
3. `RESUME.md`（当前工作恢复点）
4. `docs/README.md`（全项目文档地图）
5. `execution/COLLAB.md`（协作对象与写回规则）
6. `plan/architecture/system-architecture-v1.md`（顶层系统架构）
7. `plan/architecture/roadmap-milestones-v1.md`（长期路线图）
8. `plan/active/step2-strategy-note.md`（Step 2 策略主入口）
9. `plan/candidates/doc-governance-candidate.md`（文档治理候选）
