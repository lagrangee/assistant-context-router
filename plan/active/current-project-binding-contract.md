# Current Project Binding Contract

## Purpose
定义 Step 2 第一 authority object：`current_project_binding`。

本文档回答：
- 当前 project focus 到底是什么对象
- 它的 authoritative host 在哪里
- 谁可以修改它
- route、`/project --save`、prompt build 应如何消费它

本文档承接：
- [step2-implementation-plan.md](<repo-root>/plan/active/step2-implementation-plan.md:1)
- [step2-strategy-note.md](<repo-root>/plan/active/step2-strategy-note.md:1)

## Definition
`current_project_binding` 表示：

> 当前 `main session` 显式绑定到哪个 project，作为后续主会话解释、`/project --save` scope 与默认 route focus 的唯一 runtime-side authority。

它不是：
- project truth docs
- memory object
- board state
- route 猜测结果

## Authoritative host
当前 authoritative host 是：
- ACR runtime-side session store

当前最小宿主字段是：
- `current_project_id`
- `selected_at`
- `selected_via`
- `current_workflow`
- `updated_at`

其中真正裁 project focus 的只有：
- `current_project_id`

其余字段是 binding metadata。

## Mutation rules

### Allowed mutators
当前只允许以下路径显式修改 binding：

1. `/project <id>`
2. binding invalidation
   - 当前 binding 对应 project 无法从 registry / context 中解析
3. 后续若引入正式 `focus switch` API，也必须只是 `/project` 的结构化等价物

### Not allowed
以下路径不得 silent 修改 binding：
- route decision
- automation ingress
- project session event
- board interaction
- memory recall
- `/project --save`

## Consumer rules

### Route
- human-facing main-session route 默认消费 current binding 作为当前 project focus
- route 可以参考显式 anchor 做解释，但不得以此 silent 改写 binding
- unresolved project/action 必须 safe-fail，不能顺手改 binding

### `/project --save`
- `/project --save` 必须以 current binding 为 scope
- pending save mode / draft 必须和 current binding 一致
- 若 binding 已变化，旧 draft 必须失效或清空

### Prompt build
- main session project context injection 默认读取 current binding
- 若 binding 指向的 project 已失效，应 invalidation 并停止注入旧 project context

### Project lane helpers
- 未显式传 project id 时，可以读取 current binding 作为默认 project
- 但这只是默认值消费，不是 authority 转移

## Hard invariants
实现上必须始终成立：

1. 同一 main session 在任一时刻最多只有一个 current binding
2. `/project` 只切 focus，不切 session identity
3. route 不得 silent 改 binding
4. `/project --save` 不得跨 binding scope 写草稿
5. binding invalidation 必须可追踪，且应留下 trace

## Implementation guidance
当前实现不需要立刻重做 store schema。

更稳的做法是：
- 保留现有 `SessionProjectState`
- 通过 `CurrentProjectBinding` 语义层与 helper 统一读写

当前 helper 应至少提供：
- 从 session state 读取 binding view
- 基于 `/project` 生成 binding patch
- 判断 pending save draft 是否仍匹配当前 binding

## Out of scope
当前不在本 contract 内处理：
- business target project 解析
- multi-project active set
- project binding history
- autonomous binding guess
