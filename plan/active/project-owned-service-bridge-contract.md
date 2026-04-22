# Project-Owned Service Bridge Contract

## Purpose
定义 Step 2 / Cut 3B 当前 `service_binding` 与 project-owned service bridge 的最小正式 contract，回答：

- `service_binding` 在 router manifest 中表达什么
- direct internal service handler 与 bridge adapter 的优先级是什么
- ACR core 负责什么，不负责什么
- 这条桥接链最小如何验收

本文档承接：
- [service-first-orchestrator-action-result-contract.md](<repo-root>/plan/active/service-first-orchestrator-action-result-contract.md:1)
- [orchestrator-integration-boundary.md](<repo-root>/plan/active/orchestrator-integration-boundary.md:1)
- [docs/router-config-guide.md](<repo-root>/docs/router-config-guide.md:1)

## Core stance
`service_binding` 的目标不是把 ACR 变成外部 orchestrator 平台，而是给项目 repo 一个明确声明：

> 这个 project 的 service-first action 应桥接到哪个 project-owned ingress target。

它解决的是：
- project repo 如何显式拥有自己的 ACR 接入面
- ACR 如何在不硬编码项目业务 adapter 的前提下，把 structured action 送到外部 kernel

## Router manifest shape
当前最小 schema：

```yaml
actions:
  dispatch:
    target_kind: service
    workflow: dispatch
    requires_resolved_project: true

service_binding:
  runtime_kind: file_jsonl
  target_ref: /tmp/orchestrator-ingress.jsonl
```

说明：
- `actions.<name>.target_kind=service`
  - 决定这类 action 默认走 service-first 主路径
- `service_binding`
  - 决定当项目需要 bridge 时，service ingress 应送到哪个 runtime kind / target ref

## Precedence rule
当前 service 路径的优先级：

1. project-scoped direct handler
   - `project_id:action_name`
2. generic direct handler
   - `action_name`
3. `service_binding` + injected bridge adapter
4. 若 action 明确配置为 `service`，但以上都不可用
   - `safe_fail`

这样做的原因是：
- 保留当前最轻的 injected handler 路径
- 允许项目 repo 在需要时把 direct handler 替换成真实 bridge
- 不让 bridge 成为又一层隐式 fallback

## Ownership split

### ACR core owns
- `service_binding` 的通用 schema
- route / trace / safe-fail
- 最小 `InternalServiceRequest`
- 最小 `ServiceResult` normalization
- bridge adapter registry contract

### Project repo owns
- bridge target 的真实含义
- project-specific payload mapping
- ingress adapter 实现
- 如何把 ACR request 翻译成外部 kernel ingress

### ACR core does not own
- 某个项目的 orchestrator adapter 实现
- bridge target lifecycle
- bridge target reliability policy
- 项目业务 action 的完整类型系统

## Bridge adapter contract
bridge adapter 当前最小输入：

- `binding.runtime_kind`
- `binding.target_ref`
- `binding.metadata`
- `request.action_name`
- `request.resolved_project_id`
- `request.workflow`
- `request.parameters`
- `request.trace_id`
- `request.reply_target`

bridge adapter 当前最小输出：
- 使用统一的 `ServiceResult` shell
- 至少要能回：
  - `status`
  - `result_kind`
  - `summary`
  - `queue_ref` 或 `run_id`（若有）
  - `trace_patch`

## Validation rule
Cut 3B 当前最小验收：

1. 对于 `target_kind=service` 的 structured action
   - 无 local handler 时，bridge adapter 仍可成功接管
2. bridge ingress 会收到：
   - `action_name`
   - `resolved_project_id`
   - `trace_id`
   - `parameters`
3. ACR 本地会保留：
   - `route_trace.target_kind=service`
   - `project_session` shadow lane 中的 normalized `service_result`
4. 若 bridge adapter 缺失或不可用
   - 不得回退成 `project_session` 执行入口
   - 应通过 `safe_fail` 或 `needs_escalation` 保守失败

## Out of scope
当前不在本 contract 内解决：
- bridge adapter discovery/loading 机制的最终形态
- CLI bridge
- signal promotion 规则
- business notification / main-session escalation 的统一收口
- protocol owner / business target 的正式双层类型系统

## Validation-only note
当前 OpenClaw adapter 可以额外提供 `validation_fixture` 这类 validation-only bridge。

这不改变本 contract 的 ownership split：
- fixture 内容仍由 project repo 自己维护
- ACR core 仍不拥有 project-specific business adapter

它的意义只是：
- 让像 `demo-acr` 这样的 contract rehearsal 项目，在没有真实 service 的情况下也能演练 `service-first` 闭环
