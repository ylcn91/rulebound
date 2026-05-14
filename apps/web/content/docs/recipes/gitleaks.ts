import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "recipes/gitleaks",
  title: "gitleaks Recipe",
  description:
    "gitleaks scans the working tree and git history for committed secrets. It emits SARIF, which Rulebound parses into deterministic findings.",
  content: `## gitleaks recipe

gitleaks scans the working tree and git history for committed secrets. It emits SARIF, which Rulebound parses into deterministic findings.

Rulebound does NOT run gitleaks by default. Run it in CI or pass \`--allow-commands\`.

## Prerequisites

\`\`\`bash
brew install gitleaks
# or download a release from https://github.com/gitleaks/gitleaks/releases
\`\`\`

An optional config file (\`.gitleaks.toml\`) if you need allow-listed paths or custom rules. The defaults catch most common credential shapes.

## Rule check block

\`\`\`yaml
checks:
  - type: analyzer
    id: gitleaks-scan
    analyzer: gitleaks
    run: "gitleaks detect --redact --report-format sarif --report-path reports/gitleaks.sarif"
    report: "reports/gitleaks.sarif"
    report_format: sarif
    fail_on_severity: warning
    severity: error
    message: "gitleaks found potential secrets. Rotate any real credentials and add false positives to .gitleaks.toml."
\`\`\`

Notes:

- \`--redact\` keeps the matched secret out of the SARIF body. Without it the finding message contains the candidate secret.
- gitleaks exits non-zero when it finds anything. Rulebound treats the SARIF results as the source of truth, so \`pass_exit_codes\` does not need to be widened.

## CI snippet

\`\`\`yaml
- name: Run gitleaks
  uses: gitleaks/gitleaks-action@v2
  continue-on-error: true
  with:
    config-path: .gitleaks.toml
    args: "--redact --report-format sarif --report-path gitleaks.sarif"
  env:
    GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
\`\`\`

\`continue-on-error: true\` lets Rulebound be the gate; the gitleaks step itself does not fail the workflow.

## Troubleshooting

\`rulebound doctor\`:

\`\`\`
  ✓ analyzer:gitleaks      gitleaks: 1 report(s) ready
\`\`\`

Tool missing:

\`\`\`
  ! analyzer:gitleaks      gitleaks: required tool not found on PATH (gitleaks)
\`\`\`

Install gitleaks (\`brew install gitleaks\`) and re-run.

Report missing:

\`\`\`
ERROR  gitleaks-scan  Analyzer report not found: reports/gitleaks.sarif. Run the analyzer first or pass --allow-commands so rulebound can run \`gitleaks detect --redact --report-format sarif --report-path reports/gitleaks.sarif\` itself.
\`\`\`

Fix: run gitleaks locally once, or pass \`--allow-commands\`.

## Related

- [Analyzer Orchestration](/docs/recipes/orchestration) — the general pattern.
- [Semgrep recipe](/docs/recipes/semgrep) — pair with Semgrep for broader security coverage.
`,
}

export default doc
