# Assistant Context Router Implementation

This directory contains the MVP Step 1 implementation for the Assistant Context Router.

Step 1 includes:
- project registry loading
- session-owned project state storage
- `/projects` and `/project <id>` command handlers
- project context extraction
- `before_prompt_build` context injection
- route trace primitives

Step 1 intentionally does not include protocol routing or a custom context engine.
