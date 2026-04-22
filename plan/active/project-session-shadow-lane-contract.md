# Project Session Shadow Lane Contract

## Purpose
定义 `project session` 在 Step 2 里的正式职责、非职责、可写入对象与主会话注入规则，确保它继续是 `shadow lane / read model`，而不是重新涨回 workflow host 或第二真相层。

本 contract 直接服务于：
- `Cut 5 — Project session minimal shadow lane`
- `before_prompt_build` 对 lane summary 的最小注入
- `/project --lane` 作为 direct inspect 面

它不负责定义：
- orchestrator 的 task / run / queue authority
- docs truth host
- main-session escalation 的 authority object

## Position in the authority map
`project session` 当前的定位是：
- **authoritative host for lane entries themselves**
- **derived read model for underlying workflow/activity signals**

换句话说：
- lane 文件里的每条 event 当然以 lane file 为宿主
- 但 event 的业务语义 truth 不在 lane 里

当前 authority 分工保持为：
- project truth: `README.md / STATUS.md / RESUME.md / COLLAB.md`
- workflow truth: orchestrator / service result / runtime state
- governance truth: `main-session escalation store`
- shadow execution digest: `project session lane`

## What the lane is
`project session lane` 是一个：
- append-only
- high-signal
- project-scoped
- execution-facing
  的 shadow lane

它的主要价值是：
1. 给 secretary / agent 一个按项目聚合的 execution digest
2. 给 `/project --lane` 一个稳定 inspect 面
3. 给 main session 提供**按需读取**的高信号执行提示

## What the lane is not
`project session lane` 不是：
- workflow inbox
- dispatch queue
- retry state host
- backlog authority
- unresolved governance authority
- docs truth mirror

因此它**不能**：
1. 接受 `dispatch/review/execute_*` 这类结构化 workflow action 作为 authority ingress
2. 单独决定某个 task/run 状态是否生效
3. 取代 `main-session escalation store`
4. 取代 docs 中的 current phase / mainline / next action

## What may be appended
Step 2 当前允许投递到 lane 的对象，仅限：
1. route result digest
2. service result digest
3. promoted high-signal execution events
   - `blocked`
   - `review_request`
   - `high_signal_completion`
   - `service_error`
4. minimal trace-carrying execution metadata
   - `trace_id`
   - `action_name`
   - `route_reason`
   - optional `run_id / queue_ref`

这些对象写入 lane 的前提是：
- 它们已经有下层 authority host
- lane 只是按项目做一层可读聚合

## Append-only rule
lane 必须保持 append-only。

这意味着：
- 重复 blocker 可以产生两条 blocker event
- lane summary 中的计数首先表示**事件历史**，不是去重后的 unresolved obligation 数量

去重、ack、resolve 属于：
- `main-session escalation store`
- 或更底层的 workflow authority

不属于 lane。

## Summary rule
lane summary 是：
- read model
- execution hint
- high-signal digest

它不是：
- current project truth summary
- current docs summary
- unresolved escalation truth summary

因此 lane summary 的输出必须满足：
1. 只总结 high-signal execution history
2. 明确提示“仅供执行提示，不替代 docs truth”
3. 不把 blocked/review/completion 伪装成项目主线或当前阶段

## Main-session injection rule
lane summary **不应默认注入**所有 main-session 对话。

当前只允许在以下意图下按需注入：
1. 用户显式询问 execution/progress/high-signal history
2. 用户显式询问 lane / automation / recent execution events
3. 用户显式询问“现在有什么需要我关注/处理”
   - 这时 lane summary 只能作为 escalation 的补充 execution hint
   - 不能替代 unresolved escalation object

## What should stay out of lane injection
以下 main-session 问题，默认不该因为 lane 历史而被强行注入 lane summary：
1. 项目目标是什么
2. 当前主线是什么
3. 当前阶段是什么
4. 下一步是什么
5. 泛化的“介绍一下这个项目”
6. 仅仅因为出现了“状态 / 最近 / latest / recent”这类弱词

这些问题优先回答来源应是：
- `README.md`
- `STATUS.md`
- `RESUME.md`

只有当用户明显在问 execution-facing signal 时，lane summary 才应加入。

## Direct inspect surface
`/project --lane` 是 lane 的 direct inspect surface。

它的职责是：
- 让 human/operator 明确查看 lane 摘要
- 承担“我要看 execution digest”这类主动读取

这意味着：
- 不必把所有 lane 信息都塞回 main session 提示词
- human 想看 lane 时，应优先走 `/project --lane`

## Step 2 acceptance
Cut 5 在以下条件下算通过：
1. lane 继续保持 append-only shadow lane
2. 没有新的 workflow authority 从 orchestrator 漂到 lane
3. main session 只在 execution-facing 问题下按需注入 lane summary
4. 泛项目问题仍然以 docs/project context 为主
5. `/project --lane` 能继续承担 direct inspect 面
