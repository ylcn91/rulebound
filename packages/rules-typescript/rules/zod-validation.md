---
title: Zod Validation
category: architecture
severity: warning
modality: should
tags: [typescript, validation, zod, schema]
stack: [typescript]
---

# Zod Validation

Use Zod schemas for runtime validation of external data (API responses, user input, env vars).

## Rules

- Define Zod schemas for all API request/response bodies
- Validate environment variables at startup with `z.object()`
- Use `z.infer<typeof schema>` to derive TypeScript types from schemas
- Prefer Zod over manual type assertions or `as` casts

## Good Example

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});
type User = z.infer<typeof UserSchema>;

const user = UserSchema.parse(rawData);
```

## Bad Example

```typescript
const user = rawData as User;
```
