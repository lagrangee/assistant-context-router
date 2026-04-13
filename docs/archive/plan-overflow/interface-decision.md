# Interface Decision（v0）

## 目标
为 MVP 阶段的 `/projects` / `/project XXXX` 选择最合适的交互与实现入口。

---

## 待选方案
1. **Skill / command surface**
2. **Plugin command**
3. **Hook-based implicit interpretation**
4. **Core-level session command**

---

## 评估标准
1. 是否符合 extension-first
2. 是否利于快速验证交互模型
3. 是否容易与 OpenClaw 升级解耦
4. 是否方便承接 current project state
5. 是否有良好用户心智
6. 是否便于后续扩展 route trace / project registry / context loading

---

## 方案 A：Skill / command surface

### 描述
将 `/projects` 与 `/project XXXX` 作为显式用户入口，实现为 skill/command 形式。

### 优点
1. **侵入低**：不需要先修改 core
2. **用户心智清晰**：`/projects` 和 `/project` 本身就是自然交互模型
3. **易于快速验证**：最适合 MVP
4. **方便逐步演化**：先跑通交互，再决定是否升级为 plugin command

### 缺点
1. 控制面能力可能受限于 skill/command surface
2. 若需要更深的 session metadata/control，可能后续要升级实现形态

### 适配度
**高**。适合当前 MVP。

---

## 方案 B：Plugin command

### 描述
通过 plugin 提供命令入口与更完整的 runtime/control surface。

### 优点
1. 结构更完整
2. 更适合后续扩展成稳定功能模块
3. 更容易与 hooks / routes / state store 协同

### 缺点
1. 初始复杂度更高
2. MVP 早期可能过早进入“工程化过度”
3. 如果交互模型尚未验证，容易过度设计

### 适配度
**中高**。更像 Phase 2/3 的升级方向，而不是 MVP 第一手。

---

## 方案 C：Hook-based implicit interpretation

### 描述
不显式提供 `/projects` / `/project` 命令，而是通过 hooks 或 message parser 识别自然语言或某些模式，隐式切换 project。

### 优点
1. 表面上“更自然”
2. 少一个显式命令面

### 缺点
1. 与“explicit triggers first”原则冲突
2. 用户心智不稳定
3. 更难 debug / trace
4. 容易引入歧义

### 适配度
**低**。不适合作为 MVP 主入口。

---

## 方案 D：Core-level session command

### 描述
直接改 OpenClaw 核心命令/会话机制，把 `/project` 做成原生命令。

### 优点
1. 从理论上整合度最高
2. 若成功，会很“原生”

### 缺点
1. 与 extension-first 原则冲突
2. 升级风险高
3. MVP 阶段性价比很差
4. 会把 research 直接拉进 core 改造

### 适配度
**很低**。除非后期确认确有必要并值得 upstream。

---

## 决策
### MVP 选择：**Skill / command surface**

---

## 决策理由
1. 最符合 extension-first
2. 最适合验证 project-centric interaction model
3. 不会过早绑定到高成本实现路径
4. 与 `/projects` / `/project XXXX` 的显式 trigger 模型天然一致
5. 后续如有必要，仍可平滑升级到 plugin command 或更完整模块

---

## 对后续的影响
### 短期
- 先把 `/projects` / `/project` 交互跑通
- 同时验证 current project state 与 minimal context loading

### 中期
- 若 state/control surface 受限，再升级到 plugin-owned command/state 模块

### 长期
- 若验证成功，再考虑是否形成更通用的 plugin 或 upstream 反馈

---

## 当前阶段结论
MVP 的最佳入口不是“更自动”，而是“更显式、更轻、更易验证”。

所以：
> `/projects` / `/project XXXX` 应先作为显式 command/skill surface 落地。 
