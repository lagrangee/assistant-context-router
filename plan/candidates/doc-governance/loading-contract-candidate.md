# 文档加载契约候选（v1）

## Purpose
定义 `doc-governance` 主题下的 agent loading contract，回答：

- 不同任务下默认该读什么
- 哪些文档不应默认读
- 什么时候允许继续下钻
- 如何控制 token 与阅读面

上级总纲：

- [doc-governance-candidate.md](../doc-governance-candidate.md)

## Core stance
agent 的默认读取策略，不应是：

- 先扫完整个 `plan/`
- 先读某个目录下所有 peer docs
- 因为“怕漏”而一次性加载大量候选材料

更合理的默认策略应是：

- 先判断当前任务类型
- 再进入对应的最小读取路径
- 只有当前层不够回答问题时，才允许继续下钻

## Task classification prelude
在真正加载文档前，当前建议先完成一个很轻的任务分类前置步骤：

1. 判断当前任务类型
2. 识别目标 topic
3. 识别预期输出
4. 判断当前任务是否需要 provenance
5. 如果不确定，先只读 index / registry，再继续收窄

如果任务类型仍不明确，默认不应：

- 直接跳进 `plan/candidates/*`
- 直接跳进 derived notes
- 直接把 candidate host 当作 adopted truth

此时应先查：

- `docs/README.md`
- doc registry

如果一个任务同时命中多个类型，当前建议优先级为：

```text
writeback-decision
> provenance-lookup
> architecture-review
> continue-topic
> resume-working
```

## Default loading ladder
当前更推荐的默认读取阶梯是：

1. index layer
2. role-based entry docs
3. relevant canonical host
4. derived note
5. raw transcript

这五层不是默认都读，而是：

- 从上往下逐层尝试
- 在能够回答当前问题时立即停止
- 不因“可能有帮助”就自动下钻到底层

## Stop-early rule
当前最重要的读取规则是：

> once sufficient, stop loading

也就是说：

- 当前层已经足以回答问题，就停止继续读取
- 不因为还有未读文档而自动补读
- 不因为担心遗漏就扫完整个目录

但只有同时满足以下条件时，才允许 stop early：

- 当前文档对该 topic 具有明确 authority
- `doc_state` 不是 `superseded` 或 `archived`
- registry 中不存在显式冲突
- 当前任务不需要 provenance

## Default reading paths by task type

### Resume working
如果目标是“恢复当前主线并继续推进”，默认读取顺序应是：

1. `STATUS.md`
2. `RESUME.md`
3. `execution/COLLAB.md`
4. 当前主线对应的 active canonical host

默认不读：

- candidate pool 全量
- derived notes
- transcripts

补充约束：

- implementation / execution 类任务不得把 `doc_state: candidate` 的文档当作 adopted truth，除非 registry 明确标记该 topic 已 adopted

### Continue a known topic discussion
如果目标是“继续一个已经明确的话题”，默认读取顺序应是：

1. topic 对应的 canonical host
2. `RESUME.md`（如该话题影响当前主线）
3. 必要时读取与该 topic 对应的 derived note

默认不读：

- 同目录其他 peer docs
- 无关 architecture docs
- raw transcript

### Writeback decision
如果目标是“判断这轮讨论该写回哪里”，默认读取顺序应是：

1. 当前 thread 正在改变的 canonical host
2. `RESUME.md`
3. `execution/COLLAB.md`
4. 必要时读取相关 derived note

只有当来源争议较大、或需要确认原始依据时，才回看 transcript。

### Architecture / strategy review
如果目标是“判断系统边界、roadmap、长期演进”，默认读取顺序应是：

1. 相关 architecture / roadmap canonical hosts
2. 当前 candidate / adjudication doc
3. 必要时读取 supporting derived notes

默认不读：

- execution chatter
- progress-only docs
- raw transcript

### Provenance lookup
如果目标是“这个结论是怎么来的”，默认读取顺序应是：

1. canonical host 中的 source/provenance block
2. 对应 derived note
3. transcript manifest
4. raw transcript payload

这是默认允许继续下钻到 transcript 的少数场景之一。

### Open-ended exploration
如果目标只是“泛泛看看项目里有什么”，当前不建议进行全仓扫描。

默认应先读：

1. `docs/README.md`
2. `STATUS.md`
3. `README.md`

然后必须先把问题收窄，再进入具体 topic host。

## Load prohibitions
以下动作当前默认应视为禁止或强烈不建议：

- 默认扫描整个 `plan/active/`
- 默认扫描整个 `plan/candidates/`
- 因为一个问题而同时读取同层多个 peer docs
- 在未读 canonical host 前先读 derived note
- 在未读 derived note 前先读 raw transcript
- 把 transcript 当作日常恢复工作入口
- 在任务类型不明确时直接跳入 candidate host
- 把未注册文档当作 primary authority

## Escalation gates

### Gate A: Canonical -> Derived
只有在以下情况下，才应从 canonical host 下钻到 derived note：

- canonical host 无法解释当前判断的由来
- 当前需要保留 provenance
- 当前要做 adjudication / review，而不是只继续执行

### Gate B: Derived -> Transcript manifest
只有在以下情况下，才应继续读取 transcript manifest：

- derived note 无法解释来源对象
- 需要确认 source metadata
- 需要决定是否追溯原文

### Gate C: Manifest -> Raw transcript
只有在以下情况下，才应打开 raw transcript：

- 结论存在争议
- 需要确认原始措辞或上下文
- derived note 可能遗漏关键细节
- 当前任务本身就是 provenance audit / source adjudication

## Load budget guidance
当前建议给不同任务一个很粗的默认读取预算：

- `resume-working`
  - `3-4` 份文档内解决
- `continue-topic`
  - `3-4` 份文档内解决
- `writeback-decision`
  - `3-5` 份文档内解决
- `architecture-review`
  - `4-6` 份文档内解决
- `provenance-lookup`
  - 先读 `1` 份 canonical + `1` 份 derived，再决定是否继续

重点不是精确数字，而是建立默认心智：

- 小问题不应触发大阅读面
- 继续执行类任务的读取预算应明显小于研究类任务

这些预算是 soft budget，而不是硬上限。

如果某次读取超过预算，应至少说明原因，例如：

- registry conflict
- provenance dispute
- unclear canonical host
- stale / superseded suspicion

## Unregistered docs rule
对于未进入 registry 的文档，当前默认语义应是：

- 不应被视为 primary authority
- 只有在被注册文档直接引用，或被人类明确点名时，才进入读取面
- 默认不能接收 canonical writeback，除非先被注册，或在当前任务中被显式确认

## docs/README role
`docs/README.md` 适合承担：

- 人类可读的起步导航
- 常见场景的 reading order
- 门厅级文档索引

但它不应单独承担完整 loading contract。

更完整的 loading rules 仍应保留在治理候选文档或后续 registry 中。

## Current recommendation
当前更推荐的默认工作方式是：

- 先按任务类型选读取路径
- 先读 canonical host
- provenance 需求出现时再读 derived note
- 只有确实需要原始语义时才读 transcript
