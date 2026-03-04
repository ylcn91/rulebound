import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "rules/overview",
  title: "Rules Overview",
  description:
    "Learn how Rulebound rules work -- markdown files with YAML metadata that define your engineering standards.",
  content: `## Rules Overview

Rules are the core of Rulebound. Each rule is a markdown file with YAML front matter that describes an engineering standard your team wants to enforce.

### What is a Rule?

A rule captures a single, specific engineering standard. It includes:

- **Metadata** -- Severity, modality, category, tags, and context filters
- **Description** -- What the rule is about and why it matters
- **Requirements** -- Specific bullet points of what to do or avoid
- **Examples** -- Good and bad code examples

### Rule Lifecycle

1. **Author** -- Write rules as \`.md\` files in \`.rulebound/rules/\`
2. **Validate** -- Run \`rulebound rules lint\` to check rule quality
3. **Match** -- Rulebound selects relevant rules based on task context
4. **Enforce** -- Rules are checked during validate, diff, CI, and watch
5. **Generate** -- Export to agent config files so AI follows rules proactively

### Quick Example

\`\`\`markdown
---
title: No Console Logs in Production
category: style
severity: warning
modality: should
tags: [logging, cleanup]
stack: [typescript, javascript]
---

# No Console Logs in Production

Remove console.log statements before merging to main.

## Rules

- Use a structured logger instead of console.log
- console.error is acceptable for critical failures
- Remove all debugging console.log before code review

## Good Example

\\\`\\\`\\\`typescript
import { logger } from '@/lib/logger'
logger.info('User authenticated', { userId })
\\\`\\\`\\\`

## Bad Example

\\\`\\\`\\\`typescript
console.log('user logged in', userId)
\\\`\\\`\\\`
\`\`\`

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Severity** | \`error\`, \`warning\`, or \`info\` -- how serious a violation is |
| **Modality** | \`must\`, \`should\`, or \`may\` -- how mandatory the rule is |
| **Category** | Groups rules (architecture, security, style, testing, performance, etc.) |
| **Tags** | Free-form labels for filtering |
| **Stack** | Tech stack filter (typescript, java, go, etc.) |
| **Scope** | Project scope filter (backend, frontend, infra, etc.) |

### Related Pages

- [Rule Format](/docs/rules/rule-format) -- Full YAML schema reference
- [Severity Levels](/docs/rules/severity-levels) -- How severity and modality interact
- [Rule Inheritance](/docs/rules/rule-inheritance) -- Sharing rules across projects
- [Custom Rules](/docs/rules/custom-rules) -- Writing effective rules
`,
}

export default doc
