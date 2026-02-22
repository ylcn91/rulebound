---
title: Go Error Handling
category: architecture
severity: error
modality: must
tags: [go, errors, handling]
---

# Go Error Handling

All Go functions that can fail MUST return an error. Errors MUST be wrapped with context using `fmt.Errorf` and `%w`.

## Rules

- Always check returned errors — never use `_` to discard them
- Wrap errors with context: `fmt.Errorf("failed to create user: %w", err)`
- Use sentinel errors (`var ErrNotFound = errors.New(...)`) for expected conditions
- Use custom error types for errors that carry structured data
- Handle errors at the appropriate level — don't log and return the same error

## Good Example

```go
func (s *UserService) GetByID(ctx context.Context, id string) (*User, error) {
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        if errors.Is(err, ErrNotFound) {
            return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
        }
        return nil, fmt.Errorf("failed to fetch user %s: %w", id, err)
    }
    return user, nil
}
```

## Bad Example

```go
func (s *UserService) GetByID(ctx context.Context, id string) *User {
    user, _ := s.repo.FindByID(ctx, id) // error discarded
    return user
}
```
