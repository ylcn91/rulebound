import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "recipes/junit",
  title: "JUnit Recipe",
  description:
    "JUnit-style XML (Surefire, Failsafe, Gradle, pytest --junitxml, jest-junit) is evidence for test-based rules. Each <failure> or <error> becomes a deterministic finding.",
  content: `## JUnit recipe

Rulebound treats JUnit-style XML (Surefire, Failsafe, Gradle, pytest's \`--junitxml\`, etc.) as evidence for test-based rules. Each \`<failure>\` or \`<error>\` in a \`<testcase>\` becomes a deterministic finding with the test name as the rule id.

This is the canonical way to surface ArchUnit, contract tests, or any other test-as-spec assertion through Rulebound.

Rulebound does NOT run your test suite by default. Either run it in CI, or pass \`--allow-commands\`.

## Prerequisites

A test runner that emits JUnit-style XML. Some defaults:

| Tool                              | Report path                                    |
|-----------------------------------|------------------------------------------------|
| Maven Surefire                    | \`target/surefire-reports/TEST-*.xml\`           |
| Maven Failsafe (integration)      | \`target/failsafe-reports/TEST-*.xml\`           |
| Gradle (\`test\`)                   | \`build/test-results/test/TEST-*.xml\`           |
| pytest                            | \`pytest --junitxml=reports/pytest.xml\`         |
| Jest                              | \`jest-junit\` reporter, \`reports/jest-junit.xml\`|

Rulebound's parser is path-agnostic — point \`report:\` at whichever file your runner writes.

## Rule check block

ArchUnit via Surefire:

\`\`\`yaml
checks:
  - type: analyzer
    id: archunit-tests
    analyzer: junit
    run: "mvn -q test -Dtest=ArchitectureTest"
    report: "target/surefire-reports/TEST-com.example.ArchitectureTest.xml"
    report_format: junit-xml
    fail_on_severity: error
    severity: error
    message: "ArchUnit architecture tests failed."
\`\`\`

pytest contract suite:

\`\`\`yaml
checks:
  - type: analyzer
    id: contract-tests
    analyzer: junit
    run: "pytest tests/contract --junitxml=reports/contract.xml"
    report: "reports/contract.xml"
    report_format: junit-xml
    fail_on_severity: error
    severity: error
    message: "Contract tests failed."
\`\`\`

Severity mapping:

| JUnit element  | Rulebound severity |
|----------------|--------------------|
| \`<failure>\`    | \`error\`            |
| \`<error>\`      | \`error\`            |
| (passing test) | (no finding)       |

\`fail_on_severity: error\` is the right default — JUnit only ever emits \`error\` findings.

## CI snippet

Maven:

\`\`\`yaml
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
    cache: maven
- name: Run tests
  run: mvn -B -ntp -q test || true
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
\`\`\`

pytest:

\`\`\`yaml
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
- run: pip install -r requirements.txt
- run: |
    mkdir -p reports
    pytest tests/contract --junitxml=reports/contract.xml || true
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
\`\`\`

\`|| true\` lets Rulebound be the gate; the test step itself does not fail the workflow.

## Troubleshooting

\`rulebound doctor\`:

\`\`\`
  ✓ analyzer:junit         junit: 1 report(s) ready
\`\`\`

Tool missing:

\`\`\`
  ! analyzer:junit         junit: required tool not found on PATH (mvn, gradle)
\`\`\`

Install Maven or Gradle, or run a different test runner and update the \`run:\` command.

Report missing:

\`\`\`
ERROR  archunit-tests  Analyzer report not found: target/surefire-reports/TEST-com.example.ArchitectureTest.xml. Run the analyzer first or pass --allow-commands so rulebound can run \`mvn -q test -Dtest=ArchitectureTest\` itself.
\`\`\`

Fix: run the test suite once, or pass \`--allow-commands\`. The XML path Surefire writes depends on the fully-qualified class name — if you renamed or moved the test class, update \`report:\` accordingly.

## Related

- [Analyzer Orchestration](/docs/recipes/orchestration) — the general pattern.
- [Java Pack](/docs/recipes/java-pack) — ArchUnit via Surefire.
`,
}

export default doc
