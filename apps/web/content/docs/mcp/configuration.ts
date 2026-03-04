import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "mcp/configuration",
  title: "MCP Configuration",
  description: "Configuring the Rulebound MCP server for different AI agents and integration patterns.",
  content: `## MCP Configuration

The Rulebound MCP server uses stdio transport and auto-detects project configuration. This guide covers integration with various AI agents.

### Transport

The MCP server uses **stdio** transport (stdin/stdout). This is the standard transport for MCP servers and works with all MCP-compatible agents.

\`\`\`bash
# Start the server (stdio mode)
npx rulebound-mcp
\`\`\`

### Project Stack Detection

The server auto-detects your project's tech stack by scanning for well-known files:

| File | Detected Stack |
|------|---------------|
| \`package.json\` | typescript, javascript |
| \`pom.xml\` | java, spring-boot |
| \`build.gradle\` | java, spring-boot |
| \`build.gradle.kts\` | java, spring-boot, kotlin |
| \`go.mod\` | go |
| \`Cargo.toml\` | rust |
| \`requirements.txt\` | python |
| \`pyproject.toml\` | python |
| \`Pipfile\` | python |
| \`*.csproj\` | csharp, dotnet |
| \`Dockerfile\` | docker |
| \`docker-compose.yml\` | docker |

The detected stack is used to automatically filter rules, so agents only see rules relevant to their project.

### Rules Directory

The server searches for rules in these locations (first match wins):

1. \`.rulebound/rules/\`
2. \`rules/\`
3. \`examples/rules/\`

If no rules directory is found, tools return empty results or pass-through responses.

### Agent Integration Patterns

#### Claude Desktop

\`\`\`json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["rulebound-mcp"],
      "cwd": "/path/to/project"
    }
  }
}
\`\`\`

> The \`cwd\` field is critical — it determines where the server looks for rules and detects the project stack.

#### Claude Code

Add to your project's \`.claude/settings.json\`:

\`\`\`json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["rulebound-mcp"]
    }
  }
}
\`\`\`

#### Cursor

Add to \`.cursor/mcp.json\`:

\`\`\`json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["rulebound-mcp"]
    }
  }
}
\`\`\`

#### Custom Agent (Programmatic)

\`\`\`typescript
import { spawn } from "node:child_process"

const mcpServer = spawn("npx", ["rulebound-mcp"], {
  cwd: "/path/to/project",
  stdio: ["pipe", "pipe", "inherit"],
})

// Send MCP messages via stdin
mcpServer.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "find_rules",
    arguments: { task: "implement authentication" },
  },
  id: 1,
}))

// Read responses from stdout
mcpServer.stdout.on("data", (data) => {
  const response = JSON.parse(data.toString())
  // Process response
})
\`\`\`

### Recommended Workflow

For best results, configure your AI agent to follow this workflow:

1. **Start of task** — Call \`find_rules\` to discover relevant rules
2. **Planning** — Call \`validate_plan\` before writing any code
3. **Before each file write** — Call \`validate_before_write\` with the code
4. **After code changes** — Call \`check_code\` to verify compliance

> Many AI agents can be instructed to call these tools automatically via system prompts or CLAUDE.md instructions. Add a rule like "Always call validate_before_write before writing code files" to your project instructions.

### Filtering Rules

Tools support optional filtering parameters:

- **category** — \`architecture\`, \`security\`, \`style\`, \`testing\`, \`infra\`, \`workflow\`
- **tags** — Comma-separated tag list (e.g., \`auth,security\`)
- **stack** — Override auto-detected stack (e.g., \`java,spring-boot\`)
`,
}

export default doc
