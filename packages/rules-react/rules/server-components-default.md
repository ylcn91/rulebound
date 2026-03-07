---
title: Server Components by Default
category: architecture
severity: warning
modality: should
tags: [react, server-components, nextjs, rsc]
stack: [typescript, javascript]
---

# Server Components by Default

Use React Server Components by default. Only add "use client" when the component needs interactivity, browser APIs, or React hooks.

## Rules

- Default to Server Components (no directive needed)
- Add "use client" only for components using useState, useEffect, event handlers, or browser APIs
- Keep client components small and leaf-level
- Never add "use client" to layout or page components unless absolutely necessary
- Fetch data in Server Components, pass to Client Components as props

## Good Example

```typescript
// Server Component (default) -- fetches data directly
export default async function UserList() {
  const users = await db.select().from(usersTable);
  return <UserTable users={users} />;
}
```

## Bad Example

```typescript
"use client"
// Unnecessary client component for static data display
export default function UserList() {
  const [users, setUsers] = useState([]);
  useEffect(() => { fetch("/api/users").then(r => r.json()).then(setUsers); }, []);
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```
