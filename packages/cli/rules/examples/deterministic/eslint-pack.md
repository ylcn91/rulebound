---
title: ESLint must report zero warnings on the diff
category: quality
severity: error
modality: must
tags: [eslint, javascript, typescript, analyzer, deterministic]
stack: [typescript, javascript]
checks:
  - type: analyzer
    id: eslint-sarif
    analyzer: eslint
    run: "pnpm eslint --format @microsoft/eslint-formatter-sarif -o reports/eslint.sarif ."
    report: "reports/eslint.sarif"
    report_format: sarif
    fail_on_severity: warning
    severity: error
    message: "ESLint reported lint findings. Fix them or document an explicit waiver."
---

# ESLint must report zero warnings on the diff

ESLint is the canonical lint gate for TypeScript and JavaScript. This rule
wires ESLint's SARIF output into Rulebound as a deterministic analyzer check —
the verdict comes straight from ESLint, Rulebound only normalizes findings.

The `run:` command requires `--allow-commands`. In CI, prefer running ESLint
as a standalone step and letting Rulebound read `reports/eslint.sarif`. See
`docs/recipes/eslint.md` for the full setup.
