import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "lsp/diagnostics",
  title: "LSP Diagnostics",
  description: "Understanding Rulebound LSP diagnostics — how AST matches and rule violations appear in your editor.",
  content: `## LSP Diagnostics

The Rulebound LSP server produces two types of diagnostics: AST-based diagnostics with precise source locations, and rule-based diagnostics from semantic validation.

### AST Diagnostics

AST diagnostics have precise line and column ranges based on the tree-sitter parse tree. They appear as inline squiggly underlines in your editor.

\`\`\`
src/auth.ts:5:3 [error] [ts-no-eval] eval() is a security risk and should never be used
src/auth.ts:8:1 [warning] [ts-no-console-log] Remove console.log before committing. Use a structured logger.
\`\`\`

Each AST diagnostic includes:

| Field | Description |
|-------|-------------|
| **Range** | Exact start/end position (line, column) |
| **Severity** | Error, Warning, or Information |
| **Source** | Always \`rulebound\` |
| **Message** | Format: \`[queryId] description\` |

### Severity Mapping

| Rule Severity | LSP Severity | Editor Display |
|--------------|-------------|----------------|
| \`error\` | Error | Red underline |
| \`warning\` | Warning | Yellow underline |
| \`info\` | Information | Blue underline |

### Rule Diagnostics

Rule diagnostics come from semantic validation against your project rules. Since semantic validation operates on the entire file, these diagnostics appear at line 0, column 0 (the beginning of the file).

\`\`\`
src/service.ts:1:1 [warning] [Use Constructor Injection] Field injection detected (Fix: Use constructor injection with final fields)
\`\`\`

Rule diagnostics include a suggested fix when available:

| Field | Description |
|-------|-------------|
| **Range** | Start of file (0:0 to 0:0) |
| **Severity** | Based on rule severity |
| **Source** | Always \`rulebound\` |
| **Message** | Format: \`[ruleTitle] reason (Fix: suggestedFix)\` |

### Analysis Triggers

| Event | Behavior |
|-------|----------|
| **File Opened** | Immediate full analysis |
| **Content Changed** | Debounced analysis (300ms delay) |
| **File Saved** | Immediate full analysis (cancels pending debounce) |

The debounce ensures analysis does not run on every keystroke. When you stop typing for 300ms, the analysis runs. Saving always triggers an immediate analysis.

### Supported Languages

The LSP server detects language from file extensions:

| Extensions | Language |
|-----------|----------|
| \`.ts\`, \`.tsx\` | TypeScript |
| \`.js\`, \`.jsx\`, \`.mjs\`, \`.cjs\` | JavaScript |
| \`.py\` | Python |
| \`.java\` | Java |
| \`.go\` | Go |
| \`.rs\` | Rust |
| \`.cs\` | C# |
| \`.cpp\`, \`.cc\`, \`.cxx\`, \`.h\`, \`.hpp\` | C++ |
| \`.rb\` | Ruby |
| \`.sh\`, \`.bash\` | Bash |

Files with unsupported extensions are silently skipped (no diagnostics produced).

### Troubleshooting

**No diagnostics appearing:**
- Verify the LSP server is running: check your editor's LSP log
- Ensure the file type is supported (see table above)
- Check that \`.rulebound/rules/\` exists in your workspace for rule diagnostics

**Diagnostics are slow:**
- AST parsing is fast (<50ms for typical files)
- Semantic validation may take longer for many rules
- The 300ms debounce prevents redundant analysis

**Diagnostics at wrong location:**
- AST diagnostics have precise locations
- Rule diagnostics always appear at file start (this is expected)
`,
}

export default doc
