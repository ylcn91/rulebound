---
title: Input Sanitization
category: security
severity: error
modality: must
tags: [security, xss, injection, sanitization]
stack: []
scope: [all]
---

# Input Sanitization

All user input MUST be sanitized before rendering or storing. Prevent XSS, SQL injection, and command injection at every boundary.

## Rules

- Sanitize HTML output — use framework escaping (React JSX auto-escapes, but `dangerouslySetInnerHTML` does not)
- Use parameterized queries for all database operations — never concatenate user input into SQL
- Validate and sanitize file uploads (check MIME type, size, extension)
- Encode output appropriate to context (HTML, URL, JavaScript, CSS)
- Use Content-Security-Policy headers to prevent inline script execution

## Good Example

```typescript
// Parameterized query — safe
const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);

// React auto-escapes — safe
return <p>{userInput}</p>;
```

## Bad Example

```typescript
// String concatenation — SQL injection
const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);

// Unescaped HTML — XSS
return <div dangerouslySetInnerHTML={{ __html: userInput }} />;
```
