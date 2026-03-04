import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "gateway/request-scanning",
  title: "Request Scanning & Rule Injection",
  description: "How the Rulebound Gateway injects project rules into LLM prompts before they reach the provider.",
  content: `## Request Scanning & Rule Injection

The gateway intercepts chat/message API calls and injects your project rules into the system prompt before forwarding to the LLM provider. This ensures AI agents are always aware of your coding standards.

### How Rule Injection Works

When a request hits a chat endpoint (\`/chat/completions\` for OpenAI or \`/messages\` for Anthropic), the gateway:

1. Fetches rules from the Rulebound Server (or cache)
2. Formats rules into a structured text block
3. Injects the block into the system prompt

### Rule Text Format

Rules are formatted with severity tags and wrapped in XML-style markers:

\`\`\`
<rulebound_rules>
The following project rules MUST be followed when writing code:

[MUST] Use Constructor Injection
  Spring services must use constructor injection with final fields.
  Never use @Autowired on fields directly.

[SHOULD] No console.log in Production
  Use a structured logger instead of console.log.

[MAY] Prefer Readonly Types
  Use readonly modifiers for immutable data structures.

</rulebound_rules>
\`\`\`

Severity mapping:

| Rule Severity | Tag | Meaning |
|--------------|-----|---------|
| \`error\` | \`[MUST]\` | Must be followed |
| \`warning\` | \`[SHOULD]\` | Should be followed |
| \`info\` | \`[MAY]\` | May be followed |

### OpenAI Injection

For OpenAI-compatible APIs, rules are injected into the \`system\` message:

- If a system message exists, rules are **appended** to it
- If no system message exists, a new system message is **prepended** to the messages array

\`\`\`typescript
// Before injection
{
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Write a login function" }
  ]
}

// After injection
{
  messages: [
    { role: "system", content: "You are a helpful assistant.\\n\\n<rulebound_rules>..." },
    { role: "user", content: "Write a login function" }
  ]
}
\`\`\`

### Anthropic Injection

For Anthropic's Messages API, rules are injected into the \`system\` parameter:

- If \`system\` is a string, rules are **appended**
- If \`system\` is an array of content blocks, a new text block is **added**
- If \`system\` is absent, it is **set** to the rule text

### Rule Caching

Rules are cached in memory with a 60-second TTL to minimize server calls:

\`\`\`
First request   -->  Fetch rules from server  -->  Cache for 60s
Next request    -->  Return cached rules (no HTTP call)
After 60s       -->  Re-fetch and refresh cache
\`\`\`

You can force a cache refresh by calling \`invalidateCache()\` programmatically.

### Rule Filtering

When fetching from the server, rules can be filtered by:

- **Stack** — Only fetch rules relevant to your tech stack (e.g., \`typescript\`, \`java\`)
- **Project** — Fetch rules specific to a project

Configure these via environment variables:

\`\`\`bash
RULEBOUND_STACK=typescript,react
RULEBOUND_PROJECT=my-app
\`\`\`

### Disabling Rule Injection

\`\`\`bash
RULEBOUND_INJECT_RULES=false
\`\`\`

> When rule injection is disabled, the gateway still forwards requests but without modifying them.
`,
}

export default doc
