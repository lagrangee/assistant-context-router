# Protocol

## 目标
定义文档驱动多 agent 协作的最小协议，让主助手、外部 agent、人类之间通过文档而不是长聊天记录进行 handoff。

## 角色
### Human
- 唤醒
- 拍板
- 调整优先级
- 不负责搬运长上下文

### Main assistant
- 定义边界
- 维护 docs map / collab panel / formal docs 的结构
- 判断哪些内容应升格为正式文档
- 决定何时某种模式已足够稳定，可进入通用抽象

### External agent
- 读取协作文档
- 执行当前 request
- 回写结构化结果
- 不擅自把候选规范升级为跨项目标准

## 最小 handoff 流
1. 主助手整理当前 objective、facts、open questions、request
2. 人类只发送简短唤醒语句给外部 agent
3. 外部 agent 读取协作文档并执行当前 request
4. 外部 agent 回写 summary / recommendation / blocked / suggested doc paths
5. 主助手收口并把稳定结论升格到正式文档

## 核心原则
- 文档是主协作面，聊天只是唤醒信号
- request 必须结构化
- reply 必须结构化
- 协作面板只承载当前有效状态
- 稳定结论进入正式文档
