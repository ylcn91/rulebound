import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "recipes/eslint",
  title: "ESLint Recipe",
  description:
    "ESLint is the lint and code-quality engine for JS/TS. Rulebound consumes ESLint's JSON or SARIF output and turns each finding into a deterministic analyzer result.",
  content: `## ESLint recipe

ESLint is the lint and code-quality engine for JavaScript and TypeScript. Rulebound consumes ESLint's JSON formatter output (or any SARIF formatter you bolt on) and turns each finding into a deterministic \`analyzer\` result.

Rulebound does NOT run ESLint by default. Either run it in CI and point Rulebound at the JSON report, or pass \`--allow-commands\` to let Rulebound invoke it through the \`run:\` field.

## Prerequisites

ESLint installed in the project as a dev dependency:

\`\`\`bash
pnpm add -D eslint
# or
npm install -D eslint
\`\`\`

A working ESLint config (\`eslint.config.js\`, \`.eslintrc.*\`, etc.). Rulebound has zero opinion about the ruleset.

Make sure the reports directory exists or is created by the command:

\`\`\`bash
mkdir -p reports
\`\`\`

## Rule check block

Paste into the frontmatter of a rule under \`.rulebound/rules/\`:

\`\`\`yaml
checks:
  - type: analyzer
    id: eslint-all
    analyzer: eslint
    run: "pnpm eslint --format json -o reports/eslint.json ."
    report: "reports/eslint.json"
    report_format: json
    fail_on_severity: warning
    severity: error
    message: "ESLint reported lint findings. Fix them or document an explicit waiver."
\`\`\`

Notes:

- \`report_format: json\` with \`analyzer: eslint\` reads ESLint's native array-shape JSON output directly (\`[{filePath, messages:[{ruleId, severity, line, message}]}]\`). No formatter plugin needed.
- If you prefer SARIF (cleaner per-rule metadata, ingestable by GitHub code-scanning), switch to \`report_format: sarif\` with \`@microsoft/eslint-formatter-sarif\`:

\`\`\`yaml
  - type: analyzer
    id: eslint-sarif
    analyzer: eslint
    run: "pnpm eslint --format @microsoft/eslint-formatter-sarif -o reports/eslint.sarif ."
    report: "reports/eslint.sarif"
    report_format: sarif
    fail_on_severity: warning
    severity: error
\`\`\`

## CI snippet

\`\`\`yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm
- run: pnpm install --frozen-lockfile
- run: pnpm eslint --format @microsoft/eslint-formatter-sarif -o reports/eslint.sarif . || true
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
\`\`\`

\`|| true\` keeps ESLint's exit code from short-circuiting the workflow before Rulebound has a chance to read the report. Rulebound stays the authoritative gate.

If you would rather let Rulebound run ESLint itself, skip the explicit ESLint step and set \`allow-commands: "true"\`.

## Troubleshooting

\`rulebound doctor\` should report:

\`\`\`
  ✓ analyzer:eslint        eslint: 1 report(s) ready
\`\`\`

If the tool is missing from PATH:

\`\`\`
  ! analyzer:eslint        eslint: required tool not found on PATH (eslint, pnpm, npm, yarn)
\`\`\`

Install ESLint locally and re-run.

If the report file does not exist yet:

\`\`\`
  ! analyzer:eslint        eslint: tool present, but report file(s) not found yet: reports/eslint.sarif — run the analyzer first or pass --allow-commands
\`\`\`

Then \`rulebound check\` returns:

\`\`\`
ERROR  eslint-all  Analyzer report not found: reports/eslint.sarif. Run the analyzer (or your build) that emits this report, then re-run rulebound check.
\`\`\`

Fix: run \`pnpm eslint ...\` once, or pass \`--allow-commands\` so Rulebound runs the configured \`run:\` command itself.

## Related

- [Analyzer Orchestration](/docs/recipes/orchestration) — the general pattern.
- [TypeScript tsc recipe](/docs/recipes/typescript-tsc) — pair with ESLint for full TS coverage.
`,
}

export default doc
