import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "recipes/pmd",
  title: "PMD Recipe",
  description:
    "PMD is the Java static analyzer for style and bug patterns. Rulebound reads target/pmd.xml and converts each <violation> into a deterministic analyzer finding.",
  content: `## PMD recipe

PMD is the Java static analyzer for style and bug patterns. Rulebound reads PMD's XML report (\`target/pmd.xml\`) and converts each \`<violation>\` into a deterministic \`analyzer\` finding.

Rulebound does NOT run PMD by default. Either run \`mvn pmd:check\` in CI and let Rulebound read the report, or pass \`--allow-commands\` to let Rulebound invoke Maven itself.

## Prerequisites

- JDK matching your project (the parser does not care which version).
- Maven 3.9+ on PATH, or \`./mvnw\`.
- \`maven-pmd-plugin\` declared in \`pom.xml\` (\`org.apache.maven.plugins:maven-pmd-plugin\`). The plugin writes \`target/pmd.xml\` during the \`pmd:check\` goal.

## Rule check block

\`\`\`yaml
checks:
  - type: analyzer
    id: java.pmd
    analyzer: pmd
    run: "mvn -q pmd:check"
    report: "target/pmd.xml"
    report_format: pmd-xml
    fail_on_severity: warning
    severity: error
    message: "PMD reported violations. Fix them or document an explicit waiver."
\`\`\`

Severity mapping (from PMD \`priority\`):

| PMD \`priority\` | Rulebound severity |
|----------------|--------------------|
| 1, 2           | \`error\`            |
| 3, 4, 5        | \`warning\`          |

## CI snippet

\`\`\`yaml
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
    cache: maven
- name: Run PMD
  run: mvn -B -ntp -q pmd:check || true
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
\`\`\`

\`|| true\` keeps Maven from short-circuiting the workflow when PMD finds violations. Rulebound is the authoritative gate.

To let Rulebound drive Maven directly, drop the explicit \`mvn\` step and pass \`allow-commands: "true"\`.

## Troubleshooting

\`rulebound doctor\`:

\`\`\`
  ✓ analyzer:pmd           pmd: 1 report(s) ready
\`\`\`

Tool missing:

\`\`\`
  ! analyzer:pmd           pmd: required tool not found on PATH (pmd, mvn)
\`\`\`

Install Maven, or commit \`./mvnw\` and update the rule's \`run:\` accordingly.

Report missing:

\`\`\`
ERROR  java.pmd  Analyzer report not found: target/pmd.xml. Run the analyzer first or pass --allow-commands so rulebound can run \`mvn -q pmd:check\` itself.
\`\`\`

Fix: run \`mvn pmd:check\` once locally to seed \`target/pmd.xml\`, or pass \`--allow-commands\` so Rulebound runs Maven for you.

## Related

- [Analyzer Orchestration](/docs/recipes/orchestration) — the general pattern.
- [Java Pack](/docs/recipes/java-pack) — PMD alongside Checkstyle, SpotBugs, ArchUnit.
`,
}

export default doc
