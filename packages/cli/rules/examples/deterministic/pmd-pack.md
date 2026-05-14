---
title: PMD must report zero violations
category: quality
severity: error
modality: must
tags: [pmd, java, analyzer, deterministic]
stack: [java, maven]
checks:
  - type: analyzer
    id: java.pmd
    analyzer: pmd
    run: "mvn -q pmd:check"
    report: "target/pmd.xml"
    report_format: pmd-xml
    fail_on_severity: warning
    severity: error
    message: "PMD reported violations. Fix them or document an explicit waiver."
---

# PMD must report zero violations

PMD enforces style and bug-pattern rules over Java source. This rule wires
`mvn pmd:check` (which writes `target/pmd.xml`) into Rulebound as a
deterministic analyzer check.

CI typically runs `mvn pmd:check` in a separate step and lets Rulebound read
the report without `--allow-commands`. See `docs/recipes/pmd.md`.
