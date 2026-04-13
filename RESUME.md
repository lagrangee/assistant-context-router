# RESUME

## Purpose
这是 `assistant-context-router` 的 **resume point / working-state 对象**。

它回答：**如果我现在要继续这个项目，应该从哪里接上？**

它服务于：
- OpenClaw agent (`coordinator-agent`)
- Codex
- 其他协作 agent
- Human 在中断后快速恢复上下文

它不承担：
- 项目总介绍（那是 `README.md`）
- 项目 executive summary / 单入口（那是 `STATUS.md`）
- 多 agent 协作流转面（那是 `execution/COLLAB.md`）

## Current phase
Step 1.5 continuity fix in progress, Step 2 kickoff deferred until hall-doc recovery and conversational save both pass

## Current mainline
当前主线已从“准备进入 Step 2”回收为“先补齐 Step 1 验收缺口”：
1. 已确认 `/project` 的 session-owned state 写入与 `before_prompt_build` hook 链路存在且插件已加载到当前 OpenClaw
2. 已确认当前默认 injected context 仍偏向 `project.yaml` + `README.md` + `docs/recent-state.md`，未充分对齐门厅恢复模型
3. 当前主目标是完成 Step 1.5 acceptance fix，使 `/project <id>` 后默认 project context 以 `STATUS.md` / `README.md` / `RESUME.md` 为主，并保持 bounded
4. `/save` 的默认工作流正在切到 conversational draft -> confirm -> apply，以便更好服务第二天 continuity
5. 在 Step 1.5 验收通过前，Step 2 implementation kickoff 暂缓

## Recently completed
- Discord 已配置为私人协作 workspace
  - guild allowlist 已建立
  - native commands 已开启
  - ACP thread bindings 已开启
  - Discord exec approvals 已开启
- 已确认当前真实 Discord 工作频道：`1490988879304724603`
- 已完成一轮关键排障结论：
  - `TUI -> sessions_send -> Discord session` 不能替代原生 Discord inbound 来触发 ACP thread binding
  - 即使目标 session 是 Discord channel session，inter-session provenance 仍会让 ACP spawn 看到 `webchat`
- Escalation protocol v1.0 已完成
  - 定义了升级矩阵（🔴必须 / 🟡条件 / 🟢自主）
  - 明确了 "human in the loop, not as the bus" 的执行规则
  - 文档：`plan/active/escalation-protocol.md`
- Step 1 已完成并作为本地 MVP baseline 验收通过
- 已建立顶层门厅文档三件套：`README.md` / `STATUS.md` / `RESUME.md`
- 已更新 docs map 与门厅阅读顺序
- 已确认当前项目文档体系需要按 lifecycle + role 重建，而不是继续沿用现有目录习惯
- 已形成文档体系重建原则与盘点文档：
  - `plan/active/doc-system-rebuild-v1.md`
  - `plan/active/doc-rebuild-mapping-note.md`
- 已收拢 skill draft bundle 到 `meta/skill-draft/`
- 已将 discovery / plan overflow 材料移入 `docs/archive/`

## Last interruption point
当前中断点已经切换为：
- hall-doc-first recovery 已落到 `project-context-loader.ts` 与测试
- `/save` 已从“立即写入”切到“先生成待确认 draft，再 apply/cancel”
- 当前剩余主线是验证这套 continuity 闭环是否适合 OpenClaw 日常使用
- 若 conversational save 仍不够表达真实工作态，下一轮应评审更强的 coordinator-agent-native LLM compaction

## Immediate next actions
1. 让 Codex 按项目文档执行 Step 1.5 acceptance fix
2. 在 OpenClaw 中验证 `/save` 默认返回 conversational draft，而不是立即写文件
3. 验证 `/save apply` / `/save cancel` 是否足够顺手，能否支撑第二天 continuity
4. 再重新判断 Step 1.5 是否可验收通过，以及是否恢复 Step 2 kickoff

## Pending decisions
1. Step 1.5 完成后，Step 1 是否可按“门厅恢复体验”口径验收通过
2. `step2-context-validation.md` 是否需要在开发前再做一次显式重写，还是边实现边回补
3. `/save` 当前 conversational save 是否已经足够顺手，还是要继续升级到更强的 coordinator-agent-native LLM compaction
4. Step 2 完成后，是否正式开启 `plan/candidates/step3-candidates.md` 的下一轮评审

## Resume reading order
中断后恢复，建议先读：
1. `STATUS.md`
2. `RESUME.md`
3. `execution/COLLAB.md`
4. `docs/README.md`
5. `plan/active/doc-system-rebuild-v1.md`
6. `plan/active/doc-rebuild-mapping-note.md`

## Resume / save note
- `RESUME.md` 是单线程恢复工作的第一宿主
- `execution/COLLAB.md` 用于判断当前协作流转与 writeback 上下文
- `/save` 的目标应优先对齐门厅恢复模型，并通过 conversational draft -> confirm -> apply 完成收口
- 当前 `/save` 仍是 bounded draft baseline，不等于 fully automatic memory compaction

## Meta note
- `meta/skill-draft/` 是你、Human 与 OpenClaw agent (`coordinator-agent`) 后台并行维护的长期抽象资产
- 它**不是当前项目执行面**，默认不进入执行 agent 的阅读顺序
- 但 OpenClaw agent (`coordinator-agent`) 在后续元讨论时应记得读取它，避免遗忘抽象层进展

## Guardrail
在当前阶段：
- Step 1.5 只补 hall-doc recovery 验收缺口，不得滑入 Step 2 routing / writeback / context-engine 扩张
- Step 2 只服务 `proj-openclaw-feishu-orchestrator` 这类真实客户协作稳定性
- 不把 ACP visible mode / native thread / shared thread governance 塞进当前主 scope
- 不让 `/save` 膨胀成自动 writeback system
- 不让 skill draft 升格为正式 skill
