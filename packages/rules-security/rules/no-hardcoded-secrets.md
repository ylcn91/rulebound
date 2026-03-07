---
title: No Hardcoded Secrets
category: security
severity: error
modality: must
tags: [secrets, env, credentials, api-keys]
---

# No Hardcoded Secrets

All secrets, API keys, tokens, and passwords MUST be loaded from environment variables or a secrets manager. Never commit secrets to source control.

## Rules

- Never hardcode API keys, tokens, or passwords in source files
- Use `.env` files for local development (add to `.gitignore`)
- Use a secrets manager (AWS Secrets Manager, Vault, etc.) in production
- Never log or print secret values

## Good Example

```typescript
const apiKey = process.env.STRIPE_API_KEY;
if (!apiKey) throw new Error("STRIPE_API_KEY is required");
```

## Bad Example

```typescript
const apiKey = "YOUR_API_KEY_HERE";
```
