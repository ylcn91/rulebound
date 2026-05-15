# SpotBugs recipe

SpotBugs is a bytecode-level static analyzer for Java. Rulebound reads the XML report (`target/spotbugsXml.xml`) and emits one finding per `<BugInstance>`, with file, line and bug type.

Rulebound does NOT run SpotBugs by default. Either run `mvn spotbugs:check` in CI, or pass `--allow-commands`.

## Prerequisites

- JDK matching the project (SpotBugs analyzes compiled `.class` files, so the project must compile first).
- Maven 3.9+ on PATH, or `./mvnw`.
- `spotbugs-maven-plugin` declared in `pom.xml` (`com.github.spotbugs:spotbugs-maven-plugin`). The `spotbugs:check` goal writes `target/spotbugsXml.xml`.

## Rule check block

```yaml
checks:
  - type: analyzer
    id: java.spotbugs
    analyzer: spotbugs
    run: "mvn -q spotbugs:check"
    report: "target/spotbugsXml.xml"
    report_format: spotbugs-xml
    fail_on_severity: warning
    severity: error
    message: "SpotBugs reported bug instances."
```

Severity mapping (from SpotBugs `priority`):

| SpotBugs `priority` | Rulebound severity |
|---------------------|--------------------|
| 1                   | `error`            |
| 2, 3                | `warning`          |

SpotBugs requires the project to be compiled first. If `target/classes` is empty, `spotbugs:check` will skip silently. Run `mvn -q compile spotbugs:check` if your CI does not already compile the project before this step.

## CI snippet

Pattern: compile + run SpotBugs first, then let Rulebound read the XML
report. With `allow-commands: "false"` the action does not re-run Maven for
the pr-markdown summary. See
[ci-github-action.md — Double-run trust boundary](../ci-github-action.md#double-run-trust-boundary-pr-markdown-summary--allow-commands).

```yaml
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
    cache: maven
- name: Compile and run SpotBugs
  run: mvn -B -ntp -q compile spotbugs:check || true
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
```

`|| true` keeps the workflow alive so Rulebound becomes the authoritative gate.

## Troubleshooting

`rulebound doctor`:

```
  ✓ analyzer:spotbugs      spotbugs: 1 report(s) ready
```

Tool missing:

```
  ! analyzer:spotbugs      spotbugs: required tool not found on PATH (mvn)
```

Install Maven or commit the Maven Wrapper.

Report missing:

```
ERROR  java.spotbugs  Analyzer report not found: target/spotbugsXml.xml. Run the analyzer first or pass --allow-commands so rulebound can run `mvn -q spotbugs:check` itself.
```

Fix: run `mvn compile spotbugs:check` once, or pass `--allow-commands`. If the report exists but is empty, confirm that the project actually compiled — SpotBugs cannot analyze missing class files.
