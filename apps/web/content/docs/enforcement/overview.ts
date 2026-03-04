import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "enforcement/overview",
  title: "Enforcement Overview",
  description:
    "How Rulebound enforces rules across your development workflow with three enforcement modes.",
  content: `## Enforcement Overview

Rulebound enforces rules at multiple points in your development workflow: during validation, on git commit, in CI/CD pipelines, and in real-time while editing. The enforcement mode controls how strictly violations are handled.

### Enforcement Points

| Point | Command | When |
|-------|---------|------|
| Plan validation | \`rulebound validate\` | Before implementation |
| Diff validation | \`rulebound diff\` | Before commit |
| Pre-commit hook | Auto (via \`rulebound hook\`) | On git commit |
| CI/CD pipeline | \`rulebound ci\` | On PR/push |
| Real-time watch | \`rulebound watch\` | On file save |
| AST analysis | \`rulebound check-code\` | On demand |

### Enforcement Modes

Configure with \`rulebound enforce --mode <mode>\` or in \`.rulebound/config.json\`:

#### Advisory (default)

\`\`\`json
{ "enforcement": { "mode": "advisory" } }
\`\`\`

- Never blocks commits or CI
- Reports all violations as warnings
- Good for onboarding or evaluating rules

#### Moderate

\`\`\`json
{ "enforcement": { "mode": "moderate", "scoreThreshold": 70 } }
\`\`\`

- Blocks on **MUST** rule violations
- Blocks when score drops below threshold
- SHOULD violations are warnings only
- Recommended for most teams

#### Strict

\`\`\`json
{ "enforcement": { "mode": "strict", "scoreThreshold": 80 } }
\`\`\`

- Blocks on any **MUST** or **SHOULD** violation
- Blocks when score drops below threshold
- For regulated environments or mature teams

### Blocking Logic

| Condition | Advisory | Moderate | Strict |
|-----------|----------|----------|--------|
| MUST violation | No block | **Blocks** | **Blocks** |
| SHOULD violation | No block | No block | **Blocks** |
| Score below threshold | No block | **Blocks** | **Blocks** |
| NOT_COVERED rules | No block | No block | No block |

### Score Calculation

Validation score is a weighted average:

| Status | Weight |
|--------|--------|
| PASS | 1.0 |
| NOT_COVERED | 0.5 |
| VIOLATED | 0.0 |

Score formula: \`(PASS + NOT_COVERED * 0.5) / total * 100\`

Default threshold: **70**. Configurable with \`--threshold\`.

### Auto-Promotion

When \`autoPromote\` is enabled (default) and your score reaches 90+, Rulebound suggests upgrading to the next enforcement level. This helps teams gradually increase strictness as their rule compliance improves.

### Configuration

\`\`\`bash
# View current enforcement config
rulebound enforce

# Set mode
rulebound enforce --mode moderate

# Set threshold
rulebound enforce --threshold 80

# Both at once
rulebound enforce --mode strict --threshold 85
\`\`\`

Or edit \`.rulebound/config.json\` directly:

\`\`\`json
{
  "enforcement": {
    "mode": "moderate",
    "scoreThreshold": 70,
    "autoPromote": true
  }
}
\`\`\`
`,
}

export default doc
