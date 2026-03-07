---
title: Strict Error Handling
category: architecture
severity: error
modality: must
tags: [typescript, errors, try-catch]
stack: [typescript]
---

# Strict Error Handling

Handle all errors explicitly. Never swallow exceptions.

## Rules

- Always type catch clause errors as `unknown` and narrow
- Never use empty catch blocks
- Log errors with structured context (not just `console.error(e)`)
- Return or throw -- never silently continue after an error
- Use custom error classes for domain-specific errors

## Good Example

```typescript
try {
  const data = await fetchData();
} catch (error) {
  if (error instanceof NetworkError) {
    logger.warn("Network issue", { url, error: error.message });
    return fallbackData;
  }
  throw error;
}
```

## Bad Example

```typescript
try {
  const data = await fetchData();
} catch (e) {
  // ignore
}
```
