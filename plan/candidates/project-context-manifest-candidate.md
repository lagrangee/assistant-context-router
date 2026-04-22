# Project Context Manifest Candidate

## Purpose
定义一种比“大段摘要注入”更灵活的 project context 模式：

- 先给 agent 一个清楚的 **context manifest**
- 再只内联极少量关键锚点
- 让 agent 自己按 manifest 去阅读 truth docs

这份文档的目标是改善 project context block，使其更适合 OpenClaw agent (`coordinator-agent`) 这类本身具备工具读取能力的 agent。

## Core stance
OpenClaw agent (`coordinator-agent`) 不是 dumb parser。

因此 project context 注入不一定要：
- 每次都把完整摘要硬塞进 prompt

更好的方式通常是：
- 告诉它当前 project 是谁
- 告诉它应读哪些文件
- 告诉它阅读顺序和任务目标
- 再给少量 inline anchors

## Why this matters
当前 hall-doc-first recovery 已经正确，但如果长期完全依赖“摘要注入”：
- prompt 体积会逐渐变重
- debug 可视性不够好
- agent 对真实文件的主动阅读能力被浪费

而 manifest-first 模型更适合：
- 恢复工作
- save mode
- debugging
- future runtime portability

## Proposed model
### Layer A: Context manifest
轻量、结构化、注入 prompt。

建议包含：
- current project id
- current truth docs
- 默认阅读顺序
- 当前任务目标
- 默认 guardrails

示例内容：
- 当前项目：`proj-...`
- 默认 truth docs：
  - `STATUS.md`
  - `RESUME.md`
  - `README.md`
- 默认阅读顺序：
  1. `STATUS.md`
  2. `RESUME.md`
  3. `README.md`
- 当前任务：
  - 恢复工作 / save / review / strategy

### Layer B: Inline anchors
只保留少量必须立即看到的锚点，例如：
- 当前阶段
- 当前 next action
- 当前主线一句话

### Layer C: Agent self-read
agent 根据 manifest 自己去读文件，而不是要求插件预先把所有内容摘要好。

## Default truth docs
当前候选顺序：
1. `STATUS.md`
2. `RESUME.md`
3. `README.md`
4. `project.yaml` 作为 identity metadata 补充

注意：
- `execution/COLLAB.md` 不作为默认 project context source
- archive / historical docs 不作为默认 source

## Task-aware read order
不同任务可调整默认顺序。

### Resume working
1. `STATUS.md`
2. `RESUME.md`
3. `README.md`

### Save
1. 当前会话上下文
2. `STATUS.md`
3. `RESUME.md`
4. `README.md`

### Architecture review
1. `README.md`
2. architecture docs
3. `STATUS.md`

## Guardrails
manifest-first 不代表“随便让 agent 自己找”。

仍需约束：
- 当前 project 边界明确
- 默认 truth docs 明确
- 当前任务目标明确
- 不默认读取 full conversation / archive / collab object

## Benefits
### Better flexibility
agent 能根据任务自己决定读多少，而不是被固定摘要绑死。

### Better debugging
可以直接看“本轮给 agent 的 manifest 是什么”，比看长摘要更容易 debug。

### Better runtime portability
manifest-first 更适合未来切到 Hermes 或其他 secretary runtime，因为它减少了对特定 prompt-shaping 的依赖。

## Risks
### Agent may skip reading
如果 manifest 太弱，agent 可能没有真的去读关键文件。

### Inline anchors may still be needed
完全不内联任何锚点，可能会让恢复质量下降。

因此更合理的是：
- manifest first
- small anchors second

## Candidate adoption path
1. 先把 save mode frame 独立为可读对象
2. 再把 project context block 从“summary-heavy”逐步切向“manifest + anchors”
3. 通过真实 `/project` 和 `/save` 工作流验证：
   - continuity 有没有更稳
   - prompt 体积有没有下降
   - debug 是否更清楚

## Recommended next step
1. 为 project context block 定义一个当前候选 manifest shape
2. 在后续 Step 2 设计中评审是否采用 manifest-first 模型
3. 继续把 hall-doc-first 与 manifest-first 的关系写清楚，避免重新退回到重摘要模型
