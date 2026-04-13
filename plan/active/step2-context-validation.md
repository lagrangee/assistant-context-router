# Step 2 Context Validation

## Purpose
在 `step2-project-context-definition.md` 已定义默认 project context 的前提下，验证该 context 是否足以支撑真实多轮任务。

本文件只关注 **project context adequacy**，不覆盖 routing matrix 的语义分层与执行验证。

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
验证默认 minimum context 是否已经足以让 assistant：
1. 识别当前 project identity
2. 理解项目当前阶段与主线
3. 恢复当前工作态
4. 在多轮中保持项目边界
5. 知道何时需要请求更多 bucket

## Core question
Step 2 context validation 不是在问：
> “加更多 context 会不会更聪明？”

而是在问：
> “默认 minimum context 是否已经足够支撑正确边界与可工作恢复？”

## Task classes
至少覆盖三类真实任务：

### 1. Orientation
示例问题：
- 当前项目目标是什么？
- 现在在哪个阶段？
- 下一步大致要做什么？

期待：
- assistant 能从 identity + status 里答对目标与阶段
- 不混入别的项目

### 2. Resume / continuation
示例问题：
- 我们上次停在哪？
- 现在继续的话先做什么？
- 当前 pending decisions 是什么？

期待：
- assistant 能依赖 `RESUME.md` 给出正确恢复点
- 不需要默认读取 raw conversation 才能继续

### 3. Boundary retention
示例问题：
- 连续两到三轮后继续追问实现或策略细节
- 检查 assistant 是否仍保持正确项目边界

期待：
- assistant 保持在当前 project 内推理
- 不因多轮而漂移到别的 project 或旧文档噪音

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
- `collab.md`
- compacted conversation state（若未来存在）

目的：
- 判断失败是否真的来自某个 bucket 缺失
- 避免直接退回“随手多塞文档”

## Record template
每轮验证至少记录：
- case_id
- project_id
- session_key / harness session
- task_class
- mode
- injected buckets
- prompt summary
- expected traits
- observed result
- failure classification
- recommendation

## Failure classification
统一先归为：
- identity missing
- status missing
- resume missing
- optional bucket needed
- state stale
- model reasoning issue
- task framing unclear

说明：
- 不再使用笼统的 `context missing`
- 尽量把缺口定位到具体层（identity / status / resume / optional bucket）

## Acceptance rule
### Pass condition
默认 minimum context 应在大多数真实任务中支持：
- 正确项目识别
- 正确阶段判断
- 正确恢复下一步
- 多轮边界稳定

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

## Conversation-related validation note
当前约定：
- raw conversation archive 可以保留
- 但不默认注入

因此 validation 时要特别区分：
1. assistant 是真的需要 raw conversation 才能继续
2. 还是只是缺一个 compacted resume state

若观察到第 2 类问题，应优先考虑：
- 强化 `RESUME.md` schema
- 引入 explicit / semi-explicit conversation compaction

而不是直接默认注入 raw conversation。

## Deliverables
本文件对应的最小产物应包括：
1. validation cases 草案
2. context adequacy 记录模板
3. 首轮案例观察
4. 若失败，明确指出缺的是哪个 bucket

## Next step
context validation baseline 确认后，再进入：
- `step2-routing-matrix.md`
