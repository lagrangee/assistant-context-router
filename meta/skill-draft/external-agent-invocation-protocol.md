# External Agent Invocation Protocol (Draft)

> 这是一个跨项目通用的 external-agent 调用协议 draft。
> 它定义：主 agent 如何引入外部 agent、如何选择 thread/session vs one-shot run、如何发起任务、如何接续多轮协作。
>
> 当前项目仅作为验证样本之一。

---

## 1. 目的

本协议回答：
- 什么时候应该引入 external agent
- 什么时候用 thread/session，什么时候用 one-shot run
- 第一次调用 external agent 时，主 agent 应该怎么发起
- external agent 执行后，结果如何回流
- 主 agent 如何继续下一轮协作

它是对 `external-agent-threading-policy.md` 的运行时补充。

---

## 2. 调用前判断（Pre-invocation Gate）

主 agent 在引入 external agent 前，至少判断 4 件事：

### A. 任务是否适合外部 agent
适合：
- 已经有明确边界的子任务
- 需要较强执行力/分析力/编码能力
- 适合在共享项目对象基础上推进

不适合：
- 目标不清楚
- 仍处于 discovery / 边界未拍板阶段
- 需要 human 直接决策后才能继续

### B. 是否需要 human 先确认
如果属于以下场景，先升级给 human：
- 新项目首次引入外部 agent
- 新类型任务首次尝试
- 任务会改动高风险资产
- scope 仍不稳定

### C. 用 thread/session 还是 one-shot run
默认判断：
- 多轮协作 / 需可观察 / 需纠偏 → **thread session**
- 单轮产出 / 小任务 / 高隔离 → **one-shot run**

### D. 共享状态层是否已就绪
至少应确认：
- 项目入口明确
- 当前工作态明确
- 回写位置明确

如果这些都没有，不应贸然拉 external agent 进场。

---

## 3. 默认调用模式

对于长期协作型项目，默认推荐：

- runtime: `acp`
- mode: `session`
- thread: `true`
- cwd: 项目目录
- sandbox: 共享优先，必要时隔离

原因：
- 支持多轮回合制协作
- human 可观察、可纠偏
- 主 agent 可持续 orchestrate
- external agent 可持续读取共享对象

---

## 4. 第一次调用 external agent 的标准结构

主 agent 第一次发起 external agent 时，任务消息应至少包含以下 5 块：

### 4.1 项目定位
- 项目路径
- 当前阶段
- 任务在项目中的位置

### 4.2 阅读顺序
明确列出先读哪些文件。

### 4.3 任务目标
说明这轮要完成什么。

### 4.4 边界约束
明确：
- 不要做什么
- 不要扩 scope
- 哪些需要回写，哪些需要 review

### 4.5 产出与回写位置
明确：
- 产出文件写到哪里
- blocked 写到哪里
- need review / decision 写到哪里

---

## 5. 推荐首轮消息模板（Draft）

```markdown
请在项目 `<project-path>` 中参与一个受控子任务。

## 先读（按顺序）
1. `STATUS.md`
2. `README.md`
3. `RESUME.md`
4. `execution/COLLAB.md`
5. 本轮任务相关文档：`<doc-list>`

## 本轮任务
- 目标：<goal>
- 输出：<deliverable>

## 边界
- 不进入未授权实现
- 不扩大当前 scope
- 不改写项目总方向
- 遇到 blocked / need review / need decision，写回 `execution/COLLAB.md`

## 回写要求
- 正式产出写到：`<target-file>`
- blocked / review / decision 写到：`execution/COLLAB.md`
- 不把 thread 当作唯一状态层
```

---

## 6. external agent 执行后的结果回流

结果回流一般有三层：

### A. Runtime 层回流
- session 完成结果
- completion event
- run 返回输出

### B. 文档层回流
- 产出文件
- `COLLAB.md` 回写
- 必要时的 handoff note

### C. 编排层回流
主 agent 读取结果后决定：
- 是否收口进正式文档
- 是否继续下一轮
- 是否升级给 human

原则：
> runtime 负责告诉主 agent“跑完了”
> 文档对象负责告诉系统“现在到底到哪了”

---

## 7. 多轮协作接续协议

external agent 做完一轮后，主 agent 应做以下判断：

### 7.1 结果是否合格
- 是否完成本轮目标
- 是否遵守边界
- 是否有明显跑偏

### 7.2 结果应进入哪里
- STATUS
- RESUME
- COLLAB
- 某个正式文档
- 仅保留为临时产出

### 7.3 下一轮由谁处理
- 主 agent 自己继续
- 再给同一个 external agent 下一轮
- 切换另一个 external agent
- 升级给 human review / decision

---

## 8. 何时继续同一个 thread

应继续同一个 thread 的情况：
- 同一主题仍在延续
- 上一轮结果只是中间产物
- 需要 revision / follow-up
- human 希望保持观察连续性

不必继续同一个 thread 的情况：
- 任务已经完全收尾
- 下一轮属于不同问题域
- 上下文已变得冗长且低效
- 需要全新隔离环境

---

## 9. Human 介入点

在 thread-first 模式下，human 可以：
- 观察 external agent 的工作过程
- 发现跑偏时直接纠偏
- 在关键节点给 review / decision

但 human 不应退化为：
- 长上下文搬运者
- 主 agent 与 external agent 之间的消息总线

---

## 10. 主 agent 的纪律

主 agent 在调用 external agent 时应遵守：

1. 先收口项目状态，再派工
2. 先明确边界，再调用
3. 先明确回写位置，再启动
4. 拿到结果后先判断归属，再决定下一轮
5. 不把 external agent thread 当作唯一真相来源

---

## 11. 当前 draft 结论

已形成的工作偏好：
- thread-first external-agent collaboration
- acp session 优先于 black-box one-shot run（在长期协作项目中）
- 文档对象必须与 thread 并存，不能被 thread 替代

仍待验证的问题：
- 多 agent 并行时如何避免 thread 互相污染
- 同一项目中 external agent thread 的命名 / 生命周期策略
- completion event 与文档 writeback 的最小闭环约束

---

## 12. 与其他 draft 的关系

本文件应与以下文件一起理解：
- `external-agent-threading-policy.md`
- `handoff-skill-draft.md`
- `references/protocol.md`
- `references/request-reply-format.md`

它解决的是：
> **主 agent 在运行时，如何真正把 external agent 拉入协作并形成可接续回路**

---

*Status: draft*
*Scope: cross-project invocation protocol candidate*
*Current validation host: assistant-context-router*
