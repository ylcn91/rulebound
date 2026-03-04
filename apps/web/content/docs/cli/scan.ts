import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/scan",
  title: "Scanning Commands",
  description:
    "Rulebound scanning commands: find-rules, validate, diff, check-code, and score for comprehensive rule enforcement.",
  content: `## Scanning Commands

Rulebound provides several commands for scanning code, plans, and diffs against your rules.

### rulebound find-rules

Find and filter rules by task, category, tags, or stack.

\`\`\`bash
rulebound find-rules [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`-t, --task <text>\` | Describe the task to find relevant rules |
| \`--title <title>\` | Search by title |
| \`-c, --category <category>\` | Filter by category |
| \`--tags <tags>\` | Filter by tags (comma-separated) |
| \`--stack <stack>\` | Filter by tech stack (comma-separated) |
| \`-f, --format <format>\` | Output: \`table\` (default), \`json\`, \`inject\` |
| \`-d, --dir <path>\` | Path to rules directory |

**Examples:**

\`\`\`bash
# Find rules relevant to an auth task
rulebound find-rules --task "add JWT authentication"

# Filter by category and tags
rulebound find-rules --category security --tags "auth,api"

# Output in inject format (ready to paste into agent context)
rulebound find-rules --format inject

# JSON output
rulebound find-rules --format json
\`\`\`

The \`inject\` format outputs rules with \`[MUST]\`/\`[SHOULD]\`/\`[MAY]\` prefixes, ready to paste into an AI agent's context window.

---

### rulebound validate

Validate an implementation plan against matched rules.

\`\`\`bash
rulebound validate [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`-p, --plan <text>\` | Plan text to validate |
| \`--file <path>\` | Path to a plan file |
| \`-f, --format <format>\` | Output: \`pretty\` (default), \`json\` |
| \`-d, --dir <path>\` | Path to rules directory |
| \`--llm\` | Use LLM for deep validation (requires AI SDK) |

**Examples:**

\`\`\`bash
# Validate inline plan text
rulebound validate --plan "Add a REST endpoint for user deletion"

# Validate from a file
rulebound validate --file implementation-plan.md

# With LLM-powered deep validation
rulebound validate --plan "Refactor auth module" --llm

# JSON output for scripting
rulebound validate --file plan.md --format json
\`\`\`

The validation report shows each rule with its status: PASS, VIOLATED, or NOT_COVERED. Exit code 1 if any MUST rule is violated.

---

### rulebound diff

Validate git diff against rules before merge.

\`\`\`bash
rulebound diff [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`--ref <ref>\` | Git ref to diff against (default: HEAD) |
| \`-f, --format <format>\` | Output: \`pretty\` (default), \`json\` |
| \`-d, --dir <path>\` | Path to rules directory |
| \`--llm\` | Use LLM for deep validation |

**Examples:**

\`\`\`bash
# Diff against HEAD (uncommitted changes)
rulebound diff

# Diff against a specific branch
rulebound diff --ref main

# JSON output
rulebound diff --format json
\`\`\`

---

### rulebound check-code

Analyze a source file with AST-based anti-pattern detection using tree-sitter.

\`\`\`bash
rulebound check-code [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`--file <path>\` | Path to source file (required) |
| \`-l, --language <lang>\` | Language override (auto-detected from extension) |
| \`-q, --queries <ids>\` | Comma-separated builtin query IDs to run |

Supported languages: typescript, javascript, python, java, go, rust, c_sharp, cpp, ruby, bash.

**Examples:**

\`\`\`bash
# Analyze a TypeScript file
rulebound check-code --file src/auth.ts

# Specify language manually
rulebound check-code --file config --language typescript

# Run specific queries only
rulebound check-code --file app.py --queries "empty-catch,console-log"
\`\`\`

---

### rulebound score

Calculate rule quality score and generate a README badge.

\`\`\`bash
rulebound score [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`-d, --dir <path>\` | Path to rules directory |
| \`--no-badge\` | Skip badge generation |
| \`-o, --output <path>\` | Save badge markdown to a file |

**Examples:**

\`\`\`bash
# Score your rules
rulebound score

# Save badge to a file
rulebound score --output badge.md
\`\`\`

Rules are scored on three dimensions: atomicity (0-5), completeness (0-5), and clarity (0-5). The overall score is a percentage out of 100.
`,
}

export default doc
