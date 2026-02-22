---
title: Global Exception Handling
category: architecture
severity: error
modality: must
tags: [spring, exceptions, rest, java]
---

# Global Exception Handling

All Spring Boot applications MUST use `@RestControllerAdvice` for centralized exception handling. No try-catch in controllers.

## Rules

- Use `@RestControllerAdvice` with typed exception handlers
- Map domain exceptions to HTTP status codes consistently
- Return RFC 7807 Problem Detail format for error responses
- Never expose stack traces or internal details in production responses
- Log exceptions at the handler level with correlation context

## Good Example

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    public ProblemDetail handleNotFound(EntityNotFoundException ex) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        detail.setTitle("Resource Not Found");
        detail.setDetail(ex.getMessage());
        return detail;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleValidation(ConstraintViolationException ex) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        detail.setTitle("Validation Error");
        detail.setDetail(ex.getMessage());
        return detail;
    }
}
```
