---
title: Zod Schema Validation
category: security
severity: error
modality: must
tags: [zod, validation, input, api]
---

# Zod Schema Validation

All external input MUST be validated with Zod schemas at API boundaries. Never trust client-side validation alone.

## Rules

- Every API endpoint must validate request body/params with Zod
- Zod schemas must be the single source of truth for input types
- Use `z.infer<typeof schema>` to derive TypeScript types from schemas
- Validation errors must return structured 400 responses with field-level details
- Shared schemas go in a `schemas/` directory, co-located with the domain

## Good Example

```typescript
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

export async function POST(req: Request) {
  const parsed = CreateUserSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  // parsed.data is fully typed
}
```
