# Checkstyle recipe

Checkstyle enforces Java style and structural rules. Rulebound parses Checkstyle's XML output (`target/checkstyle-result.xml`) and emits one deterministic finding per `<error>` element.

Rulebound does NOT run Checkstyle by default. Run `mvn checkstyle:check` in CI, or pass `--allow-commands` to let Rulebound do it.

## Prerequisites

- JDK matching the project.
- Maven 3.9+ on PATH, or `./mvnw`.
- `maven-checkstyle-plugin` declared in `pom.xml`. The plugin writes `target/checkstyle-result.xml` on the `checkstyle:check` goal.
- A `checkstyle.xml` ruleset at the path the plugin expects.

## Rule check block

```yaml
checks:
  - type: analyzer
    id: java.checkstyle
    analyzer: checkstyle
    run: "mvn -q checkstyle:check"
    report: "target/checkstyle-result.xml"
    report_format: checkstyle-xml
    fail_on_severity: warning
    severity: error
    message: "Checkstyle reported violations against checkstyle.xml."
```

Severity mapping (from Checkstyle `severity` attribute):

| Checkstyle severity | Rulebound severity |
|---------------------|--------------------|
| `error`             | `error`            |
| `warning` (default) | `warning`          |
| `info`              | `info`             |

## CI snippet

Pattern: run Checkstyle first, then let Rulebound read the XML report. With
`allow-commands: "false"` the action does not re-run the analyzer for the
pr-markdown summary. See
[ci-github-action.md — Double-run trust boundary](../ci-github-action.md#double-run-trust-boundary-pr-markdown-summary--allow-commands).

```yaml
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
    cache: maven
- name: Run Checkstyle
  run: mvn -B -ntp -q checkstyle:check || true
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
```

`|| true` keeps the Maven step from halting the workflow before Rulebound reads the report.

## Troubleshooting

`rulebound doctor`:

```
  ✓ analyzer:checkstyle    checkstyle: 1 report(s) ready
```

Tool missing:

```
  ! analyzer:checkstyle    checkstyle: required tool not found on PATH (mvn)
```

Install Maven or use the Maven Wrapper.

Report missing:

```
ERROR  java.checkstyle  Analyzer report not found: target/checkstyle-result.xml. Run the analyzer first or pass --allow-commands so rulebound can run `mvn -q checkstyle:check` itself.
```

Fix: run `mvn checkstyle:check` once locally, or pass `--allow-commands`.
