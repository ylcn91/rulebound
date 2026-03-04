import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "enforcement/fail-modes",
  title: "Fail Modes",
  description:
    "How Rulebound handles violations, blocking behavior, and scoring across enforcement modes.",
  content: `## Fail Modes

Rulebound uses a combination of enforcement mode, rule modality, and validation score to determine whether to block or warn on violations.

### Validation Pipeline

When Rulebound validates code (via \`validate\`, \`diff\`, or \`ci\`), it runs a multi-layer pipeline:

1. **Keyword matching** -- Fast pattern matching against rule content
2. **Semantic matching** -- Deeper text similarity analysis
3. **LLM matching** (optional) -- AI-powered deep validation

Each rule gets a status: \`PASS\`, \`VIOLATED\`, or \`NOT_COVERED\`.

### Report Status

The overall report status is determined by rule results and modality:

| Condition | Status |
|-----------|--------|
| Any MUST rule is VIOLATED | \`FAILED\` |
| Any rule is VIOLATED or NOT_COVERED (no MUST violations) | \`PASSED_WITH_WARNINGS\` |
| All rules PASS | \`PASSED\` |

### Blocking Behavior

Whether a failure actually blocks depends on the enforcement mode:

#### Advisory Mode

\`\`\`
MUST violation    -> Report only (no block)
SHOULD violation  -> Report only (no block)
Low score         -> Report only (no block)
\`\`\`

Use advisory mode for:
- Evaluating a new rule set
- Onboarding a team to Rulebound
- Development environments where speed matters

#### Moderate Mode

\`\`\`
MUST violation    -> BLOCKS
SHOULD violation  -> Warn only
Low score (<70)   -> BLOCKS
\`\`\`

Use moderate mode for:
- Most production teams
- Balancing enforcement with developer velocity
- Gradual adoption of stricter rules

#### Strict Mode

\`\`\`
MUST violation    -> BLOCKS
SHOULD violation  -> BLOCKS
Low score (<70)   -> BLOCKS
\`\`\`

Use strict mode for:
- Regulated industries (finance, healthcare)
- Security-critical codebases
- Mature teams with well-calibrated rules

### Score-Based Blocking

The validation score provides a holistic quality measure:

| Status | Weight |
|--------|--------|
| PASS | 1.0 |
| NOT_COVERED | 0.5 |
| VIOLATED | 0.0 |

Score = weighted sum / total rules * 100

If the score falls below the threshold (default: 70), the change is blocked in moderate and strict modes.

### Gradual Enforcement

Rulebound supports gradual tightening:

1. Start with **advisory** mode to see how your rules perform
2. Fix rules that produce false positives
3. Move to **moderate** mode once MUST rules are calibrated
4. Enable **strict** mode when all rules are well-tuned

When \`autoPromote\` is enabled and your score reaches 90+, Rulebound suggests upgrading:

\`\`\`
Score: 92/100. Consider upgrading to moderate enforcement:
  rulebound enforce --mode moderate
\`\`\`

### Emergency Bypass

If enforcement blocks a critical fix:

\`\`\`bash
# Skip pre-commit hook
git commit --no-verify -m "emergency fix"

# Or temporarily switch to advisory
rulebound enforce --mode advisory
git commit -m "emergency fix"
rulebound enforce --mode moderate
\`\`\`

> Bypassed validations should be caught and reviewed in CI.
`,
}

export default doc
