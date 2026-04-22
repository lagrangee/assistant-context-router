# Monorepo Governance

## Purpose
这份文档只定义 `assistant-context-router` 的仓库结构与版本控制规则，回答三件事：
- 为什么这个仓库当前按 monorepo 方式管理
- 仓库里的模块边界如何划分
- branch、commit、staging、gitignore 应该如何约束

这里的 `monorepo` 不是 Git 专有概念，而是“多个相关模块放在同一个 repo 里协同演进”的组织方式。

## Scope boundary
这份文档只处理：
- 仓库内模块边界
- 哪些内容适合作为版本化资产进入 repo
- `.gitignore`、branch、commit、staging 规则

这份文档不处理：
- `README.md` / `STATUS.md` / `RESUME.md` / `execution/COLLAB.md` 的语义定义
- 各类 truth docs 的写法、写入节奏、字段结构
- `plan/**` 或其他设计文档的内容判断

这些内容应继续以已有 truth docs、architecture docs、planning docs 为准，而不是在这里重复规定。

## Why monorepo here
当前仓库里的几个主要模块不是弱关联关系，而是会一起演进：
- `implementation/core/` 定义通用 contract 与 routing logic
- `implementation/adapters/openclaw/` 承接宿主运行时与 plugin 接入
- `implementation/adapters/feishu/` 承接外部 work-surface / governance 集成
- `implementation/tests/` 负责跨模块验证真实集成切片

当前阶段这些模块具备以下特征：
- 经常在同一个 feature slice 内联动修改
- 测试需要跨目录一起跑
- 暂时没有独立发布节奏或独立版本号

因此当前默认策略应是：
- 保持单仓
- 强化模块边界
- 用路径、测试、commit scope 管理“仓内子项目”

## Version-control buckets
从版本控制角度，当前仓库里的内容可以按 `4+1` 个提交桶理解：

### Bucket 1: implementation
对应：
- `implementation/core/**`
- `implementation/adapters/**`
- `implementation/tests/**`
- `implementation/README.md`

### Bucket 2: project truth docs
对应：
- `README.md`
- `STATUS.md`
- `RESUME.md`
- `execution/COLLAB.md`
- `docs/README.md`

### Bucket 3: design and planning docs
对应：
- `plan/architecture/**`
- `plan/active/**`
- `plan/candidates/**`
- `docs/router-config-guide.md`

### Bucket 4: meta methodology
对应：
- `meta/skill-draft/**`

### Bucket 5: validation assets
对应：
- `validation/**`
- 与验证直接相关的 fixture / harness asset

这里的 `bucket` 只是给 staging 和 commit 分组用，不是对这些文件语义的重新定义。

## Module boundaries

### `implementation/core/`
定位：
- ACR 的 runtime-neutral contracts、state、routing、trace、config loader

应该放这里：
- 通用类型与 schema
- route decision / ingress normalization / service result
- 通用 state store 与 read model
- 不依赖具体宿主的 contract tests

不应该放这里：
- OpenClaw plugin host 细节
- Feishu/Lark CLI 调用
- 某个具体项目的 payload mapping 或 demo adapter

依赖规则：
- 可以被 adapters 依赖
- 不应反向依赖任何 adapter 目录

### `implementation/adapters/openclaw/runtime/`
定位：
- OpenClaw runtime bridge

应该放这里：
- runtime bindings
- session delivery bridge
- governance / notification runtime sender
- 只对 OpenClaw runtime 成立的 adapter 逻辑

不应该放这里：
- 通用 routing 决策
- Feishu 外部系统逻辑
- 项目私有 orchestrator 规则

### `implementation/adapters/openclaw/plugin/`
定位：
- OpenClaw plugin host、commands、hooks、validation entrypoints

应该放这里：
- plugin 注册
- `/project ...` 命令面
- host-specific hook
- OpenClaw message protocol recognition

不应该放这里：
- runtime-neutral core contract
- Feishu Base 写入细节

### `implementation/adapters/feishu/`
定位：
- Feishu/Lark work-surface 与 governance adapter

应该放这里：
- config host loader
- project catalog sync
- task/bug writeback
- business notification delivery adapter

不应该放这里：
- OpenClaw plugin host 逻辑
- ACR core 的通用 route model

### `implementation/tests/`
定位：
- 以模块边界组织测试，而不是把测试散回各目录

当前分层：
- `implementation/tests/core/`
- `implementation/tests/openclaw/`

未来如有必要可增加：
- `implementation/tests/feishu/`
- `implementation/tests/integration/`

### `validation/`
定位：
- validation fixture、演示桥接目标、回归验证资产

规则：
- 可以被测试与验证脚本依赖
- 不是主实现目录
- 不承载核心实现逻辑

### `meta/skill-draft/`
定位：
- 元资产与并行抽象草稿

规则：
- 默认不是主产品 runtime 依赖
- 可以进 repo，但应视为“meta layer”，不是 implementation layer
- 若未来开始服务多个 repo 且拥有独立版本节奏，再评估拆仓

## Gitignore policy
仓库应只跟踪：
- 共享真相
- 代码与测试
- 可复现的验证资产

默认应忽略：
- editor / OS 噪声
- `node_modules`、coverage、dist、日志
- `.env` 一类机器私有配置
- 高频 scratch 文件，例如 `*.local.md`

规则：
- 能稳定重建的生成物不要进 repo
- 只对当前操作者有意义的本地 working state 不要进 repo
- 若某类文件未来需要共享，优先提供 `*.example` / `*.sample` 模板，而不是提交个人本地版本

## Commit policy

### Core rule
一个 commit 只表达一个“可 review、可回滚、可解释”的意图。

允许的 commit 形态：
- 一个完整功能切片
- 一个纯重构
- 一组测试补强
- 一次文档或真相回写

默认不允许：
- 多个无关 feature 混在一个 commit
- 代码实现与本地 scratch 文件混在一个 commit
- “顺手改了很多”但 message 无法准确概括的提交

### Recommended split order
默认按下面顺序拆：
1. `refactor` 或结构迁移
2. `feat` / `fix`
3. `test`
4. `docs`

如果重构与功能强耦合、拆开后中间 commit 会不自洽，则允许合并为一个实现 commit。

### Commit cadence
建议规则：
- 至少每完成一个“测试通过的切片”就提交一次
- 不要长时间在 `main` 上累积未提交大改动
- 默认先开分支，再分批 commit

### Branch rule
建议默认分支前缀：
- `codex/`
- `feat/`
- `fix/`
- `docs/`

示例：
- `codex/step2-router-split`
- `feat/feishu-catalog-sync`
- `docs/monorepo-governance`

## Commit message format
建议采用 Conventional Commits：

```text
<type>(<scope>): <summary>
```

推荐 `type`：
- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`

推荐 `scope`：
- `core`
- `openclaw-plugin`
- `openclaw-runtime`
- `feishu-adapter`
- `router-config`
- `validation`
- `docs-truth`
- `docs-plan`
- `collab`
- `meta-skill`
- `repo`

示例：
- `feat(core): add project-owned service bridge route path`
- `refactor(openclaw-plugin): fold legacy commands into unified /project entry`
- `feat(feishu-adapter): add project catalog sync apply path`
- `test(openclaw-runtime): cover session delivery fallback`
- `docs(docs-truth): update repo governance entrypoints`

### Optional body template
当提交不是极小改动时，建议补 body：

```text
Why:
- 为什么要改

What:
- 改了什么
- 没改什么

Validation:
- 跑了哪些测试或验证
```

## Recommended commit buckets
当前仓库默认建议按下面 5 类提交桶拆分：

### Bucket 1: implementation slice
适合放：
- `implementation/core/**`
- `implementation/adapters/**`
- `implementation/tests/**`
- 与实现行为强绑定的 `router.yaml`
- 与实现行为强绑定的 `docs/router-config-guide.md`

推荐 type/scope：
- `feat(core)`
- `fix(openclaw-plugin)`
- `refactor(feishu-adapter)`
- `test(openclaw-runtime)`

### Bucket 2: repo truth docs
适合放：
- `README.md`
- `STATUS.md`
- `RESUME.md`
- `execution/COLLAB.md`
- `docs/README.md`
- `docs/monorepo-governance.md`

推荐 type/scope：
- `docs(docs-truth)`
- `docs(collab)`
- `docs(repo)`

规则：
- 只提交需要被版本化、review、回滚的共享变更
- 不要把 session 级 scratch note 或本地运行态混入这一桶

### Bucket 3: design / plan docs
适合放：
- `plan/architecture/**`
- `plan/active/**`
- `plan/candidates/**`

推荐 type/scope：
- `docs(docs-truth)` 当 architecture 已升格为稳定真相时
- `docs(docs-plan)` 当仍处于 active / candidates 推进阶段时

### Bucket 4: meta methodology
适合放：
- `meta/skill-draft/**`

推荐 type/scope：
- `docs(meta-skill)`
- `feat(meta-skill)` 当其已经开始形成可执行 skill 资产时

### Bucket 5: validation assets
适合放：
- `validation/**`
- 验证脚本输出模板
- 可复现 fixture

推荐 type/scope：
- `test(validation)`
- `docs(validation)`

规则：
- 只纳入可复现、可共享的 fixture
- 本机一次性输出不要直接提交

## Default staging templates
下面这几个模板适合当前仓库的日常使用。

### Template A: feature + docs
当一个切片同时改了实现和对应契约说明时：
1. 先提交实现与测试
   - `implementation/**`
   - 必要时带上 `router.yaml`
   - 必要时带上 `validation/**`
2. 再单独提交文档
   - `docs/**`
   - `plan/**`
   - `README.md` / `STATUS.md` / `RESUME.md` / `execution/COLLAB.md`

### Template B: pure writeback
当这次没有代码变更，只是收口共享文档变更时：
1. 提交 `README.md` / `STATUS.md` / `RESUME.md` / `execution/COLLAB.md`
2. 若涉及设计升格，再单独提交 `plan/**`

### Template C: structure migration
当一次调整主要是搬迁目录与边界收口时：
1. `refactor(...)` 提交结构迁移
2. `test(...)` 提交测试修正
3. `docs(...)` 提交说明和门厅更新

### Template D: meta extraction
当从当前项目抽出 skill / methodology 时：
1. `docs(meta-skill)` 或 `feat(meta-skill)` 提交 `meta/skill-draft/**`
2. 若 repo 入口因此变化，再单独提交 `docs(docs-truth)`

## Review and staging rule
提交前至少自查三件事：
- 这批文件是否真的属于同一个意图
- 是否混入了本地 scratch 或一次性输出
- 是否有对应测试或文档更新

推荐暂存方式：
- 先按模块或意图分组 `git add`
- 每组 staged 后再看一次 `git diff --cached --stat`
- 不确定时宁可拆成两个 commit，也不要硬凑一个

## Near-term upgrade path
当前不要求立刻改目录为 `packages/*`，但可以先按 monorepo 规则治理。

未来满足以下条件时，可考虑升级目录形态：
- 模块继续增多
- 测试与脚本需要更强的 workspace 管理
- 子模块出现更明确的 owner / release cadence

在那之前，优先级应是：
- 先把边界、gitignore、commit scope、测试入口治理好
- 再评估是否需要目录升级
