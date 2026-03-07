---
title: No Any Type
category: style
severity: error
modality: must
tags: [typescript, types, any, strict]
stack: [typescript]
---

# No Any Type

Never use `any` type. Use `unknown` with type guards for values of uncertain type.

## Rules

- Replace `any` with `unknown` and add type narrowing
- Use generic type parameters instead of `any`
- Enable `noImplicitAny` in tsconfig
- Use `Record<string, unknown>` instead of `Record<string, any>`

## Good Example

```typescript
function parse(input: unknown): string {
  if (typeof input === "string") return input;
  throw new TypeError("Expected string");
}
```

## Bad Example

```typescript
function parse(input: any): string {
  return input;
}
```
