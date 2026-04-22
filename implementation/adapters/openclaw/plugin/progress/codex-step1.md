# Step 1 收尾总结

## 状态
`assistant-context-router` 的 Step 1 已完成，已在本地真实 OpenClaw 运行时完成验证，可作为当前 MVP baseline 验收通过。

## Step 1 已达成范围
Step 1 已实现并验证以下能力：

- 从 `projects/index.yaml` 读取项目 registry
- `/projects` 项目列表
- `/project <id>` 项目切换
- 基于 lightweight store 的 session-owned current project state
- 最小化 project context loading
- `before_prompt_build` 的 project context 注入
- route trace primitives
- unresolved project binding 的 safe-fail invalidation

在 live validation 过程中，还补充完成了以下可用性增强：

- `/projects` 的 free-text filtering
- `/project` 的 typo-tolerant / keyword-tolerant resolution
- 通过 `before_dispatch` 处理 slash-like command
- 对 TUI 包装前缀文本的 stripping

## Live validation 结果
以下行为已在本地真实 OpenClaw 运行时确认通过：

- plugin 可以成功加载
- plugin 成功注册 `projects` 和 `project`
- `/commands` 可以看到 plugin commands
- `/projects` 可在 TUI 中成功执行
- `/project <id>` 可通过 session-aware 的 `before_dispatch` 路径成功执行
- `before_prompt_build` 已成功注册并处于活动状态

## 当前接受的 Step 1 真实工作路径
当前 Step 1 可工作的 session-aware 路径为：

`TUI message -> before_dispatch -> session-owned state write -> before_prompt_build`

这条路径是当前 tested runtime 下 `/project` 成功工作的正式路径。

## 当前已知 caveats
以下限制在 Step 1 范围内被明确接受：

- 当前 tested runtime 下，native `registerCommand(...)` handler 不能稳定拿到可用 `sessionKey`
- 因此 session-aware 的 `/project <id>` 当前依赖 `before_dispatch`
- TUI 的 slash autocomplete 不能作为 plugin command 可用性的可靠验收信号
- Step 1 只验证了 minimal context injection 路径，不等于已经证明所有真实项目协作场景下的 context adequacy 都足够

## 明确不属于 Step 1 的内容
Step 1 **不包含** 以下内容：

- protocol/project/workflow routing MVP
- 切换 project 时自动落盘上一个 project 的进展
- daemon / service-based orchestration
- custom context-engine 实现
- 完整 project memory / journaling automation

## Step 2 入口问题
Step 2 应从以下问题进入，而不是直接扩写实现：

1. 当前 minimal project context 是否足以支撑真实多轮协作？
2. 是否需要按 project type / workflow type 增加默认 context buckets？
3. 是否需要 project progress writeback？
   - 何时触发？
   - 落到哪里？
   - 自动还是显式？
4. protocol/project/workflow routing 应如何叠加，且不破坏 Step 1 的 bounded、session-owned 设计？

## 验收结论
Step 1 已可作为 `assistant-context-router` 的本地 MVP baseline 验收通过。

后续 Step 2 应建立在该 baseline 之上继续推进，并保持当前已经确认有效的几个原则：

- session-owned state
- bounded context loading
- document-driven step maintenance
- safe-fail 优先于隐式高风险行为
