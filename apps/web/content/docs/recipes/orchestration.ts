import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "recipes/orchestration",
  title: "Analyzer Orchestration",
  description:
    "Rulebound does not reimplement PMD, Checkstyle, SpotBugs, ESLint, Semgrep, gitleaks, or your test runner — the analyzer check type runs (or reads the report of) an external analyzer and normalizes its output.",
  content: `## Analyzer orchestration

Rulebound does not reimplement PMD, Checkstyle, SpotBugs, ESLint, Semgrep, gitleaks, or your test runner. The \`analyzer\` check type runs an external analyzer (or reads its existing report) and normalizes the output into the Rulebound report.

This is what keeps Rulebound out of the SonarQube replacement category. Existing mature analyzers stay where they are; Rulebound wires them into the agent workflow and the CI gate.

**Rulebound does NOT run analyzers by default unless \`--allow-commands\` is passed; otherwise it reads report files.** When \`run:\` is set on an \`analyzer\` check and the flag is omitted, Rulebound returns \`NOT_APPLICABLE\` for that check — it does not silently pass and it does not invoke arbitrary commands behind your back. The default mode is "CI (or you) runs the analyzer, Rulebound reads its report".

## Analyzer packs

The CLI ships three opt-in analyzer packs. They install the rules but you must install the underlying tools yourself and run with \`--allow-commands\`:

- \`analyzer-typescript\` — \`eslint\` + \`tsc --noEmit\`.
- \`analyzer-java\` — \`pmd\`, \`checkstyle\`, \`spotbugs\`, \`junit-xml\` (Surefire / Failsafe).
- \`analyzer-security\` — \`semgrep\` + \`gitleaks\`.

\`\`\`bash
rulebound init --pack analyzer-typescript
rulebound init --pack analyzer-java
rulebound init --pack analyzer-security
\`\`\`

These are separate from the \`starter\` / \`deterministic\` / \`agent-workflow\` packs, which do not pull in analyzer rules.

## Per-analyzer recipes

Each recipe below has install commands, the exact \`checks:\` block to paste, the CI snippet, and the troubleshooting output you should expect from \`rulebound doctor\` and \`rulebound check\`:

- [ESLint](/docs/recipes/eslint)
- [TypeScript (\`tsc --noEmit\`)](/docs/recipes/typescript-tsc)
- [Semgrep](/docs/recipes/semgrep)
- [gitleaks](/docs/recipes/gitleaks)
- [PMD](/docs/recipes/pmd)
- [Checkstyle](/docs/recipes/checkstyle)
- [SpotBugs](/docs/recipes/spotbugs)
- [JUnit / Surefire / pytest XML](/docs/recipes/junit)

## Shape

\`\`\`yaml
checks:
  - type: analyzer
    id: pmd-main
    analyzer: pmd
    run: "mvn -q pmd:check"
    report: "target/pmd.xml"
    report_format: pmd-xml
    severity: error
    pass_exit_codes: [0]
    timeout_ms: 600000
\`\`\`

| Field            | Notes                                                                  |
|------------------|------------------------------------------------------------------------|
| \`analyzer\`       | One of the supported analyzer keys (see below)                         |
| \`run\`            | Optional shell command. Executes only with \`--allow-commands\`.         |
| \`report\`         | Path to the analyzer's report file, relative to \`cwd\`                  |
| \`report_format\`  | Parser to use. Inferred from \`analyzer\` when omitted.                  |
| \`severity\`       | \`error\` blocks; \`warning\`/\`info\` do not                                |
| \`pass_exit_codes\`| Defaults to \`[0]\`                                                      |
| \`timeout_ms\`     | Defaults to 600000                                                     |
| \`fail_on_severity\` | For multi-severity reports — minimum severity that counts as fail    |

## Supported analyzers

\`pmd\`, \`checkstyle\`, \`spotbugs\`, \`junit\`, \`eslint\`, \`tsc\`, \`semgrep\`, \`gitleaks\`, \`dependency-cruiser\`, \`sarif\`, \`generic\`.

Each value primarily acts as a default for \`report_format\` and labeling.

## Supported report formats

| Format            | Used by                                                |
|-------------------|--------------------------------------------------------|
| \`pmd-xml\`         | PMD                                                    |
| \`checkstyle-xml\`  | Checkstyle                                             |
| \`spotbugs-xml\`    | SpotBugs                                               |
| \`junit-xml\`       | JUnit / Surefire / Failsafe / pytest's JUnit XML, etc. |
| \`sarif\`           | Semgrep, gitleaks, CodeQL, anything that emits SARIF   |
| \`json\`            | Generic structured JSON output                         |
| \`text\`            | Fallback. Captures exit code and truncated output.     |

If the analyzer's format is not in this list, use \`report_format: text\` (or \`type: command\`) and rely on the exit code.

## Execution modes

There are two practical ways to run an analyzer through Rulebound.

### 1. Rulebound runs the analyzer

Provide \`run\`. Use \`--allow-commands\` on the CLI.

\`\`\`yaml
checks:
  - type: analyzer
    id: eslint-all
    analyzer: eslint
    run: "pnpm eslint --format json -o reports/eslint.json ."
    report: "reports/eslint.json"
    report_format: json
    severity: error
\`\`\`

\`\`\`bash
rulebound check --allow-commands
\`\`\`

Without \`--allow-commands\`, the check returns \`NOT_APPLICABLE\` (it does not silently pass).

### 2. CI runs the analyzer, Rulebound reads the report

Often cleaner in CI. Run the analyzer as a normal step, then point Rulebound at the report file. No \`--allow-commands\` needed.

\`\`\`yaml
- run: mvn -q -DskipTests pmd:check || true
- run: rulebound check --base origin/\${{ github.base_ref }} --format github
\`\`\`

\`\`\`yaml
checks:
  - type: analyzer
    id: pmd-main
    analyzer: pmd
    report: "target/pmd.xml"
    report_format: pmd-xml
    severity: error
\`\`\`

The \`|| true\` in the analyzer step lets Rulebound be the authoritative gate for that check, instead of failing twice.

## Java analyzer pack

Recommended set for a Java service:

- **PMD** — style and bug patterns
- **Checkstyle** — style + structural rules
- **SpotBugs** — bytecode static analysis
- **ArchUnit** — architecture invariants, surfaced via \`junit-xml\` from Surefire / Failsafe

ArchUnit specifically is wired as test evidence, not as a custom static analyzer:

\`\`\`yaml
checks:
  - type: analyzer
    id: archunit-tests
    analyzer: junit
    report: "target/surefire-reports/TEST-com.example.ArchitectureTest.xml"
    report_format: junit-xml
    severity: error
\`\`\`

A worked Java example lives in [\`examples/java-spring-demo/\`](https://github.com/ylcn91/rulebound/tree/main/examples/java-spring-demo).

## Unsupported analyzers

When an analyzer does not have a Rulebound parser and you do not want to add one:

\`\`\`yaml
checks:
  - type: command
    id: my-custom-analyzer
    run: "./scripts/my-analyzer.sh"
    pass_exit_codes: [0]
    severity: error
    message: "Custom analyzer reported issues. Check its output."
\`\`\`

You lose structured evidence, but exit-code-based gating still works.

## What this is not

- Rulebound does not bundle PMD/ESLint/etc. You install them.
- Rulebound does not attempt to be a better PMD or ESLint. It runs them faithfully.
- The analyzer check is not a magic SonarQube replacement. It is a normalizer over reports the analyzers already produce.
`,
}

export default doc
