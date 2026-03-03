---
title: Integration Test Requirements
category: testing
severity: error
modality: must
tags: [integration-test, spring-boot-test, testing, rest-api]
stack: [java, spring-boot]
scope: [backend, api]
---

# Integration Test Requirements

Every REST endpoint MUST have corresponding integration tests.

## Rules

- All REST endpoints must have at least one integration test
- Use `@SpringBootTest(webEnvironment = RANDOM_PORT)` for real server testing
- Use `@ActiveProfiles("test")` to load test configuration
- Integration test classes must extend a shared `AbstractIT` base class
- Test class naming: `*IntegrationTest.java` suffix
- Test both success and error scenarios for each endpoint
- Use `TestRestTemplate` or `WebTestClient` for HTTP calls

## Good Example

```java
@ActiveProfiles("test")
@AutoConfigureWebTestClient
@ExtendWith(SpringExtension.class)
@SpringBootTest(classes = Application.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
abstract class AbstractIT {

    @Autowired
    protected TestRestTemplate restTemplate;
}

// Concrete integration test
class OrderIntegrationTest extends AbstractIT {

    @Test
    void should_create_order_successfully() {
        var request = new CreateOrderRequest("item-1", 2);

        var response = restTemplate.postForEntity("/api/orders", request, OrderResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().getId()).isNotNull();
    }

    @Test
    void should_return_404_when_order_not_found() {
        var response = restTemplate.getForEntity("/api/orders/999", OrderResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
```

## Bad Example

```java
// No base class, no profiles, mock server — not a real integration test
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @MockBean
    private OrderService orderService;

    @Autowired
    private MockMvc mockMvc;
}
```
