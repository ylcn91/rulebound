# Threat Model — CLI (`@rulebound/cli`)

## Surface description

`rulebound check` is the canonical deterministic gate. The CLI is invoked
by:

- Local developers from a shell.
- CI runners (GitHub Actions, others) — same process, different
  environment.
- AI coding agents through `child_process` (via the MCP server, which
  invokes the same engine in-process, or directly).

The CLI loads `.rulebound/rules/**/*.md`, optionally loads waivers from
`.rulebound/waivers.yaml`, and executes deterministic checks defined in
each rule (`file-exists`, `regex`, `forbidden-import`, `diff-evidence`,
`ast`, `command`, `analyzer`, `agent-process`). Findings are printed in
`pretty`, `json`, `github`, `sarif`, `pr-markdown`, or `repair-json`
format. Exit codes encode pass/fail (cf. AMP91-CLI-002).

## Trust boundary

**Inside:** the repository working tree, the rules directory, the
waivers file, the `.git` directory, the user's `$PATH`, the user's
analyzer binaries (PMD, ESLint, etc.), and anything Node can `require`.

**Outside:** the CLI does not call any network endpoint by default.
`registry install` (`@rulebound/cli` registry subcommand) hits npm
through the user's npm client; that path inherits npm's trust model and
is out of scope here. There is **no** outbound call to a Rulebound
server from `rulebound check`.

The repository working tree itself is **already trusted** — a user
running `rulebound check` is already running other tooling (build,
test, lint) against the same files. The CLI does not raise the trust
level of the working tree; it only inherits it.

## Assets behind the boundary

| Asset | Where | Why it matters |
| --- | --- | --- |
| Source code | repository working tree | Confidentiality — `evidence.snippet` may include lines from any file matched by a check. |
| Analyzer reports | wherever `analyzer.report` points | May contain file paths, secrets in stack traces, line numbers. |
| Working tree secrets | `.env`, `*.pem`, `node_modules/.bin`, etc. | Could appear in analyzer reports or be matched by regex checks. |
| `$PATH` and shell binaries | user's profile | Command/analyzer checks shell out to `/bin/sh -c` (`packages/engine/src/checks/runners/command.ts:77`). |
| Git history | `.git` | `diff-evidence` checks read `git diff` output (`packages/cli/src/lib/git-diff.ts:36-49`). |

## Threats

| ID | STRIDE | Description | Mitigation | Residual | Linked task |
| --- | --- | --- | --- | --- | --- |
| CLI-T1 | Tampering / Elevation | A rule's `command` or `analyzer` check is a shell string executed via `spawnSync("/bin/sh", ["-c", check.run], …)` at `packages/engine/src/checks/runners/command.ts:77`. A malicious or compromised rule (e.g. a rule pack from npm) could run arbitrary code with the developer's privileges. | Command/analyzer checks are gated behind `--allow-commands` (`packages/engine/src/checks/runners/command.ts:59-70`) — when the flag is absent, the check returns `NOT_APPLICABLE`. The CLI does **not** auto-enable the flag. Rule packs installed from the registry are reviewed manually; there is no registry-side signing yet. | Opt-in is per-invocation, not per-rule; once `--allow-commands` is set, every command/analyzer check in the run is enabled. **High** if `--allow-commands` is wired into CI without a curated rule set. | AMP91-ENG-003 (command/analyzer execution safety). |
| CLI-T2 | Information disclosure | Machine-readable output formats (`--format json`, `repair-json`, `sarif`) include `evidence.snippet` strings copied from analyzer reports or matched source lines. Snippets can contain credentials accidentally present in code (Authorization headers, AWS keys, GitHub PATs) and would be echoed to stdout, CI logs, and agent transcripts. | `packages/cli/src/lib/redact-snippet.ts` redacts well-known secret shapes (Bearer/Basic/Token, `password=`/`api_key=`/etc., AWS `AKIA/ASIA`, GitHub `ghp_/gho_/…` PATs) at the four output sites: pretty (`check.ts:148-149`), JSON (`check.ts:178-180`), SARIF (`check.ts:271-276`), repair-json (`check.ts:504-510`). Test coverage at `packages/cli/src/__tests__/redaction.test.ts`. | Best-effort regex set; not a substitute for `gitleaks` over the source tree (AMP91-SEC-001). Out-of-pattern secrets (custom tokens, non-prefixed keys, encrypted material in plaintext) leak through. **Medium.** | AMP91-SEC-004 (delivered in Wave 1); AMP91-SEC-001 (Wave 2). |
| CLI-T3 | Information disclosure | Analyzer subprocess stdout/stderr is captured into `result.stdout`/`result.stderr` and stored in `evidence.stdout`/`evidence.stderr` (`packages/engine/src/checks/runners/command.ts:114-120`) after a `truncate()` to 32 KB. The stdout itself is not redacted by `redactSnippet`; the redaction only covers `evidence.snippet`. | The CLI does not echo analyzer stdout to its own stdout; reports are read from disk for the analyzer pattern (`runAnalyzerCheck`, `analyzer.ts:287-303`). When `analyzer.run` is set with `--allow-commands`, stdout is captured but only surfaced on a `VIOLATED` outcome. | Out-of-band stdout from a custom command check still appears in `evidence.stdout` and machine output. **Low** because requires `--allow-commands` plus an attacker-controlled command string. | AMP91-SEC-004 follow-up (extend redaction to `evidence.stdout`/`stderr`). |
| CLI-T4 | Tampering | Waivers (`.rulebound/waivers.yaml`) silence findings by `rule` + `check` + `scope`. A waiver with no expiration or an indefinite expiration can permanently mask a violation. | `Waiver.expires` is required (`packages/engine/src/checks/waivers.ts:6-13`); expired waivers do not match. Waivers must list `rule`, `owner`, and `reason`. The CLI prints waiver matches in `pretty` output so reviewers can see what was masked. | Operators can still write `expires: 2099-12-31`. No second-reviewer requirement is enforced by the tool; that is a process control. **Medium.** | AMP91-ENG-005 (waiver hardening). |
| CLI-T5 | Tampering / DoS | `command` and `analyzer` checks have a default timeout (120 s for command, 600 s for analyzer at `command.ts:72`, `analyzer.ts:249`) and `maxBuffer` (8 MB / 16 MB). A rule with `timeout_ms: 0` or a process that ignores SIGTERM could hang the gate. | `spawnSync` honors the timeout and kills the child; `maxBuffer` overflow causes the child to be killed with an `ENOBUFS`-like error. | A spawned process that forks detached descendants is not reaped; CI runners eventually time out at the runner level. **Low.** | AMP91-ENG-003. |
| CLI-T6 | Information disclosure | `git-diff.ts` invokes `git diff <ref>` and accepts any ref matching `/^[a-zA-Z0-9._\-/~^]+$/` (`packages/cli/src/lib/git-diff.ts:14,30-34`). Refs are not allowlisted to known branches; a maliciously crafted ref like `--no-pager` is rejected by the regex (does not contain `-` at start), but the protection is regex-only, not argv-only. | `execFileSync("git", ["diff", ref], …)` uses argv passing — no shell interpolation. The leading-dash case is also rejected by the regex. | Future engine changes that use `execSync` instead of `execFileSync` would re-introduce shell parsing of `ref`. **Low.** | n/a (already addressed). |
| CLI-T7 | Repudiation | `rulebound check` does not write an audit trail of which rules ran or which waivers matched. A developer can run with `--rule=<id>` to restrict scope and the pipeline has no record of the narrowing. | The deterministic report includes `rulesEvaluated`/`rulesTotal` and the list of result IDs; CI logs preserve the JSON output. | No tamper-evident log; relies on CI retaining stdout. **Low** for a CI-driven flow, **Medium** for a local-developer flow where audit matters. | n/a (acceptable for v0.1 self-hosted). |
| CLI-T8 | Spoofing | A repo can ship a `CLAUDE.md` or other agent-instruction file that tells an agent to invoke `rulebound check` with `--allow-commands` and a forged "successful" prompt. The CLI cannot tell whether the invoker is a human or an agent following injected instructions. | Out of scope at the CLI layer; this is a prompt-injection concern handled at the agent runtime. The CLI itself only enforces the rule it is told to enforce. | **Medium**; documented in `mcp.md` (MCP-T3). | AMP91-MCP-003 (agent-process signals contract). |

## Operator checklist

- Do **not** add `--allow-commands` to CI invocations of `rulebound
  check` unless the rule set is curated and reviewed. Pre-run analyzers
  in CI first (e.g. ESLint, PMD) and let Rulebound read the report.
- Review every rule pack added via `rulebound registry install` before
  running with `--allow-commands`.
- Set a default waivers policy: `expires` within 90 days, second
  reviewer required (process control). Track this in the project's
  contributing docs.
- Treat `--format json` / `--format repair-json` / `--format sarif`
  output as potentially containing source snippets. Send these to
  systems that already trust the source.
- Run `gitleaks` (AMP91-SEC-001) separately on the working tree before
  trusting the CLI's redaction layer.

## Open questions

- Should `--allow-commands` be per-rule (allowlist) rather than
  per-invocation? Deferred to AMP91-ENG-003. Likely v0.2.
- Should `evidence.stdout`/`evidence.stderr` from command checks also
  be redacted by `redactSnippet`? Currently only `evidence.snippet` is
  redacted. Recommend extending the redaction walk in Wave 4 cleanup.
- Should waivers be signed (e.g. commit-signed YAML)? Recommend
  deferring to v0.2; the audit trail is already in `git blame`.

## Reviewer sign-off

- Date:
- Reviewer:
- Notes:
