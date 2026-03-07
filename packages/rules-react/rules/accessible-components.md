---
title: Accessible Components
category: accessibility
severity: error
modality: must
tags: [react, accessibility, a11y, wcag]
stack: [typescript, javascript]
---

# Accessible Components

All interactive components MUST be accessible. Follow WCAG AA guidelines.

## Rules

- Use semantic HTML elements (button, nav, main, section)
- All images must have alt text
- All interactive elements must be keyboard navigable
- Color must not be the sole indicator of state
- Use ARIA attributes only when semantic HTML is insufficient
- Focus states must be visible
- Ensure 4.5:1 contrast ratio for text

## Good Example

```typescript
<button
  type="button"
  onClick={handleAction}
  aria-label="Close dialog"
  className="focus:ring-2 focus:ring-blue-500"
>
  <XIcon aria-hidden="true" />
</button>
```

## Bad Example

```typescript
<div onClick={handleAction} style={{ color: "#ccc" }}>
  <img src="/close.png" />
</div>
```
