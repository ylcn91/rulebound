# Editor setup (experimental)

`@rulebound/lsp` is an LSP server that streams Rulebound diagnostics into
your editor. It speaks LSP over stdio. Status per
[`lsp-readiness.md`](./lsp-readiness.md): experimental — bundled with the
core release, scope-frozen, not a production gate.

All snippets below assume the package is installed globally (`npm i -g
@rulebound/lsp`) so that `rulebound-lsp` is on your `PATH`. If you prefer
a workspace-local install, replace `rulebound-lsp` with
`./node_modules/.bin/rulebound-lsp` or the absolute path to
`packages/lsp/dist/index.js`.

> Smoke-validation: `node packages/lsp/dist/index.js --stdio` boots the
> server and waits for an LSP `initialize` frame on stdin. The same boot
> path is asserted by `packages/lsp/__tests__/stdio-smoke.test.ts`.

## VS Code

VS Code does not register arbitrary LSP servers out of the box; you
either use a thin extension (recommended) or invoke the binary from a
generic LSP host. For ad-hoc testing without an extension, add the
following to your user `settings.json` and pair it with the
[Generic LSP Client](https://marketplace.visualstudio.com/items?itemName=llllvvuu.vscode-glspc)
extension:

```json
{
  "glspc.serverCommand": "rulebound-lsp",
  "glspc.serverCommandArguments": ["--stdio"],
  "glspc.languageId": "typescript",
  "rulebound.path": "rulebound-lsp"
}
```

The `rulebound.path` key is read by the future first-party VS Code
extension; the generic-client keys are what the LSP host needs today.
Reload the VS Code window after saving.

## Helix

Helix reads LSP definitions from `~/.config/helix/languages.toml`. Add:

```toml
[language-server.rulebound]
command = "rulebound-lsp"
args = ["--stdio"]

[[language]]
name = "typescript"
language-servers = ["typescript-language-server", "rulebound"]

[[language]]
name = "javascript"
language-servers = ["typescript-language-server", "rulebound"]

[[language]]
name = "python"
language-servers = ["pylsp", "rulebound"]

[[language]]
name = "java"
language-servers = ["jdtls", "rulebound"]
```

Restart Helix; `:lsp-restart` reloads without exiting the editor.
Diagnostics surface in the gutter and via `<space>d`.

## Neovim (built-in LSP)

Neovim 0.11+ ships a `vim.lsp.start` API. Drop this snippet into your
`init.lua` (or a plugin file):

```lua
local function start_rulebound_lsp(bufnr)
  vim.lsp.start({
    name = "rulebound",
    cmd = { "rulebound-lsp", "--stdio" },
    root_dir = vim.fs.dirname(
      vim.fs.find({ ".rulebound", ".git" }, { upward = true })[1]
    ),
    on_attach = function(_, _)
      vim.bo[bufnr].omnifunc = "v:lua.vim.lsp.omnifunc"
    end,
  })
end

vim.api.nvim_create_autocmd("FileType", {
  pattern = { "typescript", "javascript", "python", "java" },
  callback = function(args)
    start_rulebound_lsp(args.buf)
  end,
})
```

`:LspInfo` (built-in) shows the active client; `:lua
vim.diagnostic.open_float()` renders the current line's diagnostics.

## Validation

After wiring the editor:

1. Open a file in a Rulebound-aware language (`.ts`, `.tsx`, `.js`,
   `.py`, `.java`).
2. Place the file inside a repo whose root contains a `.rulebound/`
   directory; the server reads `loadLocalRules` from there.
3. Edit until a rule should fire (e.g. add `: any` in TypeScript for the
   bundled `ts-no-any` query).
4. Wait ~300 ms for the debounce, then confirm the diagnostic appears.

If the diagnostic does not appear, the server's stderr is the first
debugging step. Most hosts surface LSP server stderr through a
client-side log command (VS Code: "Output > Language Server"; Helix:
`~/.cache/helix/helix.log`; Neovim: `:LspLog`).

## Known limits

- The server reuses the engine's WASM grammars; first analysis after a
  cold start can take 1-2 seconds.
- Workspace rules are loaded once at `initialize` time; editing a rule
  file requires restarting the LSP client.
- No code actions or quick-fixes yet; only `textDocument/publishDiagnostics`.
