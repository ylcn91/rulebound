---
title: No `debugger` statements in source
category: style
severity: error
modality: must
tags: [debugger, hygiene, deterministic]
stack: [typescript, javascript]
scope: [all]
---

# No `debugger` statements in source

`debugger;` statements pause execution under a connected debugger and have no
business in shipped code. The deterministic check below scans every `.ts`
file in the repo (excluding `node_modules`, `dist`, build outputs) for a
standalone `debugger` statement.

If a debugger pause is genuinely necessary during development, use it on a
branch and remove it before merging.

```rulebound
checks:
  - type: regex
    id: no-debugger-in-source
    pattern: "^\s*debugger\s*;?\s*$"
    flags: "gm"
    files:
      - "**/*.ts"
    forbidden: true
    severity: error
    message: "Remove `debugger;` before committing."
```
