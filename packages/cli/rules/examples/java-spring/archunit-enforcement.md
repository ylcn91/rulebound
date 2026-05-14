---
title: ArchUnit Architecture Tests
category: testing
severity: error
modality: must
tags: [archunit, architecture-test, boundaries, hexagonal]
stack: [java, spring-boot]
scope: [backend, api]
---

# ArchUnit Architecture Tests

Projects MUST include ArchUnit tests to enforce architecture boundaries deterministically.

## Rules

- Add `com.tngtech.archunit:archunit-junit5` as test dependency
- Create a dedicated `ArchitectureTest` class with all architecture rules
- Verify domain module does not import from infra/framework packages
- Verify no field injection (`@Autowired` on fields)
- Verify naming conventions: adapters end with `Adapter`, ports end with `Port`
- Verify use case classes reside in `usecase` package
- Run ArchUnit tests in CI pipeline — architecture violations fail the build

## Good Example

```java
@AnalyzeClasses(packages = "com.example", importOptions = { ImportOption.DoNotIncludeTests.class })
class ArchitectureTest {

    @ArchTest
    static final ArchRule domain_should_not_depend_on_infra =
        noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("..adapter..", "..configuration..", "org.springframework..");

    @ArchTest
    static final ArchRule no_field_injection =
        noFields()
            .should().beAnnotatedWith("org.springframework.beans.factory.annotation.Autowired")
            .because("Use constructor injection instead of field injection");

    @ArchTest
    static final ArchRule ports_should_be_interfaces =
        classes()
            .that().resideInAPackage("..port..")
            .should().beInterfaces()
            .because("Ports define contracts and must be interfaces");

    @ArchTest
    static final ArchRule adapters_naming_convention =
        classes()
            .that().resideInAPackage("..adapter..")
            .and().areNotInterfaces()
            .and().areNotEnums()
            .should().haveSimpleNameEndingWith("Adapter")
                .orShould().haveSimpleNameEndingWith("Controller")
                .orShould().haveSimpleNameEndingWith("Mapper")
            .because("Adapter implementations must follow naming conventions");

    @ArchTest
    static final ArchRule usecases_should_not_access_repositories_directly =
        noClasses()
            .that().resideInAPackage("..usecase..")
            .should().dependOnClassesThat()
            .resideInAPackage("..repository..")
            .because("Use cases must access data through ports, not repositories");
}
```

## Bad Example

```java
// No architecture tests at all — violations go undetected
// domain/UseCase.java imports Spring JPA directly
import org.springframework.data.jpa.repository.JpaRepository;

public class OrderUseCase {
    private final JpaRepository<OrderEntity, Long> repo; // VIOLATION
}
```
