import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "rules/severity-levels",
  title: "Severity Levels",
  description:
    "How severity and modality interact in Rulebound to determine enforcement behavior and validation outcomes.",
  content: `## Severity Levels

Rulebound uses two dimensions to classify rules: **severity** (how serious a violation is) and **modality** (how mandatory the rule is). Together they determine validation outcomes and enforcement behavior.

### Severity

| Level | Use For | Display |
|-------|---------|---------|
| \`error\` | Critical issues that must be fixed | Red badge in reports |
| \`warning\` | Issues that should be addressed | Yellow badge in reports |
| \`info\` | Informational guidelines | Blue badge in reports |

Set severity in rule front matter:

\`\`\`yaml
severity: error
\`\`\`

### Modality

Modality follows RFC 2119 language and controls validation status:

| Level | Keyword | Meaning | On Violation |
|-------|---------|---------|-------------|
| \`must\` | MUST | Absolute requirement | Status: \`FAILED\` |
| \`should\` | SHOULD | Recommended but not absolute | Status: \`PASSED_WITH_WARNINGS\` |
| \`may\` | MAY | Optional guidance | Reported but never blocks |

Set modality in rule front matter:

\`\`\`yaml
modality: must
\`\`\`

### Validation Statuses

Each rule in a validation report gets one of three statuses:

| Status | Meaning |
|--------|---------|
| \`PASS\` | Rule is satisfied |
| \`VIOLATED\` | Rule is not satisfied |
| \`NOT_COVERED\` | Rule could not be evaluated (insufficient context) |

### How They Interact

The overall validation status is determined by combining individual rule results:

| Condition | Report Status |
|-----------|--------------|
| Any \`must\` rule is VIOLATED | \`FAILED\` |
| Any rule is VIOLATED or NOT_COVERED (but no \`must\` violations) | \`PASSED_WITH_WARNINGS\` |
| All rules PASS | \`PASSED\` |

### Enforcement Modes

Enforcement mode adds another layer on top of validation status:

| Mode | Blocks On |
|------|-----------|
| \`advisory\` | Never blocks (reports only) |
| \`moderate\` | MUST violations or score below threshold |
| \`strict\` | Any MUST or SHOULD violation, or score below threshold |

### Score Calculation

The validation score is calculated as a weighted average:

| Status | Weight |
|--------|--------|
| PASS | 1.0 |
| NOT_COVERED | 0.5 |
| VIOLATED | 0.0 |

\`\`\`
Score = (PASS * 1.0 + NOT_COVERED * 0.5 + VIOLATED * 0.0) / total_rules * 100
\`\`\`

The score threshold (default: 70) is used in moderate and strict modes to block low-quality changes.

### Choosing Severity and Modality

| Scenario | Severity | Modality |
|----------|----------|----------|
| Security vulnerability (SQL injection, XSS) | \`error\` | \`must\` |
| Missing error handling | \`warning\` | \`should\` |
| Naming convention | \`warning\` | \`should\` |
| Performance optimization tip | \`info\` | \`may\` |
| Experimental practice | \`info\` | \`may\` |
`,
}

export default doc
