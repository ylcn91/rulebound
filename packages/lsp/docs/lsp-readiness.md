# LSP Readiness

Status of `@rulebound/lsp` for production deployment. The LSP is an
**experimental** surface for editor diagnostics. The product wedge is CLI +
MCP + CI; the LSP does not block the v0.1 core release and is not part of any
release-gate checklist.

## Surface classification

- **Maturity**: experimental.
- **Release coupling**: published on the same semver track as the rest of the
  workspace (lead verdict B7). Treat regressions in `@rulebound/lsp` as
  non-blocking for the core release.
- **Authoritative gate**: `rulebound check`. Diagnostics from the LSP are
  advisory feedback while editing — they do not replace the CLI's pass/fail
  verdict.

## Hardened

- **Stdio transport only.** The server speaks LSP over stdin/stdout
  (`src/index.ts`). No TCP port is opened, no socket auth surface to manage.
- **Capabilities are narrow.** Pull-based diagnostics with no inter-file
  dependencies and no workspace-diagnostics (`src/capabilities.ts`). Editor
  clients only see the diagnostics they request for an open file.
- **Engine integration is read-only.** The LSP imports rule discovery and
  validation from `@rulebound/engine` and never mutates the workspace.

## Verified by tests

| Claim | Test file | Test name |
| --- | --- | --- |
| AST and rule diagnostics produce the documented shape | `__tests__/diagnostics.test.ts` | (all tests) |
| End-to-end document analysis exercises the engine | `__tests__/integration.test.ts` | (all tests) |

Note: the current tests mock the engine surface and do **not** boot the LSP
over stdio. A real stdio smoke test is tracked under AMP91-LSP-002 (Wave 4).

## Supported diagnostics (current)

- AST-based diagnostics from `@rulebound/engine` AST queries (TypeScript,
  JavaScript, Python, Java, Go, Rust, C#, C++, Ruby, Bash).
- Semantic rule diagnostics from `.rulebound/rules/*.md` (rule-level only;
  diagnostics are attached at file start, range `0:0` → `0:0`).

## Known limitations

- **No code actions, hovers, or completions.** Diagnostics only.
- **No multi-root workspace handling.** Rules are loaded from the first
  workspace folder advertised at `initialize`.
- **No rule hot-reload.** Editing a rule file requires the editor to restart
  the LSP server.
- **No deterministic-gate parity.** The CLI's `check` command runs the full
  deterministic pipeline (file-exists, regex, diff-evidence, forbidden-import,
  analyzer, command, agent-process); the LSP currently runs AST + rule-level
  semantic validation only. Editor diagnostics can pass while the CLI fails.
- **No editor-config bundling.** VS Code extension, Helix package, Neovim
  registration are not published; users wire the binary by hand per editor
  (see `apps/web/content/docs/lsp/editor-setup.ts`).

## Not part of v0.1 scope

These items are explicitly deferred and do not block any release:

- A first-party VS Code extension.
- Workspace-wide diagnostics (lint-on-save across the whole repo).
- Rule hot-reload (file watcher on `.rulebound/rules/**`).
- Quick-fix / code-action surface mirroring `rulebound heal` repair hints.
- Editor adoption telemetry / opt-in usage signal.

## Re-evaluating the maturity label

The LSP graduates from "experimental" to "preview" when:

1. A stdio smoke test boots the published `dist/index.js`, sends `initialize`,
   asserts `capabilities` in stdout (AMP91-LSP-002, Wave 4).
2. At least one editor (VS Code or Neovim) has documented, tested setup
   instructions with a screenshot/recording of the diagnostic flow.
3. The diagnostic surface is reviewed for parity with the CLI deterministic
   gate, with each gap explicitly documented.

Until those land, do not depend on the LSP in any release-gate or production
runbook.
