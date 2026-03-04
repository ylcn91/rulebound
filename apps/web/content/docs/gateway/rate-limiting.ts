import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "gateway/rate-limiting",
  title: "Streaming Support",
  description: "How the Rulebound Gateway handles SSE streaming responses with real-time code block scanning.",
  content: `## Streaming Support

The Rulebound Gateway fully supports Server-Sent Events (SSE) streaming responses. When an AI agent requests a streaming response (\`stream: true\`), the gateway processes the stream in real-time and scans accumulated code blocks at the end.

### How Streaming Works

1. **Detect Streaming** — The gateway checks if \`stream: true\` is set in the request body
2. **Forward Stream** — SSE chunks are forwarded to the client immediately (no buffering delay)
3. **Accumulate Content** — The \`StreamScanner\` extracts text content from each SSE chunk and accumulates it
4. **End-of-Stream Scan** — When the stream ends, accumulated code blocks are scanned for violations
5. **Append Warning** — If violations are found, a warning event is injected before the final \`[DONE]\` event

### StreamScanner

The \`StreamScanner\` class manages chunk accumulation and scanning:

\`\`\`typescript
import { StreamScanner } from "@rulebound/gateway"

const scanner = new StreamScanner({
  rules: projectRules,
  enforcement: "advisory",
  onViolation: (warning) => {
    // Optional callback when violations are detected
  },
})

// Append content from each SSE chunk
scanner.appendChunk(chunkContent)

// Check if we have complete code blocks to scan
if (scanner.hasCompleteCodeBlock()) {
  const { hasViolations, warning } = await scanner.scanAccumulated()
}

// Reset for next stream
scanner.reset()
\`\`\`

### SSE Content Extraction

The gateway extracts content from SSE data events. It handles both OpenAI and Anthropic streaming formats:

- **OpenAI**: \`choices[0].delta.content\`
- **Anthropic**: \`delta.text\`

\`\`\`
data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}

data: [DONE]
\`\`\`

### Code Block Detection

The scanner detects complete code blocks by counting triple backtick markers. A code block is considered complete when:

- There are at least 2 backtick markers
- The count is even (matching open/close pairs)

### Warning Injection

When violations are detected at the end of a stream, the gateway injects a warning as an additional SSE event before the \`[DONE]\` signal:

\`\`\`
data: {"choices":[{"delta":{"content":"\\n\\n---\\n**Rulebound: Rule violations detected...**"},"finish_reason":null}]}

data: [DONE]
\`\`\`

### Response Headers

Streaming responses use these headers:

\`\`\`
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
\`\`\`

### Enforcement in Streaming Mode

| Mode | Behavior |
|------|----------|
| \`advisory\` | Warning event appended at end of stream |
| \`moderate\` | Warning event appended at end of stream |
| \`strict\` | Warning event appended (stream cannot be blocked mid-flight) |

> In strict mode, streaming responses cannot be retroactively blocked since chunks have already been sent to the client. The violation warning is still appended at the end of the stream. For strict enforcement with streaming, consider disabling streaming at the agent level.
`,
}

export default doc
