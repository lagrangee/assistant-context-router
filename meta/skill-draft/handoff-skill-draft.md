---
name: doc-driven-handoff
description: Use when a task needs structured collaboration between the main assistant and external agents such as Codex, Claude Code, Gemini, or similar coding/reasoning agents, especially when chat history is becoming noisy and the work should be handed off through project documents instead of human relay. Helps set up a document-driven collaboration loop with a docs map, a current collaboration panel, request/reply structure, and promotion rules for moving stable conclusions into formal project documents.
---

# Doc-Driven Handoff

Use project documents as the primary collaboration surface when multiple agents need to cooperate on a task.

## Core workflow
1. Check whether the project already has a docs map, a current collaboration panel, and formal planning documents.
2. If not, create the minimum document set needed for handoff:
   - docs map
   - collaboration panel
   - formal plan/strategy note when stable scope is needed
3. Write the current objective, confirmed facts, open questions, requests, and reply summaries into the collaboration panel.
4. Keep human involvement minimal: the human should mainly wake, redirect, or approve.
5. Move stable conclusions out of the collaboration panel and into formal project documents.
6. Do not promote project-specific habits into a reusable standard too early.

## Minimum document roles
- `docs/README.md`
  - entry map: where to start, which docs are authoritative, which docs are temporary
- `progress/collab.md`
  - current collaboration state only
- `plan/*.md`
  - stable strategy, boundaries, acceptance, decisions
- `progress/*.md`
  - step closure, implementation progress, validation notes

## Request / reply expectations
### Request should include
- objective
- scope
- out-of-scope
- output contract

### Reply should include
- summary
- findings / recommendation
- blocked by / needs decision when relevant
- suggested formal doc paths

## Promotion rules
Promote content into formal docs only when it is stable enough to be reused as a decision, boundary, acceptance rule, or strategy baseline.

Leave content in the collaboration panel when it is still:
- exploratory
- pending approval
- highly temporary
- specific to the current exchange only

## Role split
- Human
  - wake, approve, prioritize, decide
- Main assistant
  - define boundaries, maintain document structure, promote stable conclusions, decide when patterns are reusable
- External agent
  - read collaboration docs, execute the current request, write back structured results

## Non-goals
- Do not replace project-specific planning docs.
- Do not write the project's whole strategy automatically.
- Do not assume every task needs a collaboration panel.
- Do not turn one project's local conventions into a global standard without repeated validation.

## When to be cautious
Pause and avoid over-formalizing when:
- the task is too small for document setup overhead
- the project has no stable file home yet
- the user only wants a quick one-off answer
- the proposed collaboration structure has only been validated in one project or with one external agent type

## References to read when needed
- `references/protocol.md` for collaboration flow and role semantics
- `references/doc-layering.md` for docs map / plan / progress / archive layering
- `references/request-reply-format.md` for compact request/reply templates
- `references/promotion-rules.md` for deciding what should become a formal document

## Current status
This is a draft only. Validate it across more than one project and more than one external agent type before turning it into a real skill.
