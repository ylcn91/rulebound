---
title: Authentication and Authorization
category: security
severity: error
modality: must
tags: [auth, jwt, rbac, session]
---

# Authentication and Authorization

Implement proper authentication and authorization for all protected resources.

## Rules

- Use established auth libraries (NextAuth, Passport, etc.) instead of custom solutions
- Store JWT tokens in httpOnly cookies, never in localStorage
- Implement RBAC or ABAC for authorization
- Validate tokens on every protected request
- Implement session expiration and refresh rotation
- Hash passwords with bcrypt or argon2 (never MD5 or SHA1)

## Good Example

```typescript
const session = await getServerSession(authOptions);
if (!session || !hasPermission(session.user, "admin")) {
  return new Response("Forbidden", { status: 403 });
}
```

## Bad Example

```typescript
const token = localStorage.getItem("jwt");
```
