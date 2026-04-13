# Memory Architecture Note

## Purpose
定义 `assistant-context-router` 中 memory 的顶层位置与边界。

核心结论：
- memory 是一级核心模块
- 但 memory 不是主真相层

## Why Memory Matters
memory 直接影响：
- secretary continuity
- project recovery quality
- cross-session recall
- human/agent preference continuity
- future runtime replacement cost

因此 memory 不能继续只是“运行时细节”，而应进入顶层架构。

## Three Memory Domains

### 1. Project Truth
宿主：
- `README.md`
- `STATUS.md`
- `RESUME.md`
- `execution/COLLAB.md`

特点：
- durable
- inspectable
- cross-runtime
- authoritative

约束：
- 不属于 memory backend
- 不能交给 runtime memory 代替

### 2. Working Memory
典型内容：
- current project
- current workflow
- recent route trace
- active working set
- session-scoped recovery context

### 3. Long-Term Memory
典型内容：
- 用户偏好
- 长期协作关系
- repeated patterns
- conversation-derived recall
- archive-derived recall

特点：
- 可由 memory backend 提供
- 主要服务 recall / continuity
- 不能越权成为主状态源

## Memory Adapter Boundary
未来 memory backend 统一走 adapter 层，例如：
- OpenClaw memory
- Hermes memory
- Mem0
- custom archive/index layer

适配层职责：
- recall
- retrieval
- memory write policy
- conflict / confidence policy

适配层不负责：
- 取代 `/project`
- 取代 hall docs
- 定义项目当前 authoritative state

## Design Rules
1. memory backend 只能增强 recall / continuity
2. memory backend 不能替代 `STATUS.md` / `RESUME.md`
3. memory backend 不能成为 `/project` authoritative source
4. 不允许把单个 runtime memory 当作跨系统唯一真相
5. 若 memory 与 hall docs 冲突，以 project truth 为准

## Near-Term Use
当前阶段建议：
- 保持 OpenClaw 自带 memory + inbox archiving 继续可用
- 但在架构上把它们收编为 memory layer 的当前实现
- 不在 Step 1.5 / Step 2 中引入大规模 memory redesign

## Future Questions
后续真正进入 Milestone 5 时，应回答：
- 哪些信息应写入 long-term memory
- 哪些信息必须只进 hall docs
- memory recall 的触发策略是什么
- recall 结果如何避免污染 project boundary
