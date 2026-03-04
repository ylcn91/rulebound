import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "rules/glob-patterns",
  title: "Glob Patterns",
  description:
    "How Rulebound discovers and filters rule files using directory scanning and metadata filters.",
  content: `## Rule Discovery and Filtering

Rulebound discovers rules by recursively scanning the rules directory for \`.md\` files. You can then filter which rules apply using metadata and CLI options.

### Rule Discovery

When you run any command that loads rules, Rulebound:

1. Finds the rules directory (\`.rulebound/rules/\` by default)
2. Recursively collects all \`.md\` files
3. Parses YAML front matter from each file
4. Builds a rule list with IDs derived from file paths

The rules directory is found by checking these locations in order:

1. \`.rulebound/rules/\`
2. \`rules/\`
3. \`examples/rules/\`

You can override this with the \`--dir\` flag or \`rulesDir\` in config.json.

### Filtering Rules

Use the \`find-rules\` command to filter rules:

\`\`\`bash
# Filter by category
rulebound find-rules --category security

# Filter by tags
rulebound find-rules --tags "auth,api"

# Filter by tech stack
rulebound find-rules --stack typescript

# Filter by title search
rulebound find-rules --title "secrets"

# Filter by task description (semantic matching)
rulebound find-rules --task "add authentication endpoint"
\`\`\`

### Context-Aware Matching

When you run \`validate\`, \`diff\`, or \`ci\`, Rulebound does smart context matching:

1. **Stack matching** -- Rules with \`stack\` that overlap with your project config get +3 score per match
2. **Scope matching** -- Rules with \`scope\` that overlap get +2 score per match
3. **Team matching** -- Rules with \`team\` matching your config get +1
4. **Global rules** -- Rules without stack/scope/team always apply
5. **Task matching** -- Words from the task description are matched against rule titles, tags, and categories

Rules are sorted by their match score so the most relevant rules are prioritized.

### Directory Organization

Organize rules into subdirectories by category:

\`\`\`
.rulebound/rules/
  security/
    no-secrets.md
    input-validation.md
  style/
    naming-conventions.md
  testing/
    coverage-requirements.md
  architecture/
    api-patterns.md
\`\`\`

The subdirectory name is used as the default \`category\` if the front matter does not specify one.

### Ignoring Files

Only files with the \`.md\` extension are loaded as rules. Other file types (README, notes, drafts) are ignored unless they end in \`.md\`.

> To exclude a rule without deleting it, move it outside the rules directory or rename it to a non-\`.md\` extension.
`,
}

export default doc
