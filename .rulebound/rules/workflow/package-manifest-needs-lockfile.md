---
title: package.json changes require a lockfile update
category: workflow
severity: error
modality: must
tags: [pnpm, lockfile, dependencies, evidence]
stack: [typescript, javascript]
scope: [all]
---

# package.json changes require a lockfile update

Any change to a `package.json` in this monorepo must include a corresponding
update to `pnpm-lock.yaml`. Without it, `pnpm install --frozen-lockfile`
breaks on CI and developers can drift onto unpinned transitive versions.

```rulebound
checks:
  - type: diff-evidence
    id: package-manifest-needs-lockfile
    severity: error
    when_changed:
      - "**/package.json"
    require_changed:
      - "pnpm-lock.yaml"
    message: "package.json changed without an updated pnpm-lock.yaml — run `pnpm install` and commit the lockfile."
```
