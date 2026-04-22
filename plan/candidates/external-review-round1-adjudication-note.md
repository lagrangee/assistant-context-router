# External Review Round 1 Adjudication Note

## Purpose
记录一次基于外部 ChatGPT 评审的 Round 1 裁决结果，作为后续继续与外部评审模型讨论的稳定锚点。

本文档不替代正式 architecture / strategy truth docs，只承接：
- 哪些外部批评应吸收
- 哪些批评需要纠偏
- 哪些争议暂缓
- 下一轮评审应聚焦什么

## Review context
本轮裁决基于以下前提已被澄清：

- 当前目标用户是窄 ICP 的 internal power-user system
- 系统目标不是重做 memory / orchestration / runtime substrate
- `docs as truth` 更准确地说是 `human-governed project contract`
- docs 主要由 agent 维护，用户不是文档员
- `project` 是当前主抽象
- `main session` 是 human-facing 默认 front door
- `/project` 是 focus switch，不是 session switch
- `project session` 已收敛为 shadow lane / read model / visibility lane
- `orchestrator` 当前定位是 workflow kernel + visibility subsystem
- `replaceability` 是架构 guardrail，不是当前 Step 2 目标
- Step 2 的目标是把 seam 做实，而不是做通用平台

## Accepted

### 1. 当前系统应被明确视为 power-user system
外部评审正确指出：
- 当前最适合的定位是窄 ICP 的 internal power-user system
- 现在不应按 general product 叙事推进

这与当前系统价值判断一致。

### 2. ACR 应停留在 upper-layer contract
以下判断应吸收：
- ACR 的价值不在 primitives 层
- 不应下沉去做 memory/orchestration/runtime substrate
- 真正可能成立的新价值在 `project operations layer`

### 3. 多状态源的 authority 问题是首要风险
外部评审最重要的有效提醒是：
- docs
- orchestrator kernel
- board/work surface
- memory
- route trace
- project session

会天然形成多状态系统。

当前最危险的问题不是功能不够，而是 authority boundary 不够正式。

### 4. `project session` 不能回涨成第二个 workflow engine
这条判断已经与当前内部共识一致：
- `project session` 应保持 shadow lane / read model / visibility lane 语义
- 不应成为 orchestrator queue 或 authoritative workflow host

### 5. visibility 必须 evidence-backed
外部评审对 progress visibility 的担忧应吸收：
- 仅有 narrative progress 不足以成立
- 高信号 visibility 最好有 artifact / evidence 支撑

当前至少应把 `artifact_ref` / `evidence_ref` 作为最小候选字段持续考虑。

## Accepted With Correction

### 1. `docs as truth`
应修正为：
- 接受“docs 不应越界为 operational runtime truth”
- 不接受“你们把 docs 当 universal truth”这一读法

更准确的表达应是：

> docs 是 human-governed project contract，而不是 universal / operational truth。

### 2. secretary bottleneck 风险
外部评审关于 secretary 可能成为瓶颈的提醒有价值，但需要修正：
- 风险不是“所有 ingress 都必须穿过 secretary”
- 风险只在 ingress taxonomy 不清晰时成立

当前已明确：
- `main session` 是默认 front door
- 结构化 orchestrator ingress 推荐 `service-first`

### 3. replaceability
外部评审指出“不要为 replaceability 过早付复杂度税”是正确的，但需要修正：
- replaceability 不是架构美学摆设
- 它当前更适合作为 guardrail，而不是 Step 2 的工程主线

### 4. Feishu positioning
当前应保留：
- Feishu 作为首个 `work-tracking / work-surface adapter`

同时吸收外部提醒：
- 长期泛化层不宜简单统称为 `UI adapter`
- 更准确的说法是 `work-surface adapter`

### 5. agent-maintained docs risk
外部评审这条提醒应修正关注点：
- 风险不是用户手工维护 docs 的负担
- 风险是 agent-maintained docs 的 fidelity、漂移、review 成本

## Rejected

### 1. “基础 human override 被拖到很后面”
这条批评基于误读。

Milestone 6 更偏：
- 高级 shared/native-thread takeover collaboration

不等于：
- 基础 human override / stop / pause 要等到很后面才存在

### 2. “你们把 docs 当成 operational runtime truth”
这条批评按当前澄清后前提不成立。

docs 当前不应承载：
- queue heartbeat
- retry
- fine-grained run state
- dispatch 是否生效的唯一判断

## Deferred

### 1. `STATUS.md` / `RESUME.md` 是否长期分离
当前不宜硬裁决。

现状：
- 两者已有不同职责说明
- 但尚无足够运行证据证明是否长期有必要双对象

后续应观察：
- duplication rate
- contradictory draft rate
- save/recovery 真实使用效果

### 2. `Task / Run / Event` 是否需要升级为更细对象模型
当前不宜立即升级成：
- `WorkItem / Run / Activity / Signal / Evidence`

现阶段更稳的做法是：
- 先保留 `Task / Run / Event`
- 在 `Run` / `Event` 上保留最小 `artifact_ref` / `evidence_ref`
- 再根据真实噪音与信号分离情况决定是否进一步拆分

## Open Questions

### 1. authoritative state matrix
对每类对象需要明确：
- 谁 authoritative
- 谁 interactive
- 谁 derived
- 谁负责 writeback

### 2. secretary ingress taxonomy
需要正式回答：
- 哪些输入必须经过 secretary
- 哪些结构化动作可 direct-to-service
- 哪些事项只能通过 escalation 回主会话

### 3. evidence minimum bar
需要继续收敛：
- 哪些高信号 progress 必须附 artifact/evidence
- 哪些只算 activity
- 哪些才算 signal

### 4. work surface semantics
board/work surface 不应只在 `truth vs projection` 二分法下讨论，还需要区分：
- authoritative source
- interactive work surface
- derived read model

## Round 1 takeaway
本轮外部评审的最大价值不在于重新定义系统，而在于压实以下判断：

1. 当前系统应作为 power-user system 推进
2. ACR 必须守住 upper-layer contract，不下沉重造 substrate
3. 多状态源 authority boundary 是最优先问题
4. `project session` 应继续收窄为 shadow lane / read model
5. visibility 必须逐步转向 evidence-backed

## Next step
下一轮外部评审应聚焦：

1. authoritative state matrix
2. object authority / interaction / projection 分层
3. secretary ingress taxonomy
4. evidence-backed visibility 的最小 contract
