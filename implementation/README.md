# Assistant Context Router Implementation

This directory contains the current implementation layout for the Assistant Context Router.

Current structure:
- `core/`
  - runtime-neutral ACR contracts and logic
- `harness/`
  - generic execution envelope, playbook registry/selection, context assembly, and boundary protocol
- `domains/work-items/`
  - vendor-neutral task / bug / card / ticket playbook semantics
- `adapters/work-surfaces/feishu/`
  - Feishu Base work-surface adapter utilities and Feishu navigation playbook
- `adapters/openclaw/runtime/`
  - OpenClaw runtime adapter bridge
- `adapters/openclaw/plugin/`
  - OpenClaw-hosted plugin commands, hooks, and validation entrypoints
- `tests/core/`
  - runtime-neutral contract tests
- `tests/openclaw/`
  - OpenClaw integration tests

Step 1 / Step 1.5 currently include:
- project registry loading
- session-owned project state storage
- `/projects` and `/project <id>` command handlers
- project context extraction
- `before_prompt_build` context injection
- route trace primitives
- hall-doc-first project recovery
- conversational `/save` with draft -> confirm -> apply
- hook-driven save mode that captures `coordinator-agent` output into a pending draft
- save frame loaded from a plugin-owned prompt file rather than only from inline code
- project context rendered as a manifest plus small anchors instead of a summary-heavy block

Step 1 intentionally does not include protocol routing or a custom context engine.

Current note:
- Step 1.5 has moved default recovery to hall docs:
  - `STATUS.md`
  - `README.md`
  - `RESUME.md`
- the current `/save` implementation is a bounded conversational baseline
- `/save` now relies on hook-driven save mode rather than a direct plugin command for draft generation
- stronger `coordinator-agent`-native LLM compaction can be layered later, but is not yet the default runtime behavior

Step 2 skeleton now started with:
- richer routing primitives:
  - `NormalizedEnvelope`
  - `RouteDecision`
  - `ReplyTarget`
  - `ServiceResult`
  - richer `RouteTrace`
- structured ingress normalization for automation-like payloads
- OpenClaw plugin-side recognition of structured automation messages sent through a message-only ingress path
- route-decision helpers that distinguish:
  - `main_session`
  - `project_session`
  - `service`
  - `safe_fail`
- `/project` trace semantics aligned to main-session focus switch rather than session hopping
- automation ingress safe-fail baseline when `action_name` or project resolution is missing
- global router manifest loading via `routerConfigPath`
- project-level router manifest override from project-root `router.yaml` / `project-router.yaml`
- project-level `service_binding` for project-owned service bridge ingress
- canonical `main session` binding via explicit `runtimeBindingsPath`, env override, or plugin-owned default discovery at `<dataDir>/assistant-context-router/runtime-bindings.yaml`
- `project_session` binding plus runtime delivery through injected adapters
- project-owned service bridge delivery through injected adapters
- harness-layer semantic execution packaging through `ExecutionEnvelope`
- harness playbook selection based on typed facts, not natural-language title parsing
- Feishu Task/Bug semantic bridge producing work-surface origin facts and harness execution envelopes
- OpenClaw semantic executor delivering harness-assembled agent context to the main session
- boundary validation for agent-emitted `complete` / `review` / `blocked` results, including structured side-effect operations for external record mutations
- Feishu adapter config host via explicit `feishuConfigPath` or plugin-owned default discovery at `<dataDir>/assistant-context-router/feishu-adapter.yaml`
- governance delivery binding consumed by the default escalation path via an idempotent governance outbox
- governance sender bridged through OpenClaw runtime system-event delivery to the resolved main-session target
- OpenClaw-hosted plugin sync registration that is accepted by the OpenClaw plugin host
- built-in `openclaw_session` runtime adapter
- `project_session_binding.target_ref` interpreted as the target OpenClaw `sessionKey`
- OpenClaw runtime delivery bridge via `runtime.system.enqueueSystemEvent(...)`, with `runHeartbeatOnce({ heartbeat: { target: "last" } })` preferred before falling back to `requestHeartbeatNow(...)`
- shadow lane semantics for project-session fallback/read-model behavior

Current OpenClaw automation message protocol:
- ingress is still a normal message
- the OpenClaw plugin recognizes a structured wrapper:
  - `[ACR_AUTOMATION]`
  - JSON body
  - `[/ACR_AUTOMATION]`
- after wrapper recognition, the plugin parses the JSON into a `NormalizedEnvelope`
- this protocol recognition lives in the OpenClaw plugin layer, not in `core/`

General-only boundary:
- this repo owns the general routing model, not project-specific runtime adapters
- runtime-shared adapters such as OpenClaw and future Hermes belong under `implementation/adapters/`
- project-specific ingress mappers, service implementations, and runtime-side adapters should live in the project repo that integrates with ACR
- ACR may document the contract and provide generic tests/helpers, but should not hardcode a specific project's protocol or demo adapter into core implementation

This is still a bounded foundation layer, not a full execution router:
- it only supports minimal service execution through injected handlers
- it now also supports a project-owned `service_binding` bridge through injected adapters
- it keeps a local JSONL lane as a shadow lane / summary read model, not as the authoritative runtime session
- it does not yet merge cross-channel personal sessions inside the plugin
- the OpenClaw runtime adapter is MVP-only: no automatic session creation, no lifecycle management, and no final reply/escalation authority model yet

Validation entrypoints:
- `npm test`
- `npm run validate:demo-acr`
- `npm run validate:openclaw-cli`
  - boots an isolated OpenClaw config/state root under `/tmp`
  - loads the local ACR plugin through real OpenClaw CLI/Gateway dispatch
  - exercises `/project <id>` without manual TUI copy/paste
  - optionally sends one follow-up prompt and checks gateway logs for `before_prompt_build`
