# Request Reply Format

## Request 最小字段
每个 request 至少应包含：
- objective
- scope
- out-of-scope
- output contract

## Reply 最小字段
每个 reply 至少应包含：
- summary
- findings / recommendation
- blocked by / needs decision（如有）
- suggested formal doc paths

## 推荐写法
### Request
- Objective: 当前要解决什么
- Scope: 本轮允许做什么
- Out-of-scope: 本轮明确不做什么
- Output contract: 外部 agent 应如何回写结果

### Reply
- Summary: 这轮做了什么
- Findings / Recommendation: 核心判断与建议
- Blocked by / Needs decision: 当前还缺什么拍板
- Suggested formal doc paths: 哪些结论应进入正式文档

## 原则
- request 要短，但边界要清楚
- reply 要结构化，不写成长聊天记录
- blocked / needs decision 必须显式写出
