---
title: Constructor-Based Dependency Injection
category: architecture
severity: error
modality: must
tags: [spring, di, constructor, java]
---

# Constructor-Based Dependency Injection

All Spring beans MUST use constructor injection. Field injection with `@Autowired` is forbidden.

## Rules

- Use constructor injection exclusively — no `@Autowired` on fields
- Mark injected fields as `final`
- Use `@RequiredArgsConstructor` (Lombok) or explicit constructors
- One constructor per class for injection (Spring auto-detects it)
- Avoid circular dependencies — refactor with events or mediator pattern

## Good Example

```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;
    private final EventPublisher eventPublisher;

    public OrderService(
            OrderRepository orderRepository,
            PaymentGateway paymentGateway,
            EventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.paymentGateway = paymentGateway;
        this.eventPublisher = eventPublisher;
    }
}
```

## Bad Example

```java
@Service
public class OrderService {
    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private PaymentGateway paymentGateway;
}
```
