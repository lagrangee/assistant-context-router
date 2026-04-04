# Step 1 Completion Summary

Assistant Context Router MVP Step 1 is complete.

Implemented:
- project registry loading from `projects/index.yaml`
- session-owned current project storage through a store adapter
- `/projects` command handler
- `/project <id>` command handler
- project context extraction from `project.yaml`, `README.md`, and `docs/recent-state.md`
- `before_prompt_build` project context injection
- route trace primitives and safe-fail handling for invalid project bindings
- Step 1 unit tests and plugin registration tests

Step 1 stays within the agreed MVP boundary:
- no daemon service
- no full router framework
- no protocol router Step 2
- no context-engine upgrade

## Real OpenClaw Contract Alignment Achieved

The following parts are now aligned to documented OpenClaw plugin/runtime patterns:

- Plugin registration shape uses `registerCommand({...})`
- Prompt-time hook uses `api.on("before_prompt_build", ...)`
- Prompt injection returns `prependSystemContext`
- Plugin metadata now declares an OpenClaw extension entry
- Plugin data dir resolution prefers runtime-owned state dir when available

These alignments were based on OpenClaw plugin/runtime docs and are reflected in:
- `src/index.ts`
- `src/hooks/before-prompt-build.ts`
- `package.json`
- `openclaw.plugin.json`

# Interim Interfaces / Temporary Assumptions

The following parts are still interim and should be treated as temporary integration assumptions:

## 1. Command runtime context fields

Current assumption:
- command handler may receive `ctx.args`
- command handler may receive `ctx.sessionKey`
- or `ctx.session.sessionKey`
- or `ctx.session.key`

Status:
- this is not yet verified against a local live OpenClaw command invocation
- implementation is defensive and resolves any of the above if present
- if none are present, `/project <id>` returns an explicit message explaining that a command bridge/runtime-provided session key is required

Implication:
- Step 1 logic is correct, but final command runtime wiring may need a small field-name adjustment after local E2E validation

## 2. Runtime state dir helper

Current assumption:
- plugin runtime may expose `api.runtime.state.resolveStateDir()`

Fallbacks already implemented:
- `OPENCLAW_PLUGIN_DATA_DIR`
- `OPENCLAW_DATA_DIR`
- plugin-local `.local/`

Status:
- preferred path is aligned with runtime docs
- exact availability in the local OpenClaw build is still pending live verification

## 3. Plugin manifest loading path

Current assumption:
- OpenClaw can load plugin extension entry from package metadata and/or plugin manifest

Status:
- plugin metadata is now shaped to be loadable
- actual local loader behavior still needs one minimal plugin load test

## 4. Session metadata API

Current status:
- Step 1 does not depend on a formal session metadata API
- all state access is already isolated behind the store adapter

Interim behavior:
- fallback store uses `sessionKey`-keyed JSON state
- invalid bindings are invalidated instead of silently preserved

Replacement boundary:
- Step 2 or later can swap the adapter implementation without changing command, hook, or context loader logic

# Minimal Local E2E Validation Plan

Goal: verify that the Step 1 plugin can be loaded by local OpenClaw and can exercise the minimal project-context flow.

## Validation Order

### 1. Plugin load validation

Verify:
- OpenClaw detects the plugin
- plugin registration completes without startup errors
- `projects` and `project` commands are visible or invokable
- `before_prompt_build` hook is registered

Pass condition:
- local plugin load succeeds and no registration-time error is emitted

### 2. `/projects` command validation

Verify:
- command executes in a live OpenClaw session
- output lists entries from `~/ourclawd/workspace/projects/index.yaml`
- no session state mutation occurs

Pass condition:
- live command output shows known projects including `proj-assistant-context-router` or `proj-openclaw-feishu-orchestrator`

### 3. `/project <id>` command validation

Verify:
- command can resolve `proj-openclaw-feishu-orchestrator` or another known project
- command runtime actually supplies usable session context
- session-owned store records the binding

Pass condition:
- command responds with current project summary
- subsequent prompt build in the same session can see the project binding

If it fails:
- inspect which command context fields are actually present
- patch only the `src/index.ts` command wiring layer, not the core modules

### 4. `before_prompt_build` validation

Verify:
- after `/project <id>`, the next model turn receives injected project context
- injected context is visible in prompt-debug tooling or logs if available
- no context explosion occurs

Pass condition:
- the assistant behaves as if the selected project is the current working boundary
- prompt injection uses the bounded summary instead of full project docs

### 5. Invalid binding degradation validation

Verify:
- create or simulate a stale binding whose project no longer resolves
- next `before_prompt_build` run invalidates the binding
- route trace is updated
- assistant continues without stale project-bound context

Pass condition:
- `current_project_id` becomes `null`
- safe-fail trace is preserved
- no repeated bad binding reuse occurs

## Minimal Local Validation Sequence

Recommended shortest path:
1. load plugin locally
2. run `/projects`
3. run `/project proj-openclaw-feishu-orchestrator`
4. send one normal follow-up message in the same session
5. inspect whether project-aware context injection happened
6. simulate one invalid binding case and confirm invalidation

# Step 2 Entry Conditions

Do not start Step 2 until all of the following are true:

## 1. Plugin load path is confirmed locally

Required:
- plugin can actually be loaded by the local OpenClaw instance
- commands and hook register successfully in the real runtime

## 2. Command session context is confirmed

Required:
- `/project <id>` can obtain session context from the live command runtime
- if field names differ, they must be patched and revalidated first

## 3. Prompt injection contract is confirmed

Required:
- `before_prompt_build` returning `prependSystemContext` is observed to work in the live runtime
- no hidden payload-shape mismatch remains

## 4. Store path is confirmed acceptable

Required:
- runtime-owned data dir behavior is validated, or
- fallback path is explicitly accepted for local MVP use

## 5. Invalid binding degradation is confirmed

Required:
- unresolved project bindings are invalidated in a live run
- stale project context is not silently reused

## 6. Step 2 scope remains narrow

Required:
- Step 2 only adds protocol routing MVP
- Step 1 command/store/context architecture remains unchanged unless live validation exposes a real integration mismatch
