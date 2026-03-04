import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "ast/supported-languages",
  title: "Supported Languages",
  description: "Complete reference of languages and built-in AST queries supported by the Rulebound engine.",
  content: `## Supported Languages

The Rulebound AST engine supports 10 languages via web-tree-sitter WASM grammars. Each language has built-in queries for common code quality and security patterns.

### Language Support Matrix

| Language | File Extensions | Built-in Queries |
|----------|---------------|-----------------|
| TypeScript | \`.ts\`, \`.tsx\` | 10 queries |
| JavaScript | \`.js\`, \`.jsx\`, \`.mjs\`, \`.cjs\` | 7 queries |
| Python | \`.py\` | 7 queries |
| Java | \`.java\` | 5 queries |
| Go | \`.go\` | 3 queries |
| Rust | \`.rs\` | 4 queries |
| C# | \`.cs\` | 0 (custom queries only) |
| C++ | \`.cpp\`, \`.cc\`, \`.cxx\`, \`.h\`, \`.hpp\` | 0 (custom queries only) |
| Ruby | \`.rb\` | 0 (custom queries only) |
| Bash | \`.sh\`, \`.bash\` | 0 (custom queries only) |

### TypeScript Queries

| ID | Name | Severity | Category |
|----|------|----------|----------|
| \`ts-no-any\` | No 'any' Type | error | style |
| \`ts-no-non-null-assertion\` | No Non-Null Assertion | warning | style |
| \`ts-no-type-assertion\` | No Unsafe Type Assertion | warning | style |
| \`ts-no-console-log\` | No console.log | warning | style |
| \`ts-no-debugger\` | No Debugger Statement | error | style |
| \`ts-empty-catch\` | No Empty Catch Block | error | style |
| \`ts-no-eval\` | No eval() | error | security |
| \`ts-no-var\` | No var Declaration | warning | style |
| \`ts-no-nested-ternary\` | No Nested Ternary | warning | style |
| \`ts-no-alert\` | No alert() | warning | style |

### JavaScript Queries

JavaScript inherits TypeScript queries except TypeScript-specific ones (\`ts-no-any\`, \`ts-no-non-null-assertion\`, \`ts-no-type-assertion\`).

| ID | Name | Severity | Category |
|----|------|----------|----------|
| \`js-no-console-log\` | No console.log | warning | style |
| \`js-no-debugger\` | No Debugger Statement | error | style |
| \`js-empty-catch\` | No Empty Catch Block | error | style |
| \`js-no-eval\` | No eval() | error | security |
| \`js-no-var\` | No var Declaration | warning | style |
| \`js-no-nested-ternary\` | No Nested Ternary | warning | style |
| \`js-no-alert\` | No alert() | warning | style |

### Python Queries

| ID | Name | Severity | Category |
|----|------|----------|----------|
| \`py-bare-except\` | No Bare Except | error | style |
| \`py-no-print\` | No print() in Production | warning | style |
| \`py-no-pass-except\` | No pass in Except | error | style |
| \`py-no-eval\` | No eval() | error | security |
| \`py-no-exec\` | No exec() | error | security |
| \`py-no-star-import\` | No Wildcard Import | warning | style |
| \`py-mutable-default-arg\` | No Mutable Default Arguments | error | style |

### Java Queries

| ID | Name | Severity | Category |
|----|------|----------|----------|
| \`java-empty-catch\` | No Empty Catch Block | error | style |
| \`java-catch-throwable\` | No catch(Throwable) | error | style |
| \`java-system-out\` | No System.out.println | warning | style |
| \`java-field-injection\` | No Field Injection | error | architecture |
| \`java-thread-sleep\` | No Thread.sleep | warning | performance |

### Go Queries

| ID | Name | Severity | Category |
|----|------|----------|----------|
| \`go-unchecked-error\` | No Unchecked Errors | error | style |
| \`go-fmt-println\` | No fmt.Println | warning | style |
| \`go-panic\` | No panic() in Libraries | warning | style |

### Rust Queries

| ID | Name | Severity | Category |
|----|------|----------|----------|
| \`rust-unwrap\` | No unwrap() | warning | style |
| \`rust-expect-no-message\` | No Bare expect() | info | style |
| \`rust-println\` | No println! in Libraries | warning | style |
| \`rust-todo\` | No todo!() Remaining | error | style |

### Querying Specific IDs

\`\`\`typescript
import { getQueryById, getQueryIdsByCategory, listQueryIds } from "@rulebound/engine"

// Get all query IDs for a language
const tsIds = listQueryIds("typescript")

// Get queries by category
const securityIds = getQueryIdsByCategory("security")

// Get a specific query definition
const noEval = getQueryById("ts-no-eval")
\`\`\`

### Adding Language Support

Languages without built-in queries (C#, C++, Ruby, Bash) still support:
- AST parsing and custom tree-sitter queries
- Language detection from file extensions
- Custom queries defined in rule files via \`<!-- ast: -->\` comments
`,
}

export default doc
