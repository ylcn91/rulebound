import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "rules/custom-rules",
  title: "Custom Rules",
  description:
    "Write effective custom rules with proper metadata, clear requirements, and good/bad examples.",
  content: `## Writing Custom Rules

Well-written rules are the foundation of effective enforcement. This guide covers how to write rules that are clear, specific, and useful for both validation and agent config generation.

### Rule Quality Dimensions

Rulebound scores rules on three dimensions (use \`rulebound score\` or \`rulebound rules lint\`):

| Dimension | What It Measures | Tips |
|-----------|-----------------|------|
| **Atomicity** | One concern per rule | Keep bullet points under 7, headings under 5 |
| **Completeness** | Metadata and examples | Include title, tags, code examples, good and bad |
| **Clarity** | Precise language | Use must/never/always; avoid vague words like "etc", "maybe" |

### Template

\`\`\`markdown
---
title: Descriptive Rule Title
category: security
severity: error
modality: must
tags: [specific, relevant, tags]
stack: [typescript]
scope: [backend]
---

# Descriptive Rule Title

One paragraph explaining why this rule exists and what problem it prevents.

## Rules

- First specific requirement (use must/never/always)
- Second specific requirement
- Third specific requirement

## Good Example

\\\`\\\`\\\`typescript
// Show the correct approach
const result = await fetchData()
if (!result.ok) {
  throw new AppError('Fetch failed', { status: result.status })
}
\\\`\\\`\\\`

## Bad Example

\\\`\\\`\\\`typescript
// Show what to avoid
const result = await fetchData()
// No error handling - violation
\\\`\\\`\\\`
\`\`\`

### Writing Effective Requirements

**Do:**
- Start each bullet with an action verb (use, avoid, always, never)
- Be specific about what to do or not do
- Reference concrete patterns or APIs

**Avoid:**
- Vague language ("try to", "consider", "maybe")
- Multiple concerns in one rule
- More than 7 bullet points (split into separate rules)

### Metadata Tips

**Tags** -- Use 2-4 specific tags. They are used for filtering with \`find-rules --tags\`.

\`\`\`yaml
# Good: specific, useful for filtering
tags: [sql-injection, parameterized-queries, database]

# Bad: too generic
tags: [code, rules]
\`\`\`

**Stack** -- Only set this if the rule is language-specific. Rules without \`stack\` apply to all projects.

\`\`\`yaml
# Only applies to TypeScript/JavaScript projects
stack: [typescript, javascript]
\`\`\`

**Scope** -- Use this for rules that target specific project areas.

\`\`\`yaml
# Only applies to backend projects
scope: [backend, api]
\`\`\`

### Code Examples for Agent Generation

The \`rulebound generate\` command extracts content from rules to create agent config files. It specifically looks for:

1. **Bullet points** -- All lines starting with \`-\`
2. **Good examples** -- Code blocks under \`## Good Example\`, \`## Correct\`, or \`## Recommended\` headings

Write your good examples so they work as standalone code snippets that an AI agent can follow.

### Scoring Your Rules

Check the quality of your rules:

\`\`\`bash
# Overall quality score
rulebound score

# Detailed per-rule lint
rulebound rules lint
\`\`\`

The score ranges from 0-100 and grades A (90+) through F (below 60).

### Category Breakdown

The \`score\` command also shows a per-category breakdown so you can identify which areas need better rules.
`,
}

export default doc
