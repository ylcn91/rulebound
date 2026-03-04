import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "gateway/ast-analysis",
  title: "Gateway AST Analysis",
  description: "How the Rulebound Gateway uses tree-sitter AST analysis to detect structural code violations in LLM responses.",
  content: `## Gateway AST Analysis

In addition to semantic validation, the gateway performs structural code analysis using tree-sitter. This catches violations that pattern matching alone would miss, such as \`eval()\` calls, empty catch blocks, and field injection patterns.

### How It Works

When the gateway extracts code blocks from an LLM response, each block with a language annotation is:

1. **Language Detection** — The code fence annotation (e.g., \`typescript\`, \`py\`) is mapped to a tree-sitter language
2. **Parsing** — The code is parsed into an AST using web-tree-sitter
3. **Query Matching** — Built-in tree-sitter queries are executed against the AST
4. **Violation Reporting** — Matches are converted to violation objects with line numbers

### Supported Language Annotations

| Annotation | Language |
|-----------|----------|
| \`typescript\`, \`ts\` | TypeScript |
| \`javascript\`, \`js\` | JavaScript |
| \`python\`, \`py\` | Python |
| \`java\` | Java |
| \`go\`, \`golang\` | Go |
| \`rust\`, \`rs\` | Rust |
| \`ruby\`, \`rb\` | Ruby |
| \`bash\`, \`sh\`, \`shell\` | Bash |
| \`csharp\`, \`cs\` | C# |
| \`cpp\`, \`c++\` | C++ |

### AST Violation Output

Each AST violation includes:

\`\`\`typescript
interface ASTViolation {
  ruleTitle: string   // The query name (e.g., "No eval()")
  severity: string    // "error" | "warning" | "info"
  reason: string      // Description prefixed with "AST pattern:"
  line: number        // 1-based line number in the code block
  codeSnippet: string // The matched code (truncated to 200 chars)
}
\`\`\`

### Example

Given this code block in an LLM response:

\`\`\`typescript
function processInput(data: any) {
  try {
    eval(data.expression)
  } catch {}
}
\`\`\`

The AST scanner would detect:

| Violation | Severity | Line |
|----------|----------|------|
| No 'any' Type | error | 1 |
| No eval() | error | 3 |
| No Empty Catch Block | error | 4 |

### Combining with Semantic Validation

AST violations are merged with semantic violations into a single \`ScanResult\`. This gives you both:

- **Semantic checks** — Rule-level validation (e.g., "Does this code follow our authentication pattern?")
- **AST checks** — Structural validation (e.g., "Does this code use \`eval()\`?")

### Graceful Degradation

AST analysis is designed to be resilient:

- If parsing fails (e.g., incomplete code snippets), the scanner returns an empty result rather than crashing
- Unsupported languages are silently skipped
- The gateway continues processing even if AST analysis encounters errors

### Programmatic Usage

\`\`\`typescript
import { scanCodeBlockWithAST, detectLanguageFromAnnotation } from "@rulebound/gateway"

const language = detectLanguageFromAnnotation("typescript")
if (language) {
  const violations = await scanCodeBlockWithAST(code, language)
  for (const v of violations) {
    console.log(\`[\${v.severity}] Line \${v.line}: \${v.reason}\`)
  }
}
\`\`\`
`,
}

export default doc
