# Research Handoff for Implementation

## 目的
这份文档是给 implementation 阶段（包括 Codex）用的最小 research 入口，避免开发时找不到 research context。

## 必读研究文档（最小 handoff set）
按优先级阅读：
1. `../../exploration/assistant-routing-research/research/research-summary.md`
2. `../../exploration/assistant-routing-research/research/implementation-brief.md`
3. `../../exploration/assistant-routing-research/research/implementation-constraints.md`
4. `../../exploration/assistant-routing-research/research/project-centric-interaction-model.md`
5. `../../exploration/assistant-routing-research/research/project-context-loading-model.md`
6. `../../exploration/assistant-routing-research/research/explicit-triggers-and-routing.md`
7. `../../exploration/assistant-routing-research/research/context-state-ownership.md`

## 与当前 delivery 项目强相关的补充文档
8. `plan/mvp-architecture-draft.md`
9. `plan/decision-record.md`
10. `plan/mvp-scope.md`
11. `plan/work-breakdown.md`
12. `plan/interface-decision.md`
13. `plan/active/orchestrator-integration-boundary.md`

## 实施提醒
- 不要从零重新发明 research 结论
- 默认以 `openclaw-feishu-orchestrator` 作为 MVP 首批客户与验收场景
- 优先遵守：extension-first / project-centric / context-light / explicit triggers first / safe-fail / no global current-project singleton

## 如果需要更多背景
再按需回看：
- `../../exploration/assistant-routing-research/research/README.md`
- `../../exploration/assistant-routing-research/research/suggestions-review.md`
- `../../exploration/assistant-routing-research/suggestions/*.md`
