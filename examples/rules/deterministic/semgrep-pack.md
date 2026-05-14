---
title: Semgrep must report zero blocking findings
category: security
severity: error
modality: must
tags: [semgrep, security, analyzer, deterministic, sarif]
checks:
  - type: analyzer
    id: semgrep-ci
    analyzer: semgrep
    run: "semgrep --config p/ci --sarif --output reports/semgrep.sarif ."
    report: "reports/semgrep.sarif"
    report_format: sarif
    fail_on_severity: warning
    severity: error
    message: "Semgrep reported findings. Triage them or document an explicit waiver."
---

# Semgrep must report zero blocking findings

Semgrep ships a deep registry of security and code-quality rules. This rule
runs the `p/ci` pack (or whatever pack you point it at) and treats any
`warning`-or-above SARIF result as a blocking violation.

Run Semgrep in CI as a separate step and let Rulebound read the SARIF, or
pass `--allow-commands` to let Rulebound run Semgrep itself. See
`docs/recipes/semgrep.md`.
