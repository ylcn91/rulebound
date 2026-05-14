---
title: TypeScript compile must succeed
category: quality
severity: error
modality: must
tags: [typescript, tsc, analyzer, deterministic]
stack: [typescript]
checks:
  - type: analyzer
    id: tsc-noemit
    analyzer: tsc
    run: "pnpm tsc --noEmit > reports/tsc.log 2>&1"
    report: "reports/tsc.log"
    report_format: text
    pass_exit_codes: [0]
    severity: error
    message: "TypeScript compile errors. Run `pnpm tsc --noEmit` locally to reproduce."
---

# TypeScript compile must succeed

`tsc --noEmit` is the source of truth for TypeScript correctness. This rule
fails the gate whenever `tsc` exits non-zero. The check is exit-code-driven:
`report_format: text` parses nothing and `pass_exit_codes: [0]` decides the
verdict.

Requires `--allow-commands` to execute. See `docs/recipes/typescript-tsc.md`.
