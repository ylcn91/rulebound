---
title: Checkstyle must report zero violations
category: quality
severity: error
modality: must
tags: [checkstyle, java, analyzer, deterministic]
stack: [java, maven]
checks:
  - type: analyzer
    id: java.checkstyle
    analyzer: checkstyle
    run: "mvn -q checkstyle:check"
    report: "target/checkstyle-result.xml"
    report_format: checkstyle-xml
    fail_on_severity: warning
    severity: error
    message: "Checkstyle reported violations against checkstyle.xml."
---

# Checkstyle must report zero violations

Checkstyle enforces structural and style rules from a single `checkstyle.xml`.
This rule runs `mvn checkstyle:check`, then Rulebound reads the resulting XML
report and reports each `<error>` element as a deterministic finding.

See `docs/recipes/checkstyle.md` for prerequisites and CI wiring.
