# Assistant Context Router Implementation

This directory contains the MVP Step 1 implementation for the Assistant Context Router.

Step 1 / Step 1.5 currently include:
- project registry loading
- session-owned project state storage
- `/projects` and `/project <id>` command handlers
- project context extraction
- `before_prompt_build` context injection
- route trace primitives
- hall-doc-first project recovery
- conversational `/save` with draft -> confirm -> apply

Step 1 intentionally does not include protocol routing or a custom context engine.

Current note:
- Step 1.5 has moved default recovery to hall docs:
  - `STATUS.md`
  - `README.md`
  - `RESUME.md`
- the current `/save` implementation is a bounded conversational baseline
- stronger `coordinator-agent`-native LLM compaction can be layered later, but is not yet the default runtime behavior
