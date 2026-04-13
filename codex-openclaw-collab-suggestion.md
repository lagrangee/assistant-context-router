# Codex x OpenClaw Collaboration Suggestion

## Background

Current local evidence shows that:

- Native `codex app` and `codex cli` share the same thread/session storage under `~/.codex`
- OpenClaw ACP sessions that invoke Codex are stored separately under project state, for example:
  - `workspace/state/sessions/agent%3Acodex%3Aacp%3A*.json`
- Those ACP session records use the schema `openclaw.acpx.session.v1`
- The Codex agent is currently invoked through `npx @zed-industries/codex-acp@^0.11.1`

So the current situation is:

- same `cwd` does not mean shared thread
- OpenClaw ACP session and native Codex thread are two different session systems

This explains why a Codex conversation started from OpenClaw ACP is not visible in native Codex App thread history.

## Goal

The intended goal is not merely "share workspace". That already exists.

The real goal is:

- OpenClaw can collaborate with Codex
- the collaboration content can be inspected in native Codex App / CLI
- the human can manually take over the same conversation with `codex resume`
- App, CLI, and OpenClaw can operate around one shared primary thread when needed

## Research Summary

Local CLI capabilities show that native Codex already supports non-interactive continuation of an existing session:

```bash
codex exec resume <SESSION_ID> "<PROMPT>"
```

This is the key capability.

It means OpenClaw does not need to write into Codex internal storage directly. Instead, it can reuse an existing native Codex session by invoking the official CLI entrypoint.

## Recommendation

Recommend a "native Codex thread as source of truth" model for selected collaboration tasks.

Core idea:

1. A native Codex thread is created in App or CLI
2. OpenClaw stores the corresponding `codexSessionId`
3. When OpenClaw needs Codex, it invokes:

```bash
codex exec resume <codexSessionId> "<structured prompt>"
```

4. The resulting exchange is written into the native Codex thread
5. The human can inspect or continue that same thread in Codex App / CLI

This is preferable to treating ACP as the primary session and trying to mirror it into Codex later.

## Why This Direction Is Better

Benefits:

- one primary context instead of two competing ones
- native visibility in Codex App and CLI
- easy human takeover with `codex resume`
- no need to reverse-engineer or mutate `~/.codex` internals
- lower long-term risk than dual-session synchronization

Compared with "keep ACP as primary and mirror to Codex", this model is cleaner because:

- there is a single authoritative conversation
- failure modes are simpler
- audit and handoff are easier
- debugging context drift is much easier

## Proposed Modes

This should not replace every OpenClaw-to-Codex invocation.

Recommend supporting two modes:

### Mode A: Isolated ACP Mode

Use the current ACP session model.

Good for:

- one-shot tasks
- batch jobs
- tasks where intermediate reasoning is not important
- tasks that should stay isolated from human threads

### Mode B: Shared Native Thread Mode

Use native Codex session as the primary thread and let OpenClaw resume it.

Good for:

- long-running collaboration
- tasks with frequent human takeover
- risky or ambiguous tasks that benefit from inspection
- workflows where human and automation both need the same evolving context

Default recommendation:

- keep ACP mode as default
- enable shared native thread mode only for selected high-value collaboration tasks

## Suggested Architecture

### Session Model

For shared native thread mode, OpenClaw should store at least:

- `codexSessionId`
- `cwd`
- `createdAt`
- `lastUsedAt`
- `mode = native-thread`
- optional `title`
- optional `lastPromptDigest`

OpenClaw may still keep its own local record for audit and orchestration, but that record should be treated as execution metadata, not the primary conversation context.

### Invocation Model

Instead of launching a separate ACP-managed Codex session as the main context, OpenClaw should:

1. resolve the active `codexSessionId`
2. build a structured prompt
3. call native Codex via CLI resume
4. parse the result
5. relay the result back into OpenClaw channels

The primary conversation history should live in the native Codex thread.

### Prompt Contract

OpenClaw should avoid ad hoc one-line prompts.

Recommend a stable structured prompt envelope containing:

- source channel
- task goal
- current workspace/cwd
- relevant context summary
- constraints
- requested output format
- permission boundary
- whether code changes are allowed
- whether command execution is allowed

This aligns better with project owner's document-driven operating style.

## First-Link Strategy

There are two viable ways to create the link between OpenClaw and a native Codex thread.

### Option 1: Human-Created Native Thread First

Flow:

1. Human creates a thread in Codex App or CLI
2. Human gives OpenClaw the `session_id`
3. OpenClaw resumes that session from then on

Pros:

- simplest and most controllable
- explicit ownership
- easy to reason about during rollout

Cons:

- requires manual setup

### Option 2: OpenClaw Creates the Native Session

Flow:

1. OpenClaw starts a native Codex session programmatically
2. captures the created `session_id`
3. persists it
4. uses `codex exec resume` afterwards

Pros:

- more automated

Cons:

- more implementation uncertainty
- likely more brittle during initial rollout

Recommendation:

- start with Option 1
- only automate creation after the collaboration model is proven useful

## Risks and Open Questions

### 1. Output Parsing Stability

If OpenClaw needs machine-readable output, it should evaluate whether `codex exec resume --json` is sufficient and stable enough.

If not, a stricter wrapper contract may be needed.

### 2. Context Growth

Long-lived shared threads may become heavy.

OpenClaw should define rules for:

- when to continue a thread
- when to fork a thread
- when to start a fresh thread by topic

### 3. Approval / Sandbox Semantics

The native Codex execution path may behave differently from the current ACP harness expectations.

OpenClaw needs explicit policy on:

- sandbox mode
- approval policy
- how unattended runs should behave

### 4. Concurrency

If OpenClaw and a human both write to the same native thread at the same time, context contamination becomes likely.

This needs an operational rule.

Recommended rule:

- one shared thread should have one active writer at a time
- human takeover should pause automatic writes from OpenClaw

## What Not To Do

Not recommended:

- directly writing to `~/.codex` sqlite/jsonl internals
- trying to fake native thread records
- keeping ACP session as the primary truth and doing full bidirectional sync to native Codex thread

These approaches are more fragile and much harder to maintain.

## Product Judgment: Is This Worth Doing?

This capability is useful, but not universally necessary.

It is worth doing when the real need is:

- unified context
- easy manual takeover
- auditability
- reduced recovery cost when automation drifts

It is not worth doing just to watch every step of automation.

So this should be treated as a selective collaboration feature, not a universal default.

Recommended product stance:

- default to isolated ACP sessions
- allow opt-in shared native thread mode for tasks that genuinely benefit from human + automation co-working

## Final Recommendation

Recommended direction for OpenClaw:

- do not try to make ACP sessions appear inside Codex App
- instead, add a collaboration mode where OpenClaw drives a real native Codex session through:

```bash
codex exec resume <SESSION_ID> "<PROMPT>"
```

- treat that native Codex session as the primary shared thread
- keep OpenClaw's own session records only as orchestration metadata
- roll this out as an opt-in mode for high-value collaborative tasks

## Short Version For Discussion

If OpenClaw wants Codex App / CLI visibility, the clean path is not "merge ACP storage into Codex".

The cleaner path is:

- use a real native Codex thread as the canonical conversation
- let OpenClaw resume that thread through official Codex CLI
- let humans inspect and continue that same thread when needed

That delivers shared visibility without depending on Codex internal storage hacks.
