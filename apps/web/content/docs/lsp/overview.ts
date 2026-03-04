import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "lsp/overview",
  title: "LSP Server Overview",
  description: "Rulebound LSP Server — real-time diagnostics for rule violations directly in your editor.",
  content: `## LSP Server Overview

The Rulebound LSP (Language Server Protocol) server provides real-time diagnostics in your code editor. As you type, the server analyzes your code against both built-in AST queries and your project's custom rules, surfacing violations as editor warnings and errors.

### How It Works

The LSP server runs as a standard language server using \`vscode-languageserver\`. It connects to your editor via the Language Server Protocol and provides:

1. **AST Diagnostics** — Structural code analysis using tree-sitter
2. **Rule Diagnostics** — Semantic validation against workspace rules
3. **Real-time Updates** — Diagnostics update as you type (300ms debounce)

### Architecture

\`\`\`
Editor (VS Code, Neovim, etc.)
    |
    |  Language Server Protocol (stdio)
    |
Rulebound LSP Server
    |
    +-- AST Analyzer (tree-sitter)
    |       Detects: eval(), empty catch, console.log, etc.
    |
    +-- Rule Validator (@rulebound/engine)
            Validates against .rulebound/rules/*.md
\`\`\`

### Features

- **Multi-language Support** — TypeScript, JavaScript, Python, Java, Go, Rust, and more
- **Automatic Language Detection** — Language is detected from file extensions
- **Workspace Rules** — Loads rules from \`.rulebound/rules/\` directory
- **Debounced Analysis** — 300ms debounce on content changes to avoid excessive processing
- **Immediate on Save** — Full analysis runs immediately when you save a file

### Quick Start

\`\`\`bash
# Install the LSP server
pnpm add @rulebound/lsp

# Run the server (typically done by your editor)
npx rulebound-lsp --stdio
\`\`\`

### VS Code Setup

Add to your VS Code \`settings.json\`:

\`\`\`json
{
  "rulebound.enable": true,
  "rulebound.lspPath": "node_modules/.bin/rulebound-lsp"
}
\`\`\`

### Neovim Setup (nvim-lspconfig)

\`\`\`lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

configs.rulebound = {
  default_config = {
    cmd = { 'npx', 'rulebound-lsp', '--stdio' },
    filetypes = { 'typescript', 'javascript', 'python', 'java', 'go', 'rust' },
    root_dir = lspconfig.util.root_pattern('.rulebound', 'package.json', '.git'),
  },
}

lspconfig.rulebound.setup({})
\`\`\`

### Server Capabilities

The LSP server advertises:

| Capability | Value |
|-----------|-------|
| Text Document Sync | Full (entire document on each change) |
| Diagnostic Provider | Pull-based, no inter-file dependencies |

### Rule Loading

On initialization, the server:

1. Scans workspace folders for a rules directory (\`.rulebound/rules/\`, \`rules/\`, or \`examples/rules/\`)
2. Loads all \`.md\` rule files with frontmatter metadata
3. Uses these rules for semantic validation alongside AST analysis

### Next Steps

- [Diagnostics](/docs/lsp/diagnostics) — Understanding diagnostic output
- [Editor Setup](/docs/lsp/editor-setup) — Detailed editor configuration
`,
}

export default doc
