# Assistant Context Router MVP — Feasibility Check

## 目的
验证 `assistant-context-router` 的 MVP 是否能在 **不深改 OpenClaw core** 的前提下，基于现有扩展面（plugin / hook / context engine / session store）实现。

---

## 结论（先说结论）

### 结论 1：**plugin-first / hook-assisted 方案是 feasible 的**
从 OpenClaw 本地 docs 可确认：
- 存在正式的 **Plugin API**
- Plugin 可注册：
  - `registerHook`
  - `registerCommand` / `registerCli`
  - `registerContextEngine`
  - `registerService`
- 存在正式的 **Hooks** 体系
- 存在正式的 **Context Engine slot**（`plugins.slots.contextEngine`）
- Session state 由 gateway 持有，session 与 transcript 有明确边界

因此：
> 这个项目**没有必要**做成独立 daemon service。
> 最合理形态是：**独立 delivery 项目 + OpenClaw 插件/钩子/上下文引擎组合实现**。

### 结论 2：`/projects`、`/project` 做成“command/plugin 能力”在产品方向上是对的
Docs 明确提到 plugin 可注册 `registerCommand` / `registerCli`，以及存在 chat-native command 控制能力。

但当前还没拿到足够细节，无法 100% 断言：
- 自定义 chat slash command 的产品面是否已像内建命令一样成熟
- 命令是否天然拥有合适的 session-local persistence API

因此 MVP 推荐写法应是：
> **plugin-first，但允许 hook/context-engine 作为落地骨架；不要把实现成功押死在“必须是完整自定义 slash command”这一点上。**

### 结论 3：最稳的核心能力，不是 command，而是 **session-aware context assembly**
Docs 明确说明：
- OpenClaw 有 `contextEngine` slot
- context engine 可接管 context assembly / compaction
- plugin hooks 有：
  - `before_prompt_build`
  - `before_dispatch`
  - `message_received`
  - `before_message_write`
  - `session_start` / `session_end`
  - `before_compaction` / `after_compaction`

这意味着：
> 即使 `/project` 的命令产品面第一版不完美，MVP 的核心仍然能成立：
> **把 project 绑定到 session，再由 hook / context engine 在 prompt assembly 阶段注入正确的 project context。**

---

## Docs 证据摘要

### 1. Plugins 文档
确认了 OpenClaw 插件可注册：
- `registerHook` / `on(...)`
- `registerCommand` / `registerCli`
- `registerContextEngine`
- `registerService`

并且：
- `plugins.slots.contextEngine` 是正式 slot
- plugin 是一等扩展机制，不是 hack

### 2. Hooks 文档
确认了：
- hooks 可以监听 command / message / session / agent / gateway 事件
- hooks 事件里有 `sessionKey`
- message / session / command 生命周期可见
- `session:patch` 事件存在，说明 session properties 的修改在系统中是正式概念

### 3. Context 文档
确认了：
- OpenClaw 默认用 legacy context engine
- 若插件提供 `kind: "context-engine"` 并挂到 slot，则可接管 context assembly
- context 注入是可插拔的正式能力，不必深改 core

### 4. Agent Loop 文档
确认了：
- plugin hooks 中 `before_prompt_build` 可在 prompt 提交前注入上下文
- `before_dispatch` 可在模型 dispatch 前处理消息
- 这是 project routing/context injection 的自然落点

### 5. Session 文档
确认了：
- session 隔离是正式机制
- state lives in gateway
- session transcript 与 session store 是明确存在的

这支持一个关键架构判断：
> `current project state` 应优先设计为 **session-owned**，而不是 workspace 全局变量。

---

## 对三个关键问题的判断

## A. `/projects` / `/project` 的实现方式是否可行？
### 判断
**可行，但建议分层看：**

#### 目标形态（推荐）
- 作为 **plugin command 能力** 暴露
- 语义上属于“控制面/状态变更入口”，不是普通 skill

#### MVP 可接受形态
如果自定义 chat command 面实现成本偏高，则：
- 外部仍表现为 `/projects` / `/project`
- 内部可先由 plugin + hook + context-engine 组合实现
- 必要时第一版允许通过普通消息模式或最小命令桥接完成

### 结论
- **产品方向：plugin/command-first 成立**
- **工程落地：需要允许 fallback，不要把第一版锁死在某个命令 API 细节上**

---

## B. 这个项目应该是什么形式？
### 判断
**不是 daemon。**

### 推荐形态
- `projects/delivery/assistant-context-router` 是独立交付项目
- 交付物是：
  - 一个或多个 OpenClaw plugin
  - 可能附带 hooks / config / context-engine / trace 机制

### 不推荐
- 独立 router daemon service
- 平行消息总线
- 绕开 OpenClaw session/context 体系的外部状态机

### 原因
因为当前问题天然依附于：
- session
- context assembly
- message dispatch
- prompt build

这些都已经在 OpenClaw 扩展面内有正式落点。

---

## C. project context 如何加载 / 从哪里读取 / 如何保存？
### 推荐模型
**Project-first, context-light, session-owned**

### 读取源
第一层：
- `projects/index.yaml` 中的 registry entry
- 项目入口文件（通常 `project.yaml`）

第二层：
- `README.md`
- `docs/recent-state.md` 等最近状态文件

第三层（按需）：
- research 文档
- notes
- memory recall
- 外部资源

### 保存什么
#### 应保存
- 当前 session 绑定的 `current_project_id`
- 可能的 `current_workflow`
- route trace / route source
- 必要的 session-local routing metadata

#### 不应保存
- 整个 project context 的全文快照
- workspace 根的全局单例 `CURRENT_PROJECT.md`

### 切换 project 时怎么处理上一个 project
推荐：
- 保存“状态结果 / trace / 最近命中原因”
- 不保存整份上下文镜像
- project context 本身应当是**可重建**的

---

## MVP 推荐技术路线

## Phase 1 — 最小可跑骨架
1. project registry reader
2. `/projects` 列表入口
3. `/project <id>` 切换入口
4. session-local current project binding
5. `before_prompt_build` 中注入最小 project context

## Phase 2 — Protocol routing MVP
1. Feishu dispatch/review 识别
2. 显式 project anchor / binding 命中
3. safe-fail
4. route trace

## Phase 3 — Hardening
1. 评估是否需要单独 context engine
2. 多 session 并发污染验证
3. compaction / session lifecycle 协同

---

## 风险与 fallback

### 风险 1：自定义 command 产品面不够顺手
**Fallback：**
先把核心实现做在 plugin hook + context injection 上，命令入口只做薄包装。

### 风险 2：缺少现成 session metadata 写入 API
**Fallback：**
使用以 `sessionKey` 为主键的轻量状态存储层，明确标注为过渡实现；但必须保证不是全局单例。

### 风险 3：context engine 介入过早导致实现复杂度上升
**Fallback：**
先用 `before_prompt_build` 实现最小 project context 注入；只有在 legacy context engine 不够用时，再升级到完整 context-engine plugin。

---

## 最终建议
对 Codex 的指导不应是：
> “去实现一个 plugin 版 router。”

而应是：
> “基于 OpenClaw 已确认存在的 plugin / hook / context-engine 扩展面，先做一个 session-aware、project-centric 的 MVP；command 是入口，context injection 才是核心，必要时允许从 command-first 降级到 hook-first。”

换句话说：
- **feasible：是**
- **最稳实现：plugin + hook/context injection 组合**
- **不建议：daemon service**
- **状态归属：session-owned，不是 global file**
