---
title: Structured Error Handling
category: architecture
severity: error
modality: must
tags: [errors, exceptions, logging]
---

# Structured Error Handling

All errors MUST be caught, logged with context, and returned in a structured format. Never swallow exceptions silently.

## Rules

- Every catch block must log the error with contextual information
- API endpoints must return structured error responses with status codes
- Never use empty catch blocks or `catch (e) {}`
- Include correlation IDs in error responses for traceability
- Distinguish between client errors (4xx) and server errors (5xx)

## Good Example

```typescript
try {
  const user = await db.users.findById(id);
  if (!user) throw new NotFoundError("User", id);
  return user;
} catch (error) {
  logger.error("Failed to fetch user", { userId: id, error });
  throw error;
}
```

## Bad Example

```typescript
try {
  return await db.users.findById(id);
} catch (e) {
  // silently ignored
  return null;
}
```
