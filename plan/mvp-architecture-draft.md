# MVP Architecture Draft（v0）

## 目标
在不深改 OpenClaw core 的前提下，实现一个最小可用的 Assistant Context Router MVP，优先解决：
- webchat/TUI 等主动会话中的 project context switch
- Feishu dispatch/review 这类结构化协议消息的 project/workflow route
- context loading 的克制与可解释性

---

## 1. 设计原则
1. **Extension-first**：优先 config / skill / hook / plugin
2. **Project-centric**：project 是工作上下文容器
3. **Context-light**：先索引、后按需，不做全量加载
4. **Explicit triggers first**：显式锚点优先于语义推断
5. **Session/conversation isolation**：current project state 不能是全局单例
6. **Safe-fail**：route 不确定时不做高风险写操作
7. **Route trace**：所有关键 route decision 可解释

---

## 2. MVP 建议的组成

### 2.1 Project registry（静态项目宇宙）
数据源：
- `workspace/projects/index.yaml`
- 相关 project 的 `project.yaml`

用途：
- `/projects` 列出项目
- `/project XXXX` 做 project resolve
- 后续 route decision 做 project lookup

### 2.2 Project command surface（显式交互入口）
候选入口：
- `/projects`
- `/project XXXX`

当前推荐：**先做成 skill/command surface**，而不是一开始深嵌到 core session 命令体系。

理由：
- 侵入小
- 易迭代
- 更符合 extension-first

### 2.3 Current project state store
当前建议：
- 不做全局 `CURRENT_PROJECT.md`
- 优先探索 **session-scoped / conversation-scoped state**

候选落点：
1. session metadata（首选候选）
2. plugin-owned lightweight state store（次选）

MVP 结论倾向：
- **先优先探索 session metadata 路径**
- 若扩展面不够，再退到 plugin-owned store

### 2.4 Context loading engine（轻量）
职责：
- 进入 project 后，不是全量加载，而是只加载最小必要 buckets

MVP 默认顺序：
1. project identity / index
2. project rules / strategy（若当前任务类型需要）
3. recent state（按需）
4. session-local history（有限）
5. memory / external state（按需）

### 2.5 Protocol router / bridge
职责：
- 处理结构化 protocol source
- 如 Feishu dispatch/review

MVP 输入优先级：
1. project anchor（若消息带）
2. protocol prefix
3. chat/channel binding
4. resource anchor（record_id / project_id）
5. 最后才是语义推断

### 2.6 Route trace
每次关键 route decision 至少要能记录：
- 输入 trigger
- 命中规则
- 解析出的 project
- 选定的 workflow
- 若 reject/fallback，其原因是什么

---

## 3. 推荐的实现路径

### Phase 1：Project-first interaction
先做：
- `/projects`
- `/project XXXX`
- current project state
- minimal context loading

目标：
- 验证 project-centric interaction model
- 降低“回忆我们在说什么”的成本

### Phase 2：Protocol routing
再做：
- Feishu dispatch/review protocol classify
- project anchor consume
- route 到对应 workflow/bridge

目标：
- 解决“dispatch 看运气”的问题

### Phase 3：Route trace + polish
补：
- route trace
- safe-fail policy
- acceptance 验证

---

## 4. 对 `/projects` / `/project` 的当前判断

### `/projects`
应只做轻量 listing：
- project_id
- title
- type
- status
- next_action

### `/project XXXX`
应完成：
1. resolve project
2. 写入 current project state（隔离作用域）
3. 返回轻量 project context summary
4. 不做全量上下文注入

### 非目标
- 不在切换瞬间读完整项目目录
- 不一次性塞入所有研究文档/notes/memory

---

## 5. 对 Feishu dispatch/review 的当前判断
MVP 最佳路径不是靠猜，而是：
- **要求协议消息尽量带 project anchor**
- routing layer 消费这个 anchor
- 若缺失，则才退到 chat binding / protocol pattern / resource lookup

这意味着：
- orchestrator/协议侧最好也配合最小变更

---

## 6. 当前最需要尽快拍板的 3 个技术决策
1. `/projects` / `/project` 具体采用 skill 还是 plugin command？
2. current project state 具体如何落地隔离？
3. route trace 最小记录位置在哪？

---

## 7. 当前建议
### 建议 A
先做 command/skill surface + session-scoped state 的最小原型。

### 建议 B
dispatch/review 的 project anchor 协议尽快一起设计，不要留到后面靠猜。

### 建议 C
切换 project 后默认只返回轻量 summary，不主动灌大上下文。
