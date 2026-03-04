import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "gateway/response-scanning",
  title: "Response Scanning",
  description: "How the Rulebound Gateway scans LLM responses for code violations using semantic validation and AST analysis.",
  content: `## Response Scanning

After the LLM responds, the gateway extracts code blocks from the response and scans them for rule violations. Scanning uses two complementary approaches: semantic validation and AST analysis.

### How It Works

1. **Extract Code Blocks** — Fenced code blocks (\\\`\\\`\\\`) are extracted from the response text
2. **Semantic Validation** — Code is validated against project rules using the Rulebound engine
3. **AST Analysis** — Code blocks with language annotations are parsed and analyzed structurally
4. **Build Report** — Violations from both approaches are combined into a \`ScanResult\`
5. **Enforce** — Based on the enforcement mode, violations are warned or blocked

### Code Block Extraction

The gateway extracts all fenced code blocks from the LLM response:

\`\`\`
\\\`\\\`\\\`typescript
// This code block will be extracted and scanned
function login(user: any) {
  eval(user.input)
}
\\\`\\\`\\\`
\`\`\`

The language annotation (e.g., \`typescript\`) is used to select the appropriate AST parser.

### Scan Result

\`\`\`typescript
interface ScanResult {
  hasViolations: boolean
  violations: Array<{
    ruleTitle: string
    severity: string
    reason: string
    suggestedFix?: string
    codeSnippet: string
  }>
}
\`\`\`

### Enforcement Behavior

| Mode | On Violation |
|------|-------------|
| **advisory** | Warning appended to the response body |
| **moderate** | Warning appended to the response body |
| **strict** | Response blocked with HTTP 422 |

#### Advisory/Moderate Warning

In advisory or moderate mode, a warning block is appended to the response:

\`\`\`
---
**Rulebound: Rule violations detected in the code above:**

[ERROR] **No eval()**: eval() is a security risk and should never be used
  Fix: Use JSON.parse(), new Function(), or refactor logic
[WARNING] **No 'any' Type**: Use 'unknown' with type guards instead of 'any'

Please review and fix these violations before using this code.
---
\`\`\`

For OpenAI responses, the warning is appended to \`choices[0].message.content\`. For Anthropic responses, a new text content block is added.

#### Strict Mode Blocking

In strict mode, the gateway returns a 422 response:

\`\`\`json
{
  "error": {
    "message": "Rulebound: Code violations detected. Request blocked.",
    "type": "rulebound_violation",
    "violations": [
      {
        "ruleTitle": "No eval()",
        "severity": "error",
        "reason": "eval() is a security risk and should never be used"
      }
    ]
  }
}
\`\`\`

### Disabling Response Scanning

\`\`\`bash
RULEBOUND_SCAN_RESPONSES=false
\`\`\`

> When disabled, responses pass through without any scanning or modification.

### Programmatic Usage

\`\`\`typescript
import { scanResponse, extractCodeBlocks, buildViolationWarning } from "@rulebound/gateway"

const result = await scanResponse(responseText, rules)

if (result.hasViolations) {
  const warning = buildViolationWarning(result.violations)
  // Append warning to response or handle as needed
}
\`\`\`
`,
}

export default doc
