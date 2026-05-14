import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/doctor",
  title: "rulebound doctor",
  description:
    "Detect rules, config, toolchains, and analyzer availability. Run this before adding analyzer rules to a project.",
  content: `## rulebound doctor

\`rulebound doctor\` inspects the current workspace and reports whether everything Rulebound needs is in place. Run it after \`rulebound init\` and any time analyzer checks start returning \`ERROR\`.

### Usage

\`\`\`bash
rulebound doctor
\`\`\`

\`doctor\` takes no flags. It always runs against the current working directory.

### What it checks

- **rules dir** — is \`.rulebound/rules\` (or another auto-detected directory) present?
- **rules loaded** — how many rules were parsed, split into deterministic (rules with \`checks:\` blocks) and advisory-only.
- **rule schema** — does any rule have invalid \`checks:\` entries that failed strict-schema validation?
- **project stack** — detected stack (\`typescript\`, \`java\`, \`python\`, \`go\`, ...).
- **git repo** — \`.git\` presence (required for \`diff-evidence\` and \`branch_matches\`).
- **config** — whether \`.rulebound/config.json\` is present (defaults apply when missing).
- **toolchains** — which baseline tools are on \`PATH\` (\`node\`, \`pnpm\`, \`git\`, \`java\`, \`mvn\`, \`gradle\`, \`python\`, \`go\`, \`cargo\`).
- **analyzer:<tool>** — for every \`type: analyzer\` check across loaded rules: is the required CLI on \`PATH\`, and is the expected report file present?
- **command checks** — count of \`type: command\` and \`type: analyzer\` (with \`run:\`) checks that need \`--allow-commands\` to execute.
- **agent configs** — presence of \`AGENTS.md\`, \`CLAUDE.md\`, \`.cursorrules\`, \`.cursor/rules\`.

### Example output

\`\`\`
rulebound doctor

  ✓ rules dir              /repo/.rulebound/rules
  ✓ rules loaded           12 total · 9 deterministic · 3 advisory-only
  ✓ project stack          typescript
  ✓ git repo               /repo
  ✓ config                 .rulebound/config.json
  ✓ toolchains             node, pnpm, git
  ✓ analyzer:eslint        eslint: 1 report(s) ready
  ! analyzer:tsc           tsc: tool present, but report file(s) not found yet: reports/tsc.log — run the analyzer first or pass --allow-commands
  ! command checks         2 check(s) require '--allow-commands' to execute (subprocess-disabled by default)
  ✓ agent configs          AGENTS.md, CLAUDE.md
\`\`\`

### Status legend

- \`✓\` ok — no action needed.
- \`!\` warn — Rulebound will continue, but a check may be \`NOT_APPLICABLE\` or \`ERROR\` until you fix it.
- \`✗\` fail — Rulebound cannot run. The command exits with code \`2\`.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | No \`fail\` items. |
| 2 | At least one \`fail\` item (e.g. missing rules directory or rule-schema parse error). |

### Related

- [Analyzer Orchestration](/docs/recipes/orchestration) — what makes an analyzer check green vs warn.
- [\`rulebound init\`](/docs/cli/init) — what \`doctor\` checks for after init.
`,
}

export default doc
