---
title: Input Sanitization
category: security
severity: error
modality: must
tags: [xss, injection, sanitization, validation]
---

# Input Sanitization

All user input MUST be validated and sanitized before processing. Never trust client-side data.

## Rules

- Validate all input with a schema validator (Zod, Joi, etc.)
- Escape HTML output to prevent XSS
- Use parameterized queries to prevent SQL injection
- Never use `eval()`, `exec()`, or `new Function()` with user input
- Validate file uploads (type, size, content)

## Good Example

```typescript
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});
const data = schema.parse(req.body);
```

## Bad Example

```typescript
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`;
```
