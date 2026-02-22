---
title: Strict TypeScript Types
category: style
severity: error
modality: must
tags: [typescript, types, strict]
---

# Strict TypeScript Types

All TypeScript code MUST use strict typing. No `any`, no type assertions without justification, no implicit returns.

## Rules

- `strict: true` must be enabled in tsconfig.json
- Never use `any` — use `unknown` and narrow with type guards
- No `as` type assertions unless accompanied by a runtime check
- All function parameters and return types must be explicitly typed
- Use discriminated unions over optional fields for state variants
- Prefer `interface` for object shapes, `type` for unions and intersections

## Good Example

```typescript
interface User {
  id: string;
  name: string;
  role: "admin" | "member" | "viewer";
}

function getDisplayName(user: User): string {
  return user.name;
}
```

## Bad Example

```typescript
function getDisplayName(user: any) {
  return user.name;
}
```
