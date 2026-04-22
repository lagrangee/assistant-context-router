# Demo ACR Validation Harness Contract

## Purpose
定义 `demo-acr` 为 Gate 5 `escalation hygiene` 人工演练所需的最小 validation harness 边界，回答：

- 为什么 `demo-acr` 需要一个可执行的最小 service harness
- 这次改动属于哪一层
- 哪些部分是 validation-only，而不是正式产品能力

## Core stance
这次改动的目标不是把 ACR 扩成新的 service platform，而是：

> 让 `demo-acr` 在没有真实 orchestrator/service 的前提下，仍然能稳定触发 Step 2 当前已经存在的 `service-first -> signal promotion -> notification / escalation split` 闭环。

因此：
- `demo-acr` 自己提供 fixture/result
- OpenClaw adapter 只提供一个极薄的 validation bridge
- ACR core 不持有 demo-specific business logic

## Ownership split

### `demo-acr` owns
- Gate 5 场景对应的 fixture message
- validation-only service result fixture
- rehearsal docs / acceptance docs

### OpenClaw adapter owns
- 一个 validation-only 的 `service_binding.runtime_kind`
- 把 `InternalServiceRequest` 映射到 fixture result
- 不把 demo business logic 硬编码进 ACR core

### ACR core does not own
- `demo-acr` 的 fake review/block/completion 业务语义
- project-specific validation scenario catalog
- 通用 service runtime / worker platform

## Shape
当前最小 harness 采用：

```yaml
service_binding:
  runtime_kind: validation_fixture
  target_ref: /abs/path/to/demo-acr/validation/service-results.json
```

约束：
- `target_ref` 指向项目 repo 自己维护的 validation fixture 文件
- fixture 只覆盖 Gate 5 当前需要的 service scenarios
- 若 fixture 缺失或未命中，bridge 应保守返回 `needs_escalation`

## Why this is acceptable now
这条 harness 合理，是因为它满足：

1. 只服务当前 Step 2 的人工 validation
2. 不新增 authority host
3. 不要求引入真实 orchestrator/runtime
4. 不把 demo logic 写回 ACR core

## Why this is not product scope
这条 harness 不是正式能力，原因是：

- 它不解决真实项目的 service integration
- 它不提供 durability / retries / lifecycle
- 它不提供 generic bridge discovery
- 它只为 contract rehearsal 提供可执行输入

## Future rule
未来只有在出现以下信号时，才考虑把它升格成更正式的通用 bridge primitive：

1. 不止一个项目需要类似的 local validation harness
2. 我们明确要支持 project-owned local command/service bridge
3. 这条能力不再只是 demo validation，而是正式开发接线方式

在那之前，它应持续被视为：

> validation-only harness
