import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "mcp/overview",
  title: "MCP Server Overview",
  description: "Rulebound MCP Server — Model Context Protocol server for pre-write rule enforcement in AI coding agents.",
  content: `## MCP Server Overview

The Rulebound MCP (Model Context Protocol) server exposes rule enforcement as tools that AI coding agents can call directly. This enables **pre-write enforcement** — validating code against project rules before it is written to disk.

### What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard for connecting AI agents to external tools and data sources. Rulebound's MCP server provides five tools that AI agents call during their workflow.

### Architecture

\`\`\`
AI Coding Agent (Claude, Copilot, etc.)
    |
    |  MCP Protocol (stdio)
    |
Rulebound MCP Server
    |
    +-- Rule Loader
    |       Reads .rulebound/rules/*.md
    |
    +-- Validator
    |       Semantic pattern matching
    |
    +-- AST Analyzer
            tree-sitter structural analysis
\`\`\`

### Available Tools

| Tool | Purpose | When to Call |
|------|---------|-------------|
| \`find_rules\` | Find relevant rules for a task | Before starting implementation |
| \`validate_plan\` | Validate an implementation plan | Before writing any code |
| \`check_code\` | Check a code snippet | After writing code |
| \`list_rules\` | List all project rules | When exploring project standards |
| \`validate_before_write\` | Pre-write code validation | Before writing any code file |

### Quick Start

\`\`\`bash
# Install
pnpm add @rulebound/mcp

# Run the MCP server
npx rulebound-mcp
\`\`\`

### Agent Configuration

#### Claude Desktop

Add to \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["rulebound-mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
\`\`\`

#### Claude Code

Add to \`.claude/settings.json\`:

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

### Auto-Detection

The MCP server automatically:

- **Detects project stack** from project files (\`package.json\` -> TypeScript, \`pom.xml\` -> Java, etc.)
- **Finds rules directory** by scanning \`.rulebound/rules/\`, \`rules/\`, and \`examples/rules/\`
- **Filters rules by stack** so agents only see relevant rules

### Next Steps

- [Tools Reference](/docs/mcp/pre-write-tool) — Detailed tool documentation
- [Configuration](/docs/mcp/configuration) — Agent integration patterns
`,
}

export default doc
