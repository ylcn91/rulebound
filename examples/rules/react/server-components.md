---
title: Server Components by Default
category: architecture
severity: warning
modality: should
tags: [react, nextjs, rsc, performance]
stack: [react, typescript, nextjs]
scope: [frontend]
---

# Server Components by Default

React components SHOULD be Server Components by default. Only add `"use client"` when the component needs browser APIs, event handlers, or React hooks.

## Rules

- Default to Server Components — no directive needed
- Add `"use client"` only when using useState, useEffect, onClick, onChange, etc.
- Keep client components small and leaf-level
- Fetch data in Server Components, pass as props to client components
- Never import server-only code in client components

## Good Example

```tsx
// app/users/page.tsx — Server Component (default)
export default async function UsersPage() {
  const users = await db.users.findMany();
  return (
    <div>
      <h1>Users</h1>
      <UserSearch />  {/* client component for interactivity */}
      <UserList users={users} />  {/* server component with data */}
    </div>
  );
}
```

## Bad Example

```tsx
"use client"  // unnecessary — no client features used
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  useEffect(() => { fetch("/api/users").then(...) }, []);
  // should have been a Server Component with direct DB access
}
```
