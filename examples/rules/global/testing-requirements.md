---
title: Testing Requirements
category: testing
severity: error
modality: must
tags: [testing, coverage, ci]
---

# Testing Requirements

All features MUST have tests. AI agents MUST write tests alongside implementation, never as an afterthought.

## Rules

- Minimum 80% code coverage for all new code
- Every bug fix must include a regression test
- Unit tests for business logic, integration tests for API endpoints
- Tests must be deterministic — no flaky tests in CI
- Test names must describe the expected behavior, not the implementation
- Mock external dependencies; never call real APIs in tests

## Good Example

```typescript
describe("createUser", () => {
  it("returns the created user with a generated ID", async () => {
    const result = await createUser({ name: "Alice", email: "alice@test.com" });
    expect(result.id).toBeDefined();
    expect(result.name).toBe("Alice");
  });

  it("throws ValidationError when email is invalid", async () => {
    await expect(createUser({ name: "Alice", email: "not-an-email" }))
      .rejects.toThrow(ValidationError);
  });
});
```
