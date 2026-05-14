---
title: Bugfix branch requires a regression test
category: workflow
severity: error
modality: must
tags: [bugfix, testing, deterministic, diff-evidence]
checks:
  - type: diff-evidence
    id: bugfix-regression-test
    branch_matches: '^fix/'
    require_changed:
      - "**/*.test.ts"
      - "**/*.test.tsx"
      - "**/*.test.js"
      - "**/*Test.java"
      - "**/test_*.py"
      - "**/*_test.go"
    severity: error
    message: "fix/* branch must include at least one regression test."
---

# Bugfix branch requires a regression test

Every fix must ship with a regression test that fails on the unfixed code and
passes on the fix. Without that contract, the same bug returns silently in
the next release. Waive only for documentation-only fixes via
`.rulebound/waivers.yaml`.
