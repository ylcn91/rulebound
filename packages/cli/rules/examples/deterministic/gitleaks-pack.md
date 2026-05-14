---
title: gitleaks must report zero secrets
category: security
severity: error
modality: must
tags: [gitleaks, secrets, security, analyzer, deterministic, sarif]
checks:
  - type: analyzer
    id: gitleaks-scan
    analyzer: gitleaks
    run: "gitleaks detect --redact --report-format sarif --report-path reports/gitleaks.sarif"
    report: "reports/gitleaks.sarif"
    report_format: sarif
    fail_on_severity: warning
    severity: error
    message: "gitleaks found potential secrets. Rotate any real credentials and update .gitleaks.toml for false positives."
---

# gitleaks must report zero secrets

gitleaks scans the working tree (and optionally git history) for committed
credentials. This rule consumes its SARIF report — every gitleaks finding
becomes a Rulebound violation.

Add false positives to `.gitleaks.toml` allow-lists rather than waiving them
through Rulebound. See `docs/recipes/gitleaks.md`.
