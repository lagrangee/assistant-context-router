# Decision Record（v0）

## 目标
在实现前，先锁定 MVP 阶段最关键的技术决策，避免后续反复摇摆。

---

## Decision 1：`/projects` / `/project XXXX` 优先采用 command/skill surface

### 决策
MVP 阶段优先将 `/projects` 与 `/project XXXX` 做成 **command/skill surface**，而不是深嵌到 OpenClaw core command/session 体系。

### 理由
1. **侵入更小**：更符合 extension-first 原则
2. **验证更快**：先验证交互模型是否成立
3. **升级风险更低**：避免一开始就依赖 core patch
4. **可替换性更好**：后续若要 plugin 化或进入更深层扩展，迁移成本较低

### 备选方案
- plugin command
- hook 驱动的隐式命令解释
- core-level session command

### 当前不选的原因
#### plugin command
可行，但当前阶段先用 skill/command surface 更轻；若后续发现需要更强控制，再升级。

#### hook 驱动隐式解释
对显式 context switch 来说不够直接，也不利于用户心智。

#### core-level session command
升级与维护风险过高，不符合 MVP 克制原则。

---

## Decision 2：current project state 不采用全局文件单例，优先探索 session-scoped state

### 决策
MVP 阶段**不采用全局 `CURRENT_PROJECT.md` 单例**。
优先探索：
- session metadata / conversation-scoped state

如扩展面不够，再考虑：
- plugin-owned lightweight state store

### 理由
1. **避免 context bleeding**：多 channel、多会话、多设备场景下，全局状态极易污染
2. **更符合 session/conversation 隔离模型**
3. **更符合 project context 作为交互作用域而非全局环境变量的设计原则**

### 备选方案
- workspace 根目录全局 markdown 文件
- 单一 JSON 全局状态文件
- long-term memory 文件承担 current project

### 当前不选的原因
#### 全局 markdown / JSON 单例
多入口并发下风险高，会导致 project context 串线。

#### long-term memory 文件
memory 不应承担瞬时 current context state。

---

## Decision 3：切换 project 后采用“轻量索引优先、按需追加”的 context loading

### 决策
进入 `/project XXXX` 后，不进行全量 context 注入。
MVP 默认只加载：
1. project identity / index
2. minimal rules / strategy（如有必要）
3. 返回轻量 summary

其余内容按对话与任务逐步追加。

### 理由
1. **避免 context loading 爆炸**
2. **降低无关上下文污染**
3. **更符合 project-centric 但 context-light 的原则**

### 备选方案
- 切换时预加载整个项目 README / docs / notes / memory
- 只加载当前 session history，不加载项目文档

### 当前不选的原因
#### 全量预加载
代价高、污染风险高、对大项目不可持续。

#### 只依赖 session
无法真正建立 project boundary。

---

## Decision 4：Feishu dispatch/review 优先消费显式 project anchor，而不是主要靠猜

### 决策
对于 Feishu dispatch/review 等 protocol source，MVP 优先路径是：
- 消费显式 project anchor
- 若缺失，再退到 chat binding / protocol pattern / resource lookup

### 理由
1. **减少 project 识别歧义**
2. **让 protocol source 自描述**
3. **降低 router 复杂度与误路由风险**

### 备选方案
- 完全靠 chat_id 绑定
- 完全靠语义推断

### 当前不选的原因
#### 完全靠 chat_id 绑定
适合固定来源，但不够通用，也不适合跨系统传播。

#### 完全靠语义推断
不稳定，不适合作为协议消息主路径。

---

## Decision 5：Route trace 是 MVP 必须项，不是后补优化项

### 决策
MVP 必须记录最小 route trace，至少包括：
- 输入 trigger
- 命中规则
- project 解析结果
- workflow 选择结果
- fallback/reject 原因

### 理由
1. **没有 trace 就难以 debug**
2. **没有 trace 就无法解释误路由**
3. **后续扩展 workflow 时 trace 会成为必要基础设施**

### 备选方案
- 先不记 trace，后续再补

### 当前不选的原因
后补 trace 往往意味着早期行为不可解释，难以及时修正模型与规则。

---

## 当前阶段总结
MVP 的关键方向已经明确：
- command/skill surface 先行
- session-scoped current project state
- 轻量 project context loading
- protocol source 自描述优先
- route trace 从第一天就存在
