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
### ACR-COLLAB-08 — Step 2 minimal loop execution + Gate 5 validation
- owner: Codex + Human
- status: in progress
- objective:
  - 把 Step 2 最小闭环从“边界共识”推进到“已实现且可实测”的状态
  - 在 Cut 4B 之后验证 `business notification` 与 `main-session escalation` 的真实分流体验
  - current_state:
  - Cut 1–4B 已 implemented + auto-validated
  - 当前已落地：
    - `current_project_binding`
    - `/project --save` host matrix / preview-apply contract
    - route / trace / safe-fail
    - service-first bridge
    - signal promotion
    - minimal business notification record
    - minimal main-session escalation store
  - Gate 5 `escalation hygiene` human validation 已通过：
    - `review_request` 默认停留在 business/work side
    - `blocked + human decision` 能稳定回到 main session
    - `high_signal_completion` 不默认污染主会话
    - 重复 blocker 不会堆叠 unresolved main-session escalation
  - Cut 5A / 5B 已 completed + auto-validated：
  - Cut 5C 已 completed + auto-validated：
    - `/project --lane` summary 已明确区分 recent lane events 与 unresolved governance items
    - `blocked events: N` 现在不会再被误读成 open escalation count
  - Cut 5 已完整完成：
    - `project-session-shadow-lane` contract 已 formalize
    - lane summary 触发条件已收紧
    - 普通项目状态问答不再因为弱关键词自动消费 lane 历史
  - Cut 6 已 completed + auto-validated：
    - `minimal-visibility-evidence` contract 已 formalize
    - 高信号事项现在可携带单个 `artifact_ref`
    - `artifact_ref` 已沿 lane / notification / escalation / prompt hint 贯通
  - Cut 7 已 completed + auto-validated：
    - `work-surface-projection` contract 已 formalize
    - 高信号 signal 现在会同步更新 per-project latest work-surface snapshot
    - snapshot 已携带：
      - `headline`
      - `summary`
      - `run_id / queue_ref`
      - optional `artifact_ref`
  - 当前新的主线：
    - Cut 7 已结束
    - Cut 8A 已启动，并已完成第一刀真正的 Feishu/work-surface adapter 消费实现骨架
    - Human review 通过后，live Base 已新增：
      - `Dict Definition.Work Surface状态`
      - `Work Surface Snapshots`
    - adapter 默认字段名已与 live Base 对齐：
      - `Project ID`
      - `所属项目`
      - `状态`
      - `标题`
      - `摘要`
      - `更新时间`
    - manual sync / dry-run 入口已落地，并已在真实 Base 上完成一次 dry-run：
      - project: `proj-bitable-pm-system`
      - outcome: 成功生成 create upsert plan
    - main-session plugin 已新增 project-scoped 手工命令：
      - 首选入口：`/project [<project_id>] --surface-sync [--apply]`
      - 默认 `dry_run`
      - `--apply` 才真正写 Feishu
      - 未传 `project_id` 时使用当前 `/project` binding
      - `/project` 现已成为唯一公开命令入口：
        - `/project --all [query]`
        - `/project [<project_id>] --lane`
        - `/project [<project_id>] --catalog-sync [--apply]`
        - `/project --save`
        - `/project [<project_id>] --surface-sync [--apply]`
        - `/project --help`
      - default runner 当前会先解析统一的 `work-surface binding`
        - 支持 env + optional local config host
        - 若未显式指定，则默认尝试发现 `<plugin dataDir>/assistant-context-router/feishu-adapter.yaml`
        - 若没有显式 binding，现阶段仍保守回退到已确认的 Base token
      - `FEISHU_BASE_TOKEN` 仍可作为最直接的 env override
    - 当前机器的默认 runtime host 已创建：
      - `<openclaw-acr-data-dir>/feishu-adapter.yaml`
      - 已显式包含 `work_surface` 与 `governance.default_target`
    - `governance delivery binding` 已接入默认 escalation runtime path
      - 当前先进入幂等 `governance delivery outbox`
      - 再通过 OpenClaw runtime sender 投递到解析后的 canonical session
      - 依赖 `runtimeBindings.main_sessions` alias 解析 local symbolic target
      - 当前仍未直接接 WeChat / Feishu 外部 API
    - 当前已新增 project-scoped governance inspect 入口：
      - `/project [<project_id>] --governance`
      - 默认按当前 project binding 查看
      - 展示的是 governance outbox mirror，而不是 governance truth
    - `Projects` catalog sync first slice 已 implemented + auto-validated + live-validated：
      - 新增 `/project [<project_id>] --catalog-sync [--apply]`
      - 默认 `dry_run`
      - 当前已支持 `create / update / noop`
      - duplicate / drift / schema 缺失会 clear fail，并返回 friendly error text
      - `demo-acr` 已在真实 Base 上验证：
        - `dry_run = noop`
        - `apply = noop`
        - anchor record id：`<projects-catalog-record-id>`
    - 第一次真实 live upsert 已通过：
      - first apply: `create`
      - second apply: `update`
      - stable record id: `<work-surface-snapshot-record-id>`
    - plugin 已新增 optional `workSurfaceProjectionObserver`
      - 直接接在真实 signal -> snapshot 落盘之后
      - failure safe-fail，不会打断主链
      - 当前不默认自动 apply 到 Feishu
    - plugin implementation tests 全绿：`160/160`
- next_handoff:
  - Codex 已把最小 work-surface snapshot 落到 ACR core，并把 Feishu projection table / adapter skeleton / manual sync / live create-update validation / runtime observer hook / main-session manual sync command 落到 live Base + repo
  - `Business Notification` 的 Feishu IM delivery first slice 当前也已 implemented + auto-validated：
    - 新增 `BusinessNotificationDeliveryRecord` outbox
    - 新增 `/project [<project_id>] --notifications`
    - deliverable target 才走 `lark-cli im` sender
    - unsupported / missing target 稳定回落为 `record_only`
  - 当前已采纳的 operating-surface 分工：
    - `automation-ingress` 只承接 `dispatch ingress` 与 `dispatch` notification
    - `agent-coordination` 只承接 `review workflow`
    - `WeChat DM` 只承接 `main-session escalation`
  - `Task/Bug writeback first slice` 当前也已 implemented + auto-validated：
    - writeback 现在接在真实 `service path`
    - 只接受显式 row anchor：
      - `task_record_id / taskRecordId`
      - `bug_record_id / bugRecordId`
    - project default 当前已真实从 project-owned `router.yaml` 读取：
      - `task_bug_policy.defaults.acceptance_mode`
      - `task_bug_policy.defaults.completion_notify_mode`
    - 当前已真实写入：
      - `current_step / step_result / next_action / last_event_at`
      - `ACR开始执行时间`
      - `执行摘要`（Task）
      - `状态` 的非终态推进
    - 当前 guardrails：
      - terminal row 默认 noop
      - 避免 `Reviewing -> Doing/Fixing` 回退
      - 不自动写 `Done / Fixed / 实际完成时间 / 修复结果`
  - 当前下一步已从“先 formalize Task/Bug policy/schema”推进到“拿真实 `dispatch group -> Task/Bug row` 跑第一轮 live writeback 验证，再进入 self-hosted real usage”
  - 已确认的 guardrails：
    - 默认沿用既有 Base：`private config host`
    - `Tasks / Bugs` 的 meta 设计与字段/状态机逻辑应继承
    - 第一刀不直接把 project-level snapshot 写进 `Tasks / Bugs`
    - `Service Runs Monitor` 不作为当前 projection 的默认目标
    - observer hook 保留，但默认不自动 apply 到 Feishu
    - 后续若继续调整 Feishu 表结构，必须先与 Human 讨论确认
- related_docs:
  - `plan/active/step2-implementation-plan.md`
  - `plan/active/step2-cut-tracker.md`
  - `plan/active/main-session-escalation-notification-split-contract.md`
  - `plan/active/project-session-shadow-lane-contract.md`
  - `plan/active/work-surface-projection-contract.md`
  - `plan/active/step2-gate5-escalation-hygiene-checklist.md`

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
  - `/project --save` 只允许补 continuity / writeback pairing，不扩展成自动 writeback system
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
  - `implementation/adapters/openclaw/plugin/progress/codex-step1.md`

### ACR-COLLAB-06 — Step 1.5B conversational save
- owner: OpenClaw agent (`coordinator-agent`)
- status: completed
- objective:
  - 将 `/project --save` 收紧为 continuity-first 的 conversational save
  - 让 `coordinator-agent` 先给出 draft summary，再等待 Human 确认后写入 hall docs
- current_state:
  - `/project --save` 已切到 draft -> confirm -> apply/cancel
  - `/project --save --dry-run` 仍保留为调试入口，不是日常主路径
  - pending save draft 已进入 session-owned state，project switch 会清空它
  - save frame 已迁到 plugin-owned prompt file：`implementation/adapters/openclaw/plugin/prompts/save-mode-frame.md`
  - save frame prompt 已改为热读取，调 prompt 时不再要求 gateway 重启
- constraints:
  - 不做 silent write
  - 不把 `COLLAB.md` 当默认 save source
  - 不扩成自动 memory/archive sync
  - 不进入 Step 2 routing
- next_handoff:
  - `/project --save` 已在 Step 2 Cut 1 中收口为 host-matrix-backed continuity contract
  - 后续不再以 Step 1.5 save 为主线，相关演进并入 Step 2 minimal loop
- related_docs:
  - `STATUS.md`
  - `RESUME.md`
  - `plan/architecture/system-architecture-v1.md`
  - `plan/candidates/save-mode-contract-candidate.md`
  - `plan/candidates/cross-agent-writeback-candidate.md`
  - `plan/candidates/project-context-manifest-candidate.md`

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
- status: completed
- objective:
  - 将 Step 2 从旧的 protocol/project/workflow layering framing 收紧到更贴近真实使用方式的协作模型
  - 明确 `main session`、`project session`、channel ingress normalization 与最小 service dispatch 的边界
- current_state:
  - `plan/active/step2-project-context-definition.md` 已建立
  - `plan/active/project-doc-object-schemas.md` 已建立
  - 当前新共识已形成：
    - `main session` 是唯一 human-facing 默认入口
    - `/project` 只切 `main session` 焦点，不切 session
    - `project session` 是 per-project 的 system-facing event lane
    - automation 默认不进入 `main session`
- next_handoff:
  - 已完成边界重写，并转入 `step2-implementation-plan.md` + `step2-cut-tracker.md` 的执行主线
- related_docs:
  - `plan/active/step2-project-context-definition.md`
  - `plan/active/project-doc-object-schemas.md`
  - `plan/active/step2-strategy-note.md`

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

### ACR-COLLAB-07 — Codex-side writeback skill
- owner: Codex
- status: completed
- objective:
  - 为 Codex 提供一个正式 writeback lane，把当前 Codex thread 的关键结论写回 truth docs
  - 降低 Human 在 Codex 与 `coordinator-agent` 之间充当人工消息总线的频率
- current_state:
  - `project-writeback` 已作为 formal skill 安装到 `~/.codex/skills/project-writeback/`
  - repo 内保留 source draft：`meta/skill-draft/project-writeback/SKILL.md`
- related_docs:
  - `meta/skill-draft/project-writeback/SKILL.md`
  - `plan/candidates/cross-agent-writeback-candidate.md`

## Recent handoffs / writebacks
- Cut 5 当前已推进到：
  - `project-session-shadow-lane` contract 已 formalize
  - lane summary 主会话注入已从弱词触发收紧到 execution-facing intent 触发
  - `/project --lane` summary 已明确区分 recent lane events 与 unresolved governance items
  - 全量实现测试已通过：`94/94`
- Cut 6 当前已推进到：
  - `minimal-visibility-evidence` contract 已 formalize
  - `artifact_ref` 已沿高信号链路贯通
  - 全量实现测试继续通过：`94/94`
- 当前剩余判断不再是“Gate 5 是否成立”或“ACR 内部 evidence 接口是否还缺”，而是：
  - Step 2 还有哪些 human-facing work-surface gap 未闭合
  - 下一条主线该先收哪一个
- Step 2 当前已从“边界重定义”推进到“最小闭环执行”：
  - Cut 1–4B 已 implemented + auto-validated
  - Gate 5 `escalation hygiene` human validation 已通过
- `business notification` 与 `main-session escalation` 已正式拆成不同宿主：
  - business side 先记录高信号通知
  - main session 只承接 unresolved governance escalation
- `project session` 继续收口为 shadow lane / read model，不再承担 escalation truth
- 文档体系重建已完成第一轮收口，顶层门厅文档已固定为：`README.md` / `STATUS.md` / `RESUME.md`
- `/project --save` 已切到 conversational draft -> confirm -> apply 模型，等待 OpenClaw 实机验证
- 已新增 Step 1.5 continuity 候选规范，用于约束后续 save / writeback / project context 设计：
  - `plan/candidates/save-mode-contract-candidate.md`
  - `plan/candidates/cross-agent-writeback-candidate.md`
  - `plan/candidates/project-context-manifest-candidate.md`
- 已新增 `project-writeback` 的 repo source draft，并已对应安装全局 formal skill，用于承接 Codex-side truth-doc writeback：
  - `meta/skill-draft/project-writeback/SKILL.md`
  - `~/.codex/skills/project-writeback/SKILL.md`
- Step 2 文档已拆分为：context definition / object schemas / context validation / routing matrix
- Codex 与 project owner 已完成一轮新的 Step 2 边界重定义，已采纳的核心结论包括：
  - `main session` 是 Human 与 `coordinator-agent` 的唯一主工作入口
  - `/project` 的意义是在 `main session` 中切换当前项目焦点，而不是把 Human 送进 `project session`
  - `project session` 是 per-project 的 system-facing event lane，主要承接 automation / agents / services 的事件流与结果
  - automation 默认不污染 `main session`；只有 decision / blocked / review / high-signal completion 才应上浮
  - `workflow` 可以保留为分类字段，但不再默认拆成独立 session
- Codex 已将 Step 2 最小实现骨架推进到可运行状态，当前已落地：
  - structured ingress normalization
  - richer route primitives 与 route trace
  - automation -> service / project lane / safe-fail 的最小 dispatch
  - global + project router manifest
  - project lane JSONL event lane
  - `/project --lane` 摘要入口
  - `before_prompt_build` 中保守按需的 lane summary optional bucket
- ACR implementation 目录已按三层边界完成收口：
  - `implementation/core/`
  - `implementation/adapters/openclaw/runtime/`
  - `implementation/adapters/openclaw/plugin/`
- OpenClaw plugin path 已迁移并完成宿主配置修复：
  - OpenClaw 现加载 `implementation/adapters/openclaw/plugin/openclaw.plugin.json`
  - plugin `register` 已改为同步注册，`openclaw plugins inspect` 可正确识别 commands / hooks
- Step 2.1 的 OpenClaw runtime adapter MVP 已落地：
  - 内置 `openclaw_session` runtime-shared adapter
  - `project_session_binding.target_ref` 当前解释为 OpenClaw `sessionKey`
  - delivery 通过 `runtime.system.enqueueSystemEvent(...)` 排队，并优先 `runHeartbeatOnce(target=last)` 立即驱动 continuation
  - shadow lane 继续只作为 fallback / summary / trace read model
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
3. 真实 `openclaw-feishu-orchestrator` action 的接线优先级，以及 lane summary 的后续 human-facing 策略
4. ACR general contract 与 project-specific adapter 的最终边界是否需要进一步文档化

最新已决定的新原则：
- ACR core 应保持 general-only
- runtime-shared adapter 由 ACR 管理（如 OpenClaw adapter、未来 Hermes adapter）
- project-specific adapter / runtime integration 不应继续长在 ACR repo
- `openclaw-feishu-orchestrator` 的 ACR-native refactor 应回到 orchestrator 项目 thread 推进
- Step 2.1 已落地的通用能力包括：
  - `main session binding`
  - `project session binding`
  - `project session` runtime delivery contract
  - shadow lane / read model fallback
  - OpenClaw runtime adapter MVP / session-bound delivery bridge

## Closed items (recent)
- Step 1 收尾与本地 MVP baseline 验收：done
- 项目文档体系第一轮重建：done
- 顶层门厅文档命名收敛（README / STATUS / RESUME）：done
