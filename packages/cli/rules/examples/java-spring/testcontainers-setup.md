---
title: Testcontainers for External Dependencies
category: testing
severity: error
modality: must
tags: [testcontainers, docker, integration-test, database, redis]
stack: [java, spring-boot]
scope: [backend, api]
---

# Testcontainers for External Dependencies

Integration tests MUST use Testcontainers for all external dependencies.

## Rules

- Use Testcontainers for databases (PostgreSQL, MySQL), cache (Redis), search (Elasticsearch)
- Never use embedded or in-memory databases (H2) in integration tests
- Use `@Testcontainers` and `@Container` annotations for lifecycle management
- Share containers across test classes with the singleton pattern for performance
- Container configuration belongs in the `AbstractIT` base class
- Add `testcontainers` and database-specific module as test dependencies

## Good Example

```java
@Testcontainers
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
abstract class AbstractIT {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    @Container
    static final GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }
}
```

## Bad Example

```java
// H2 in-memory database — behavior differs from production PostgreSQL
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driver-class-name=org.h2.Driver

// No container management, relies on local installations
@SpringBootTest
class OrderIntegrationTest {
    // Assumes PostgreSQL is running on localhost:5432
}
```
