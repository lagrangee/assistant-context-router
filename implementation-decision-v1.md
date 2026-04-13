# Assistant Context Router MVP — Implementation Decision v1

> Note
>
> 本文件主要反映 **Step 1 baseline** 的实现决策与当时的上下文装配模型。
> 其中部分结论，尤其是默认 project context loading，已经被后续文档覆盖。
>
> 当前应优先以以下文档为准：
> - `STATUS.md`
> - `RESUME.md`
> - `plan/architecture/system-architecture-v1.md`
> - `plan/active/step2-project-context-definition.md`
>
> 特别说明：
> - 本文件中关于 `docs/recent-state.md` 的默认 context 结论，已不再代表当前推荐模型
> - Step 1.5 的目标正是将默认恢复入口切换到 hall docs（`STATUS.md` / `README.md` / `RESUME.md`）

## 目的
把 `assistant-context-router` 从“已完成 MVP 定义 + 已完成 feasibility check”推进到一个**可交给 Codex 实现**的决策状态。

本文不重新定义需求，只回答：
1. `/projects` / `/project` 怎么实现
2. `current project state` 放哪里
3. project context 怎么加载
4. route trace / fallback 怎么落

---

## 0. 决策摘要（TL;DR）

### D1. 产品入口
- `/projects`：做成 **command/plugin-first** 的项目列表入口
- `/project <id>`：做成 **command/plugin-first** 的 project context switch 入口

### D2. 实现骨架
- 第一版核心不要押在“命令壳”上
- **核心应放在 plugin hook + session-aware context injection**
- 优先使用：
  - `before_prompt_build`
  - 必要时 `before_dispatch`
  - 若需要更强装配能力，再上 `contextEngine`

### D3. 状态归属
- `current project state` 必须是 **session-owned**
- 不使用 workspace 全局 `CURRENT_PROJECT.md` 作为主状态源
- 若缺少现成 session metadata API，使用以 `sessionKey` 为键的轻量状态层作为过渡方案

### D4. Context loading
- 采用 **project-first, context-light, incremental**
- 默认只注入：
  - project registry entry
  - `project.yaml`
  - 可选 `README.md`
- 不做全量项目文档注入

### D5. Route policy
- 优先级：
  1. 显式 `/project`
  2. 协议消息携带的 project anchor
  3. 已知 channel/chat binding
  4. protocol family
  5. 最后才是语义猜测

### D6. Trace
- 每次 route decision 都要有最小 trace：
  - 命中哪个 project
  - 命中原因
  - 是否 safe-fail

---

## 1. `/projects` / `/project` 的实现决策

## 1.1 `/projects`
### 决策
做成 **plugin command / command-like capability**。

### 责任
- 读取 `projects/index.yaml`
- 列出可进入的项目宇宙
- 输出最小字段：
  - `project_id`
  - `title`
  - `type`
  - `status`
  - `file`

### 第一版不要做
- 不做复杂筛选/搜索系统
- 不做项目推荐
- 不做自动切换

---

## 1.2 `/project <id>`
### 决策
做成 **plugin command / command-like capability**。

### 责任
- 校验 `project_id`
- 读取项目入口文件
- 更新当前 session 的 `current_project_id`
- 返回简短确认信息：
  - 当前 project
  - objective
  - status
  - next_action

### 第一版不要做
- 不自动写大量文件
- 不自动载入完整项目目录
- 不顺手做 workflow orchestration

---

## 1.3 为什么不是 skill-first
### 原因
1. `/projects` / `/project` 是**控制面命令**，不是 prompt 技巧
2. 需要明确状态语义
3. 需要后续 trace / testability
4. 要和 route decision / session state 对接

### 允许的现实妥协
如果第一版 command 产品面不够成熟：
- 外部仍定义为 `/projects` / `/project`
- 内部实现允许由 plugin + hook 组合完成
- 但语义上仍把它们视为 command，不视为普通 skill 问答

---

## 2. current project state 的实现决策

## 2.1 主决策
`current project state` 归属于 **session**。

### 必存字段（最小）
- `current_project_id`
- `project_selected_at`
- `project_selected_via`（manual / route / anchor / binding）
- `current_workflow`（可选）
- `route_reason_last`（可选）

---

## 2.2 为什么不能用全局 `CURRENT_PROJECT.md`
### 否决理由
- 多 channel / 多会话下会 context bleed
- 无法支持并行推进多个项目
- 会把“当前项目”错误提升为全局单例状态
- 与 session-owned state 原则冲突

---

## 2.3 如果缺少现成 session metadata API，怎么办
### 过渡方案（允许）
使用一个轻量状态存储层，主键至少是：
- `sessionKey`

例如：
- plugin 内部持久化文件 / KV
- gateway 可访问的本地状态文件

### 约束
- 不能做成 workspace 全局单值
- 必须按 sessionKey 隔离
- 必须能恢复与清理
- 必须在文档中显式标记为 interim storage

---

## 3. project context loading 的实现决策

## 3.1 总原则
**先定边界，再加内容。**

切 project 的目标不是“尽可能多读文档”，而是：
- 让模型明确当前属于哪个 project
- 只加载足够支撑当前任务的最小上下文包

---

## 3.2 默认加载层
### Layer 1（默认必载）
- `projects/index.yaml` 中该项目的 registry entry
- 该项目 `project.yaml`

### Layer 2（有则追加）
- `README.md`
- 当前推荐模型已不再将 `docs/recent-state.md` 视为默认加载层

### Layer 3（按需追加）
- 研究文档
- notes
- memory recall
- 其他外部状态

---

## 3.3 技术落点
### 第一选择
`before_prompt_build`

原因：
- 正好位于 prompt 提交前
- 适合注入 project-aware context
- 不需要第一版就完全替换 context engine

### 第二选择
`before_dispatch`

适合：
- 需要在 dispatch 前先做 route / project resolution
- 或在 agent 是否接管前做更早判断

### 第三选择
`contextEngine`

适合：
- 当第一版已证明 project-aware context assembly 有价值
- 且 legacy context engine + hooks 的组合已不够表达需求

### 决策
**MVP 第一版默认不要直接上完整 contextEngine。**
先用 `before_prompt_build` 跑通。

---

## 4. protocol / project / workflow routing 的实现决策

## 4.1 首批覆盖范围
- webchat 主会话
- Feishu dispatch 群
- Feishu review 群

---

## 4.2 Route 优先级
按以下顺序判定：

1. **显式 project switch**
   - `/project <id>`
2. **协议消息中的 project anchor**
   - 若消息本身携带 `project_id` / structured tag
3. **稳定 binding**
   - channel / account / chat 绑定到 project
4. **protocol family**
   - dispatch / review / approval 等
5. **语义猜测（最后才用）**

---

## 4.3 Safe-fail 原则
当 project / workflow 仍不确定时：
- 不做高风险写操作
- 可以要求确认
- 或只返回解释性/低风险结果

MVP 必须把 safe-fail 作为正式行为，而不是异常分支。

---

## 5. route trace 的实现决策

## 5.1 MVP trace 最小字段
每次 route decision 至少记录：
- `resolved_project_id` 或 `unresolved`
- `route_source`（manual / anchor / binding / protocol / semantic）
- `confidence`（可选，简单分档即可）
- `safe_fail`（true/false）
- `reason`

---

## 5.2 trace 放哪里
MVP 推荐两层：

### 面向系统
- 内部 trace / plugin 日志 / state store

### 面向用户
- 在需要时给出简短 explanation
  - 例如：
    - “命中 project: X（来源：显式切换）”
    - “未确定 project，已进入保守失败”

### 第一版不要做
- 不做复杂 trace UI
- 不做完整 route dashboard

---

## 6. 具体实施顺序（给 Codex）

## Step 1 — 命令入口 + 状态层
实现：
- `/projects`
- `/project <id>`
- session-local current project storage

验收：
- 可以列项目
- 可以切换项目
- 可以在同一 session 内稳定记住当前 project

## Step 2 — context injection
实现：
- `before_prompt_build` 按 current project 注入最小上下文包

验收：
- 切换项目后，后续问答能明显体现项目边界
- 不发生明显 context 爆炸

## Step 3 — protocol routing MVP
实现：
- dispatch/review project resolution
- safe-fail
- route trace

验收：
- Feishu dispatch/review 的命中率提升
- 不确定时行为保守且可解释

## Step 4 — 再判断是否需要 contextEngine 化
只有在前 3 步跑通后，才决定是否升级为 context-engine plugin。

---

## 7. 明确不做的事
MVP 第一版不做：
- daemon service
- 全局 current project 单例
- 全项目全文注入
- 大一统 router framework
- 完整自动 project 推理系统
- 为所有 channel 一次性做通用解

---

## 8. 给 Codex 的一句话指令
> 不要重新发明一个 router 平台。请基于 OpenClaw 已确认存在的 plugin / hook / context 机制，先做一个 session-aware、project-centric 的最小可跑 MVP：command 是入口，context injection 是核心，route trace 与 safe-fail 是必须项。

---

## 9. Step 1 验收后的现实修正

经过本地 live validation，以下现实约束已被确认，并作为后续阶段的正式前提：

1. `assistant-context-router` 的 Step 1 已完成，并已作为本地 MVP baseline 验收通过。
2. 当前 tested runtime 下，session-aware 的 `/project <id>` 真实工作路径为：
   `TUI message -> before_dispatch -> session-owned state write -> before_prompt_build`
3. 当前 tested runtime 下，native `registerCommand(...)` handler 不能稳定拿到可用 `sessionKey`。
4. 因此，在 OpenClaw runtime 明确补足 command handler session context 之前，`before_dispatch` 应被视为当前正式的 session-aware command bridge。
5. TUI 的 slash autocomplete 不能作为 plugin command 可用性的可靠验收信号；应以 `/commands` 与实际执行结果为准。

这些修正不会推翻前述决策，而是把 Step 1 从“设计态”推进到了“经过真实运行时约束修正后的可执行基线”。

## 10. Step 2 layering decision

Step 2 的定位已明确为：

> 在 Step 1 已确认的 command/store/context baseline 之上，叠加 protocol/project/workflow routing policy，先完成验证与策略收口，再决定是否进入实现。

### Step 2 不是什么
- 不是 architecture replacement
- 不是 generic router framework
- 不是 context-engine rewrite
- 不是 progress writeback 阶段

### Step 2 是什么
- minimal context adequacy validation
- protocol/project/workflow routing policy layering
- route trace schema 的最小扩展
- unresolved 场景下的 safe-fail 规则收紧

### Step 2 继续遵守的原则
1. layering over replacement
2. bounded by default
3. session-owned first
4. safe-fail before convenience
5. protocol-specific before generic

若后续 Step 2 需要引入更多默认 context bucket、progress writeback 或更强 runtime 装配能力，必须先通过单独策略评审，不得在 Step 2 内隐式滑入。 
