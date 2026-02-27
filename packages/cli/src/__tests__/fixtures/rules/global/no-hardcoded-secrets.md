---
title: No Hardcoded Secrets
category: security
severity: error
modality: must
tags: [secrets, env, credentials]
---

# No Hardcoded Secrets

All secrets MUST be loaded from environment variables.

## Rules

- Never hardcode API keys, passwords, or tokens in source files
- Use `.env` files for local development

## Good Example

```typescript
const apiKey = process.env.STRIPE_API_KEY;
```

## Bad Example

```typescript
const apiKey = "sk_live_abc123...";
```
