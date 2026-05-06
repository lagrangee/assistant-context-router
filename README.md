# Assistant Context Router

Assistant Context Router (ACR) is a project-aware routing and execution layer for
OpenClaw-hosted assistants.

It keeps the human-facing assistant experience centered on the main session, while
letting structured project events route into bounded project context, shadow lanes,
work-surface writeback, semantic execution requests, and governance notifications.

## What This Repo Owns

ACR owns the general contracts and runtime glue for:

- project focus and bounded context injection
- structured automation ingress
- route decisions and traceable safe-fail behavior
- project session shadow lanes
- service-first execution bridges
- harness context assembly and playbook selection
- strict agent-output boundary capture
- work-surface projection and writeback contracts
- OpenClaw plugin commands and hooks
- Feishu work-surface adapter contracts

It does not try to become a full orchestration platform, a generic workflow
engine, or the authority host for project-specific business truth. Project-specific
adapters and payload mappers should live in the integrating project repo and connect
through ACR's manifests and service contracts.

## Current State

The original Step 1 / Step 1.5 baseline is complete. The active system has moved
well beyond simple project switching:

- `/project` is the single public command surface for project focus, lane inspection,
  save mode, catalog sync, surface sync, governance, and notification audit.
- Structured OpenClaw messages using `[ACR_AUTOMATION] ... [/ACR_AUTOMATION]` are
  parsed into normalized envelopes before routing.
- Project-level `router.yaml` can override action routing and bind a service bridge.
- Feishu `Projects`, `Work Surface Snapshots`, business notification, governance
  delivery, and `Tasks / Bugs` writeback slices are implemented.
- `dispatch`, `review_resolution`, and `complete` can route through the Feishu
  Task/Bug semantic bridge.
- Main-session mediated semantic execution is supported: ACR reads a Task/Bug row,
  builds a compact execution context, queues it into the canonical OpenClaw main
  session, and captures a strict `[ACR_AUTOMATION]` completion boundary from the
  agent output.
- Completion writeback supports manual acceptance (`Reviewing / REVIEW_WAIT /
  need_review`) and direct finalization policies, with fail-closed guards around
  missing anchors, enum drift, placeholder summaries, and prose-only mutation claims.

The current project-owned router in this repo uses:

```yaml
service_binding:
  runtime_kind: feishu_task_bug_semantic
  target_ref: agent:main:main

task_bug_policy:
  defaults:
    acceptance_mode: manual_acceptance
    completion_notify_mode: no_dm_on_completion_boundary
    start_mode: manual_only
```

For the most current operational status, read `STATUS.md` first. For the next
work cut, read `RESUME.md`.

## Public Safety And Local Config

This repo is intended to be public-reviewable. Runtime credentials and local machine
paths must stay outside git.

- `.env.example` documents supported environment variables.
- A real local `.env` is intentionally not tracked.
- `FEISHU_BASE_TOKEN` is required for direct Feishu Base access unless a local config
  host supplies the binding.
- `ACR_FEISHU_CONFIG_PATH` may point to a local Feishu adapter YAML config host.
- `ACR_RUNTIME_BINDINGS_PATH` may point to a local runtime bindings YAML file.
- OpenClaw plugin data-dir defaults may also provide `feishu-adapter.yaml`,
  `runtime-bindings.yaml`, and related local runtime hosts.
- The code should fail closed when required env/config bindings are absent.

Do not commit live Base tokens, local absolute paths, personal session keys, or
machine-specific runtime files.

## Repository Layout

- `implementation/core/`
  - runtime-neutral project, routing, state, save, trace, and context contracts
- `implementation/harness/`
  - execution envelopes, compact context assembly, playbook registry/selection, and
    boundary protocol validation
- `implementation/domains/work-items/`
  - vendor-neutral task / bug / card / ticket playbook semantics
- `implementation/adapters/feishu/`
  - Feishu adapter config host and Task/Bug writeback support
- `implementation/adapters/work-surfaces/feishu/`
  - Feishu Base work-surface adapter utilities and navigation playbook
- `implementation/adapters/openclaw/plugin/`
  - OpenClaw plugin commands, hooks, protocol parsing, validation scripts, and tests
- `implementation/adapters/openclaw/runtime/`
  - OpenClaw runtime delivery bridge
- `implementation/tests/`
  - runtime-neutral and OpenClaw integration tests, plus public-safe fixtures
- `plan/`
  - active design contracts and candidate planning docs
- `docs/`
  - documentation map, router guide, repo governance, and archive entrypoints
- `execution/`
  - collaboration and handoff notes

## Key Concepts

### Main Session

The human-facing assistant surface remains the default place for conversation,
focus switching, review, and final decisions. ACR does not silently move the human
between project sessions.

### Project Session Shadow Lane

Project lanes are a trace and read model for routed events. They are useful for
summaries, inspection, and fallback delivery, but they are not the authoritative
runtime session.

### Structured Automation Ingress

Automation enters OpenClaw as a normal message, then the plugin recognizes the ACR
wrapper and parses the JSON payload into a normalized envelope. Missing project
resolution, unsupported routes, malformed protocol bodies, or unavailable service
bridges safe-fail with traceable results.

### Service Bridge

Project-level `router.yaml` can bind service routes to a runtime-specific bridge.
In this repo's self-hosted configuration, the bridge reads Feishu Task/Bug rows,
assembles semantic execution context, and queues a trusted system event into the
main session.

### Boundary Capture

When an agent completes routed work, it must emit a strict `[ACR_AUTOMATION]`
boundary block. ACR validates the boundary before applying side effects, so a prose
claim like "I updated the card" is not treated as an external mutation.

## Commands And Validation

The main test host is the OpenClaw plugin package:

```bash
cd implementation/adapters/openclaw/plugin
npm test
```

Useful validation scripts in that package include:

```bash
npm run validate:demo-acr
npm run validate:openclaw-cli
```

`validate:demo-acr` uses repo-local public-safe fixtures under
`implementation/tests/fixtures/demo-acr/`. If you need to validate against a real
external demo project root, set `ACR_DEMO_PROJECT_ROOT` explicitly.

## Runtime Configuration

ACR supports a layered config model:

- project-level router manifest: `router.yaml`
- optional global router config: plugin `routerConfigPath`
- Feishu adapter config: `ACR_FEISHU_CONFIG_PATH` or plugin data-dir default
- runtime bindings: `ACR_RUNTIME_BINDINGS_PATH` or plugin data-dir default
- direct env override for Feishu Base access: `FEISHU_BASE_TOKEN`

See `docs/router-config-guide.md` for the router manifest model and runtime binding
details.

## Reading Order

For reviewers:

1. `README.md`
2. `docs/README.md`
3. `implementation/README.md`
4. `docs/router-config-guide.md`
5. `implementation/adapters/openclaw/plugin`

For current project status:

1. `STATUS.md`
2. `RESUME.md`
3. `execution/COLLAB.md`
4. `plan/active/step2-strategy-note.md`

For Feishu / work-surface contracts:

1. `plan/active/feishu-sync-architecture-note.md`
2. `plan/active/feishu-adapter-config-host-contract.md`
3. `plan/active/feishu-action-ingress-contract.md`
4. `plan/active/feishu-task-bug-ownership-acceptance-contract.md`
5. `plan/active/feishu-work-surface-operating-model.md`

## Review Notes

This repo deliberately keeps many contracts small and explicit. The useful review
questions are:

- Does routing fail closed when project resolution or config is missing?
- Are external mutations backed by structured side-effect operations rather than
  prose claims?
- Does context assembly stay compact enough for real main-session execution?
- Are project-specific assumptions kept out of runtime-neutral core modules?
- Are local credentials and machine paths kept out of tracked files and history?

## Upstream Research Context

The project started from earlier assistant-routing research under the broader project owner
workspace. That research is useful historical context, but this repo's current truth
is the implementation, active plan docs, and validation fixtures in this repository.
