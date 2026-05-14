---
title: DTO Pattern for API Layer
category: architecture
severity: warning
modality: must
tags: [spring, dto, api, java]
stack: [java, spring-boot]
scope: [backend, api]
---

# DTO Pattern for API Layer

Controllers MUST use DTOs for request/response. Never expose JPA entities directly in API responses.

## Rules

- Use separate Request and Response DTOs for each endpoint
- Use Java records for immutable DTOs
- Map between entities and DTOs in the service layer
- Validate request DTOs with `@Valid` and Jakarta Validation annotations
- Never return JPA entities from controllers — prevents lazy loading issues and data leaks

## Good Example

```java
public record CreateOrderRequest(
    @NotBlank String customerId,
    @NotEmpty List<OrderItemRequest> items
) {}

public record OrderResponse(
    String id,
    String status,
    BigDecimal total,
    Instant createdAt
) {}

@PostMapping("/orders")
public ResponseEntity<OrderResponse> createOrder(
        @Valid @RequestBody CreateOrderRequest request) {
    Order order = orderService.create(request);
    return ResponseEntity.status(201).body(OrderResponse.from(order));
}
```
