# Implementation Strategy（draft）

## 目标
在不深改 OpenClaw core 的前提下，交付一个最小可用的 Assistant Context Router MVP。

## 输入约束（来自 research）
- project-centric interaction model
- explicit triggers first
- context loading must stay minimal
- current project state must not be global
- protocol sources should carry project anchors when possible
- extension-first: config / skills / hooks / plugins 优先

## 待确认的核心设计问题
1. `/projects` 与 `/project XXXX` 最适合落在哪个扩展面？
   - skill
   - plugin command
   - hook + state
   - session metadata patch
2. current project state 存在哪里？
   - session metadata
   - plugin-owned store
   - conversation-scoped state
3. route decision 的主入口在哪里？
   - 命令入口
   - message hooks
   - plugin inbound layer
4. route trace 记录到哪里？
5. Feishu dispatch/review 的 project anchor 采用何种协议形式？

## 当前建议的 MVP 顺序
### Phase 1
- project registry listing
- current project switch
- minimal context loading model

### Phase 2
- protocol classification
- dispatch/review route bridge
- route trace

### Phase 3
- polish / acceptance / rollback validation

## 本阶段产出
- strategy 确认
- config/schema 草案
- state ownership 决策
- command / hook / plugin 组合方案
