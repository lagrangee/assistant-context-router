# Step 2 Gate 5 Escalation Hygiene Checklist

## Purpose
验证 Cut 4A / 4B 之后，`business notification` 与 `main-session escalation` 是否真的完成了最小分流，而不是继续互相污染。

这份 checklist 只关注你作为 human/operator 的真实体验，不验证底层实现细节本身。

通过标准不是“功能全都有”，而是：
- business/work side 能看到该看的高信号
- main session 只保留真正需要 project owner/coordinator agent 介入的事项
- secretary 不会因为 escalation 机制把主会话重新变成噪音入口

## Test setup
建议测试前保证：

1. 当前已经绑定到目标 project
   - 对 `demo-acr`，直接发送：
     - [<demo-acr-root>/validation/messages/01-project-focus.txt](<demo-acr-root>/validation/messages/01-project-focus.txt)
2. 有一条能够触发 service-first 路径的真实或模拟工作流动作
3. Feishu/work surface 可见
4. main session 可继续对话

如果你使用 `demo-acr` 做人工演练，优先看：
- [<demo-acr-root>/validation/gate5-escalation-rehearsal.md](<demo-acr-root>/validation/gate5-escalation-rehearsal.md)
  - 其中已包含一张 `demo-acr -> ACR -> OpenClaw` 的 Mermaid 业务流图

注意：
- `append_project_note` 只依赖 `project_session` delivery
- `demo-acr` 当前已通过 `router.yaml -> service_binding.runtime_kind=validation_fixture` 接上 validation-only service harness
- 只要当前 coordinator-agent 环境加载的是最新 ACR OpenClaw plugin，这三个 service 场景就不再需要你手工拼装 handler

## Scenario 1 — `review_request` 只留在 business/work side

### 操作
1. 发送：
   - [<demo-acr-root>/validation/messages/02-review-request.txt](<demo-acr-root>/validation/messages/02-review-request.txt)
2. 再发送：
   - [<demo-acr-root>/validation/messages/06-ask-attention.txt](<demo-acr-root>/validation/messages/06-ask-attention.txt)

### 预期
- business/work side 能看到 review 请求
- main session **不会**因为这个 review request 自动出现高优先级治理提示
- secretary 仍能继续正常项目对话，不会一上来就被 review 噪音打断

### 失败信号
- main session 被 review request 自动污染
- 你明明没有被要求拍板，但主会话先跳出来要你处理 review

## Scenario 2 — `blocked + human decision` 必须进入 main session

### 操作
1. 发送：
   - [<demo-acr-root>/validation/messages/03-blocked-human-decision.txt](<demo-acr-root>/validation/messages/03-blocked-human-decision.txt)
2. 再发送：
   - [<demo-acr-root>/validation/messages/06-ask-attention.txt](<demo-acr-root>/validation/messages/06-ask-attention.txt)

### 预期
- business/work side 仍能看到 blocked 信号
- main session 会出现 unresolved escalation 提示
- 提示内容能让你快速知道：
   - 哪个 project
   - 什么 signal
   - 为什么需要你
   - 最好还能带 trace 或简短 summary

### 失败信号
- business side 看到了 blocked，但 main session 完全无感
- main session 有提示，但看不出为什么需要你拍板
- 提示里充满底层技术噪音，而不是治理信息

## Scenario 3 — `high_signal_completion` 不应自动升级主会话

### 操作
1. 发送：
   - [<demo-acr-root>/validation/messages/04-high-signal-completion.txt](<demo-acr-root>/validation/messages/04-high-signal-completion.txt)
2. 再发送：
   - [<demo-acr-root>/validation/messages/07-general-project-question.txt](<demo-acr-root>/validation/messages/07-general-project-question.txt)

### 预期
- business/work side 可以看到完成类高信号
- main session 默认不被 completion 刷屏
- 只有当你主动问项目状态或需要收口时，secretary 才引用它

### 失败信号
- 每次完成都自动把主会话变成通知面板
- completion 和 decision/blocker 一样抢占主会话注意力

## Scenario 4 — 重复 blocker 不应无限堆叠 unresolved escalation

### 操作
1. 先发送：
   - [<demo-acr-root>/validation/messages/03-blocked-human-decision.txt](<demo-acr-root>/validation/messages/03-blocked-human-decision.txt)
2. 再发送：
   - [<demo-acr-root>/validation/messages/05-blocked-human-decision-repeat.txt](<demo-acr-root>/validation/messages/05-blocked-human-decision-repeat.txt)
3. 最后发送：
   - [<demo-acr-root>/validation/messages/06-ask-attention.txt](<demo-acr-root>/validation/messages/06-ask-attention.txt)

### 预期
- main session 看到的是“同一 unresolved obligation 仍然存在”
- 不应该出现多条几乎重复的 escalation 反复刷屏

### 失败信号
- 每触发一次同类 blocker，main session 就长出一条新的未决事项
- 你明显感觉 escalation store 在无意义膨胀

## Scenario 5 — 不相关对话不应被 escalation 过度打断

### 操作
1. 先让 Scenario 2 或 Scenario 4 留下 unresolved escalation
2. 发送普通项目问题：
   - [<demo-acr-root>/validation/messages/07-general-project-question.txt](<demo-acr-root>/validation/messages/07-general-project-question.txt)
3. 再发送明确 asking-for-attention 的问题：
   - [<demo-acr-root>/validation/messages/06-ask-attention.txt](<demo-acr-root>/validation/messages/06-ask-attention.txt)

### 预期
- unresolved escalation 应该作为 governance hint 出现
- 但它不应压过 project truth/docs context 本身
- 普通对话时提示应克制
- 明确 asking-for-attention 时提示应更有存在感

### 失败信号
- escalation block 比项目上下文还长、还抢眼
- 每轮主会话都像被“告警系统”劫持

## Pass criteria
当以下 4 条都成立时，Gate 5 可判为通过：

1. `review_request` 默认停留在 business/work side，不自动污染 main session
2. 真正需要 human decision 的 `blocked` 能稳定回到 main session
3. completion 类高信号不会默认刷主会话
4. unresolved escalation 是可读、可理解、不会无限重复堆叠的

## If it fails
如果测试中失败，优先记录失败属于哪一类：

- `wrong promotion`
  - 不该进 main session 的进来了
- `missing promotion`
  - 应该回 main session 的没回来
- `poor readability`
  - 回来了，但人看不懂
- `duplicate escalation`
  - unresolved item 反复堆叠
- `prompt pollution`
  - escalation 抢走了主会话上下文

记录时尽量保留：
- 触发动作
- project
- 你看到的 business/work side 表现
- 你看到的 main session 表现
- 你主观上觉得“烦”还是“刚好”的原因
