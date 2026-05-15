# Rulebound

[![MIT License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

**Deterministic guardrails for AI coding agents.**

Do not trust the agent. Verify the plan, diff, evidence, and code with deterministic checks.

Rulebound is policy-as-code for nondeterministic AI coding agents. It runs the deterministic part of code review — AST checks, regex, diff evidence, import boundaries, and existing analyzers (PMD, Checkstyle, SpotBugs, ArchUnit, ESLint, Semgrep, gitleaks, etc.) — through one CLI / MCP / CI surface, so agents have to prove they followed the rules.

Works with **Claude Code**, **Cursor**, **Amp**, and any MCP-compatible coding agent.

---

## What Rulebound is

- A deterministic guardrail layer for agent-generated plans, diffs, and code.
- A bridge between human-readable rules (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, engineering docs) and machine-checkable enforcement.
- An orchestrator for existing deterministic analyzers — it normalizes their output, it does not replace them.
- A CLI + MCP + CI workflow that makes agents prove they followed the right rules.

## What Rulebound is not

- **Not a SonarQube replacement.** SonarQube does general static code quality. Rulebound does agent workflow + repo-specific policy evidence. Run both side by side. See [docs/rulebound-vs-sonarqube.md](docs/rulebound-vs-sonarqube.md).
- **Not a generic code-smell platform.** Built-in checks are intentionally narrow; bring your own analyzer for breadth.
- **Not an LLM-as-judge product.** LLM/keyword/semantic findings are advisory by default and never the final blocker.
- **Not a hosted SaaS dashboard.** The stable core is CLI + engine + MCP + CI deterministic gate. The server, dashboard, gateway, LSP and SDKs are secondary preview / experimental surfaces — see [Maturity tiers](#maturity-tiers).

---

## Quick start (under 10 minutes)

```bash
# 1. Install
npm install -g @rulebound/cli

# 2. Initialize the low-noise starter pack (pure deterministic, no analyzers)
rulebound init --pack starter --no-hook

# 3. Check environment, toolchains, analyzers
rulebound doctor

# 4. Run deterministic checks
rulebound check

# 5. Run as part of CI (GitHub annotations)
rulebound check --format github --base main
```

Once `starter` is green, layer on more curated packs as needed:

```bash
# Stack-specific deterministic packs:
rulebound init --pack typescript --pack security --pack agent-workflow

# Opt-in analyzer packs (require external tools and --allow-commands):
rulebound init --pack analyzer-typescript   # eslint + tsc
rulebound init --pack analyzer-java         # pmd + checkstyle + spotbugs + junit
rulebound init --pack analyzer-security     # semgrep + gitleaks
```

`rulebound init --examples` remains as a showcase mode for demos. It seeds a
broader rule set that may emit analyzer warnings until you install the
matching toolchain — prefer `--pack starter` for first-run repos.

Full walkthrough: [docs/quickstart.md](docs/quickstart.md).

For agent integration via MCP: [docs/mcp-setup.md](docs/mcp-setup.md).

For CI integration (GitHub Action inputs, SARIF, double-run trust boundary): [docs/ci-github-action.md](docs/ci-github-action.md).

---

## Deterministic vs Advisory

Rulebound separates findings by provenance. Only deterministic results can block by default.

| Source           | Deterministic | Blocks by default | Notes                                                           |
|------------------|---------------|-------------------|-----------------------------------------------------------------|
| `ast`            | Yes           | Yes (severity)    | Tree-sitter queries on source files                             |
| `regex`          | Yes           | Yes (severity)    | File-scoped pattern checks, including secret patterns           |
| `file-exists`    | Yes           | Yes (severity)    | Required-file presence                                          |
| `file-not-exists`| Yes           | Yes (severity)    | Forbidden-file presence                                         |
| `diff-evidence`  | Yes           | Yes (severity)    | "When X changes, Y must change" on the current diff             |
| `forbidden-import` | Yes         | Yes (severity)    | Import-boundary checks (e.g. domain cannot import infra)         |
| `command`        | Yes           | Yes (exit code)   | Runs only with `--allow-commands`                               |
| `analyzer`       | Yes           | Yes (report)      | PMD / Checkstyle / SpotBugs / JUnit XML / SARIF                 |
| `agent-process`  | Yes           | If `severity: error` | Signals from the agent (find_rules called, bugfix spec, etc.) |
| `keyword`        | No            | No                | Legacy advisory matcher                                         |
| `semantic`       | No            | No                | Legacy advisory matcher                                         |
| `llm`            | No            | No                | Optional explanation/repair assistant only                      |

Strict mode blocks **deterministic** failures only. LLM/keyword/semantic findings always warn — they are visible but never the final judge.

---

## Rule format

Rules are Markdown with YAML front matter. The Markdown body stays human-readable and is what agents see. The `checks:` block is the machine-enforceable layer.

```markdown
---
title: DB schema changes require migration
category: architecture
severity: error
modality: must
tags: [db, migration]
checks:
  - type: diff-evidence
    id: schema-needs-migration
    when_changed:
      - "packages/server/src/db/schema.ts"
    require_changed:
      - "packages/server/migrations/**/*.sql"
    message: "Schema change without a corresponding migration."

  - type: regex
    id: no-hardcoded-secret-keys
    pattern: "sk_(?:live|test)_[A-Za-z0-9]{16,}"
    files: ["**/*.ts", "**/*.tsx", "**/*.js"]
    forbidden: true
    severity: error
    message: "Hardcoded API key. Move to environment variable."

  - type: analyzer
    id: pmd-java
    analyzer: pmd
    report: "target/pmd.xml"
    report_format: pmd-xml
    severity: error
---

# DB schema changes require migration

Any change to `schema.ts` must be accompanied by at least one SQL migration
under `packages/server/migrations/`. Schema drift between code and the DB is
not acceptable.
```

Checks can also live in fenced ```rulebound``` blocks inside the Markdown body — same schema. Full reference: [docs/deterministic-rule-schema.md](docs/deterministic-rule-schema.md).

---

## Core commands

| Command                       | Purpose                                                                |
|-------------------------------|------------------------------------------------------------------------|
| `rulebound init`              | Create `.rulebound/rules/` and (optionally) seed example rules         |
| `rulebound init --pack <name>`| Install one or more curated rule packs (repeatable)                    |
| `rulebound packs list`        | List available rule packs and their contents                          |
| `rulebound check`             | Run deterministic checks (canonical command)                           |
| `rulebound evidence`          | Deterministic evidence report (defaults to `pr-markdown`)              |
| `rulebound advise`            | Advisory plan/diff review — NOT the deterministic gate                 |
| `rulebound heal`              | Self-healing loop: run checks, optionally run repair command, re-run   |
| `rulebound doctor`            | Detect rules, config, toolchains, analyzer expectations, command opts |
| `rulebound find-rules`        | Find rules relevant to a task (legacy advisory matcher)                |
| `rulebound validate`          | Advisory plan validation                                               |
| `rulebound diff`              | Advisory git diff validation                                           |
| `rulebound ci`                | Legacy advisory CI validation; prefer `check --format github`          |
| `rulebound review`            | Advisory multi-agent review; not the deterministic gate                |
| `rulebound bugfix`            | Define a bugfix boundary / postcondition / preservation spec           |

### `rulebound check` flags

```
-d, --dir <path>          Path to rules directory
-f, --format <fmt>        pretty | json | github | repair-json | sarif | pr-markdown
    --diff                Restrict diff-evidence checks to changed files
    --staged              Use staged changes for diff context
-b, --base <branch>       Base branch for diff context
    --ref <ref>           Git ref for diff context
    --rule <id>           Run only rules matching this ID or prefix
    --allow-commands      Permit command/analyzer checks that exec a shell
    --fail-on-advisory    Exit 3 when advisory findings present
    --waivers <path>      Path to waivers YAML (default .rulebound/waivers.yaml)
```

The `pr-markdown` format produces a sectioned PR-ready summary
(blockers / warnings / waivers / advisory / analyzer findings / repair).
The GitHub Action appends it to `$GITHUB_STEP_SUMMARY` by default.

### Exit codes

| Code | Meaning                                                     |
|------|-------------------------------------------------------------|
| 0    | Pass                                                        |
| 1    | Deterministic violation (blocking)                          |
| 2    | Config/runtime error (no rules, missing dir, bad schema)    |
| 3    | Advisory-only findings, when `--fail-on-advisory` is set    |

---

## PR review without becoming CodeRabbit

Rulebound can produce PR annotations and review-style summaries, but its core
authority is deterministic evidence — not broad LLM commentary.

Use the surfaces this way:

- `rulebound check --format github --base main` is the **authoritative PR gate**.
  It should fail only on deterministic blockers such as missing migrations,
  missing tests, forbidden imports, analyzer findings, or explicit command
  failures.
- `rulebound check --format sarif` is the code-scanning/reporting surface for
  deterministic findings.
- `rulebound check --format repair-json` is the agent repair-loop payload.
- `rulebound review`, `rulebound validate`, and legacy keyword/semantic/LLM
  matchers are **advisory** by default. They may help humans and agents reason,
  but they are not the final judge unless a team explicitly opts into that.

This keeps Rulebound complementary to CodeRabbit-style reviewers: reviewers can
suggest improvements; Rulebound proves whether the agent supplied the required
policy evidence.

See [docs/rulebound-vs-coderabbit.md](docs/rulebound-vs-coderabbit.md) for the
category boundary.

---

## Scenario evidence (planned)

Agents increasingly act across APIs, MCP tools, CLIs, and third-party services.
Rulebound's role is to require deterministic evidence that a scenario was run
and passed; it is **not** to host every API twin or sandbox itself.

Future scenario checks should consume reports from external sandboxes, API
twins, Playwright/Cypress runs, or service-specific test harnesses and then
block only on deterministic facts: missing report, failed scenario, stale run,
or mismatched target. LLM commentary about a scenario remains advisory.

Design notes (not yet implemented): [docs/scenario-evidence.md](docs/scenario-evidence.md).

---

## Self-healing

`rulebound heal` runs the deterministic check loop, optionally executes a repair command between iterations, and re-runs. The final pass/fail is decided by deterministic checks re-running — never by an LLM explanation.

```bash
rulebound heal --max-iterations 3 --cmd "pnpm tsc -p . && pnpm lint --fix"
```

See [docs/self-healing.md](docs/self-healing.md) for the repair-JSON contract and how to wire it into an agent.

---

## Bugfix workflow

`rulebound bugfix start` creates a behavior-preserving spec that forces an agent to declare:

- bug condition `C`
- postcondition `P` (what must be true after the fix)
- preservation scenarios for `not C` (what must still work)
- explicit scope (files / functions touched)

`rulebound bugfix validate --spec ... --plan ...` checks a proposed plan against the spec. The `agent-process: bugfix_spec_present` and `regression_test_added` deterministic checks can require this for `fix/**` branches.

See [docs/bugfix-workflow.md](docs/bugfix-workflow.md).

---

## Analyzer orchestration

Rulebound does not reimplement PMD, Checkstyle, SpotBugs, ESLint, Semgrep, gitleaks, or your test runner. The `analyzer` check type runs them (or reads their existing report) and normalizes the result into the Rulebound report.

Supported report formats today: `pmd-xml`, `checkstyle-xml`, `spotbugs-xml`, `junit-xml`, `sarif`, `json`, `text`.

For analyzers without a supported parser, use `type: command` with `pass_exit_codes`. See [docs/analyzer-orchestration.md](docs/analyzer-orchestration.md).

---

## MCP

Rulebound ships an MCP server so agents can query rules and run deterministic checks during a task.

```json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["-y", "@rulebound/mcp"]
    }
  }
}
```

Per-agent setup snippets (Claude Code, Cursor, Amp, generic MCP): [docs/mcp-setup.md](docs/mcp-setup.md).

---

## Maturity tiers

> **Stable core for v0.1 = CLI + engine + MCP + CI deterministic gate.**
> The server, dashboard, gateway, LSP and native SDKs are preview / beta / experimental — they are secondary surfaces and are not production core. See [`docs/amp-91-new.md`](docs/amp-91-new.md) §3 for the maturity targets.

- **Stable** — Supported public surface; breaking changes only on major versions; production-ready.
- **Beta** — Usable in production with caveats; minor breaking changes possible between minors; release-noted.
- **Preview** — Wired up but evolving; expect breaking changes without deprecation; not production-ready.
- **Experimental** — Spike / proof-of-concept; may be removed; do not depend on shape or behavior.

| Surface | Package | Tier | Notes |
| --- | --- | --- | --- |
| Engine | `@rulebound/engine` | Stable | Stable core. Public API and `DeterministicReport` schema; see `docs/report-schema.md`. |
| CLI | `@rulebound/cli` | Stable | Stable core. `rulebound check` is the authoritative deterministic gate. |
| GitHub Action / CI templates | — | Stable | Stable core. PR gate blocks on deterministic failures; see `.github/workflows/examples/` and `docs/ci-github-action.md`. |
| MCP server | `@rulebound/mcp` | Beta | Core-adjacent. Deterministic MCP tools return the same report shape as the CLI; advisory tools are not the final gate. |
| Rule packs | `@rulebound/rules-*` | Beta | typescript, react, security, java-spring, go, infra, agent-workflow, monorepo, deterministic, starter. |
| Server | `@rulebound/server` | Preview | Self-hosted HTTP API. Requires explicit env + Postgres 17; no SaaS, no migrations yet. |
| Dashboard | `apps/web` | Preview | Self-hosted audit viewer; no SaaS, no SSO, no org/RBAC. |
| Gateway | `@rulebound/gateway` | Preview | Self-hosted LLM proxy; body logging off by default; privacy / streaming hardening still in flight. |
| LSP | `@rulebound/lsp` | Experimental | Editor diagnostics only; not part of any release gate. |
| SDKs | `sdks/*` | Preview | ts/py/go/rust/java/dotnet; TypeScript canonical, others mirror via separate parity matrix. |

---

## Development

Requirements: Node.js 22+, pnpm 10+. PostgreSQL 17 is only needed for the Preview-tier server/dashboard (see [Maturity tiers](#maturity-tiers)).

```bash
git clone https://github.com/ylcn91/rulebound.git
cd rulebound
pnpm install
pnpm build
pnpm test
```

CLI binary after build: `packages/cli/dist/index.js`.

## Contributing

Issues and PRs welcome. Keep changes small, deterministic, and tested. Do not add LLM calls into the deterministic test suite.

## License

MIT. See [LICENSE](LICENSE).
