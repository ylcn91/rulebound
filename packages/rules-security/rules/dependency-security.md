---
title: Dependency Security
category: security
severity: warning
modality: should
tags: [dependencies, npm, supply-chain]
---

# Dependency Security

Keep dependencies updated and audit for known vulnerabilities.

## Rules

- Run `npm audit` or `pnpm audit` regularly
- Pin exact dependency versions in production
- Review new dependencies before adding (check maintainer, downloads, last update)
- Use lockfiles (pnpm-lock.yaml, package-lock.json)
- Never run `curl | bash` for installations in CI/CD

## Good Example

```json
{
  "dependencies": {
    "express": "4.18.2"
  }
}
```

## Bad Example

```json
{
  "dependencies": {
    "express": "*"
  }
}
```
