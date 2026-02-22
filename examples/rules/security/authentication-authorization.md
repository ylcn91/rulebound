---
title: Authentication and Authorization
category: security
severity: error
modality: must
tags: [auth, rbac, security, api]
---

# Authentication and Authorization

Every API endpoint MUST enforce authentication and authorization. No endpoint should be accessible without explicit access control decisions.

## Rules

- All endpoints must check authentication before processing
- Use role-based (RBAC) or attribute-based (ABAC) access control
- Authorization checks must happen at the service layer, not just middleware
- Public endpoints must be explicitly marked and documented
- Use short-lived tokens (JWT with <15min expiry) with refresh rotation
- Never store sensitive auth data in localStorage — use httpOnly cookies

## Good Example

```typescript
export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const canAccess = await checkPermission(session.userId, "orders:read");
  if (!canAccess) return new Response("Forbidden", { status: 403 });

  const orders = await orderService.list(session.userId);
  return Response.json(orders);
}
```
