---
title: SpotBugs must report zero bug instances
category: quality
severity: error
modality: must
tags: [spotbugs, java, analyzer, deterministic]
stack: [java, maven]
checks:
  - type: analyzer
    id: java.spotbugs
    analyzer: spotbugs
    run: "mvn -q compile spotbugs:check"
    report: "target/spotbugsXml.xml"
    report_format: spotbugs-xml
    fail_on_severity: warning
    severity: error
    message: "SpotBugs reported bug instances."
---

# SpotBugs must report zero bug instances

SpotBugs analyzes compiled `.class` files for bug patterns. The rule's
`run:` includes `mvn compile` so the project is built before SpotBugs walks
the bytecode — without that step SpotBugs silently produces an empty report.

See `docs/recipes/spotbugs.md`.
