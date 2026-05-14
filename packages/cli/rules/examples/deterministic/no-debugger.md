---
title: No debugger statements
category: style
severity: error
modality: must
tags: [style, deterministic, regex]
stack: [typescript, javascript]
checks:
  - type: regex
    id: no-debugger
    pattern: '\bdebugger\b'
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
    severity: error
    message: "Remove debugger statements before committing."
---

# No debugger statements

Ship-blocking. Pause helpers, breakpoints, and `debugger` statements must not
land in committed code. CI fails when this regex matches any tracked TS/JS file.

The check is deterministic: the same code yields the same verdict every run,
no LLM involved.
