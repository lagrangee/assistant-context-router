# External Agent Threading Policy (Draft)

> 这是一个 **跨项目通用的协作运行策略 draft**。
> 它不属于某个项目的定制规则，而是面向未来多项目、多 agent 协作的候选工作流协议。
>
> 当前 `assistant-context-router` 只是验证样本之一。

---

## 1. 目的

本策略回答：

- 什么时候外部 agent 协作应优先使用 **thread/session**，而不是 one-shot run
- 人类、主 agent（orchestrator）、外部 agent 在可见 thread 中如何协作
- 为什么“可见 thread + 文档回写”比“黑盒一次性执行”更适合长期协作型项目

核心原则：

> **visible thread-based external-agent collaboration**
> 优先于
> **hidden one-shot execution**

前提是：
- 任务是多轮协作型，而不是一次性生成型
- 需要人类持续可观察、可纠偏、可 review
- 需要主 agent 维护项目工作态与协作流转

---

## 2. 默认偏好

对于以下类型的工作，默认优先采用：

- `runtime: acp`
- `mode: session`
- `thread: true`

即：**thread-bound external-agent session**

而不是：

- 一次性 one-shot run
- 黑盒式执行后只回一个结果

---

## 3. 什么时候优先使用 thread

### 应优先使用 thread 的场景

#### A. 多轮协作型项目
例如：
- 策略设计
- 文档治理
- 分阶段实现
- review -> revise -> validate 的往返工作

特点：
- 不止一轮任务
- 中间会出现 review / correction / follow-up
- 需要稳定连续性

#### B. 人类希望保持可观察性
例如：
- 希望随时看到外部 agent 的真实进展
- 希望发现跑偏时及时纠偏
- 希望在关键节点直接留言给 agent

#### C. 项目有共享文档对象
例如：
- `README`
- `STATUS`
- `RESUME`
- `COLLAB`

这类项目更适合 thread，因为 agent 不是单轮吃 prompt，而是持续读写共享状态层。

#### D. 主 agent 不是把任务外包，而是在做 orchestration
即：
- 主 agent 需要多次给外部 agent 下达后续任务
- 外部 agent 的输出需要被反复整合、收口、升级

这时 thread 比 one-shot run 更自然。

---

## 4. 什么时候不必使用 thread

以下情况可以退回 one-shot run：

### A. 一次性明确产出
例如：
- 生成一段脚本
- 跑一个独立分析
- 做一个短摘要
- 临时查询某项事实

### B. 风险较高，需要隔离执行
例如：
- 可能污染当前工作目录
- 需要实验性改动
- 需要在临时副本里验证

### C. 人类不需要观察过程，只需要结果
例如：
- 明确委托一个封闭小任务
- 输出边界很清楚
- 中间不需要 review / correction

### D. 任务不值得维护持续上下文
如果任务极小，维持 thread 的成本高于收益，则不必 thread。

---

## 5. 三方角色模型

### 5.1 Human（项目 owner / reviewer / authority）
负责：
- discovery
- 方向拍板
- review
- 决策
- 最终验收

不负责：
- 人工搬运长上下文
- 在多个 agent 之间重复传话
- 维护协作文档状态

### 5.2 Main agent / orchestrator
负责：
- 判断是否应引入外部 agent
- 选择 thread 还是 one-shot
- 维护共享项目对象
- 把人类意图翻译为稳定任务
- 读取外部 agent 输出并继续编排
- 进行 escalation / review routing

### 5.3 External agent
负责：
- 在 thread 中接收具体任务
- 读取共享文档对象
- 执行任务
- 回写结果 / blocked / need review / need decision

不负责：
- 自行改写项目总方向
- 代替 human 拍板
- 绕过主 agent 擅自扩 scope

---

## 6. thread 模式为什么更优

### 6.1 可观察
human 可以随时看真实进展，而不是只能听主 agent 二次转述。

### 6.2 可纠偏
human 或主 agent 发现跑偏时，可以在 thread 中及时修正。

### 6.3 更像协作，不像黑盒外包
主 agent 不是“偷偷调用工具”，而是在一个开放协作面中与外部 agent 协同工作。

### 6.4 更适合长期项目
共享 thread + 共享文档状态，更容易支持多轮往返。

---

## 7. thread 模式的必要配套

如果要采用 thread-first 协作，必须同时具备：

### A. 明确的阅读顺序
外部 agent 进入前，必须知道先读什么。

### B. 明确的任务边界
必须说明：
- 做什么
- 不做什么
- 输出到哪里
- blocked 怎么处理

### C. 明确的回写位置
thread 不是唯一状态层。真正可恢复状态仍需写回项目对象。

### D. 明确的 escalation 规则
外部 agent 不能因为 thread 可见就直接绕过主 agent 处理关键决策。

### E. 明确的 authority 结构
- human = final authority
- main agent = orchestrator
- external agent = executor / analyst

---

## 8. 可见 thread 与文档回写的关系

thread **不是** 项目长期状态层的替代品。

### thread 的作用
- 可观察协作过程
- 可进行即时纠偏
- 保留一段任务执行上下文

### 文档对象的作用
- 承担稳定状态
- 承担中断恢复
- 承担正式收口
- 承担跨 agent 的一致事实源

因此原则是：

> **thread 用来协作过程可见化**
> **文档对象用来承接稳定工作态与正式结论**

不能把 thread 当作唯一 source of truth。

---

## 9. 推荐默认配置（Draft）

对于长期协作型项目，推荐默认：

- runtime: `acp`
- mode: `session`
- thread: `true`
- cwd: 目标项目目录
- sandbox: 共享优先，除非任务有明显风险

### 选择这个默认的原因
- 保持连续性
- 保持可观察性
- 支持多轮回合制协作
- 支持主 agent 持续 orchestrate

---

## 10. 适用范围

本 draft 更适用于：
- 文档驱动项目
- 多阶段设计/实现/验证项目
- 多 agent 协作项目
- human 希望保持在环但不做人肉总线的项目

不一定适用于：
- 极短的一次性任务
- 高隔离需求任务
- 纯批处理型任务

---

## 11. 当前状态

这是一个 **通用 draft**，不是正式 skill 规则。

当前仅可做如下表述：
- 已形成明确偏好：thread-first external-agent collaboration
- 当前项目只是用于验证该模式的样本之一
- 仍需更多样本验证：
  - 多项目
  - 多 agent 类型
  - 多任务类型

---

## 12. 与其他 draft 的关系

本文件应与以下 draft 一起理解：
- `boundary-note.md`
- `draft-structure.md`
- `handoff-skill-draft.md`
- `references/protocol.md`
- `references/doc-layering.md`
- `references/request-reply-format.md`
- `references/promotion-rules.md`

它补的是：

> **外部 agent 在运行时层面，如何接入这套协作模型**

---

*Status: draft*
*Scope: cross-project collaboration policy candidate*
*Current validation host: assistant-context-router*
