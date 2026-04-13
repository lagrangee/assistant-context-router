# COLLAB

## Purpose / Role
这是 `assistant-context-router` 的 **multi-agent collaboration object**。

它回答：
- 当前有哪些 agent / 角色在协作
- 谁负责什么
- 正在流转哪些 work items
- 最近 handoff / writeback 是什么
- 哪些事项需要 review / decision / unblock

它不承担：
- 项目长期定义（那是 `README.md`）
- 项目阶段总收口（那是 `STATUS.md`）
- 单一工作线程的最终恢复点（那是 `RESUME.md`）
- 原始对话归档

## Collaboration model
当前协作原则：
- **human in the loop, not as the bus**
- Human 负责 discovery、review、decision、验收
- OpenClaw agent (`coordinator-agent`) 负责编排、收口、维护工作态、驱动其他 agents 协作
- 其他 agents 负责读取项目对象、执行任务、回写结果
- 人类不再负责在两边人工搬运长上下文

## Escalation rules
何时必须升级给 Human，何时 OpenClaw agent (`coordinator-agent`) 自主决策：
- 🔴 **必须升级**：方向决策、边界拍板、资源/权限、验收判断、安全风险
- 🟡 **条件升级**：未定义场景、外部 agent 进入新 scope、时间敏感决策
- 🟢 **OpenClaw agent (`coordinator-agent`) 自主**：文档维护、工作态更新、信息整理、执行已确认方案

完整协议见：`plan/active/escalation-protocol.md`

## Participants / Roles
- Human
  - discovery 阶段讨论
  - review / decision
  - 最终验收
- OpenClaw agent (`coordinator-agent`)
  - 项目协作编排者
  - 正式文档收口者
  - 当前工作态维护者
  - 多 agent 协作驱动者
- External agents（Codex / Claude / Gemini / future agents）
  - 读取项目对象与协作协议
  - 执行具体任务
  - 回写结构化摘要、建议、blocked、need review / decision

## Working agreements
1. 正式结论进入正式文档，不把关键结论只留在对话或协作面板里。
2. `COLLAB.md` 写协作流转，不替代 `RESUME.md` 的工作恢复收口。
3. 需要恢复工作的结论优先收口进 `RESUME.md`。
4. 需要阶段总收口的结论优先收口进 `STATUS.md`。
5. 人类只在 review / decision / exception handling 时介入，不做人肉总线。

## Active work items
### ACR-COLLAB-05 — Step 1.5 acceptance fix for hall-doc recovery
- owner: Codex
- status: completed
- objective:
  - 修复 Step 1 的验收缺口，使 `/project <id>` 后的默认 project context 注入真正对齐门厅恢复模型
  - 让 assistant 在 project switch 后优先基于 `STATUS.md` / `README.md` / `RESUME.md` 迅速恢复 working state
- scope:
  - 调整默认 project context loading 顺序为门厅优先
  - 保持 bounded context，不扩到 Step 2 routing / writeback / collab bucket
  - 补充或修改测试，证明 hall-doc recovery 生效且安全降级不退化
  - 更新 Step 1 相关实现说明，明确这是 acceptance fix，不是 Step 2
- constraints:
  - 不进入 protocol/project/workflow routing
  - `/save` 只允许补 continuity / writeback pairing，不扩展成自动 writeback system
  - 不引入 full conversation / collab panel 作为默认注入
  - 不改变 session-owned state 模型
- acceptance:
  - `/project proj-assistant-context-router` 后，默认 injected context 至少覆盖：当前项目、当前阶段、当前主线或 next action、从哪里恢复工作
  - 默认注入以 `STATUS.md` / `README.md` / `RESUME.md` 为主，`project.yaml` 退为 identity metadata 补充
  - 缺失单个门厅文档时可安全降级
  - 测试全绿
- next_handoff:
  - 已完成 hall-doc-first recovery 与相关测试收口
  - 当前下一步是验证 OpenClaw 中的真实 continuity 体验是否过关
- related_docs:
  - `STATUS.md`
  - `RESUME.md`
  - `plan/active/step2-project-context-definition.md`
  - `implementation/plugin/progress/codex-step1.md`

### ACR-COLLAB-06 — Step 1.5B conversational save
- owner: OpenClaw agent (`coordinator-agent`)
- status: in progress
- objective:
  - 将 `/save` 收紧为 continuity-first 的 conversational save
  - 让 `coordinator-agent` 先给出 draft summary，再等待 Human 确认后写入 hall docs
- current_state:
  - `/save` 已切到 draft -> confirm -> apply/cancel
  - `/save --dry-run` 仍保留为调试入口，不是日常主路径
  - pending save draft 已进入 session-owned state，project switch 会清空它
- constraints:
  - 不做 silent write
  - 不把 `COLLAB.md` 当默认 save source
  - 不扩成自动 memory/archive sync
  - 不进入 Step 2 routing
- next_handoff:
  - 在 OpenClaw 中验证 `/save`、`/save apply`、`/save cancel` 的真实工作流
  - 如果 continuity 质量仍不够，再评审更强的 coordinator-agent-native LLM compaction
- related_docs:
  - `STATUS.md`
  - `RESUME.md`
  - `plan/architecture/system-architecture-v1.md`

### ACR-COLLAB-04 — Escalation protocol definition
- owner: OpenClaw agent (`coordinator-agent`)
- status: completed
- objective:
  - 定义升级矩阵：何时必须升级给 Human，何时 OpenClaw agent (`coordinator-agent`) 自主决策
  - 把 "human in the loop, not as the bus" 落地为可执行规则
- current_state:
  - `plan/active/escalation-protocol.md` 已完成 v1.0
  - 包含：升级矩阵、详细规则、升级方式、COLLAB 集成、快速参考卡
- related_docs:
  - `plan/active/escalation-protocol.md`

### ACR-COLLAB-01 — Step 2A project context definition
- owner: OpenClaw agent (`coordinator-agent`)
- status: in progress
- objective:
  - 定义 project switch 后默认最小 context 的组成
  - 明确 raw conversation / compacted state / default context 的分层
- current_state:
  - `plan/active/step2-project-context-definition.md` 已建立
  - `plan/active/project-doc-object-schemas.md` 已建立
- next_handoff:
  - 进入后续 review / refinement
- related_docs:
  - `plan/active/step2-project-context-definition.md`
  - `plan/active/project-doc-object-schemas.md`

### ACR-COLLAB-02 — Step 2 validation split
- owner: OpenClaw agent (`coordinator-agent`)
- status: completed
- objective:
  - 将旧的 `step2-validation-design.md` 拆分为 context validation 与 routing matrix 两个问题域
- current_state:
  - 已完成拆分与索引重写
- related_docs:
  - `plan/active/step2-context-validation.md`
  - `plan/active/step2-routing-matrix.md`
  - `plan/active/step2-validation-design.md`

### ACR-COLLAB-03 — Collaboration object formalization
- owner: OpenClaw agent (`coordinator-agent`)
- status: in progress
- objective:
  - 定义 `COLLAB.md` 的位置、命名、schema 与它和 `RESUME.md` 的关系
- current_state:
  - `plan/candidates/collab-object-definition.md` 已建立
  - 协作文档已迁移到 `execution/COLLAB.md`
- next_handoff:
  - 后续可继续补充 item schema / status enum / review rules
- related_docs:
  - `plan/candidates/collab-object-definition.md`
  - `execution/COLLAB.md`

## Recent handoffs / writebacks
- 文档体系重建已完成第一轮收口，顶层门厅文档已固定为：`README.md` / `STATUS.md` / `RESUME.md`
- `/save` 已切到 conversational draft -> confirm -> apply 模型，等待 OpenClaw 实机验证
- Step 2 文档已拆分为：context definition / object schemas / context validation / routing matrix
- 当前正在将 collaboration object 从“临时 progress 文档”提升为“正式项目对象”
- Discord 已建立为真实工作面，并完成一轮关键协作验证前置：
  - 正确工作频道已识别为 `1490988879304724603`
  - 已证实 `TUI -> sessions_send -> Discord session` 不能替代原生 Discord inbound 来触发 ACP thread binding
  - 下一步必须在 Discord 原生消息入口先执行 `/project assistant-context-router`，再继续最小 ACP thread spawn 测试

## Need review / need decision
### REVIEW-STEP1.5-ACCEPTANCE
- 类型：验收
- 升级方式：即时
- 状态：decided
- 决策：Human 已确认启动 Step 1.5 acceptance fix，并由 Codex 按项目文档执行；当前目标是补齐 hall-doc recovery 缺口，不进入 Step 2

当前待验证而非待拍板的点：
1. `/project assistant-context-router` 在主会话下是否能真实基于门厅文档恢复 working state
2. 恢复后，原生 Discord inbound 下的 ACP thread-bound Codex session 能否真正建立

下一批可能需要 Human review / decision 的点：
1. `COLLAB.md` 的 item schema 是否需要进一步结构化（例如固定 status enum）
2. project switch 时是否采用显式 / 半显式 resume compaction policy
3. 何时允许 OpenClaw agent (`coordinator-agent`) 直接调度外部 agents 进入 Step 2 case design

## Closed items (recent)
- Step 1 收尾与本地 MVP baseline 验收：done
- 项目文档体系第一轮重建：done
- 顶层门厅文档命名收敛（README / STATUS / RESUME）：done
