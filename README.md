# Assistant Context Router

## What this project is
这是一个面向 OpenClaw 的 **project-aware assistant context routing** 项目。

目标不是重写 OpenClaw，也不是一开始就做一个泛化 router framework；而是在现实运行约束下，逐步交付一个：
- project-centric
- trigger-driven
- context-selective
- extension-first

的最小可行方案。

## What this README does
本文件承担：
- 项目长期定义
- 项目目标与边界
- 顶层阅读入口
- 主要目录角色说明

本文件不承担：
- 当前阶段总收口（见 `STATUS.md`）
- 当前工作恢复点（见 `RESUME.md`）
- 高频协作记录（见 `execution/COLLAB.md`）

## Current phase
当前项目已完成 Step 1 baseline，正在进行 Step 1.5 continuity 收口：hall-doc recovery 与 conversational save。

当前真实主线不是直接进入实现，而是先完成：
1. 顶层架构与路线图收口
2. Step 1.5 的 project switch / hall-doc recovery 修复
3. `/save` 的 continuity-first conversational save 收口
4. 随后再恢复 Step 2 的 routing 与 validation 设计

## Project goals
本项目当前要解决的核心问题是：
1. session 中显式 project 切换后，如何建立合理且 bounded 的 project context
2. 如何在 Step 1 baseline 之上叠加最小 routing policy layering
3. 如何让多个 agent（OpenClaw agent `coordinator-agent` / Codex / 其他）在文档驱动模式下稳定协作与恢复工作

## Non-goals (current stage)
当前阶段明确不做：
- 泛化 router framework
- 过早扩大默认上下文
- progress writeback implementation
- 正式打包通用 skill
- 绕过文档结构与工作态定义，直接冲进实现

## Top-level reading order
建议阅读顺序：
1. `STATUS.md` — 项目当前状态 / 单入口摘要
2. `README.md` — 项目长期定义与结构说明（本文）
3. `RESUME.md` — 当前工作恢复点
4. `docs/README.md` — 文档地图

## Working shortcuts
- 如果目标是 **resume 当前主线**：先读 `STATUS.md` -> `RESUME.md` -> `execution/COLLAB.md`
- 如果目标是 **判断 save / writeback 应写到哪**：先读 `RESUME.md` -> `execution/COLLAB.md` -> `docs/README.md`
- 如果目标是 **做架构判断**：先读 `plan/architecture/system-architecture-v1.md` -> `plan/architecture/roadmap-milestones-v1.md`

## Local configuration
真实运行时配置不应写入 repo。

- 从 `.env.example` 复制本机 `.env`，并填入 `FEISHU_BASE_TOKEN` 等私有值。
- Feishu adapter 也支持通过 `ACR_FEISHU_CONFIG_PATH` 指向本机 YAML config host。
- OpenClaw runtime bindings 可通过 `ACR_RUNTIME_BINDINGS_PATH` 或 plugin data dir 默认路径加载。
- 当前代码没有 live Feishu Base token fallback；缺少 env/config 时会 fail closed。

## Key project docs
- `STATUS.md`：当前阶段总收口 / 单入口摘要
- `RESUME.md`：当前工作主线、上次中断点、下一步
- `plan/architecture/system-architecture-v1.md`：顶层系统架构、稳定真相层与可替换 adapter 边界
- `plan/architecture/roadmap-milestones-v1.md`：长期 roadmap 与 milestone 入口
- `plan/architecture/memory-architecture-note.md`：memory 分层与 adapter 边界
- `plan/architecture/execution-backend-boundary.md`：ACP / native thread / LangGraph / Agents SDK 的边界
- `implementation-decision-v1.md`：MVP 决策、Step 1 现实修正、Step 2 layering decision
- `plan/active/step2-strategy-note.md`：Step 2 策略主文档
- `plan/active/orchestrator-integration-boundary.md`：与 orchestrator 的边界与语义分层
- `execution/COLLAB.md`：多 agent 协作对象 / handoff / review / writeback 面

## Directory roles
- `docs/`
  - 文档地图、导航、archive 入口
- `plan/`
  - 当前仍在推进中的策略 / 设计 / validation 问题
- `execution/`
  - 协作对象、handoff、review / decision 流转面
- `implementation/`
  - 代码、测试、实现说明、执行侧产物
- `docs/archive/`
  - 历史材料与已降级文档

## Upstream context
本项目承接以下上游研究：
- `../../exploration/assistant-routing-research/research/research-summary.md`
- `../../exploration/assistant-routing-research/research/implementation-brief.md`
- `../../exploration/assistant-routing-research/research/implementation-constraints.md`
