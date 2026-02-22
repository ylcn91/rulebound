---
title: No Hardcoded Secrets
category: security
severity: error
modality: must
tags: [secrets, env, credentials]
stack: []
scope: [all]
---

# No Hardcoded Secrets

All secrets, API keys, tokens, and credentials MUST be loaded from environment variables or a secrets manager. Never commit secrets to source control.

## Rules

- Never hardcode API keys, passwords, or tokens in source files
- Use `.env` files for local development (always in `.gitignore`)
- Use a secrets manager (Vault, AWS Secrets Manager, etc.) in production
- Rotate credentials immediately if accidentally committed

## Good Example

```typescript
const apiKey = process.env.STRIPE_API_KEY;
if (!apiKey) throw new Error("STRIPE_API_KEY is required");
```

## Bad Example

```typescript
const apiKey = "sk_live_abc123...";
```
