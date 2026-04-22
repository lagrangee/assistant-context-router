# External Review Round 3 Stack Adjudication Note

## Purpose
记录一次基于外部 ChatGPT Round 3 buy / build / borrow stack review 的裁决结果，回答：

- 哪些技术栈判断可以直接吸收
- 哪些判断需要修正或加边界
- 下一轮应如何把讨论收敛到接下来 1-2 个月的最小推进面

本文档承接：
- Round 1 adjudication
- Round 2 authority matrix adjudication

不替代正式 architecture / implementation plan。

## Overall judgment
本轮外部评审整体质量较高，且比前两轮更“落地”。

当前判断：
- 它给出的总体技术栈 stance 是合理的
- 这轮最有价值的不是它列了多少产品，而是它持续把讨论压回：
  - 最少自研底层
  - 最少新增 authority host
  - 先把 ACR 自己该拥有的 3 个上层 contract 做硬

这轮已经足够作为：
- 当前 1-2 个月栈选择的参考
- 下一轮 Step 2 scope discipline 的前置材料

## Accepted

### 1. 接下来 1-2 个月默认不要 re-platform
这条判断应直接吸收。

当前最稳的策略是：
- 保留 current main-session/runtime baseline
- 保留 current orchestrator 作为 workflow/kernel authority
- 保留 Feishu 作为首个 work surface

不要在 Step 2 期间：
- 更换 runtime
- 引入新的 durable workflow substrate
- 再接一个 memory host

### 2. 不要额外引入 durable workflow engine
以下提醒应吸收：
- Temporal / LangGraph / Prefect 都很强
- 但当前如果再叠一层 durable substrate，只会新增 authority host

因此：
- 当前不应把它们接进主栈
- 真到 future 阶段不得不换 durable substrate 时，再比较 Temporal 等

### 3. `sessions / handoffs / tracing` 是 commodity
这条判断也值得保留：
- 这类能力已有成熟方案
- 不应自己重造

如果未来要引入新的 worker-side experiment：
- OpenAI Agents SDK 是当前最轻的候选之一

### 4. memory 现在不应进入主栈
这和当前 roadmap 一致，应吸收：
- 先把 continuity / seam / visibility 做稳
- memory backend 暂不进入主栈
- 未来如果试点，可先小范围观察 Mem0 等

### 5. visibility 最值得借的是语义和 UX bar，不是整套平台
本轮对：
- Linear Agents
- OpenHands
- Devin

的判断很有价值：
- 更适合作为 visibility semantics / UX bar
- 不适合现在直接接进 authority path

这与当前 `Task / Run / Event` + minimal `artifact_ref` 路线一致。

### 6. CLI 应作为稳定 operator boundary
这条判断应直接吸收：
- kernel 用 adapter
- agent/operator 用 CLI
- skill 包装 CLI 的使用方式

当前值得推进的是：
- 极薄的 `orchestratorctl`
- 必要时再有 `acrctl`

### 7. 有三件事必须自己做
本轮提出的“三件只能自己做的事”判断较准：

1. project contract + writeback governance
2. ACR ↔ orchestrator service-first seam
3. ACR-owned continuity control plane

这三件事确实是当前系统 thesis 所在，不能简单外包给现有框架。

## Accepted With Correction

### 1. OpenAI Agents SDK 作为 future isolated worker-side experiment
这条建议是合理的，但需补边界：
- 只适合 future isolated worker-side experiment
- 不应让 SDK types 直接成为 ACR core contract
- 也不意味着现在就应引入 SDK

换句话说：
- 这是“可放行的唯一新外部件候选”
- 不是“当前必须引入的新外部件”

### 2. Feishu 作为首个 surface 的结论基本成立，但要防止低估它的未来上限问题
本轮判断：
- 当前继续 Feishu 最现实

这点我同意。

但要补一句：
- Feishu 现在是对的，不代表未来 visibility detail 一定够用
- 下一阶段仍需验证它在 run/activity/evidence detail 上是否很快触顶

### 3. `artifact_ref` 不需要独立系统，这个判断方向对，但需要 formalize 最小 schema
外部评审建议：
- artifact truth 仍在原宿主
- 系统内只保留最小 `artifact_ref/evidence_ref`

这个方向是对的。

需要补的不是“再造 artifact 平台”，而是：
- 尽快 formalize 最小 schema
- 明确高信号事项何时必须挂 ref

### 4. “不要做自定义 progress cockpit” 这条当前成立，但要保留最小本地视图
我同意：
- 不应自己做 Devin/OpenHands 级 cockpit

但需补充：
- 不做完整 cockpit
- 不等于完全不做最小 run detail / signal view

当前 Step 2 仍需要最小可见度面。

## Deferred

### 1. 是否长期要引入 OpenAI Agents SDK
当前不宜做工程决策。

现状：
- 作为 future worker experiment 候选合理
- 但没有足够理由现在进主栈

### 2. 是否未来需要更强 durable substrate
当前 defer。

需要等：
- current orchestrator 的 durability / override / retry / recovery 能力跑出真实边界
- 再判断是否值得引入 Temporal / Prefect / LangGraph 一类 substrate

### 3. `acrctl` 是否需要和 `orchestratorctl` 同时推进
当前也 defer。

更现实的顺序可能是：
- 先做 `orchestratorctl`
- ACR 的 continuity control plane 先用最小内部接口跑通
- 再决定是否需要独立 `acrctl`

## Rejected

### 1. “当前应该引入新的外部大框架进入主路径”
这条方向当前不应采纳。

本轮外部评审本身也没有这么建议，反而明确提醒：
- 最危险的诱惑是“再加一个好框架”

这一点应作为当前阶段 hard rule。

## Key stack takeaways

### 1. 当前应坚持 boring stack
现在最有价值的不是“选一个最强框架”，而是：
- 用最 boring 的栈
- 把 authority 边界稳住
- 把上层 contract 做硬

### 2. 现有 orchestrator 是现阶段的 kernel authority
除非它真实跑出 durability 天花板，否则：
- 不要急着用外部 durable substrate 替换或包裹它

### 3. 新引入外部能力要经过更高门槛
当前允许进入主线的外部件，必须同时满足：
- 不新增 authority host
- 不把系统往 substrate 层拖
- 对 next 1-2 months 目标有直接帮助

## Open Questions

### 1. orchestrator 当前 durability 能力是否足够
这将决定未来是否需要引入 Temporal/Prefect/LangGraph 一类底层能力。

### 2. Feishu 的 visibility 上限
需要真实试跑后判断：
- 它是否很快在 run/activity/evidence detail 上触顶

### 3. CLI 最小命令面
需要继续收敛：
- `orchestratorctl` 最小要做哪些命令
- 哪些命令现在不值得做

### 4. OpenAI Agents SDK 的试点边界
如果未来要做 isolated worker experiment，需要先定义：
- 不进入主 authority path
- 不污染 ACR core contract
- 只验证 worker-side ergonomic / tracing / sessions

## Round 3 takeaway
本轮外部评审给出的最硬判断可以浓缩成一句：

> 未来 1-2 个月最重要的不是“选一个更强框架”，而是用最少新框架，把 ACR 该拥有的 3 个上层 contract 做硬。

这句判断应保留。

## Next step
下一轮外部评审建议聚焦：

1. Step 2 minimal valuable system
2. keep / defer / drop list
3. must-have contracts before implementation
4. should-not-do list
5. 最小 evidence-backed visibility 范围
