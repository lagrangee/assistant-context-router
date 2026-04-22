# Minimal Visibility Evidence Contract

## Purpose
定义 Step 2 当前在 ACR repo 内正式支持的最小 visibility / evidence 边界。

本 contract 只回答：
- ACR 现在如何承接高信号 execution projection
- `artifact_ref` 如何沿现有 signal 链路透传

它不回答：
- orchestrator 的完整 `Task / Run / Event` 宿主模型
- Feishu / board 的最终字段或 UI 呈现方式
- artifact 内容存储、解析或下载

## Position
当前 Step 2 里：
- workflow truth 仍在 orchestrator / service runtime
- docs truth 仍在 `README.md / STATUS.md / RESUME.md / COLLAB.md`
- ACR 只承接：
  - signal projection
  - optional `run_id / queue_ref`
  - optional `artifact_ref`
  - concise execution summary

也就是说，ACR 当前支持的是：
- **high-signal execution projection**

而不是：
- full task store
- full run store
- board state host
- artifact content host

## Minimal object shape
当前最小 evidence 对象为单个 `artifact_ref`。

字段只保留：
- `kind`
- `label`
- `target`

约束：
1. `artifact_ref` 当前只允许单个，不做数组
2. `artifact_ref` 是 pointer，不是 artifact body
3. `artifact_ref` 可以缺省，缺省不影响原有 signal 逻辑

## Carry-through rule
若 service result 提供 `artifact_ref`，ACR 当前应沿以下链路透传：

1. `ServiceResult`
2. `project session lane event`
3. `business notification record`
4. `main-session escalation record`
5. execution-facing prompt hints
6. `/project --lane` summary

当前不要求透传到：
- docs truth
- save/writeback draft
- Feishu adapter

## Read-model rule
`artifact_ref` 当前只服务于 read model / evidence hint。

它的职责是：
- 让 human/agent 知道高信号事项后面是否有一个可追的 evidence pointer
- 为后续 Feishu/work-surface projection 预留稳定接口

它不负责：
- 决定 signal promotion
- 决定 escalation 是否成立
- 决定 docs 是否应写回

## Prompt and lane rule
当前只允许在已经存在的 execution-facing 读面里显示 `artifact_ref`：

1. `/project --lane`
2. `before_prompt_build` 的 lane summary
3. `before_prompt_build` 的 unresolved escalation block

限制：
- 不新增新的 prompt 注入入口
- 不因为有 `artifact_ref` 就扩大 lane summary 的注入范围
- 不把 `artifact_ref` 自动升级成 main-session interruption

## Step 2 acceptance
Cut 6 在以下条件下算通过：
1. `artifact_ref` 不引入新的 authority host
2. 高信号 service result 可稳定携带单个 `artifact_ref`
3. lane / notification / escalation / prompt hint 都能保留它
4. 没有 `artifact_ref` 的旧路径继续正常工作
5. 普通项目问答仍不因 visibility/evidence 而被污染
