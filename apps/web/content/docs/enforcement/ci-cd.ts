import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "enforcement/ci-cd",
  title: "CI/CD Integration",
  description:
    "Add Rulebound to your CI/CD pipeline with GitHub Actions, GitLab CI, or any CI system.",
  content: `## CI/CD Integration

The \`rulebound ci\` command is designed for CI/CD pipelines. It diffs your changes against a base branch, validates against matched rules, and outputs results in machine-readable formats.

### GitHub Actions

\`\`\`yaml
name: Rulebound CI
on:
  pull_request:
    branches: [main]

jobs:
  rulebound:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install -g rulebound

      - name: Validate changes
        run: rulebound ci --base main --format github
\`\`\`

The \`--format github\` flag outputs GitHub Actions annotations:

\`\`\`
::error::MUST violation: No Hardcoded Secrets - API key found in source code
::warning::SHOULD: Input Validation - user input not validated in handler
::notice::Rulebound CI: 5 passed, 1 violated, 2 not covered. Score: 72/100
\`\`\`

These annotations appear directly on the PR's "Files changed" tab.

### Options

| Flag | Default | Description |
|------|---------|-------------|
| \`-b, --base <branch>\` | \`main\` | Base branch to diff against |
| \`-f, --format <format>\` | \`pretty\` | Output: \`pretty\`, \`json\`, \`github\` |
| \`--llm\` | off | Use LLM for deep validation |
| \`-d, --dir <path>\` | auto | Path to rules directory |

### Exit Codes

| Code | Meaning |
|------|---------|
| \`0\` | Passed -- all rules satisfied or only warnings |
| \`1\` | Failed -- MUST violations detected or blocked by enforcement |
| \`2\` | Error -- no rules found, git error, or configuration issue |

### Enforcement in CI

The CI command respects your enforcement config from \`.rulebound/config.json\`:

- **Advisory** -- Always exits 0 (never blocks the pipeline)
- **Moderate** -- Exits 1 on MUST violations or score below threshold
- **Strict** -- Exits 1 on any MUST/SHOULD violation or score below threshold

### JSON Output

For custom integrations, use \`--format json\`:

\`\`\`bash
rulebound ci --format json
\`\`\`

\`\`\`json
{
  "task": "CI diff against main",
  "rulesMatched": 8,
  "rulesTotal": 12,
  "results": [...],
  "summary": { "pass": 6, "violated": 1, "notCovered": 1 },
  "status": "FAILED",
  "filesChanged": ["src/auth.ts", "src/api.ts"],
  "score": 72,
  "blocked": true
}
\`\`\`

### GitLab CI

\`\`\`yaml
rulebound:
  stage: test
  image: node:20
  script:
    - npm install -g rulebound
    - rulebound ci --base main
  only:
    - merge_requests
\`\`\`

### Generic CI

For any CI system:

\`\`\`bash
# Install
npm install -g rulebound

# Run validation (ensure full git history is available)
git fetch origin main
rulebound ci --base main
\`\`\`

> The CI command needs git history to compute the diff. Make sure your CI clones with full depth (\`fetch-depth: 0\` in GitHub Actions).

### LLM-Powered Validation in CI

For deeper validation, enable the \`--llm\` flag and set your API key:

\`\`\`yaml
- name: Validate with LLM
  env:
    ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
  run: rulebound ci --base main --format github --llm
\`\`\`

> LLM validation adds latency and API costs. Consider using it only on critical branches or for final review.
`,
}

export default doc
