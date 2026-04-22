# External Review Round 2 Authority Matrix Adjudication Note

## Purpose
记录一次基于外部 ChatGPT Round 2 authoritative state matrix 的裁决结果，回答：

- 哪些对象级裁权判断可以吸收
- 哪些地方需要修正或补充
- 哪些争议继续保留到后续讨论

本文档承接 Round 1 adjudication，不替代正式 architecture / contract 文档。

## Overall judgment
本轮外部评审质量较高，已经从“宏观批评”进入“对象级裁权”。

当前判断：
- 这份 matrix 足够作为后续 formal contract 的重要输入
- 不需要在 Round 2 再做大量争论
- 下一步应转向：
  - 将矩阵压缩成 Step 2 最小正式 contract
  - 明确 buy / build / borrow stack

## Accepted

### 1. authoritative source / interactive surface / derived read model 三分法
这是本轮最有价值的推进。

相比简单的：
- truth
- projection

三分法更适合当前系统，因为：
- board/work surface 不是纯 projection
- `project session` 是 derived host，但不是底层业务 authority
- `main session` 对某些对象是交互面，不是宿主

### 2. docs 只裁 project contract，不裁 runtime state
本轮 matrix 明确把以下对象排除出 docs authority：
- queue / runtime state
- heartbeat
- run state
- route trace
- notification record

这与当前内部共识一致，应吸收。

### 3. `current project binding` 应由 ACR runtime-side explicit state 承载
这条判断非常重要：
- `current project binding in main session` 不在 docs
- 不在 memory
- 不在 board
- 不应靠聊天文本或 route 猜测

这应作为 Step 2 第一优先 contract。

### 4. orchestrator 应裁 workflow kernel objects
以下对象 authority 放在 orchestrator kernel 的方向正确：
- task / bug / backlog item
- task status
- run / execution attempt
- current step / progress summary
- heartbeat / liveness
- queue / runtime state
- business notification record

这和当前 `service-first` 接缝设计一致。

### 5. `blocked / need_review / need_decision` 必须拆成两层对象
这是本轮最值得保留的结构判断之一：

- operational blocked / review state
  - 属于 orchestrator signal / kernel state
- persistent unresolved human obligation
  - 属于 escalation / `COLLAB.md` / cross-session collaboration object

不拆就会形成最危险的双重真相。

### 6. business notification 与 main-session escalation 必须分开
本轮 matrix 把两者拆成不同对象，这非常重要。

应继续坚持：
- business notification
  - 服务 workflow / protocol /业务沟通
- main-session escalation
  - 服务 continuity / governance / human decision

### 7. `project session shadow lane` 作为 derived host 的表述可接受
本轮对 `project session` 的表述很接近当前内部共识：
- 它对“这个读面自身的 entries”可以有 host
- 但其内容语义仍是 derived
- 它不裁 task/run/queue truth

这个说法比简单的“只是 projection”更精确。

## Accepted With Correction

### 1. project identity 的 authority 仍需机器元数据 contract
本轮把 `README.md` 作为 project identity 的语义宿主，并把 `project.yaml/manifest` 视为机器补充，这个方向合理。

但还需补一句：
- `project metadata contract` 不能长期停留在 `uncertain`
- 至少需要一个更明确的机器侧 authority 入口

否则后续：
- registry
- route
- board binding
- project-owned integration

会继续依赖软约定。

### 2. task/backlog authority 的表述应加一个范围限定
“task / bug / backlog item authority 在 orchestrator kernel”当前对 orchestrated work 是对的。

但更准确的说法应是：
- **被纳入 orchestrator scope 的 work items** 由 orchestrator authority 承载
- 不是说世界上所有项目工作对象都必须先被 orchestrator 统一托管

否则会误导成：
- ACR 项目里的所有 work item 都必须先进入 orchestrator kernel

### 3. `COLLAB.md` 的角色仍然应保持谨慎
本轮将 unresolved human obligation 持久化到 `COLLAB.md` 作为候选宿主，这个方向可以接受。

但需补充：
- `COLLAB.md` 更适合承载跨 session、跨 agent、持续 unresolved 的协作对象
- 不是所有 blocked/review 事项都应默认升格进 `COLLAB.md`

因此：
- promotion rule 必须正式化

### 4. `artifact / evidence reference` 现在先作为附属字段更稳
本轮 matrix 建议：
- artifact 内容 truth 在外部 host
- 系统内只持有 normalized `artifact_ref`

这个判断很好。

但当前不建议立刻升级成大型独立对象模型；
Step 2 更稳的做法是：
- 先把 `artifact_ref / evidence_ref` 做成 `Run/Event` 的最小字段

## Deferred

### 1. `STATUS.md` / `RESUME.md` 的长期双对象结构
本轮 matrix 给了一个较合理的裁权方式：
- `STATUS.md` = current phase
- `RESUME.md` = current mainline / next action

这可以作为当前工作性结论，但仍不应视为永久终局。

后续仍应观察：
- duplication rate
- contradiction rate
- save/recovery 实际体验

### 2. `main-session escalation store` 的具体宿主形态
本轮正确指出：
- 需要独立 escalation object

但当前 `exact host type` 仍是 `uncertain`。

这条现在先不展开成大系统。

### 3. `Task / Run / Event` 是否要继续拆成更细对象
本轮 matrix 已经足够支持当前阶段。

是否未来拆成：
- Activity
- Signal
- Evidence

仍应 defer。

### 4. work-surface 在未来是否会升级为部分 authority
对当前 Feishu-first 阶段：
- work surface 更接近 interactive surface

对未来更 agent-native surface：
- 是否会在某些对象上升级为 authority

现在仍应保留争议，不提前定死。

## Key corrections to carry forward

### 1. authority matrix 不应只有 truth/projection 二分
今后内部正式文档若要收口矩阵，应采用至少三类：
- authoritative source
- interactive surface
- derived read model

### 2. `blocked/review/decision` 需要 promotion rule
需要定义：
- 什么只留在 orchestrator
- 什么进入 business notification
- 什么进入 main-session escalation
- 什么 unresolved 时才进入 `COLLAB.md`

### 3. `project session` 应坚持 derived-first
今后任何设计若让 `project session`：
- 决定 dispatch 是否生效
- 承载 queue
- 成为 authoritative host

都应视为越界。

## Open Questions

### 1. minimal project metadata contract
需要决定：
- `README`
- `project.yaml`
- registry entry

三者谁分别裁什么。

### 2. minimal escalation record
需要一个 Step 2 足够小的 escalation object：
- id
- source
- signal kind
- target
- status
- resolution

### 3. board write-through policy
需要明确：
- board/card 的交互如何 write-through 到 orchestrator
- 哪些字段只是 surface-local

### 4. evidence minimum bar
需要继续明确：
- 哪些 progress 更新必须附 `artifact_ref`
- 哪些只算 activity

## Round 2 takeaway
本轮外部评审最值得保留的，不是又提出了多少新抽象，而是把系统里最危险的 authority conflict 明确到了对象级：

1. docs contract vs runtime state
2. task status vs run status
3. blocked signal vs unresolved human obligation
4. business notification vs main-session escalation
5. project session derived host vs authoritative host

## Next step
下一轮外部评审建议聚焦：

1. buy / build / borrow stack
2. 哪些能力直接采用现有系统
3. 哪些能力只做上层 contract
4. 接下来 1-2 个月的最小现实技术栈
