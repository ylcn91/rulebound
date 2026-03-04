import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "ast/pattern-matching",
  title: "AST Pattern Matching",
  description: "Writing tree-sitter queries for Rulebound AST analysis — query syntax, captures, and filters.",
  content: `## AST Pattern Matching

Rulebound uses tree-sitter query syntax (S-expressions) to match patterns in parsed code. This guide covers query syntax, captures, and how to define custom queries.

### Query Syntax

Tree-sitter queries use S-expression patterns that match AST node types:

\`\`\`
(call_expression
  function: (identifier) @fn) @call
\`\`\`

This query matches any function call and captures the function name as \`@fn\` and the entire call as \`@call\`.

### Query Definition

Each query is defined as an \`ASTQueryDefinition\`:

\`\`\`typescript
interface ASTQueryDefinition {
  id: string              // Unique identifier (e.g., "ts-no-eval")
  name: string            // Human-readable name
  description: string     // What this query detects
  language: string        // Target language or "*" for all
  severity: "error" | "warning" | "info"
  category: string        // e.g., "security", "style"
  query: string           // Tree-sitter S-expression
  message: string         // Violation message
  suggestedFix?: string   // How to fix the violation
  captureFilters?: Record<string, string | string[]>
}
\`\`\`

### Capture Filters

Capture filters let you narrow matches by the text of captured nodes. Without filters, the query matches all nodes of the specified type.

**Match only \`console.log\` (not \`console.error\`):**

\`\`\`typescript
{
  query: \`
    (call_expression
      function: (member_expression
        object: (identifier) @obj
        property: (property_identifier) @prop)
    ) @call
  \`,
  captureFilters: {
    obj: "console",
    prop: "log"
  }
}
\`\`\`

**Match multiple values:**

\`\`\`typescript
{
  query: \`
    (call_expression
      function: (selector_expression
        operand: (identifier) @pkg
        field: (field_identifier) @fn)) @call
  \`,
  captureFilters: {
    pkg: "fmt",
    fn: ["Println", "Printf", "Print"]  // Match any of these
  }
}
\`\`\`

### Custom Queries in Rules

You can embed tree-sitter queries directly in rule markdown files using HTML comments:

\`\`\`markdown
---
title: No Direct DOM Manipulation
category: style
severity: warning
tags: [react, dom]
---

React components should not use direct DOM manipulation.

<!-- ast:
builtins: ["ts-no-eval"]
queries: ["(call_expression function: (member_expression object: (identifier) @obj property: (property_identifier) @prop) @expr)"]
-->
\`\`\`

- **builtins** — Reference built-in query IDs to include
- **queries** — Define custom tree-sitter S-expressions

### Match Results

Each match produces an \`ASTMatch\`:

\`\`\`typescript
interface ASTMatch {
  queryId: string           // Which query matched
  queryName: string         // Human-readable query name
  message: string           // Violation message
  severity: "error" | "warning" | "info"
  suggestedFix?: string
  location: {
    startRow: number        // 0-based line
    startColumn: number     // 0-based column
    endRow: number
    endColumn: number
  }
  matchedText: string       // The matched source text (max 200 chars)
  capturedNodes: Array<{
    name: string            // Capture name (@fn, @obj, etc.)
    type: string            // AST node type
    text: string            // Node text
    startRow: number
    startColumn: number
  }>
}
\`\`\`

### ASTMatcher Class

For advanced usage, the \`ASTMatcher\` class implements the \`Matcher\` interface and can be used in the validation pipeline:

\`\`\`typescript
import { ASTMatcher } from "@rulebound/engine"

const matcher = new ASTMatcher({
  language: "typescript",
  queryIds: ["ts-no-eval", "ts-no-any"],
})

const results = await matcher.match({
  plan: codeToCheck,
  rules: projectRules,
})
\`\`\`

The \`ASTMatcher\` automatically:
- Extracts code blocks from the input
- Detects languages from code fence annotations
- Matches built-in or custom queries per rule
- Falls back to language detection from code content if no fence annotation

### Tips

- The primary capture (first \`@capture\`) determines the reported location
- Matched text is truncated to 200 characters
- Queries that fail to parse for a given language are silently skipped
- Use \`language: "*"\` to make a query run against all languages
`,
}

export default doc
