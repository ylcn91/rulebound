import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "enforcement/github-actions",
  title: "GitHub Actions",
  description:
    "Set up Rulebound in GitHub Actions with PR annotations, status checks, and enforcement gating.",
  content: `## GitHub Actions

Rulebound integrates natively with GitHub Actions through the \`--format github\` output mode, which emits annotations that appear directly on pull request files.

### Basic Workflow

\`\`\`yaml
name: Rulebound
on:
  pull_request:
    branches: [main, develop]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install -g rulebound
      - run: rulebound ci --base main --format github
\`\`\`

> \`fetch-depth: 0\` is required so the CI command can compute the diff against the base branch.

### Annotation Format

The \`--format github\` output uses GitHub's workflow command syntax:

\`\`\`
::error::MUST violation: No Hardcoded Secrets - API key found in source code
::warning::SHOULD: Input Validation - user input not validated
::notice::Rulebound CI: 5 passed, 1 violated, 2 not covered. Score: 72/100
\`\`\`

- \`::error::\` -- MUST violations (VIOLATED status)
- \`::warning::\` -- SHOULD/MAY violations or NOT_COVERED rules
- \`::notice::\` -- Summary with pass/fail/not-covered counts and score

These annotations appear inline on the "Files changed" tab of the PR.

### Status Check

Make Rulebound a required status check:

1. Go to repository Settings > Branches > Branch protection rules
2. Enable "Require status checks to pass before merging"
3. Add the "Rulebound" job as a required check

### With LLM Validation

For deeper analysis, add your API key as a repository secret:

\`\`\`yaml
- name: Validate with LLM
  env:
    ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
  run: rulebound ci --base main --format github --llm
\`\`\`

### Multi-Format Output

Run multiple formats for both human and machine consumption:

\`\`\`yaml
- name: Validate (annotations)
  run: rulebound ci --base main --format github

- name: Validate (JSON artifact)
  run: rulebound ci --base main --format json > rulebound-report.json
  continue-on-error: true

- uses: actions/upload-artifact@v4
  with:
    name: rulebound-report
    path: rulebound-report.json
\`\`\`

### Caching

Speed up CI runs by caching node_modules:

\`\`\`yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: \${{ runner.os }}-rulebound

- run: npm install -g rulebound
\`\`\`

### Exit Codes

| Code | Meaning | GitHub Status |
|------|---------|---------------|
| \`0\` | Passed | Success (green check) |
| \`1\` | Failed (violations or blocked) | Failure (red X) |
| \`2\` | Configuration error | Failure (red X) |

### Monorepo Support

For monorepos, point to the correct rules directory:

\`\`\`yaml
- run: rulebound ci --base main --format github --dir packages/api/.rulebound/rules
\`\`\`
`,
}

export default doc
