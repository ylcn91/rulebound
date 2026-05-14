package com.example.demo;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * ArchUnit rules enforced on the demo project. Surefire writes the JUnit XML
 * report under target/surefire-reports/ and Rulebound's analyzer check with
 * <code>report_format: junit-xml</code> reads it to surface failures.
 */
@AnalyzeClasses(
        packages = "com.example.demo",
        importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule controllers_should_not_use_repositories =
            noClasses()
                    .that().resideInAPackage("..controller..")
                    .should().dependOnClassesThat()
                    .resideInAPackage("..repository..")
                    .because("Controllers must talk to the service layer, never repositories directly.");

    @ArchTest
    static final ArchRule no_field_injection =
            noClasses()
                    .should().dependOnClassesThat()
                    .haveFullyQualifiedName("org.springframework.beans.factory.annotation.Autowired")
                    .because("Use constructor injection instead of @Autowired fields.");
}
