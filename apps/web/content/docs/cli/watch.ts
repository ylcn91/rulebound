import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/watch",
  title: "rulebound watch",
  description:
    "Watch files for changes and run real-time rule validation and AST analysis on save.",
  content: `## rulebound watch

Watch a directory for file changes and run real-time rule validation and AST analysis. Violations are reported immediately as you edit code.

### Usage

\`\`\`bash
rulebound watch [dir] [options]
\`\`\`

### Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| \`dir\` | \`.\` | Directory to watch |

### Options

| Flag | Default | Description |
|------|---------|-------------|
| \`--debounce <ms>\` | \`300\` | Debounce interval in milliseconds |
| \`--format <type>\` | \`pretty\` | Output format: \`pretty\` or \`json\` |
| \`--ignore <glob>\` | see below | Glob patterns to ignore (repeatable) |

### Default Ignore Patterns

These directories are ignored by default:

- \`node_modules\`
- \`.git\`
- \`dist\`
- \`.next\`
- \`coverage\`

Add custom ignores:

\`\`\`bash
rulebound watch --ignore "build" --ignore "tmp"
\`\`\`

### What It Does

On each file change, the watch command:

1. **Detects language** from the file extension
2. **Runs AST analysis** using tree-sitter with built-in anti-pattern queries
3. **Runs rule validation** against your \`.rulebound/rules/\`
4. **Reports violations** in real-time

Only files with supported language extensions are analyzed. Unsupported files are silently skipped.

### Examples

\`\`\`bash
# Watch current directory
rulebound watch

# Watch a specific directory
rulebound watch src/

# JSON output (useful for editor integrations)
rulebound watch --format json

# Faster debounce for immediate feedback
rulebound watch --debounce 100

# Ignore additional directories
rulebound watch --ignore "generated" --ignore "vendor"
\`\`\`

### Output Formats

**Pretty format** (default):

\`\`\`
[ERROR] src/auth.ts:15 - empty-catch: Empty catch blocks hide errors
[WARN]  src/api.ts - SHOULD: Input Validation - validate user input
\`\`\`

**JSON format** (for tool integration):

\`\`\`json
{"type":"ast","file":"src/auth.ts","line":15,"rule":"empty-catch","severity":"error","message":"Empty catch blocks hide errors"}
\`\`\`

### Stopping

Press \`Ctrl+C\` to stop the watcher.

> Watch mode uses Node.js native \`fs.watch\` with recursive mode, which requires Node.js 18+.
`,
}

export default doc
