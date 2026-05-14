import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "recipes/java-pack",
  title: "Java Analyzer Pack",
  description:
    "PMD, Checkstyle, SpotBugs, and ArchUnit (via Surefire) wired into a single Rulebound check pipeline. Rulebound is the orchestrator and policy gate; the analyzers stay the source of truth.",
  content: `## Java deterministic analyzer pack

Rulebound treats mature Java static analyzers as the source of truth and uses their XML reports as deterministic evidence. This pack wires PMD, Checkstyle, SpotBugs and ArchUnit (via Surefire's JUnit XML) into a single Rulebound check pipeline.

A runnable example lives at [\`examples/java-spring-demo/\`](https://github.com/ylcn91/rulebound/tree/main/examples/java-spring-demo) — a minimal Spring Boot Maven project with the plugins, an intentional code smell in \`UserService.java\`, an ArchUnit test, and rules under \`.rulebound/rules/java/analyzer-pack.md\`.

To install these rules in your own repo, use the opt-in \`analyzer-java\` pack (requires Maven/JDK and \`--allow-commands\` at check time):

\`\`\`bash
rulebound init --pack analyzer-java
\`\`\`

For TypeScript and security stacks, the parallel packs are \`analyzer-typescript\` and \`analyzer-security\`. See [Analyzer Orchestration](/docs/recipes/orchestration).

## What this is

- An orchestrator. Rulebound shells out to \`mvn …\`, then parses the XML the plugins write under \`target/\`.
- A normalizer. PMD violations, Checkstyle errors, SpotBugs bug instances and JUnit failures all collapse into the same deterministic Rulebound finding shape (\`source: analyzer\`, \`deterministic: true\`, \`confidence: exact\`).
- A policy gate. A finding at or above \`fail_on_severity\` flips the rule to \`VIOLATED\` and (when severity is \`error\`) blocks CI.

## What this is NOT

- Not a SonarQube replacement. Sonar runs its own engines and ships a UI; Rulebound only reads outputs the existing plugins already produce.
- Not a re-implementation of PMD/Checkstyle/SpotBugs/ArchUnit. Rulebound has zero opinion about which rulesets you enable.
- Not a Java compiler. If \`mvn\` cannot build, the analyzer check reports an error result instead of inventing findings.
- Not a security scanner. Pair it with Semgrep/CodeQL/gitleaks via separate analyzer checks if you need that coverage.

## Requirements

- JDK 21 (matches \`<java.version>\` in the demo \`pom.xml\`; use whatever your team standardises on — the parser does not care).
- Maven 3.9+ on \`PATH\` for the \`run:\` commands. The Maven Wrapper (\`./mvnw\`) works just as well; swap the command if you prefer it.
- Internet access on the first build so Maven can fetch the PMD, Checkstyle and SpotBugs plugins plus their rulesets.
- The plugins themselves are declared in \`pom.xml\`; no global install is required.

## How Rulebound orchestrates the analyzers

Each analyzer check has two halves:

1. \`run:\` — the Maven command Rulebound executes when the CLI is invoked with \`--allow-commands\`. Without that flag, Rulebound skips the command and just reads the existing report. That is the common setup when Maven already runs in an earlier CI step.
2. \`report:\` / \`report_format:\` — the XML file Rulebound parses. The parser in \`packages/engine/src/checks/runners/analyzer.ts\` knows \`pmd-xml\`, \`checkstyle-xml\`, \`spotbugs-xml\`, \`junit-xml\` and SARIF. Each finding keeps its file, line, rule id, severity and message.

Severity mapping:

| Source | Rulebound severity |
|---|---|
| PMD \`priority<=2\` | \`error\` |
| PMD \`priority>2\` | \`warning\` |
| Checkstyle \`severity="error"\` | \`error\` |
| Checkstyle \`severity="warning"\` (default) | \`warning\` |
| Checkstyle \`severity="info"\` | \`info\` |
| SpotBugs \`priority="1"\` | \`error\` |
| SpotBugs \`priority>=2\` | \`warning\` |
| JUnit \`<failure>\` / \`<error>\` | \`error\` |

\`fail_on_severity\` (default \`warning\`) decides which findings become blocking.

## Wiring it in CI

The recommended layout is one Maven job that produces the reports and a follow-up Rulebound job that reads them.

\`\`\`yaml
# .github/workflows/java-rulebound.yml
name: java-rulebound
on: [pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven

      - name: Run analyzers
        working-directory: examples/java-spring-demo
        run: |
          mvn -B -q pmd:check || true
          mvn -B -q checkstyle:check || true
          mvn -B -q spotbugs:check || true
          mvn -B -q test -Dtest=ArchitectureTest || true

      - name: Upload analyzer reports
        uses: actions/upload-artifact@v4
        with:
          name: java-analyzer-reports
          path: |
            examples/java-spring-demo/target/pmd.xml
            examples/java-spring-demo/target/checkstyle-result.xml
            examples/java-spring-demo/target/spotbugsXml.xml
            examples/java-spring-demo/target/surefire-reports/*.xml

      - name: Rulebound check
        working-directory: examples/java-spring-demo
        run: npx -y @rulebound/cli check --format github
\`\`\`

\`|| true\` keeps the Maven step from short-circuiting before Rulebound has a chance to normalize the report; the Rulebound CLI exits non-zero on its own when a blocking finding is present.

Running locally is the same flow without the workflow scaffolding:

\`\`\`bash
cd examples/java-spring-demo
mvn -q verify
rulebound check
\`\`\`

Add \`--allow-commands\` to let Rulebound invoke the Maven goals itself instead of relying on a previous step.

## The contract

- PMD, Checkstyle, SpotBugs, ArchUnit run under Maven. They are the authoritative source of findings.
- Each plugin writes its XML report into \`target/\`.
- Rulebound reads those XML files, normalizes them into deterministic \`CheckResult\` records, and either passes or blocks the rule.
- If a report file is missing, Rulebound emits an \`ERROR\` status — never a silent pass. That keeps misconfigured pipelines from masquerading as green.

## Related

- [Analyzer Orchestration](/docs/recipes/orchestration) — the general pattern.
- [PMD recipe](/docs/recipes/pmd), [Checkstyle recipe](/docs/recipes/checkstyle), [SpotBugs recipe](/docs/recipes/spotbugs), [JUnit recipe](/docs/recipes/junit).
`,
}

export default doc
