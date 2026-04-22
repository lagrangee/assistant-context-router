# Router Config Guide

## Purpose
这份文档说明 Step 2 当前采用的最小 router 配置方式：
- 全局 router config
- 项目级 router manifest

目标是让 action routing 的默认行为可读、可 review、可测试，而不是只埋在代码里。

边界说明：
- 这里定义的是 ACR 的通用接入 contract
- project-specific payload mapping、runtime adapter、external service implementation 不应写进 ACR core
- 某个项目若需要代码级适配，应在该项目 repo 中实现，并通过这里的 manifest / service contract 接入

补充说明：
- 当宿主是 OpenClaw 时，automation ingress 仍然通过 message 进入系统
- ACR 的 OpenClaw plugin 负责识别 structured automation message protocol，并将其 parse 成 `NormalizedEnvelope`
- project repo 负责遵循该 protocol 组织 message，不负责实现 parser

## Current model
当前 router 配置分两层：

### 1. Global router config
由插件配置项 `routerConfigPath` 指向一个 YAML 文件。

适合放：
- 跨项目共用的 action 默认路由
- 通用 workflow 提示
- 通用 `service` / `project_session` 默认目标
- project runtime 无关的主会话 binding 配置应放在单独 runtime bindings manifest，而不是项目 router manifest

### 2. Project-level router manifest
放在项目根目录，当前会自动探测以下文件名：
- `router.yaml`
- `router.yml`
- `project-router.yaml`
- `project-router.yml`

适合放：
- 某个项目特有的 action routing
- 覆盖全局默认的 target_kind / workflow
- 某个项目允许直达 service 的 action 集
- 某个项目的 `project_session_binding`

规则：
- 项目级 manifest 优先级高于全局 config
- 两层只合并 `actions` 映射；同名 action 由项目级覆盖

## Supported schema
当前最小 schema：

```yaml
actions:
  dispatch:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true

  append_project_note:
    target_kind: project_session

  review:
    target_kind: service
    workflow: review

service_binding:
  runtime_kind: validation_fixture
  target_ref: /abs/path/to/demo-acr/validation/service-results.json

project_session_binding:
  runtime_kind: file_jsonl
  target_ref: /tmp/demo-project-session.jsonl
```

字段说明：

- `target_kind`
  - `service`
  - `project_session`
- `workflow`
  - `general`
  - `dispatch`
  - `review`
- `requires_resolved_project`
  - 默认为 `true`
  - 当为 `true` 时，project 未解析会 safe-fail
- `service_binding.runtime_kind`
  - service-first bridge 所属 runtime 类型
- `service_binding.target_ref`
  - service ingress 的项目侧引用
  - 由 project-owned service bridge adapter 自己解释
- `project_session_binding.runtime_kind`
  - project session 所属 runtime 类型
- `project_session_binding.target_ref`
  - runtime target 的项目侧引用
  - 对 `openclaw_session` 而言，当前表示目标 OpenClaw `sessionKey`
- `project_session_binding.metadata`
  - 可选 runtime-specific metadata

## Current behavior

### If `target_kind: service`
- 当该 action 存在已注册的 internal service handler 时，automation 可直达 service
- 当项目 router manifest 提供 `service_binding` 且存在对应 bridge adapter 时，也可直达 service bridge
- 若 action 明确配置为 `service`，但既没有 direct handler，也没有可用 service bridge，则会 `safe-fail`
- service handler 现在支持两种注册键：
  - `action_name`
  - `project_id:action_name`
- 当两者同时存在时，优先使用 `project_id:action_name`
- `service_binding` 当前是 project-level default bridge，不按 action 细分；是否真正走 bridge 仍由 `actions.<name>.target_kind=service` 决定

### If `target_kind: project_session`
- 该 action 会优先尝试 resolve `project_session_binding` 并投递到 runtime target
- 当前内置的 runtime-shared adapter 包括：
  - `openclaw_session`
  - 先通过 OpenClaw `runtime.system.enqueueSystemEvent(...)` 排队事件
  - 再优先调用 `runtime.system.runHeartbeatOnce({ heartbeat: { target: "last" } })` 立即驱动一次 continuation
  - 只有在 heartbeat 忙碌等情况下才退回 `requestHeartbeatNow(...)` 做 queued delivery
- binding 缺失或 delivery 失败时，降级到本地 shadow lane
- shadow lane 只承担 fallback / summary / trace 读面，不是 authoritative runtime session

### If no config exists
- 若 action 有已注册 handler，默认走 `service`
- 否则默认走 `project_session`

## Example: global config

```yaml
actions:
  dispatch:
    target_kind: service
    workflow: dispatch

  review:
    target_kind: service
    workflow: review

  append_project_note:
    target_kind: project_session
```

## Example: project-level override

某项目根目录的 `router.yaml`：

```yaml
actions:
  dispatch:
    target_kind: project_session
    workflow: dispatch
```

这会覆盖全局默认，把该项目中的 `dispatch` 从 `service` 改成 `project_session`。

## Recommended usage
- 把跨项目共用规则放在全局 config
- 把项目特有行为放在项目根目录 `router.yaml`
- 把项目特有的 internal service 实现注册成 `project_id:action_name`
- 把项目特有的 `project_session_binding` 也放在项目根目录 `router.yaml`
- 先保持 schema 很小，避免过早长成完整 orchestration DSL
- 优先用 manifest 表达“默认去哪里”，不要在这里塞执行逻辑
- 不在 ACR repo 内维护某个具体项目的 demo adapter；真实接线应回到项目 repo 做 ACR-native 集成

## Runtime bindings manifest
`main session` 的 canonical binding 不放在项目 router manifest，而放在独立 YAML 中。

当前加载优先级是：
- 显式 plugin config `runtimeBindingsPath`
- env `ACR_RUNTIME_BINDINGS_PATH`
- 默认发现 `<plugin dataDir>/assistant-context-router/runtime-bindings.yaml`

当前已不建议再把运行时继续挂在 demo fixture 上。当前机器已把真实宿主收口到：
- `<openclaw-acr-data-dir>/runtime-bindings.yaml`

当前最小 schema：

```yaml
main_sessions:
  - binding_id: main-session
    runtime_kind: openclaw
    canonical_session_key: agent:main:main
    aliases: wechat:dm:human
```

用途：
- 把 channel/session alias 解析到 canonical `main session`
- 确保 `/project` 焦点绑定在真实 main session identity 上
- 也可被 governance sender 复用，把 symbolic target 解析到真实 main-session target

当前 governance sender 的典型第一版解析路径例如：
- `local:human_dm`
- `-> wechat:dm:human`
- `-> agent:main:main`

## OpenClaw message protocol
当宿主是 OpenClaw 时，当前推荐的 structured automation message format 为：

```text
[ACR_AUTOMATION]
{ ...json... }
[/ACR_AUTOMATION]
```

说明：
- 入口仍然是普通 message
- protocol recognition / parse 发生在 ACR 的 OpenClaw plugin 中
- wrapper 内 JSON 可为：
  - 顶层包含 `payload` 的完整 event 对象
  - 或 payload 本体
- 识别成功后，plugin 会把它转换成 `NormalizedEnvelope` 再进入 routing
- 某些 OpenClaw/TUI 入口可能在 `before_dispatch` 前剥离外层 wrapper；当前 plugin 也兼容识别剥离后仍保持 ACR automation 形态的裸 JSON body

## Service bridge
当前 `service_binding` 的定位是：

- 让 project repo 显式声明“这类 service action 应桥接到哪个 ingress target”
- 让 ACR core 保持 runtime-neutral，不直接硬编码某个项目的 orchestrator adapter

推荐方式：
- project repo 在自己的 `router.yaml` 中声明 `service_binding`
- project repo 通过宿主 runtime/plugin 注入对应 `serviceBridgeAdapter`
- ACR 只负责：
  - route
  - trace
  - 把最小 `InternalServiceRequest` 交给 bridge
  - 接收最小结构化 result shell

当前非目标：
- 不在 ACR core 内内置某个项目的 orchestrator bridge
- 不把 `service_binding` 做成完整 orchestration DSL

### Validation-only bridge
当前 OpenClaw adapter 额外内置一个 `validation_fixture` bridge，定位非常克制：

- 只用于 demo/contract rehearsal
- `target_ref` 指向项目 repo 自己维护的 fixture result JSON
- 让没有真实 service 的项目也能演练 `service-first -> signal promotion` 闭环

它不是：
- 正式 orchestrator integration
- 通用 worker runtime
- 对真实项目的推荐生产接线方式

## Non-goals
当前配置面还不负责：
- complex fallback graph
- human-facing escalation policy 全量建模
- service registration 本身
- 跨 channel main-session alias 合并

这些仍属于后续 Step 2 / Step 3 演进问题。

## Project session lane
当前实现中，`project session` 还不是完整聊天面，而是一个本地 JSONL event lane。

它当前承载：
- automation ingress 事件
- service 执行结果
- 可用于后续 summary 的高信号事项

当前 summary helper 重点关注这些 signal：
- `blocked`
- `review_request`
- `high_signal_completion`
- `service_error`

这意味着：
- 普通事件仍然可以留在 project lane
- `coordinator-agent` 后续可以通过 lane summary 只拉取高信号事项，而不是回放全部事件流

当前仍未做：
- lane 到 `main session` 的自动摘要推送
- 人类可读的完整项目事件视图
- 通用 event DSL
- OpenClaw project session 的自动创建与生命周期管理
- reply / escalation authority 的最终 runtime 收口
