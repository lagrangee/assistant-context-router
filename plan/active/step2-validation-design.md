# Step 2 Validation Design (Transition Index)

> Transition note
>
> 本文件不是当前 Step 2 validation 的主真相，也不是当前活跃设计文档。
> 它仅作为迁移索引保留，用于把旧引用导向新的 active docs。

## Purpose
本文件不再承担完整的 Step 2 validation 主体内容。

随着 Step 2 定义的收敛，原先混合在一起的 validation 设计已经拆分为两个更清晰的问题域：
1. **project context adequacy**
2. **routing matrix / routing semantics**

因此本文件现在仅作为索引说明，指向新的正式文档。

## New structure
### 1. Context definition
- `step2-project-context-definition.md`
  - 定义 project switch 后默认最小 context 应由哪些对象组成

### 2. Core doc object schemas
- `project-doc-object-schemas.md`
  - 定义 `README.md` / `STATUS.md` / `RESUME.md` 三类核心对象的 schema

### 3. Context validation
- `step2-context-validation.md`
  - 验证默认 minimum project context 是否足够

### 4. Routing matrix
- `step2-routing-matrix.md`
  - 定义 routing validation matrix、语义分层与 safe-fail 要求

## Why this split
拆分原因：
- context adequacy 与 routing semantics 已经是两个不同层次的问题
- 若继续混在一份文档里，容易让 Step 2 讨论反复滑回“多加文档”或“直接做 routing”
- 拆分后更利于：定义 -> 验证 -> 实现边界控制

## Current guidance
当前 Step 2 应按以下顺序推进：
1. 先确认 `step2-project-context-definition.md`
2. 再确认 `project-doc-object-schemas.md`
3. 再推进 `step2-routing-matrix.md`
4. 最后执行 `step2-context-validation.md` 中的验证设计

## Historical note
旧版 `step2-validation-design.md` 中混合的内容，已经被吸收、拆分或重写到上述文档中。
本文件保留的目的仅是：
- 避免旧引用直接失效
- 给后续 agent 一个清晰迁移入口

因此：
- 若需要当前 validation 设计，请优先阅读 active docs
- 不应将本文件视为当前 source of truth
