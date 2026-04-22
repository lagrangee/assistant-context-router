# Step 2 Context Validation

## Purpose
在 `step2-project-context-definition.md` 已定义默认 project context 的前提下，验证 `/project` 在 `main session` 中切换项目焦点后，这套 context 是否足以支撑真实多轮任务。

本文件只关注 **main-session project context adequacy**，不覆盖 `project session` / `service` 的 route semantics；那部分由 `step2-routing-matrix.md` 负责。

## Baseline under validation
当前默认 minimum project context 为：
- `project.yaml`
- `README.md`
- `STATUS.md`
- `RESUME.md`

默认不注入：
- `docs/README.md`
- `execution/COLLAB.md`
- raw conversation archive

这些仅作为 optional bucket / source 按需下钻。

## Validation goal
验证 `/project` 在 `main session` 中设置 `current_project_id` 后，默认 minimum context 是否已经足以让 assistant：
1. 识别当前 project identity
2. 理解项目当前阶段与主线
3. 在主会话中恢复当前工作态
4. 在多轮中保持项目边界
5. 知道何时需要读取额外 bucket

## Core question
Step 2 context validation 现在不是在问：
> “加更多 context 会不会更聪明？”

而是在问：
> “当 Human 不切 session、只在 `main session` 里通过 `/project` 切项目焦点时，默认 minimum context 是否已经足够支撑正确边界与可工作恢复？”

## Task classes
至少覆盖三类真实任务：

### 1. Orientation in main session
示例问题：
- 当前项目目标是什么？
- 现在在哪个阶段？
- 下一步大致要做什么？

期待：
- assistant 能从 identity + status 里答对目标与阶段
- 不混入别的项目

### 2. Resume / continuation in main session
示例问题：
- 我们上次停在哪？
- 现在继续的话先做什么？
- 当前 pending decisions 是什么？

期待：
- assistant 能依赖 `RESUME.md` 给出正确恢复点
- 不需要默认读取 raw conversation 才能继续

### 3. Boundary retention after focus switch
示例问题：
- 先 `/project foo`，连续两到三轮讨论
- 再切 `/project bar`
- 检查 assistant 是否能在主会话中正确切换并保持新的项目边界

期待：
- assistant 能随着 `current_project_id` 切换项目边界
- 不因仍在同一个 `main session` 而遗留旧项目噪音

## Test modes
每类任务至少两组：

### Mode A — default minimum context
仅使用：
- `project.yaml`
- `README.md`
- `STATUS.md`
- `RESUME.md`

### Mode B — minimum context + selected optional bucket
在 Mode A 基础上，按任务需要只增加一个 optional bucket，例如：
- `docs/README.md`
- `execution/COLLAB.md`
- compacted conversation state（若未来存在）

目的：
- 判断失败是否真的来自某个 bucket 缺失
- 避免直接退回“随手多塞文档”

## Record template
每轮验证至少记录：
- `case_id`
- `main_session_id`
- `project_id`
- `task_class`
- `mode`
- `injected_buckets`
- `prompt_summary`
- `expected_traits`
- `observed_result`
- `failure_classification`
- `recommendation`

## Failure classification
统一先归为：
- `identity_missing`
- `status_missing`
- `resume_missing`
- `optional_bucket_needed`
- `focus_switch_stale`
- `state_stale`
- `model_reasoning_issue`
- `task_framing_unclear`

说明：
- 不再使用笼统的 `context missing`
- 需要区分“文档不够”与“main session 里的 focus switch 没有生效”

## Acceptance rule

### Pass condition
默认 minimum context 应在大多数真实任务中支持：
- `/project` 后主会话内正确项目识别
- 正确阶段判断
- 正确恢复下一步
- 主会话多轮边界稳定
- project focus switch 后不把旧项目噪音带入新项目

### Escalation rule
只有在以下条件满足时，才考虑提升 optional bucket 的地位：
1. 同类任务稳定暴露同一缺口
2. 缺口能明确归因到某个 bucket
3. 该 bucket 的引入不会显著破坏 bounded context

### Non-escalation rule
不允许因为以下原因就扩大默认 context：
- 单次失败
- 模型一时没答好
- 只是“感觉多点信息可能更聪明”
- 本质失败其实来自 focus switch / route state 错误，而不是 context 不足

## Conversation-related validation note
当前约定：
- raw conversation archive 可以保留
- 但不默认注入

因此 validation 时要特别区分：
1. assistant 是真的需要 raw conversation 才能继续
2. 还是只是缺一个更稳定的 `RESUME.md` / compacted resume state
3. 还是 `main session` 的 `current_project_id` 没有正确发挥作用

若观察到第 2 类问题，应优先考虑：
- 强化 `RESUME.md` schema
- 引入 explicit / semi-explicit conversation compaction

而不是直接默认注入 raw conversation。

## Deliverables
本文件对应的最小产物应包括：
1. validation cases 草案
2. main-session context adequacy 记录模板
3. 首轮案例观察
4. 若失败，明确指出缺的是 bucket、focus switch 还是 route state

## Next step
context validation baseline 确认后，再与：
- `step2-routing-matrix.md`
协同进入最小实现切口设计
