import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "lsp/editor-setup",
  title: "Editor Setup",
  description: "How to configure the Rulebound LSP server in VS Code, Neovim, and other editors.",
  content: `## Editor Setup

The Rulebound LSP server works with any editor that supports the Language Server Protocol. This guide covers setup for popular editors.

### Prerequisites

Install the LSP server package in your project:

\`\`\`bash
pnpm add -D @rulebound/lsp
\`\`\`

### VS Code

Create or update \`.vscode/settings.json\` in your workspace:

\`\`\`json
{
  "rulebound.enable": true,
  "rulebound.lspPath": "./node_modules/.bin/rulebound-lsp"
}
\`\`\`

Alternatively, launch the server manually via a VS Code task or extension.

### Neovim (nvim-lspconfig)

\`\`\`lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.rulebound then
  configs.rulebound = {
    default_config = {
      cmd = { 'npx', 'rulebound-lsp', '--stdio' },
      filetypes = {
        'typescript', 'typescriptreact',
        'javascript', 'javascriptreact',
        'python', 'java', 'go', 'rust',
      },
      root_dir = lspconfig.util.root_pattern(
        '.rulebound', 'package.json', '.git'
      ),
      settings = {},
    },
  }
end

lspconfig.rulebound.setup({
  on_attach = function(client, bufnr)
    -- Optional: custom keybindings or behavior
  end,
})
\`\`\`

### Helix

Add to \`~/.config/helix/languages.toml\`:

\`\`\`toml
[language-server.rulebound]
command = "npx"
args = ["rulebound-lsp", "--stdio"]

[[language]]
name = "typescript"
language-servers = ["typescript-language-server", "rulebound"]

[[language]]
name = "python"
language-servers = ["pylsp", "rulebound"]
\`\`\`

### Sublime Text (LSP Package)

Install the [LSP](https://packagecontrol.io/packages/LSP) package, then add to LSP settings:

\`\`\`json
{
  "clients": {
    "rulebound": {
      "enabled": true,
      "command": ["npx", "rulebound-lsp", "--stdio"],
      "selector": "source.ts | source.js | source.python | source.java | source.go | source.rust"
    }
  }
}
\`\`\`

### Emacs (lsp-mode)

\`\`\`elisp
(with-eval-after-load 'lsp-mode
  (add-to-list 'lsp-language-id-configuration
    '(typescript-mode . "typescript"))

  (lsp-register-client
    (make-lsp-client
      :new-connection (lsp-stdio-connection
        '("npx" "rulebound-lsp" "--stdio"))
      :activation-fn (lsp-activate-on "typescript" "javascript" "python" "java" "go" "rust")
      :server-id 'rulebound)))
\`\`\`

### Verifying the Setup

After configuring your editor:

1. Open a supported file (e.g., \`.ts\`, \`.py\`, \`.java\`)
2. Write code that triggers a built-in rule (e.g., use \`eval()\` in TypeScript)
3. You should see a diagnostic underline with the message

\`\`\`typescript
// This should trigger a diagnostic:
eval("alert('test')")
\`\`\`

### Connection Mode

The LSP server uses **stdio** transport. The editor launches the server process and communicates over stdin/stdout. No TCP ports are used.

\`\`\`bash
# The server expects to be launched with --stdio
npx rulebound-lsp --stdio
\`\`\`

> The LSP server loads workspace rules from the project root on initialization. If you add or modify rules, restart the LSP server to pick up changes.
`,
}

export default doc
