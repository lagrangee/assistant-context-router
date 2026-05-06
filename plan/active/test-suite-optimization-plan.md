# Test Suite Optimization Plan

## Goal

Keep tests that protect the current Assistant Context Router contract, and remove or collapse tests that only preserve development history.

## Current Contract Anchors

Tests should map to at least one of these active contracts:

- `/project` is the only public OpenClaw command surface; old aliases are retired guardrails only.
- Feishu `Tasks / Bugs` semantic execution is the live self-host path through `feishu_task_bug_semantic`.
- `validation_fixture` remains only as a rehearsal bridge for `demo-acr`, not as the primary ACR self-host runtime.
- Agent-output completion boundaries must fail closed unless they contain concrete summary, evidence, and structured operations.
- Business notification delivery must preserve the split between direct channel delivery, OpenClaw-session fallback, and record-only audit.
- Feishu payload shape compatibility is valuable when it reflects real host envelopes.

## Repo Test Inventory

The repo currently has one executable test entrypoint:

- `implementation/adapters/openclaw/plugin/package.json` -> `node --test ../../../tests/core/*.test.ts ../../../tests/openclaw/*.test.ts`

That runner covers both core contracts and OpenClaw plugin integration contracts.

## Cleanup Rules

- Keep one representative regression test per active contract branch.
- Collapse input-shape variants into table-driven tests when the expected behavior is identical.
- Delete tests that only prove an obsolete implementation path and are already covered by a current contract test.
- Prefer shared test builders over repeated full object literals.
- Prefer adapter/core contract tests over plugin-level duplicate coverage when both assert the same branch.

## Execution Scope

This cleanup intentionally touches tests only. Runtime code should change only if a test exposes an actual stale contract.

Primary files:

- `implementation/tests/core/business-notification-delivery.test.ts`
- `implementation/tests/core/router-config.test.ts`
- `implementation/tests/openclaw/automation-dispatch.test.ts`
- `implementation/tests/openclaw/index-registration.test.ts`
- `implementation/tests/openclaw/runtime-session-binding.test.ts`
- `implementation/tests/openclaw/semantic-boundary-output.test.ts`
- `implementation/tests/openclaw/business-notification-delivery-adapter.test.ts`
- `implementation/tests/openclaw/openclaw-test-helpers.ts`

Verification:

```sh
cd implementation/adapters/openclaw/plugin
npm test
```
