# Step 1 Completion Summary

Assistant Context Router MVP Step 1 is complete and has now been validated against a live local OpenClaw runtime.

Implemented:
- project registry loading from `projects/index.yaml`
- session-owned current project storage through a store adapter
- `/projects` command handler
- `/project <id>` command handler
- project context extraction from `project.yaml`, `README.md`, and `docs/recent-state.md`
- `before_prompt_build` project context injection
- route trace primitives and safe-fail handling for invalid project bindings
- typo-tolerant and keyword-tolerant `/project` resolution
- free-text filtering for `/projects`
- Step 1 unit tests and plugin registration tests

Step 1 stays within the agreed MVP boundary:
- no daemon service
- no full router framework
- no protocol router Step 2
- no context-engine upgrade

## Live Validation Outcome

The following Step 1 behaviors are now confirmed on a real local OpenClaw instance:

- plugin loads successfully
- plugin registers both `projects` and `project`
- `/commands` shows plugin commands
- `/projects` executes successfully in TUI
- `/project <id>` executes successfully when routed through `before_dispatch`
- `before_prompt_build` is registered and active

Important behavior learned during live validation:

- TUI sometimes prepends timestamp-style metadata like `[Sat ...]` before user text
- `before_dispatch` now strips those wrappers before checking slash-like commands
- native plugin command handlers still do not receive `sessionKey`
- therefore the real Step 1 happy path for `/project <id>` is:
  `TUI message -> before_dispatch -> session-owned state write -> before_prompt_build`

## Current User Experience Behavior

Current UX improvements now in place:

- `/project` supports exact `project_id`
- `/project` supports silent auto-correct when there is one strong match
- `/project feishu orchestrator` style keyword queries can resolve directly
- `/projects` supports free-text filtering such as `/projects feishu`

Current known UX limitation:

- typing `/` in the OpenClaw TUI does not automatically show plugin commands in its local slash autocomplete UI
- this appears to be a TUI/runtime behavior, not an `assistant-context-router` registration failure
- plugin commands are still visible through `/commands` and execute correctly when typed directly

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

## 1. Native plugin command handler session context

Current reality after live validation:
- native `registerCommand(...)` handlers do receive `ctx.args`
- native command handlers do **not** currently provide usable `sessionKey` in the tested runtime
- this matches the local OpenClaw SDK types inspected during validation

Status:
- implementation is still defensive and checks `ctx.sessionKey`, `ctx.session.sessionKey`, and `ctx.session.key`
- but the tested local runtime path did not provide those fields
- `before_dispatch` **does** provide `sessionKey`, so Step 1 remains functional without redesign

Implication:
- do not rely on native plugin command handlers alone for session-owned project switching
- keep `before_dispatch` as the real session-aware command path unless OpenClaw later adds session context to plugin command handlers

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
- local plugin load has been validated successfully
- `configSchema` support and native plugin object export shape were both required for real load success

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

Observed status:
- passed

### 2. `/projects` command validation

Verify:
- command executes in a live OpenClaw session
- output lists entries from `~/ourclawd/workspace/projects/index.yaml`
- no session state mutation occurs

Pass condition:
- live command output shows known projects including `proj-assistant-context-router` or `proj-openclaw-feishu-orchestrator`

Observed status:
- passed

### 3. `/project <id>` command validation

Verify:
- command can resolve `proj-openclaw-feishu-orchestrator` or another known project
- session-aware path writes session-owned state
- typo and keyword-tolerant resolution behave sanely

Pass condition:
- command responds with current project summary
- subsequent prompt build in the same session can see the project binding

Observed status:
- passed through `before_dispatch`

Important note:
- the native plugin command handler itself still lacks session context in the tested runtime
- the working path is the slash-like `before_dispatch` bridge

### 4. `before_prompt_build` validation

Verify:
- after `/project <id>`, the next model turn receives injected project context
- injected context is visible in prompt-debug tooling or logs if available
- no context explosion occurs

Pass condition:
- the assistant behaves as if the selected project is the current working boundary
- prompt injection uses the bounded summary instead of full project docs

Observed status:
- hook registration is confirmed
- full user-facing project-aware follow-up turn should still be rechecked once after any future runtime upgrade

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

Observed status:
- covered by automated tests
- should be re-smoke-tested manually only if store/runtime semantics change

## Minimal Local Validation Sequence

Recommended shortest path:
1. load plugin locally
2. run `/projects`
3. run `/project proj-openclaw-feishu-orchestrator`
4. send one normal follow-up message in the same session
5. inspect whether project-aware context injection happened
6. simulate one invalid binding case and confirm invalidation

Actual live validation completed:
1. plugin loaded successfully
2. `/commands` showed plugin commands
3. `/projects` executed successfully
4. `/project` executed successfully after fixing TUI metadata-prefix stripping
5. typo-driven failures led to auto-correct / suggestion hardening
6. `/projects` filtering and keyword-based `/project` resolution were added for usability

# Step 2 Entry Conditions

Do not start Step 2 until all of the following are true:

## 1. Plugin load path is confirmed locally

Required:
- plugin can actually be loaded by the local OpenClaw instance
- commands and hook register successfully in the real runtime

Current status:
- satisfied

## 2. Command session context is confirmed

Required:
- there is at least one stable live runtime path that gives `/project <id>` session context
- that path is accepted as the Step 1 production path

Current status:
- satisfied via `before_dispatch`
- not satisfied via native plugin command handler alone

## 3. Prompt injection contract is confirmed

Required:
- `before_prompt_build` returning `prependSystemContext` is observed to work in the live runtime
- no hidden payload-shape mismatch remains

Current status:
- registration and return contract are aligned
- one more manual smoke turn is still recommended after any runtime/plugin loader changes

## 4. Store path is confirmed acceptable

Required:
- runtime-owned data dir behavior is validated, or
- fallback path is explicitly accepted for local MVP use

Current status:
- satisfied for local MVP use

## 5. Invalid binding degradation is confirmed

Required:
- unresolved project bindings are invalidated in a live run
- stale project context is not silently reused

Current status:
- satisfied in automated validation
- low-risk manual recheck only if runtime semantics change

## 6. Step 2 scope remains narrow

Required:
- Step 2 only adds protocol routing MVP
- Step 1 command/store/context architecture remains unchanged unless live validation exposes a real integration mismatch

Current status:
- still satisfied
