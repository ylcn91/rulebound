---
title: Branch Naming Convention
category: workflow
severity: warning
modality: should
tags: [git, branch, naming, convention]
stack: []
scope: []
---

# Branch Naming Convention

Branches SHOULD follow the `type/description` naming pattern.

## Rules

- Use conventional prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`
- Use lowercase with hyphens as separators
- Keep descriptions short and descriptive
- No spaces or special characters
- Include ticket number when applicable: `feat/JIRA-123-add-auth`

## Good Example

```bash
feat/add-jwt-authentication
fix/redis-connection-leak
refactor/extract-order-domain
test/add-payment-integration-tests
chore/upgrade-spring-boot-3.4
feat/EJ-456-url-maker-cache
```

## Bad Example

```bash
my-branch
feature_new_stuff
john/working-on-it
test
fix
WIP
```
