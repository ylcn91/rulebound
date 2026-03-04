import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "rules/rule-format",
  title: "Rule Format",
  description:
    "Complete reference for the Rulebound rule YAML front matter format and markdown body structure.",
  content: `## Rule Format

Rules are markdown files with YAML front matter. The front matter defines metadata for matching and enforcement; the body contains the rule description and examples.

### Full Schema

\`\`\`markdown
---
title: Rule Title
category: security
severity: error
modality: must
tags: [auth, api]
stack: [typescript, javascript]
scope: [backend]
change-types: [feature, bugfix]
team: [platform]
---

# Rule Title

Description of the rule and why it exists.

## Rules

- First requirement
- Second requirement
- Third requirement

## Good Example

\\\`\\\`\\\`typescript
// Correct approach
\\\`\\\`\\\`

## Bad Example

\\\`\\\`\\\`typescript
// Incorrect approach
\\\`\\\`\\\`
\`\`\`

### Front Matter Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| \`title\` | \`string\` | filename | Human-readable rule name |
| \`category\` | \`string\` | parent directory | Grouping category |
| \`severity\` | \`"error" \\| "warning" \\| "info"\` | \`"warning"\` | How serious a violation is |
| \`modality\` | \`"must" \\| "should" \\| "may"\` | \`"should"\` | How mandatory the rule is |
| \`tags\` | \`string[]\` | \`[]\` | Free-form labels for filtering |
| \`stack\` | \`string[]\` | \`[]\` | Tech stack filter |
| \`scope\` | \`string[]\` | \`[]\` | Project scope filter |
| \`change-types\` | \`string[]\` | \`[]\` | Change type filter (feature, bugfix, refactor) |
| \`team\` | \`string[]\` | \`[]\` | Team name filter |

### Severity

Controls how violations appear in reports:

| Value | Meaning | CLI Display |
|-------|---------|-------------|
| \`error\` | Critical violation, must be fixed | Red \`[ERROR]\` |
| \`warning\` | Should be fixed, may be acceptable | Yellow \`[WARNING]\` |
| \`info\` | Informational, good to know | Blue \`[INFO]\` |

### Modality

Controls enforcement behavior (follows RFC 2119):

| Value | Meaning | Enforcement |
|-------|---------|-------------|
| \`must\` | Absolute requirement | Violations cause FAILED status |
| \`should\` | Recommended practice | Violations cause PASSED_WITH_WARNINGS |
| \`may\` | Optional guideline | Reported but never blocks |

> In \`strict\` enforcement mode, \`should\` violations also block.

### Category

Built-in categories:

- \`architecture\` -- System design and patterns
- \`security\` -- Security requirements
- \`style\` -- Code style and formatting
- \`testing\` -- Testing standards
- \`performance\` -- Performance guidelines
- \`infra\` -- Infrastructure rules
- \`workflow\` -- Development workflow

You can use any string as a category. If omitted, the parent directory name is used.

### Stack and Scope Filters

Rules with \`stack\` or \`scope\` arrays are only matched when the project config has overlapping values:

\`\`\`yaml
# Only applies to TypeScript projects
stack: [typescript]

# Only applies to backend and API projects
scope: [backend, api]
\`\`\`

Rules without \`stack\` or \`scope\` are considered global and apply to all projects.

### Body Structure

The markdown body should follow this structure:

1. **Heading** -- Repeat the title as an H1
2. **Description** -- Why the rule exists
3. **Rules section** -- Bullet list of specific requirements
4. **Good Example** -- Code that follows the rule
5. **Bad Example** -- Code that violates the rule

The \`generate\` command extracts bullet points and good examples when creating agent config files.

### Rule ID

Each rule gets an automatic ID based on its file path:

\`\`\`
.rulebound/rules/security/no-secrets.md  ->  security.no-secrets
.rulebound/rules/global/naming.md        ->  global.naming
\`\`\`

Rule IDs are used for inheritance overrides and the \`rules show\` command.
`,
}

export default doc
