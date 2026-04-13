# Collab Skill Draft Structure

## 目的
为未来将“文档驱动 + 多 agent 协作机制”抽象为跨项目通用 skill 做结构预演；当前仅定义草案结构，不正式创建 skill。

## 当前定位
这不是 skill 本身，而是未来 skill 的设计稿。

它回答：
1. 未来通用 skill 应如何组织
2. SKILL.md 应包含哪些最小内容
3. 哪些细节应下沉到 references
4. 哪些内容绝不能塞进 skill

## 未来 skill 的建议名称（候选）
- `agent-collab-docs`
- `multi-agent-collab`
- `doc-driven-handoff`

当前更推荐：
- `doc-driven-handoff`

原因：
- 更聚焦“通过文档完成多 agent 交接与协作”
- 不把 skill 误导成“所有协作问题的总入口”

## 未来 skill 的目录草案
```text
doc-driven-handoff/
├── SKILL.md
└── references/
    ├── protocol.md
    ├── doc-layering.md
    ├── request-reply-format.md
    └── promotion-rules.md
```

## SKILL.md 应包含的最小内容
### 1. skill 做什么
- 帮助 agent 在需要与外部 agent 协作时，优先采用文档驱动交接，而不是依赖长聊天记录或人肉转述。

### 2. 何时触发
- 用户明确要与 Codex / Claude Code / Gemini / 其他 agent 协作
- 一个任务需要通过文档交接当前状态、请求、结论、阻塞
- 一个项目开始出现 step 文档、progress 文档、协作面板、docs map 需求
- 用户要求建立可复用协作协议或文档治理方式

### 3. skill 的最小工作流
- 先识别当前项目是否已存在 docs map / progress / plan 文档
- 若没有，创建最小协作面板与 docs map
- 将 request / reply / blocked / needs decision 结构化
- 将稳定结论升格到正式文档
- 不直接把项目特例抽象成通用规范

### 4. role model
- 人类：最小唤醒与拍板
- 主助手：定义边界、收正式文档、决定升格
- 外部 agent：读协作文档、回写结构化结果

### 5. clear non-goals
- 不替项目制定业务策略
- 不替项目写全部正式文档
- 不负责自动 writeback / 自动归档
- 不提供某个具体 coding agent 的专属实现逻辑

## references/ 应承载的内容
### `protocol.md`
- 文档驱动协作协议
- 人类 / 主助手 / 外部 agent 的职责分工
- 典型 handoff 流程

### `doc-layering.md`
- docs map / plan / progress / archive 的分层规则
- 新增、合并、升格、归档的判断原则

### `request-reply-format.md`
- request 最小字段
- reply 最小字段
- blocked by / needs decision 的推荐写法

### `promotion-rules.md`
- 什么条件下项目内候选规范可以升格为通用 skill
- 什么仍应留在项目内，不应抽象

## 明确不应放进 skill 的内容
- 某个具体项目的业务背景
- 某个具体项目的 project id 列表
- 某个项目专属的 step 结论
- 某个项目的 docs map 实体内容
- 某个单一 agent 的特定偏好实现

## 与当前项目文档的关系
当前项目中的这些文档，是未来 skill 的原材料，而不是 skill 本体：
- `plan/candidates/doc-governance-candidate.md`
- `plan/collab-skill-boundary-note.md`
- `execution/COLLAB.md`
- `docs/README.md`

未来如果正式创建 skill，应从这些文档中提炼“通用方法”，而不是原样复制项目内容。

## 创建 skill 前的 preflight
正式创建 skill 前，至少应再次确认：
1. 是否已有第二个项目验证样本
2. 是否已有第二类外部 agent 验证样本
3. skill 的触发描述是否足够清晰且不过宽
4. references 是否已经把可变细节与核心流程分离

## 当前结论
下一步如果继续推进，合理动作应是：
- 继续在项目文档中验证这套机制
- 待样本足够后，再由 coordinator agent 主导真正创建 skill
