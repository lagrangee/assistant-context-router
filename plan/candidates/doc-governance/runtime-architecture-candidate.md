# 文档治理运行时架构候选（v1）

## Purpose
定义 `doc-governance` 主题下的 runtime / implementation architecture，回答：

- 文档规则如何变成可运行工具链
- `capture plugin`、canonical spool、aggregator、transcript builder 如何协作
- authority discovery 如何实现
- header / registry 漂移如何被检测
- transcript / derived note / canonical host 的 provenance 链如何落地

上级总纲：

- [doc-governance-candidate.md](../doc-governance-candidate.md)

## Current implementation stance
当前推荐的实现策略不是“从零重写一切”，而是：

- 复用 `inbox-archiving` 的工程模式
- 保留并升级现有 `inbox-capture-plugin`
- 保持 `memory/inbox` 现有效果不退化
- 为 doc-governance 新增 transcript builder / registry resolver / drift linter

一句话说：

```text
reuse architecture pattern
> preserve current inbox archive output
> add new doc-governance-specific builders and validators
```

## Reuse decision
当前建议把现有 `inbox-archiving` 链路拆成“可复用的模式”和“不能直接复用的最终对象”两部分。

### Reuse as-is or with small adaptation

- OpenClaw `inbox-capture-plugin`
- append-only canonical event spool
- pure-code aggregator discipline
- dual filtering
- fail-closed
- date-level lock / concurrency protection

### Rebuild for doc-governance

- transcript archive object builder
- registry-driven authority resolver
- registry/header drift linter
- derived note scaffold

### Keep agent-led

- derived note adjudication
- canonical host writeback
- adoption pointer placement

## Runtime chain
当前推荐的运行时主链路是：

```text
OpenClaw capture plugin v2
-> canonical event spool v2
-> daily inbox aggregator (compat path)
-> transcript builder (new path)
-> transcript archive object
-> derived note generation
-> canonical host writeback
```

说明：

- `daily inbox aggregator` 与 `transcript builder` 是两个并行 consumer
- 两者都消费 canonical spool，但产物不同
- `memory/inbox` 继续服务日常记忆归档
- transcript archive object 服务 provenance 与 doc-governance

### Operational default
运行时默认不要求每次都生成 derived note。

更准确地说：

- transcript capture 与 transcript archive object 应尽量自动化和结构化
- derived note 应保持稀疏，只在需要中间压缩层时由 agent 生成
- canonical host writeback 继续作为多数 thread 的主要终点

## Component ownership

### 1. Capture plugin
职责：

- 监听 OpenClaw runtime 的 canonical capture hooks
- 过滤已知 automation / system 噪音
- 将 canonical visible text append 到 event spool

非职责：

- 不直接生成 transcript archive
- 不直接生成 derived note
- 不直接写 canonical hosts

当前结论：

- 允许直接升级现有 plugin
- 不新建第二个平行 capture plugin
- 升级必须保持对现有 aggregator 的兼容

### 2. Canonical event spool
职责：

- 作为 append-only 的 runtime canonical ingest substrate
- 同时服务 memory/inbox 与 transcript builder

非职责：

- 不是最终 transcript archive
- 不是 derived note
- 不是 canonical truth

### 3. Daily inbox aggregator
职责：

- 继续生成 `memory/inbox/YYYY-MM-DD.conversation.log`
- 保持当前日级 inbox 归档效果

约束：

- 输出 contract 应保持稳定
- 不依赖 transcript builder 才能运行
- 允许适配 event spool v2，但不改变主产物职责

### 4. Transcript builder
职责：

- 从 canonical event spool 生成 transcript archive object
- 把按天的 runtime spool 升格为按 conversation / session 组织的 provenance object

约束：

- 纯代码实现
- 不调用 LLM
- 不做总结式改写
- 输出 `manifest.yaml + messages.jsonl (+ attachments/)`

## Runtime-specific ingest adapters
当前不建议把“conversation/session 的提取保存”设计成单一实现。

更稳妥的做法是：

- 每个 runtime 各自有 ingest adapter
- 统一归一到同一套 canonical event spool / transcript builder 契约

### OpenClaw

- 使用 plugin hook capture
- 直接写 canonical event spool
- 保持与现有 daily inbox aggregator 的兼容

### Codex

- 若存在稳定 thread / message export 或官方 hook，优先使用官方接口
- 若没有稳定 hook，则在 invocation boundary 做 wrapper capture
- wrapper 负责记录：
  - user input
  - assistant visible output
  - timestamp
  - thread/session ref（若可得）
  - message/run ids（若可得）

### Claude Code

- 若存在稳定 session/run export，优先做 export adapter
- 若没有，则在 CLI / invocation boundary 做 wrapper capture
- 保持 `source_ref_kind/source_ref` 的原生语义

### Generic fallback

- official export importer
- human-triggered manual import

不建议作为主路径的做法：

- transcript scan
- internal DB scan
- screen scraping
- 依赖本地 UI 私有存储结构

### 5. Derived note generator
职责：

- 为 agent 提供稳定模板或脚手架
- 承接 transcript archive 与 canonical writeback 之间的中间层

约束：

- 主要由 agent 填充
- 可以有 scaffold helper
- 不建议全自动生成最终 note 内容

### 6. Canonical host writeback
职责：

- 将 adopted 结论写入 canonical host
- 在必要时加入轻量 `adopted_from` pointer

约束：

- 保持 adjudication 在 agent 侧
- 不直接由 plugin 或 builder 自动完成

### 7. Registry resolver
职责：

- 根据 task type / topic hint / output kind 解析 authority
- 返回默认读取路径与 stop-early 依据

约束：

- 纯代码实现
- 以 `docs/doc-registry.yaml` 为 machine authority

### 8. Drift linter
职责：

- 检查 registry 与 header 的漂移
- 检查 topic authority invariant
- 检查 path / doc_id / link discipline

约束：

- 先做 repo-local script
- 可后续接 `/save`、writeback、CI

## Event spool v2
为了让 plugin 一步到位升级，同时不破坏现有 aggregator，当前建议 event spool 采用“保留旧字段 + 新增可选字段”的 v2 策略。

### Compatibility rule

- 现有必需字段保持不变
- 不删除现有字段
- 新能力通过新增字段表达
- aggregator 必须继续接受只含 v1 字段的旧行
- aggregator 也必须接受含 v2 扩展字段的新行

### Retained v1 fields

- `ts`
- `date_shanghai`
- `sessionKey`
- `channel`
- `role`
- `text`
- `messageId`（可选）
- `sourceEvent`
- `dedupeKey`

### Added v2 fields

- `source_system`
- `capture_version`
- `account_id`（可选）
- `conversation_id`（可选）
- `source_ref_kind`
- `source_ref`
- `project_hint`（可选）

### Suggested example

```json
{
  "ts": "2026-04-21T10:18:55.000Z",
  "date_shanghai": "2026-04-21",
  "sessionKey": "agent:human:router-design",
  "channel": "webchat",
  "role": "assistant",
  "text": "我们可以把 registry resolver 做成纯代码工具。",
  "messageId": "msg_123",
  "sourceEvent": "before_message_write",
  "dedupeKey": "webchat:msg_123:assistant",
  "source_system": "openclaw",
  "capture_version": 2,
  "account_id": "acct_abc",
  "conversation_id": "conv_xyz",
  "source_ref_kind": "session",
  "source_ref": "agent:human:router-design"
}
```

### Why v2 is needed

- transcript builder 需要稳定 conversation/session grouping 依据
- provenance object 需要来源系统信息
- `conversation_id` 不能继续只存在内存 hint 中
- 未来多 runtime adapter 需要同一套 ingest substrate

## Event-to-project routing
由于 archive namespace 按 `project_id` 分子空间，而 runtime event 默认只知道 conversation/session，所以当前建议明确一层 `event -> project` 路由契约。

### Routing precedence

1. explicit `project_hint`
2. runtime/session mapping rule
3. current workspace / invocation context
4. human override

### Required outcome

- transcript builder 在 finalize transcript object 前，必须得到稳定 `project_id`
- 如果无法唯一确定 `project_id`，builder 不应静默归档到默认项目
- 无法判定时，应进入待确认状态，而不是生成误归档 transcript

### Suggested fallback behavior

- mark as `unresolved_project`
- keep canonical event in spool
- require manual adjudication or explicit override before archive write

## Capture plugin v2
当前建议直接修改现有 plugin，而不是新建第二套实现。

### Required changes

1. 将 `conversationId / accountId` 真正写入 spool
2. 写入 `source_system / capture_version / source_ref_kind / source_ref`
3. 去掉硬编码 workspace root，改为配置或环境变量驱动
4. 保持现有过滤与 dedupe 逻辑的总体语义

### Non-goals for plugin

- 不在 plugin 内生成 transcript manifest
- 不在 plugin 内决定 derived note
- 不在 plugin 内判断 canonical writeback host

### Compatibility promise

- 仍然写到现有 canonical spool 位置
- 旧 aggregator 不应因新增字段而失效
- 若新增字段缺失，builder 可降级，但 plugin v2 应尽量补齐

## Aggregator adaptation
当前建议对现有 aggregator 做一轮很小的兼容性升级，而不是重写。

### Must preserve

- 输出路径仍为 `memory/inbox/YYYY-MM-DD.conversation.log`
- 输出主体仍然是日级 conversation log
- 仍然保留 lock / fail-closed / noise filtering discipline

### Recommended changes

1. 显式接受 event spool v2 的新增字段
2. 如新增字段存在，可做轻量校验，但不要求必须用于输出
3. 保持当前头部与正文格式稳定
4. 不把 transcript builder 变成前置依赖

### Important boundary

- inbox aggregator 的目标是日常 inbox archive
- transcript builder 的目标是 provenance-grade transcript object
- 两者共享输入，不共享最终输出模型

## Transcript builder
这是 doc-governance 需要新增的核心工具。

### Responsibility

- 消费 canonical event spool
- 将按天 event 升格为按 conversation / session 的 transcript archive object
- 输出到 repo 外 archive root

### Grouping precedence
当前建议按以下优先级分组：

1. `source_system + conversation_id`
2. `source_system + source_ref_kind + source_ref`
3. `source_system + sessionKey + date_shanghai`（降级 fallback）

### Output shape

- object directory
- `manifest.yaml`
- `messages.jsonl`
- 可选 `attachments/`

### Manifest responsibilities

- `project_id`
- `source`
- `source_ref_kind`
- `source_ref`
- `captured_at`
- `title`
- `summary`（可为空或后补）
- payload 指针
- 可选 `derived_notes`

### Important constraint

- transcript builder 是结构升格器，不是总结器
- 它不负责生成 derived note
- 它不直接 touching canonical host

## Derived note generation
当前建议 derived note 继续由 agent 主导，但给它一个更稳定的脚手架入口。

### Recommended flow

1. transcript builder 生成 archive object
2. agent 按需读取 manifest / selected messages
3. agent 生成或更新 derived note
4. derived note 挂 source refs
5. 后续如被吸收，则写入 `note_state` / `canonicalized_to`

### Trigger conditions

- provenance 未来高概率需要回看
- 一次讨论包含多个 competing positions
- 当前还没形成 adopted truth
- 当前 review / adjudication 值得保留中间层

### Non-goal

- 不追求“每次有 transcript 就自动产 note”
- 不追求 LLM 自动批量总结全部 raw transcript
- 不让 agent 默认同时写 Layer 2 与 Layer 3

## Canonical host writeback and adoption pointer
当前建议 canonical writeback 继续由 agent 负责。

### Why agent-led

- 写回动作本质是 adjudication
- 需要判断哪些结论 adopted、哪些 deferred、哪些 rejected
- 纯代码工具不适合做这种语义决策

### Minimal provenance link
当前建议 canonical host 最多保留一个轻量 adoption pointer，例如：

```yaml
adopted_from:
  - derived_note_id: doc-governance-review-round4
    adopted_at: 2026-04-21
```

原则：

- canonical host 不挂长 provenance
- 详细来源保留在 derived note
- raw transcript 默认通过 derived note 间接可达

## Registry-driven authority discovery
当前建议 authority discovery 明确做成一层工具，而不是让 agent 每次自己推断。

### Input

- `task_type`
- `topic_hint`
- `output_kind`
- 可选 `current_doc`

### Output

- primary host
- candidate supporting hosts
- prerequisites
- read_next
- stop-early eligibility

### Source of authority

- `docs/doc-registry.yaml`

### Delivery form

- 先做 repo-local script
- 后续可加 skill wrapper
- 默认不做 plugin

### Candidate-only topic behavior
如果某个 topic 在 registry 中只有 `candidate` 文档、没有 `adopted primary`，resolver 不应伪装返回一个可执行 truth host。

当前建议：

- 对 execution / implementation 类任务：返回 `no adopted primary`
- 对 review / planning 类任务：返回 candidate set，并显式标记为 non-authoritative
- 对 writeback-decision：要求人工确认是更新 candidate host，还是先升格 adopted host

原则是：

- candidate host 可以被读
- 但不能在没有显式说明时被当作 adopted execution truth

## Header / registry drift handling
当前建议把漂移处理做成 linter，而不是依赖人工自觉。

### Minimum checks

1. `doc_id` 唯一
2. `path` 为 repo-relative 且文件存在
3. 同一 topic 只有一个 `primary + adopted`
4. `candidate` 不能被视为 adopted execution truth
5. header 与 registry 的 `Role / Authority / Read next` 语义一致
6. 文档内部 child links 使用 repo-relative link

### Suggested run points

- `/save` 前后
- canonical writeback 后
- PR / CI 中

## Implementation carrier decisions
当前建议各层载体如下：

### Plugin

- 只负责 raw capture
- 只做 runtime adapter

### Pure-code tools

- inbox aggregator
- transcript builder
- registry resolver
- drift linter

### Skill wrappers

- 可选包装 resolver / linter / transcript builder
- 作用是方便 agent 调用，不替代底层工具

### Agent

- derived note adjudication
- canonical host writeback
- adoption pointer placement

## Rollout order
当前推荐的实现顺序是：

1. 升级 `capture plugin` 到 event spool v2
2. 小改 `aggregator`，确保 `memory/inbox` 效果不退化
3. 新建 transcript builder v1
4. 新建 derived note scaffold
5. 新建 registry resolver v1
6. 新建 drift linter v1

## Phased runtime rollout
当前更推荐按 runtime 与能力范围分阶段推进，而不是一开始就把所有 agent tool 一起接入。

### Phase 1: OpenClaw-first baseline

目标：

- 以 OpenClaw 为参考 runtime，跑通 `capture -> spool -> aggregator -> transcript builder`
- 保持 `memory/inbox` 效果不退化
- 证明 transcript archive object 与 canonical writeback 可以共存

### Phase 2: Second runtime adapter

目标：

- 在 OpenClaw baseline 稳定后，再接入第二个 runtime adapter
- 候选优先级可在 `Codex` 与 `Claude Code` 之间再判断
- 验证 multi-runtime ingest model 是否真的足够统一

### Phase 3: Tooling hardening

目标：

- 将 resolver / linter 挂到 `/save`、writeback、CI
- 视需要补 attachment handling、manual import、更多 runtime adapter

## Phase 1 implementation backlog
当前建议把第一阶段实现拆成 5 个工作包。

### Work package A: Capture substrate v2

Goal:

- 升级现有 `inbox-capture-plugin`
- 产出兼容 v1 的 canonical event spool v2

Deliverables:

- plugin v2 设计确认
- event spool v2 字段契约
- 配置化 workspace/archive root 方案

Acceptance:

- 新事件能写出 v2 扩展字段
- 旧字段不丢失
- 去重与噪音过滤语义不退化

### Work package B: Aggregator compatibility patch

Goal:

- 让现有 inbox aggregator 接受 v2 event
- 保持 `memory/inbox` 现有 contract 稳定

Deliverables:

- aggregator compat patch
- v1/v2 event 兼容规则
- 回归检查样例

Acceptance:

- 旧 v1 event 仍可生成 conversation log
- 新 v2 event 也可生成 conversation log
- 输出路径、头部字段、正文格式不退化

### Work package C: Transcript builder v1

Goal:

- 从 canonical event spool 生成 transcript archive object

Deliverables:

- transcript builder CLI / script
- object directory layout
- `manifest.yaml + messages.jsonl` 输出

Acceptance:

- 同一 conversation 可稳定聚合
- transcript object 可从 source refs 追溯回来
- builder 不依赖 LLM

### Work package D: Registry tooling baseline

Goal:

- 让 authority discovery 从“文档约定”进入“可执行工具”

Deliverables:

- 最小 `docs/doc-registry.yaml`
- resolver v1
- drift linter v1

Acceptance:

- resolver 能返回 primary host / prerequisites / read_next
- linter 能检查唯一 adopted primary、repo-relative path、header drift
- 未注册文档不会被误当作 primary authority

### Work package E: Agent authoring baseline

Goal:

- 让 agent 对 derived note 与 canonical writeback 有稳定落点与模板

Deliverables:

- derived note scaffold
- adoption pointer 最小约定
- writeback examples

Acceptance:

- agent 不需要每次都写 derived note
- 需要 derived 时有统一模板
- canonical host 最多保留轻量 provenance pointer

## Work package dependencies
当前依赖关系建议如下：

```text
A Capture substrate v2
-> B Aggregator compatibility patch
-> C Transcript builder v1

C Transcript builder v1
-> E Agent authoring baseline

D Registry tooling baseline
can proceed in parallel with C
```

说明：

- `A + B` 共同构成 OpenClaw-first capture baseline
- `C` 证明 provenance-grade transcript object 可行
- `D` 与 `C` 可并行推进，因为一个服务 authority discovery，一个服务 transcript 升格
- `E` 应建立在 `C` 的 transcript object 已经稳定可用之后

## Phase 1 non-goals
当前第一阶段明确不追求：

- 一次性接入所有 runtime
- 自动生成所有 derived note
- 完整 attachment pipeline
- 复杂 provenance graph
- CI 全量门禁
- registry 多文件拆分

## Scheduling recommendation
如果按排期视角收口，当前更推荐的切法是：

1. Milestone A: OpenClaw capture compatibility
2. Milestone B: transcript builder baseline
3. Milestone C: registry tooling baseline
4. Milestone D: agent authoring baseline

## Phase 1 scheduling candidates
为了让 `Phase 1 implementation backlog` 能直接进入排期讨论，当前建议把第一阶段进一步收成 4 个可评审的 scheduling candidates。

### Candidate S1: OpenClaw capture compatibility baseline

Current status:

- 已于 2026-04-21 升格到 active planning host：
  - [doc-governance-openclaw-capture-baseline.md](../../active/doc-governance-openclaw-capture-baseline.md)

Scope:

- `Work package A: Capture substrate v2`
- `Work package B: Aggregator compatibility patch`

Why now:

- 这是所有后续 runtime tooling 的输入基线
- 不先稳住 `capture -> spool -> aggregator`，后续 transcript builder 无法可靠验证
- 这一项还能最早暴露“升级 plugin 是否会破坏 `memory/inbox`”的真实风险

Complexity:

- `medium`

Key dependencies:

- 无前置实现依赖
- 需要同时理解现有 `inbox-capture-plugin` 与 `inbox-archiving` aggregator contract

Main risks:

- plugin v2 新字段影响现有 aggregator
- workspace / archive root 配置化可能引入新的环境差异
- 噪音过滤与 dedupe 语义在升级后退化

Recommended output:

- 一个稳定的 OpenClaw-first capture baseline
- 明确的 v1/v2 spool compatibility 约定

Promotion trigger:

- 当项目准备从纯设计进入最小 runtime 原型时，应优先升格这一项

### Candidate S2: Transcript builder baseline

Scope:

- `Work package C: Transcript builder v1`

Why now:

- 这是 doc-governance runtime 与现有 `memory/inbox` 链路真正分叉的关键能力
- 它决定 raw transcript 是否能稳定进入 archive object，并支撑 provenance 链

Complexity:

- `medium-large`

Key dependencies:

- 依赖 `Candidate S1` 先稳定 canonical event spool v2

Main risks:

- conversation / session grouping 不稳定
- `event -> project_id` 路由规则在真实数据中出现歧义
- builder 输出 object model 过早绑死，影响后续多 runtime 接入

Recommended output:

- `manifest.yaml + messages.jsonl` 的 transcript object baseline
- 一条从 source refs 回溯 transcript 的最小验证样例

Promotion trigger:

- 当 `S1` 已证明新 capture substrate 不退化时，应优先开启这一项

### Candidate S3: Registry tooling baseline

Scope:

- `Work package D: Registry tooling baseline`

Why now:

- 设计层已经把 authority discovery 和 drift handling 定成核心约束
- 如果没有 resolver / linter，registry 仍然只是纸面契约，无法真正约束 agent 行为

Complexity:

- `medium`

Key dependencies:

- 可与 `Candidate S2` 并行
- 需要先从当前设计文档中收出最小 `docs/doc-registry.yaml`

Main risks:

- registry schema 过早做重
- resolver 对 candidate-only topic、unregistered docs 的行为实现不一致
- header / registry sync 规则只停留在说明层，未转成校验逻辑

Recommended output:

- 最小 registry 样本
- resolver v1
- drift linter v1

Promotion trigger:

- 当项目需要把 loading / writeback 从“靠 agent 自觉”推进到“有工具约束”时，应升格这一项

### Candidate S4: Agent authoring baseline

Scope:

- `Work package E: Agent authoring baseline`

Why now:

- runtime substrate 就绪后，agent 仍然需要稳定的 derived note / adoption pointer / writeback 范式
- 如果没有这一层，runtime data 虽然存在，但仍无法稳定进入 canonical hosts

Complexity:

- `small-medium`

Key dependencies:

- 依赖 `Candidate S2` 至少提供可用 transcript object
- 最好与 `Candidate S3` 同步对齐 registry / authority 约束

Main risks:

- derived note 再次膨胀成默认必写层
- canonical host 写回示例不够克制，导致重复维护 provenance
- agent 模板过重，反而增加 token 和写回负担

Recommended output:

- 稀疏 derived note scaffold
- 最小 adoption pointer 约定
- 几个可直接复用的 writeback examples

Promotion trigger:

- 当 transcript object 已可用，且项目准备让 agent 在真实线程里开始依赖 provenance 路径时，应开启这一项

## Recommended sequencing
按当前风险和依赖关系，更推荐的排期顺序是：

1. `S1 OpenClaw capture compatibility baseline`
2. `S2 Transcript builder baseline`
3. `S3 Registry tooling baseline`（可与 `S2` 并行，但不应晚于 `S2` 太多）
4. `S4 Agent authoring baseline`

如果资源受限，当前最小可行切法是：

- 先做 `S1`
- 再做 `S2`
- 然后在 `S3` 与 `S4` 之间优先选择更能解除当前阻塞的一项

## Current scheduling stance
当前更推荐的判断不是“立刻一次性实现 Phase 1 全部能力”，而是：

- `S1` 已被选为第一优先级，并已升格到 active planning host
- 用 `S1` 的结果决定 `S2` 的实际切分
- 将 `S3` 视为把文档契约落成 runtime discipline 的关键并行项
- 将 `S4` 保持在 transcript object 真正确立后再升格

## Acceptance gates
进入真正实现前，当前建议至少满足：

### Gate A: Plugin / aggregator compatibility

- plugin v2 写出的 event，旧 aggregator 仍能产出可接受结果
- 或 aggregator v2 明确兼容 v1/v2 event
- `memory/inbox` 产物不退化

### Gate B: Transcript object viability

- 同一 conversation 能稳定聚合进一个 transcript object
- manifest 与 messages payload 可重建来源链

### Gate C: Provenance chain viability

- transcript -> derived note -> canonical host 至少能一跳一跳追溯

## Current recommendation
当前最值得坚持的实现原则是：

- 复用 `inbox-archiving` 的工程模式
- 直接升级现有 capture plugin，而不是再造平行 capture 链
- 让 aggregator 保持 `memory/inbox` 稳定
- 为 doc-governance 新增 transcript builder / resolver / linter
- 让 derived note 与 canonical writeback 继续保持 agent-led
