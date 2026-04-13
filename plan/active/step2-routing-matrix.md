# Step 2 Routing Matrix

## Purpose
定义 Step 2 的 routing validation matrix，用于验证 project / protocol / workflow 分层是否足够稳、是否可解释、是否能够 safe-fail。

本文件不负责定义 default project context；那部分由 `step2-project-context-definition.md` 负责。

## Position in Step 2
当前顺序应为：
1. `step2-project-context-definition.md`
2. `step2-routing-matrix.md`
3. `step2-context-validation.md` 的执行
4. 其他后续实现设计

## Routing goal
Step 2 routing 要回答的是：
1. assistant 是否能进入正确的 project boundary
2. protocol owner / business target / workflow family 是否能被正确分层
3. unresolved 场景是否能够 safe-fail
4. route trace 是否足够 explainable

当前这份 matrix 首先服务于 `proj-openclaw-feishu-orchestrator` 这类真实客户协作场景，不提前扩展为完整 execution-mode / collaboration-mode router。

## Required routing semantics
Step 2 routing 评审中必须显式区分：

### 1. Protocol owner project
谁拥有这套 protocol / runtime / contract

### 2. Business target project
这条任务真正针对哪个业务项目

### 3. Workflow family
这条任务属于哪类工作流（例如 dispatch / review / future family）

规则：
- 不能把 owner project 识别成功，误当作 business target 已解析成功
- 不能在 business target unresolved 时继续做高风险动作

## Minimum routing order
建议最小 routing 顺序为：
1. explicit `/project <id>`
2. explicit project anchor in message / payload
3. known session binding
4. protocol-family-only signal
5. unresolved -> safe-fail

## Minimum matrix
| Area | Scenario | Expected | Fail means |
| --- | --- | --- | --- |
| Routing | explicit switch | enters correct project boundary | project switch not authoritative |
| Routing | anchored request | resolves business target project | anchor resolution not enough |
| Routing | bound session continuation | keeps current project | binding or state is unstable |
| Routing | owner-only signal | resolves owner + workflow only | semantics mixed or over-routed |
| Safe-fail | unresolved target | asks / halts safely | high-risk misrouting |
| Trace | every route | route evidence is explainable | routing is not debuggable |

## Route trace requirements
每次 routing decision 应尽量能够解释：
- 为什么进入这个 project
- 是否只识别到了 owner project
- business target 是否已解析
- workflow family 是什么
- 是基于哪类证据完成 route

建议 trace 字段至少包括：
- `protocol_family`
- `protocol_owner_project`
- `business_target_project`
- `workflow_family`
- `route_evidence`
- `safe_fail_reason`（当 unresolved 时）

## Scenario classes
### 1. Explicit project switch
示例：
- 用户先 `/project foo`
- 后续任务默认应留在该 project 内

### 2. Anchored task
示例：
- 消息中包含明确 project anchor
- routing 应优先解析到 business target project

### 3. Session-bound continuation
示例：
- 没有新 anchor，但 session 已绑定 project
- routing 应保持 project continuity

### 4. Protocol-family-only signal
示例：
- 来自已知 protocol channel 或 workflow family
- 但没有明确 business target

期待：
- 最多只解析到 owner project + workflow family
- 不越权推断 business target

### 5. Unresolved / ambiguous target
示例：
- 多个候选项目
- 信息不足
- protocol owner 与 business target 可混淆

期待：
- safe-fail
- 请求更多信息或停止高风险动作

## Acceptance rule
### Routing passes when
- project boundary 解析稳定
- owner / target / workflow 不混用
- unresolved 时能保守失败
- trace 对人类与 agent 都可解释

### Routing fails when
- 错 project 继续执行
- owner project 被当作 business target
- unresolved 时仍贸然继续
- 无法解释 route 为什么成立

## Relationship to context design
routing matrix 不负责解决“context 不够”的问题。

如果 routing 失败，应先判断失败类型：
1. 是 route 错了
2. 还是 route 对了，但 default context 不足

不能把所有失败都归因为 context。

## Relationship to future implementation
本文件仍属于设计与评审层：
- 先定义 scenario / expected / fail means
- 不在当前文件里直接展开实现代码
- 不因 routing 设计直接引入 writeback 机制
- 不在当前 Step 2 中引入 ACP visible mode、native thread、shared thread governance 等 advanced collaboration 维度

## Next step
在本矩阵通过评审后，后续应：
1. 按 scenario 设计验证用例
2. 与 `step2-context-validation.md` 协同执行
3. 根据失败类型分别修正 context design 或 routing policy
