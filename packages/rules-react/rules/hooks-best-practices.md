---
title: Hooks Best Practices
category: style
severity: warning
modality: should
tags: [react, hooks, state, effects]
stack: [typescript, javascript]
---

# Hooks Best Practices

Follow React hooks best practices for predictable state management and side effects.

## Rules

- Keep hooks at the top level of components (no conditional hooks)
- Extract complex logic into custom hooks
- Use `useCallback` for functions passed to child components
- Use `useMemo` for expensive computations, not for every value
- Clean up effects (return cleanup function from useEffect)
- Minimize useEffect usage -- prefer event handlers and Server Components

## Good Example

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

## Bad Example

```typescript
function Component({ items }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/data").then(r => r.json()).then(setData);
  }); // missing dependency array!
}
```
