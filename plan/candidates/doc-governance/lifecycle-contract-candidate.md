# 文档生命周期契约候选（v1）

## Purpose
定义文档在当前项目中的默认生命周期规则，回答：

- 什么时候允许新增文档
- 什么时候必须更新原宿主
- 什么时候应该 merge
- 什么时候才 archive

本文档当前是 `doc-governance` 主题下的 lifecycle 子契约。

上级总纲：

- [doc-governance-candidate.md](../doc-governance-candidate.md)

## Core stance
默认不应通过“继续新开文档”来承接讨论。

默认优先级应是：

```text
update existing host
> update/create derived note
> create new canonical host
> archive superseded docs
```

也就是说：

- 已有宿主，先更新宿主
- 还不是正式真相，先进入 derived note
- 真正缺少独立宿主时，才新增 canonical host
- archive 发生在 merge / absorption 之后

这里的 `canonical host` 指正式宿主层，而不是自动等于“已 adopted truth”。

- candidate proposal host 也可以是 canonical host
- 是否已被执行层默认采信，由 metadata / registry 中的 `doc_state` 决定
- implementation / execution 类任务不应把 `doc_state: candidate` 文档当作 adopted truth

## New-doc gate
新增文档前，至少应回答以下 4 个问题：

1. 这条内容是不是已经有明确宿主？
2. 当前缺的是 canonical host，还是只缺一份 derived note？
3. 新开文档会不会让后续 agent 更难判断 source of truth？
4. 这份新文档在两周后还有高概率继续被引用吗？

只有当回答明确指向“当前确实缺少独立宿主”时，才应新增。

## Update-by-default rule
对于大多数高频讨论，默认动作应是更新已有文档，而不是新增。

尤其是以下情况：

- 同一主题继续收敛
- 已有文档只是缺一个小节
- 当前讨论只是在补边界、补例外、补触发条件
- 当前 thread 没有创造新的 topic object，只是在推进已有对象

一句话说：

- 新主题，才倾向新文档
- 老主题，默认更新原宿主

## Canonical-host rule
一个稳定 topic 尽量只有一个 canonical host。

只有在以下条件同时较明显时，才创建新的 canonical host：

- 主题边界已经独立
- 未来会被反复引用
- 继续寄居原文档会显著降低可读性

目标是：

- 减少 peer docs 数量
- 降低 source-of-truth 判断成本
- 控制默认加载面

默认应写回当前 canonical host 的情形包括：

- 当前只是为已有规则补边界、例外或触发条件
- 当前在修正已有判断的适用范围
- 当前没有创造新的稳定 topic object
- 当前变化已经清楚属于某一份已知 host 的主题边界

## Derived-note rule
derived note 的职责是压缩和提炼，而不是重新长成新的 transcript 集合。

当前建议：

- 默认不为每轮讨论都创建 derived note
- 只有在 provenance 未来高概率需要回看、当前尚未 adopted、或存在多个 competing positions 时，才创建或更新 derived note
- 单轮重要讨论，即使需要 derived note，默认也最多产出一份主要 derived note
- 同一 topic 在短时间内反复讨论，优先追加到已有 derived note
- 只有当 topic / review round / decision round 明显切换时，才拆新 note

## Merge-before-archive rule
archive 不应作为第一动作。

更推荐的顺序是：

1. 先判断有效内容是否应被吸收到更高等级宿主
2. 吸收完成后，再把旧文档降级或 archive
3. 避免在未完成吸收前就把仍有用的文档直接归档

也就是说：

- merge 是内容动作
- archive 是生命周期动作

## Writeback host matrix
为降低 writeback 漂移，当前建议优先按变化类型决定宿主：

| Change type | Preferred writeback host | Not-allowed primary host |
| --- | --- | --- |
| lifecycle rule change | lifecycle contract | umbrella summary only |
| loading rule change | loading contract | derived note only |
| registry schema change | metadata / registry contract | header only |
| source / provenance rule change | source pipeline contract | transcript manifest only |
| adopted cross-cutting summary | umbrella doc | child contract primary rule |
| unresolved review result | derived note | canonical host as final rule |
| accepted decision | canonical host + optional provenance pointer | raw transcript |

补充约束：

- umbrella doc 只能做跨子契约摘要，不应承接细规则
- derived note 可以保留过程，但不应成为 adopted rule 的唯一宿主
- raw transcript 只做原始来源，不做正式规则宿主

## Expected outputs per discussion round
当前建议每轮讨论的预期产出控制在小范围内：

- `0-1` 个 transcript archive object
- `0-1` 个主要 derived note
- `0-n` 个现有 canonical host update
- `0-1` 个新的 canonical host，而且应是少见情况

如果一轮讨论结束后自然产出了多个新文档，默认应反过来检查：

- 是否把 derived note 和 truth host 混开过度了
- 是否在多个文件里重复保存同一条结论
- 是否本该更新原文档，却错误地新开了 peer doc

## Trigger summary

### Create a new canonical host when
- 出现了现有文档没有明确宿主的稳定主题
- 某个主题已经反复在多个 thread 中被引用
- 单个文档同时承载多个边界，继续追加会明显降低可读性

### Update an existing canonical host when
- 当前 thread 形成了已 adopted 的新结论
- 当前 thread 改变了已有结论的边界、适用范围或下一步判断
- 当前 thread 只是在已有宿主上补足缺失章节

### Create or update a derived note when
- 这轮讨论值得保留中间提炼
- 当前尚未形成正式真相
- provenance 未来可能需要被追溯
- 或当前存在 competing positions，需要保留 adjudication 中间层

### Archive a doc when
- 内容已被更高等级宿主吸收
- 文档只剩历史追溯价值，不再影响当前执行
- 文档长期不再被引用，且已有明确替代物

## Practical examples

### Example A
同一条 `doc-governance` 主题继续增加 lifecycle 规则：

- 正确动作：更新已有 lifecycle host
- 错误动作：再新开一份平级 lifecycle note

### Example B
一次长讨论还没形成正式结论，但值得保留中间提炼：

- 正确动作：新增或更新 derived note
- 错误动作：直接把整段讨论压进 `STATUS.md` 或 `RESUME.md`

### Example C
一个长期主题已经独立，并会持续被引用：

- 正确动作：创建新的 canonical host
- 前提是原文档已难以继续干净承载

## Current recommendation
当前最值得坚持的不是“多写文档”，而是：

- 先问宿主是谁
- 再问这轮内容是不是只该成为 derived note
- 最后才考虑新增 canonical host
