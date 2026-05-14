---
title: Hexagonal Architecture Enforcement
category: architecture
severity: error
modality: must
tags: [hexagonal, ports-adapters, clean-architecture, modularity]
stack: [java, spring-boot]
scope: [backend, api]
---

# Hexagonal Architecture Enforcement

Projects MUST follow hexagonal (ports & adapters) architecture with strict module boundaries.

## Rules

- Domain module MUST NOT depend on infrastructure or framework code
- No Spring annotations (`@Service`, `@Component`, `@Autowired`) in domain module
- Ports (interfaces) live in `domain/` — adapters (implementations) live in `infra/`
- Use cases contain business logic in domain, controllers/repositories in infra
- Multi-module build structure required: at minimum `domain` + `infra` modules
- Domain module dependencies limited to pure Java, utility libraries (commons, guava)

## Good Example

```java
// domain/src/main/java/com/example/order/port/OrderRepositoryPort.java
public interface OrderRepositoryPort {
    Order findById(Long id);
    void save(Order order);
}

// domain/src/main/java/com/example/order/usecase/CreateOrderUseCase.java
public class CreateOrderUseCase {
    private final OrderRepositoryPort orderRepository;

    public CreateOrderUseCase(OrderRepositoryPort orderRepository) {
        this.orderRepository = orderRepository;
    }

    public Order execute(CreateOrderCommand command) {
        var order = Order.create(command);
        orderRepository.save(order);
        return order;
    }
}

// infra/src/main/java/com/example/adapter/OrderJpaAdapter.java
@Repository
public class OrderJpaAdapter implements OrderRepositoryPort {
    private final OrderJpaRepository jpaRepository;
    // ...
}
```

## Bad Example

```java
// domain module importing Spring — FORBIDDEN
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class CreateOrderUseCase {
    @Autowired
    private JpaRepository<OrderEntity, Long> repo;
}
```
