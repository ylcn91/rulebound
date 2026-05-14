---
title: CLI command changes require a CLI test update
category: testing
severity: error
modality: must
tags: [cli, testing, evidence]
stack: [typescript]
scope: [packages/cli]
---

# CLI command changes require a CLI test update

When any command under `packages/cli/src/commands/*.ts` is modified, the same
change set must include at least one CLI test update — either a colocated
`*.test.ts` inside `packages/cli/src/commands/` or an integration test under
`packages/cli/src/__tests__/`.

Commands are the user-visible surface. Letting them drift without a test
change has bitten this repo before (exit-code regressions, format flag
regressions).

```rulebound
checks:
  - type: diff-evidence
    id: cli-command-needs-test
    severity: error
    when_changed:
      - "packages/cli/src/commands/*.ts"
    require_changed:
      - "packages/cli/src/__tests__/**/*.test.ts"
      - "packages/cli/src/commands/**/*.test.ts"
    message: "CLI command changed without an accompanying test update under packages/cli/src/__tests__/ or packages/cli/src/commands/*.test.ts."
```
