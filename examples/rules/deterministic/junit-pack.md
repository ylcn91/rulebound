---
title: ArchUnit tests must pass
category: architecture
severity: error
modality: must
tags: [junit, archunit, java, analyzer, deterministic, surefire]
stack: [java, maven]
checks:
  - type: analyzer
    id: archunit-tests
    analyzer: junit
    run: "mvn -q test -Dtest=ArchitectureTest"
    report: "target/surefire-reports/TEST-com.example.ArchitectureTest.xml"
    report_format: junit-xml
    fail_on_severity: error
    severity: error
    message: "ArchUnit architecture tests failed. Review the failing test for the violated invariant."
---

# ArchUnit tests must pass

ArchUnit encodes architectural invariants (layering, naming, dependency
direction) as JUnit tests. Rulebound reads the Surefire JUnit XML report and
turns each failing test into a deterministic violation.

The same shape works for pytest's `--junitxml`, Gradle's
`build/test-results/test/*.xml`, etc. — point `report:` at whichever path
your runner writes. See `docs/recipes/junit.md`.
