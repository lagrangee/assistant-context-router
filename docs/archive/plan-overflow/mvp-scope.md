# MVP Scope（v0）

## 目标
把 Assistant Context Router 的第一版范围收敛到足够小、但足以验证方向是否成立。

---

## MVP 必做（In Scope）

### 1. Project registry listing
实现一个最小项目列表能力，数据来自：
- `projects/index.yaml`
- 必要时补 `project.yaml`

至少支持输出：
- project_id
- title
- type
- status
- next_action（若可得）

对应交互：
- `/projects`

---

### 2. Explicit project context switch
实现显式切换：
- `/project XXXX`

至少支持：
- 解析 project
- 进入 current project state
- 返回轻量 project summary

---

### 3. Session-/conversation-scoped current project state
MVP 要能证明：
- current project 不是全局单例
- 至少在当前交互范围内能稳定保存和读取

---

### 4. Minimal context loading
切换 project 后：
- 只加载 project identity / minimal rules / light summary
- 不做全量项目上下文注入
- 后续按需追加

---

### 5. Route trace（最小版）
对以下关键动作记录最小 trace：
- `/project XXXX` resolve 结果
- 当前 project state 来源
- dispatch/review route 命中依据
- fallback/reject 原因

---

### 6. Feishu dispatch/review 路由最小验证
至少覆盖：
- 能消费 project anchor（若消息携带）
- 若缺失，则按最小规则做 fallback
- 不清楚时 safe-fail

这一步的目标不是做完整协议系统，而是验证：
- project-centric route 是否比当前更稳

---

## MVP 不做（Out of Scope）

### 1. 不做完整通用 router framework
第一版不追求：
- 覆盖所有 channel
- 覆盖所有 workflow
- 做高度抽象的通用路由平台

### 2. 不重写 OpenClaw core routing
不修改：
- channel/session base routing
- reply-to-origin
- 底层 workflow runtime

### 3. 不做全量 context preload
切 project 后，不自动读完整项目目录、全部 docs、全部 notes、全部 memory。

### 4. 不做强自然语言 project inference
MVP 不以“自由语言自动猜对所有项目”为目标。
显式 trigger 优先。

### 5. 不做所有 protocol source 的完整接入
第一版只聚焦：
- webchat/TUI 主会话
- Feishu dispatch
- Feishu review

---

## MVP 成功标准
MVP 应至少证明：
1. `/projects` 和 `/project XXXX` 的交互模型是成立的
2. current project state 的隔离模型可行
3. project-centric + light context loading 确实能减少“从零启动/重新解释背景”的成本
4. dispatch/review 在 project anchor 帮助下，比现在更稳定
5. route trace 足以解释关键决策

---

## MVP 之后再决定的事
如果 MVP 成立，再扩展：
- 更多 channel
- 更多 workflow
- 更完整的 protocol family
- 更复杂的 route policy
- 是否 plugin 化 / upstream 化
