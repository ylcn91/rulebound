import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "mcp/pre-write-tool",
  title: "MCP Tools Reference",
  description: "Complete reference for all Rulebound MCP server tools — find_rules, validate_plan, check_code, list_rules, and validate_before_write.",
  content: `## MCP Tools Reference

The Rulebound MCP server provides five tools for rule enforcement. Each tool accepts structured parameters and returns JSON results.

### find_rules

Find relevant project rules for a given task. Should be called before starting any implementation.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`task\` | string | Yes | Description of the task |
| \`category\` | string | No | Filter by category: architecture, security, style, testing, infra, workflow |
| \`tags\` | string | No | Comma-separated tags to filter by |
| \`stack\` | string | No | Tech stack override (auto-detected if omitted) |

**Response:**

\`\`\`json
[
  {
    "id": "security.no-eval",
    "title": "No eval() Usage",
    "category": "security",
    "severity": "error",
    "modality": "must",
    "tags": ["security", "injection"]
  }
]
\`\`\`

**Relevance Scoring:**

Rules are ranked by relevance to the task using a scoring system:
- Tag match: +3 points
- Title keyword match: +2 points
- Category match: +2 points
- Phrase match in title: +5 points

If no rules score above 0, global rules (those with no stack filter) are returned.

---

### validate_plan

Validate an implementation plan against project rules. Must be called before writing any code.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`plan\` | string | Yes | The implementation plan text |
| \`task\` | string | No | Task context for better rule matching |

**Response:**

\`\`\`json
{
  "status": "PASSED_WITH_WARNINGS",
  "summary": "Plan addresses most rules",
  "violations": [
    {
      "rule": "Use Constructor Injection",
      "severity": "error",
      "reason": "Field injection detected",
      "fix": "Use constructor injection with final fields"
    }
  ]
}
\`\`\`

**Status values:** \`PASSED\`, \`PASSED_WITH_WARNINGS\`, \`FAILED\`

A plan is \`FAILED\` if any \`must\` modality rule is violated.

---

### check_code

Check a code snippet against project rules. Call after writing code to verify compliance.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`code\` | string | Yes | The code snippet to check |
| \`language\` | string | No | Programming language (auto-detected if omitted) |
| \`file_path\` | string | No | File path for context-based matching |

**Response:**

\`\`\`json
{
  "compliant": false,
  "violations": [
    {
      "rule": "No eval()",
      "severity": "error",
      "detail": "eval() is a security risk",
      "fix": "Use JSON.parse() or refactor logic"
    }
  ]
}
\`\`\`

---

### list_rules

List all available rules for the project's tech stack.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`category\` | string | No | Filter by category |

**Response:**

\`\`\`json
[
  {
    "id": "style.no-console-log",
    "title": "No console.log",
    "category": "style",
    "severity": "warning",
    "modality": "should"
  }
]
\`\`\`

---

### validate_before_write

The most important tool for pre-write enforcement. AI agents should call this before writing any code file.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`code\` | string | Yes | Code to validate before writing |
| \`file_path\` | string | Yes | Target file path |
| \`language\` | string | No | Language override (auto-detected from extension) |

**Response:**

\`\`\`json
{
  "approved": true,
  "file_path": "src/auth/login.ts",
  "language": "typescript",
  "violations": [],
  "message": "Code is clean -- safe to write"
}
\`\`\`

When violations are found:

\`\`\`json
{
  "approved": false,
  "file_path": "src/auth/login.ts",
  "language": "typescript",
  "violations": [
    {
      "rule": "ts-no-eval",
      "line": 5,
      "message": "eval() is a security risk and should never be used",
      "severity": "error",
      "source": "ast"
    },
    {
      "rule": "security.no-hardcoded-secrets",
      "message": "Inline secret value",
      "severity": "error",
      "fix": "Load from environment variables",
      "source": "semantic"
    }
  ],
  "message": "2 violation(s) found -- review before writing"
}
\`\`\`

Violations include a \`source\` field indicating whether they came from AST analysis or semantic validation.

### Language Auto-Detection

When no \`language\` parameter is provided, the server detects language from:

1. **File extension** (\`.ts\` -> TypeScript, \`.py\` -> Python, etc.)
2. **Code heuristics** (e.g., \`public class\` -> Java, \`func\` + \`package\` -> Go)
3. **Project stack** (fallback to primary stack technology)
`,
}

export default doc
