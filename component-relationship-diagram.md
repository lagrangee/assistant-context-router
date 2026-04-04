# Assistant Context Router MVP — Component Relationship Diagram

## 目的
这份文档用于帮助实现方（例如 Codex）快速建立 `assistant-context-router` 的系统分层理解。

重点不是 UI 图，而是回答：
- 核心组件有哪些
- 组件之间怎么协作
- 哪些是入口，哪些是状态层，哪些是上下文装配层
- 哪些是 MVP 第一版必须做的

---

## 一句话总览

`assistant-context-router` 的核心不是“做两个命令”，而是：

> 通过 command 入口或 protocol routing 确定当前 session 的 project，再由 `before_prompt_build` 基于该 project 注入最小上下文包，从而实现 project-centric 的 assistant behavior。

也就是说：
- **command 是入口**
- **session store 是状态归属层**
- **context loader + before_prompt_build 是核心执行层**
- **trace / safe-fail 是治理层**

---

## 组件关系图（ASCII）

```text
                           ┌─────────────────────────────┐
                           │        User / Channel       │
                           │ webchat / Feishu / review   │
                           └──────────────┬──────────────┘
                                          │ inbound message
                                          ▼
                           ┌─────────────────────────────┐
                           │   OpenClaw Session Layer    │
                           │ sessionKey / transcript     │
                           │ session-owned state         │
                           └──────────────┬──────────────┘
                                          │
                       ┌──────────────────┼──────────────────┐
                       │                  │                  │
                       ▼                  ▼                  ▼
        ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
        │ Command Entry       │  │ Protocol Router     │  │ Session Project     │
        │ /projects           │  │ dispatch/review     │  │ Store               │
        │ /project <id>       │  │ anchor/binding      │  │ current_project_id  │
        └─────────┬───────────┘  └─────────┬───────────┘  │ workflow            │
                  │                        │              │ last_route_trace    │
                  └──────────────┬─────────┘              └─────────┬───────────┘
                                 │                                  │
                                 ▼                                  │
                    ┌─────────────────────────────┐                 │
                    │   Project Registry Loader   │◄────────────────┘
                    │ reads projects/index.yaml   │
                    │ resolves project.yaml path  │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │ Project Context Loader      │
                    │ reads:                      │
                    │ - project.yaml              │
                    │ - README.md (optional)      │
                    │ - docs/recent-state.md opt  │
                    └──────────────┬──────────────┘
                                   │ lightweight context payload
                                   ▼
                    ┌─────────────────────────────┐
                    │ Hook: before_prompt_build   │
                    │ inject project-aware        │
                    │ context into prompt         │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │   OpenClaw Agent Runtime    │
                    │   model call / tool use     │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │ Route Trace / Safe-Fail     │
                    │ reason / source / outcome   │
                    │ stored in session state     │
                    └─────────────────────────────┘
```

---

## 组件说明

## 1. User / Channel
来源包括：
- webchat 主会话
- Feishu dispatch 群
- Feishu review 群

这里的重点不是 channel 本身，而是：
- 输入从哪里来
- 是否带 protocol family
- 是否带 project anchor

---

## 2. OpenClaw Session Layer
这是所有状态隔离的基础。

### 职责
- 维护 sessionKey / transcript
- 提供当前对话容器
- 持有 session-owned project state 的归属边界

### 设计原则
`current project state` 必须归属于 session，而不是 workspace 全局文件。

---

## 3. Command Entry
包含：
- `/projects`
- `/project <id>`

### 职责
- 为用户提供显式控制入口
- `/projects` 负责列出项目宇宙
- `/project <id>` 负责显式切换当前 project

### 非职责
- 不负责完整 context 装配
- 不负责完整 routing 决策
- 不应承载大部分业务逻辑

### 关键原则
command 是入口，不是核心引擎。

---

## 4. Protocol Router
### 职责
对结构化来源消息做 route 解析，尤其是：
- dispatch
- review

### 主要输入
- 显式 project anchor
- channel/chat binding
- protocol family

### 输出
- `resolved_project_id`
- `workflow`
- `route_source`
- `safe_fail`

### 关键原则
第一版不要依赖自由语义猜测作为主路径。

---

## 5. Session Project Store
这是 MVP 中最关键的状态层。

### 最小字段建议
- `current_project_id`
- `selected_at`
- `selected_via`
- `current_workflow`
- `last_route_trace`

### 关键原则
- session-owned
- 若缺少现成 session metadata API，可用 `sessionKey` 级过渡 store
- 不允许使用 workspace 根的全局 `CURRENT_PROJECT.md`

---

## 6. Project Registry Loader
### 职责
- 读取 `projects/index.yaml`
- 根据 `project_id` 找到项目入口
- 返回项目 registry 信息

### 作用
这是“项目宇宙”的权威索引层。

---

## 7. Project Context Loader
### 职责
按 project 读取最小上下文包。

### 默认读取层
#### Layer 1（必载）
- registry entry
- `project.yaml`

#### Layer 2（可选）
- `README.md`
- `docs/recent-state.md`

#### Layer 3（按需）
- notes
- research
- memory recall
- 外部资源

### 关键原则
- project-first
- context-light
- incremental
- 不做全文注入

---

## 8. Hook: `before_prompt_build`
这是 MVP 第一版的核心实现点。

### 职责
- 在 prompt 提交给模型前
- 读取当前 session 的 project binding
- 注入该 project 的最小 context payload

### 为什么它重要
这是真正改变模型行为的地方。

换句话说：
- `/project` 只是改变状态
- `before_prompt_build` 才让状态变成模型可用上下文

---

## 9. OpenClaw Agent Runtime
### 职责
- 接收最终 prompt
- 进行模型调用
- 执行工具调用
- 返回回复

这个层不是本项目的主改造目标。

### 关键原则
不要为了 `assistant-context-router` 去深改 OpenClaw core runtime。

---

## 10. Route Trace / Safe-Fail
### Trace 职责
记录：
- 命中的 project
- route source
- workflow
- reason
- safe-fail 与否

### Safe-Fail 职责
在 project/workflow 不确定时：
- 不做高风险写操作
- 返回解释性结果或请求确认
- 不偷偷借用别的 session/project 状态

### 关键原则
trace 和 safe-fail 是 MVP 一等需求，不是附属调试项。

---

## 数据流（正常路径）

### 路径 A：显式切项目
1. 用户输入 `/project <id>`
2. Command Entry 校验 `project_id`
3. Session Project Store 写入 `current_project_id`
4. 后续消息到来时，`before_prompt_build` 读取该状态
5. Project Context Loader 读取最小上下文包
6. 注入 prompt
7. 模型在正确 project context 下工作
8. Route Trace 记录本次命中来源为 `manual`

### 路径 B：结构化协议消息
1. dispatch/review 消息进入 session
2. Protocol Router 先看 anchor / binding / family
3. 若 resolve 成功，写入 session project/workflow 状态
4. `before_prompt_build` 注入对应 project context
5. 若 unresolved，则进入 safe-fail
6. Trace 记录 `binding/protocol/unresolved`

---

## MVP 第一版必须具备的组件
### 必须做
- Command Entry
  - `/projects`
  - `/project <id>`
- Session Project Store
- Project Registry Loader
- Project Context Loader
- `before_prompt_build`
- Route Trace
- Safe-Fail
- Dispatch/Review Protocol Router（最小版）

### 暂时不做
- 完整 context engine plugin
- daemon service
- 大一统 router framework
- 所有 channel 的统一 routing DSL
- 自由语义 project inference 主路径
- 完整 trace UI / dashboard

---

## 设计原则总结

### Principle 1
**Command 是入口，context injection 是核心。**

### Principle 2
**State 必须 session-owned。**

### Principle 3
**Project context 必须轻量、分层、可重建。**

### Principle 4
**Routing 优先显式与结构化信号，不优先语义猜测。**

### Principle 5
**Safe-fail 与 trace 是正式能力。**

---

## 给实现方（Codex）的提醒
实现时请始终检查以下问题：
1. 有没有把命令入口误做成核心逻辑承载层？
2. 有没有把状态错误做成全局单例？
3. 有没有让 context loader 过度加载？
4. 有没有让 protocol routing 依赖自由语义猜测？
5. 有没有把 safe-fail 当成“以后再补”的功能？

如果以上任一问题出现，说明实现方向开始偏离 MVP。 
