import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "ast/overview",
  title: "AST Engine Overview",
  description: "Rulebound AST Engine — structural code analysis using tree-sitter for precise pattern detection across 10 languages.",
  content: `## AST Engine Overview

The Rulebound AST engine provides structural code analysis using [tree-sitter](https://tree-sitter.github.io/tree-sitter/). Unlike regex-based scanning, AST analysis understands the structure of your code and can detect precise patterns like \`eval()\` calls, empty catch blocks, or field injection with exact source locations.

### How It Works

1. **Parse** — Code is parsed into an Abstract Syntax Tree using web-tree-sitter with language-specific WASM grammars
2. **Query** — Tree-sitter queries (S-expression patterns) are executed against the AST
3. **Match** — Matching nodes are captured with their source locations
4. **Report** — Matches are converted to violations with line numbers, messages, and suggested fixes

### Architecture

\`\`\`
Source Code
    |
    v
web-tree-sitter Parser
    |
    v
Abstract Syntax Tree (AST)
    |
    v
Tree-sitter Queries (S-expressions)
    |
    v
ASTMatch[] with locations
\`\`\`

### Key Features

- **10 Languages** — TypeScript, JavaScript, Python, Java, Go, Rust, C#, C++, Ruby, Bash
- **30+ Built-in Queries** — Common patterns pre-configured per language
- **Custom Queries** — Define your own tree-sitter queries in rule files
- **Capture Filters** — Filter matches by capture values (e.g., only match \`console.log\`, not \`console.error\`)
- **WASM-based** — Runs in Node.js via WebAssembly, no native compilation needed

### Performance

The engine reports timing for both parsing and querying:

\`\`\`typescript
interface ASTAnalysisResult {
  language: string
  matches: ASTMatch[]
  parseErrors: number    // Syntax errors found
  nodeCount: number      // Total AST nodes
  parseTimeMs: number    // Time to parse
  queryTimeMs: number    // Time to run queries
}
\`\`\`

Typical performance for a 500-line file:
- Parse time: 5-15ms
- Query time: 1-5ms per query

### Usage

\`\`\`typescript
import { analyzeCode, analyzeWithBuiltins } from "@rulebound/engine"

// Analyze with all built-in queries for a language
const result = await analyzeWithBuiltins(code, "typescript")

// Analyze with specific queries
const result = await analyzeCode(code, "typescript", customQueries)

for (const match of result.matches) {
  console.log(
    \`[\${match.severity}] L\${match.location.startRow + 1}: \${match.message}\`
  )
}
\`\`\`

### Integration Points

The AST engine is used by:

| Component | Usage |
|-----------|-------|
| **Gateway** | Scans code blocks in LLM responses |
| **LSP Server** | Provides real-time diagnostics in editors |
| **MCP Server** | Pre-write validation via \`validate_before_write\` |
| **CLI** | \`rulebound scan\` command |

### Next Steps

- [Pattern Matching](/docs/ast/pattern-matching) — Writing tree-sitter queries
- [Supported Languages](/docs/ast/supported-languages) — Language-specific queries and features
`,
}

export default doc
