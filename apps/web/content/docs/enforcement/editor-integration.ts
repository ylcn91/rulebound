import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "enforcement/editor-integration",
  title: "Editor Integration",
  description:
    "Integrate Rulebound with your editor using the LSP server, watch mode, and generated agent configs.",
  content: `## Editor Integration

Rulebound provides real-time enforcement in your editor through multiple integration methods: the LSP diagnostics server, watch mode, and generated agent config files.

### LSP Server

The Rulebound LSP server provides real-time diagnostics as you type. It analyzes files on save and reports violations as editor warnings and errors.

\`\`\`bash
# Start the LSP server
npx @rulebound/lsp --stdio
\`\`\`

Configure your editor to use the server:

**VS Code** (via custom LSP client or extension):

\`\`\`json
{
  "rulebound.lsp.enabled": true,
  "rulebound.lsp.path": "npx @rulebound/lsp --stdio"
}
\`\`\`

**Neovim** (via nvim-lspconfig):

\`\`\`lua
require('lspconfig').rulebound.setup({
  cmd = { 'npx', '@rulebound/lsp', '--stdio' },
  filetypes = { 'typescript', 'javascript', 'python', 'java', 'go' },
})
\`\`\`

The LSP server provides:
- Real-time diagnostics on file open and save
- Severity mapping (error, warning, info) to editor diagnostic levels
- Rule title and suggested fixes in diagnostic messages

See [LSP Server](/docs/lsp/overview) for full documentation.

### Watch Mode

For editors without LSP support, use the watch command:

\`\`\`bash
# Run in a terminal alongside your editor
rulebound watch src/ --format json
\`\`\`

The JSON output can be parsed by editor plugins or terminal integrations.

### Agent Config Files

Generate config files that your AI coding agents read automatically:

\`\`\`bash
rulebound generate --agent claude-code
rulebound generate --agent cursor
rulebound generate --agent copilot
\`\`\`

| Agent | Config File | How It Works |
|-------|-------------|-------------|
| Claude Code | \`CLAUDE.md\` | Read automatically when Claude starts |
| Cursor | \`.cursor/rules.md\` | Loaded as project-level rules |
| GitHub Copilot | \`.github/copilot-instructions.md\` | Loaded as custom instructions |

> Commit these files to your repo so all team members get consistent AI behavior.

### MCP Server

For Claude Code and other MCP-compatible agents, the Rulebound MCP server provides pre-write enforcement:

\`\`\`json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["@rulebound/mcp"]
    }
  }
}
\`\`\`

The MCP server provides a \`check_rules\` tool that agents call before writing code. See [MCP Server](/docs/mcp/overview) for details.

### Recommended Setup

For the best experience, combine multiple methods:

1. **LSP server** for real-time diagnostics in your editor
2. **Generated config files** for proactive AI compliance
3. **Pre-commit hook** as a final safety net before commit
4. **CI/CD** for team-wide enforcement
`,
}

export default doc
