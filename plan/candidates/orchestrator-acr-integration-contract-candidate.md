# Orchestrator ACR Integration Contract Candidate

## Purpose
定义 `assistant-context-router` 与 `openclaw-feishu-orchestrator` 的候选接入契约，回答：

- 两边分别负责什么
- 为什么默认推荐 `service-first` 接线
- `project session` 在 orchestrator 场景下到底承担什么角色
- Feishu / CLI / skill / adapter 分别应落在哪一层

本文档当前是项目内候选方案，不是最终正式 contract。

## Core stance
`openclaw-feishu-orchestrator` 对 ACR 来说是一个高价值的 **work orchestration / visibility subsystem**，但不是 `ACR core`。

更准确的关系应是：
- `ACR core`：project truth、main session、routing、safe-fail、human governance
- `orchestrator kernel`：task / bug workflow、queue、state transition、run visibility、protocol/business notification
- `work-tracking UI adapter`：Feishu/Trello/Jira/Linear 等人类友好的项目运营界面

因此这不是“谁替代谁”的关系，而是：

> secretary collaboration layer 与 work orchestration subsystem 的接缝设计问题。

## Why this seam matters
如果这层接缝不清楚，系统很容易滑向以下失败模式：

- ACR 与 orchestrator 竞争主真相
- `project session` 被误用成 workflow queue
- board/work-tracking 工具反向变成系统真相层
- business notification 与 `main session escalation` 混为一谈
- 项目 repo 的接线逻辑被硬编码回 ACR core

## Responsibility split

### ACR should own
- `docs as truth`
- `/project` focus switch
- `main session` continuity
- ingress normalization
- route decision / safe-fail / trace
- 哪些高信号事项应升级回主会话
- `project session` 的 shadow lane / read model 语义

### Orchestrator should own
- task / bug / work-item lifecycle
- queue / runtime state / retry / dedupe
- dispatch / review / finalize protocol ingress
- run / progress / event visibility
- protocol/business notification
- work-management observability

### UI adapters should own
- 如何把 task/run/event 暴露给 Human
- board / card / table / feed 的具体呈现方式
- PM tool 的字段映射与交互体验

## Default integration shape
当前推荐的默认接法应是：

`channel ingress -> ACR normalization -> route decision -> project-owned internal service -> orchestrator ingress`

也就是：

`NormalizedEnvelope -> internal service -> orchestrator kernel`

而不是：

`NormalizedEnvelope -> project session -> 再靠 agent 二次理解 -> orchestrator`

## Why service-first is the default
对 orchestrator 这类已经拥有清晰 workflow kernel 的项目，`service-first` 更合理，原因有四个：

### 1. It avoids duplicated ingress interpretation
orchestrator 已经有稳定 action contract 时，不应先落到对话面再重新判断一次。

### 2. It keeps workflow execution inside the kernel
真正的：
- 状态推进
- 队列接收
- 幂等
- 重试

都应留在 orchestrator 内部，而不是散落到 `project session` 对话流里。

### 3. It makes routing easier to explain and test
当 action contract 清晰时，`service` 路由会比“先投递到 lane，再让 agent 自己理解”更可验证。

### 4. It preserves project-session as visibility lane
这样 `project session` 就能保持：
- shadow lane
- trace read model
- summary source

而不会膨胀成第二个 workflow engine。

## Recommended routing split
对 orchestrator 首批场景，建议默认这样分。

### Service-first actions
以下动作默认应直达 `service`：
- `dispatch`
- `execute_success`
- `execute_blocked`
- `review_done`
- `review_fix`

这些动作的特征是：
- 结构化
- 低歧义
- 已有明确业务语义
- 天然属于 workflow kernel ingress

### Project-session-friendly actions
以下事项更适合进入 `project session` / shadow lane：
- `append_note`
- `handoff_note`
- `ops_summary`
- `high_signal_event_log`
- service 执行结果摘要
- 需要给 `coordinator-agent` 看的 progress digest

这些对象更偏：
- read model
- visibility
- collaboration trace

而不是 workflow state transition。

## Project session semantics in orchestrator scenarios
在 orchestrator 场景中，`project session` 不应被视为“项目运行时主入口”。

更合理的定义是：

### What it is
- ACR 的 system-facing shadow lane
- route result / service result / high-signal event 的聚合读面
- 给 `coordinator-agent` 恢复项目进展的摘要源

### What it is not
- orchestrator queue
- authoritative workflow state host
- task/run/event 的唯一真相
- 业务动作是否生效的判断依据

## Candidate action contract
为了让 Step 2 接线可测试，建议先有一个很小的 ACR-facing action contract。

### Minimum payload hints
每条结构化动作至少应尽量携带：
- `action_name`
- `protocol_owner_project_id`
- `business_target_project_id` 或 `project_ref`
- `record_id`
- `kind`
- `summary`
- `trace_id`

说明：
- `protocol_owner_project_id`
  - 当前多半是 `proj-openclaw-feishu-orchestrator`
- `business_target_project_id`
  - 表示真实工作归属 project
- 如果 `business_target_project_id` 缺失且后续动作必须依赖它，ACR 应 safe-fail，而不是猜

### Minimum service result hints
从 ACR 视角，orchestrator-facing service 至少应能返回：
- `accepted`
- `queued`
- `rejected`
- `needs_escalation`

外加少量结构化信息：
- `run_id` 或 `queue_ref`
- `summary`
- `escalation_reason`
- `trace_patch`

这里的重点不是把 orchestrator 的全部内部状态暴露给 ACR，而是：
- 让 ACR 能判断 route 是否成立
- 让 ACR 知道是否需要升级给 Human / `coordinator-agent`

## Business notification vs Main-session escalation
这两者必须显式拆开。

### Business / protocol notification
由 orchestrator 发出。

它的典型目标是：
- review chat
- 工作群
- task card comment
- outbox / operator feed

它服务于：
- workflow 运转
- protocol 协作
- 业务观察

### Main-session escalation
由 ACR 的上层协作语义定义。

它的目标是：
- 把真正需要 Human 决策、review、takeover 的高信号事项送回 secretary 主工作面

它服务于：
- continuity
- governance
- human decision

因此：
- business notification 不自动等于 `main session escalation`
- 发到了飞书 review 群，不代表已经回到了 secretary 主会话

## Feishu / CLI / Skill / Adapter layering
这一层当前最容易被混淆。

### Feishu
Feishu 更像：
- work-tracking UI adapter
- business communication channel

它不应被视为：
- ACR core 的一部分
- project truth host

### CLI
CLI 更适合作为：
- agent/operator 友好的稳定工具边界
- 项目侧系统能力的可调用接口

当前建议长期方向是：
- orchestrator 对外提供 project-owned CLI，例如 `orchestratorctl`
- `coordinator-agent` / Codex / skill 通过 CLI 触发稳定操作

### Skill
skill 更适合作为：
- agent 的工作说明书
- 调用约定与操作流程的封装

skill 不是：
- runtime integration contract
- daemon 内核依赖

### Adapter
adapter 更适合作为：
- runtime/kernel 内部的系统集成边界
- SDK/API/client 封装

推荐关系是：
- kernel 用 adapter
- agent/operator 用 CLI
- skill 包装 CLI 的使用方式

## Current coupling and recommended direction
当前 orchestrator 里已经出现两类不同耦合：

### 1. Feishu API coupling
直接对接 Feishu Open API 的 bitable adapter。

这类耦合本质上属于：
- work-tracking UI / service adapter

### 2. OpenClaw CLI coupling
通过 `openclaw message send` 做通知投递。

这类耦合更像：
- delivery channel adapter

当前这两种耦合都可以暂时存在，但长期建议是：
- 不把 OpenClaw 私有约定写死成 orchestrator 唯一未来
- 让 delivery / UI adapter 成为 replaceable layer
- 让项目 repo 持有自己的 integration seam

## Project-owned integration obligation
当前推荐由项目 repo 显式拥有以下 ACR 接入面：

- `router.yaml`
- ACR-facing action contract
- project-owned internal service implementation
- orchestrator kernel ingress bridge
- UI/work-tracking adapter binding

这层不应被反向挪回 `ACR core`。

## Step 2 minimum scope
Step 2 不需要把所有接缝都做满，但应至少明确以下内容：

### In scope
- `service-first` 作为 orchestrator 默认接法
- `project session` 只作为 shadow/visibility lane
- `protocol owner` / `business target` 的 safe-fail 规则
- business notification 与 `main session escalation` 的语义拆分
- Step 2 最小 progress visibility 可接入 orchestrator

### Out of scope
- 全量自治策略
- 完整 CLI 标准化
- 多 PM 工具 adapter 同时落地
- 把 orchestrator 抽象成通用平台
- ACR core 内建某个具体项目的业务 handler

## Failure modes to avoid
- 把 orchestrator kernel 重新做进 ACR
- 把 `project session` 变成 dispatch inbox
- 把 Feishu 当成系统主真相
- 用 skill 充当 runtime integration layer
- 用 CLI 代替 kernel 内部 adapter
- 混淆 business notification 与 `main session escalation`

## Recommended next step
1. 在 orchestrator repo 中补一个最小 `router.yaml` 草案。
2. 为 orchestrator 定义首批 ACR-facing action contract。
3. 在 ACR core 中继续收口 project-owned integration loading contract。
4. 后续再决定是否把 `protocol_owner_project_id` / `business_target_project_id` 正式推进到 core 类型系统。
