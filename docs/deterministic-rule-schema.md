# Deterministic rule schema

A rule is a Markdown file with YAML front matter. Front matter can include a `checks:` array. Each check entry is a tagged union — its `type` decides which fields are valid.

The full TypeScript types live in `packages/engine/src/checks/types.ts`. This document is the user-facing reference.

## Common fields

Every check accepts these optional fields:

| Field      | Type                          | Default  | Notes                                     |
|------------|-------------------------------|----------|-------------------------------------------|
| `id`       | string                        | derived  | Stable identifier for repair JSON / CI    |
| `severity` | `error` \| `warning` \| `info`| `error`  | Severity drives whether a result blocks   |
| `message`  | string                        | default  | Reason printed on failure                 |

A `VIOLATED` or `ERROR` result with `severity: error` is blocking. `warning` /
`info` are non-blocking. Advisory sources (`keyword`, `semantic`, `llm`) are not
part of this deterministic schema and do not block by default.

## Where checks can live

Checks can be declared in YAML front matter:

```markdown
---
title: No debugger statements
severity: error
checks:
  - type: regex
    id: no-debugger
    pattern: "\\bdebugger\\b"
    files: ["**/*.ts", "**/*.tsx"]
    forbidden: true
---

Agents must not commit debugger statements.
```

They can also live in fenced `rulebound` blocks when the human-readable body
needs to introduce the rule first:

````markdown
# No debugger statements

Agents must not commit debugger statements.

```rulebound
checks:
  - type: regex
    id: no-debugger
    pattern: "\\bdebugger\\b"
    files: ["**/*.ts", "**/*.tsx"]
    forbidden: true
```
````

Both forms parse into the same schema.

## `type: ast`

Tree-sitter AST query against source files of a given language.

```yaml
checks:
  - type: ast
    id: ts-no-any
    language: typescript
    builtin: ts-no-any
    severity: error
    message: "Use 'unknown' with type guards instead of 'any'."
```

| Field      | Required | Notes                                                       |
|------------|----------|-------------------------------------------------------------|
| `language` | yes      | `typescript`, `javascript`, `python`, `java`, `go`, `rust`, `csharp`, `cpp`, `ruby`, `bash` |
| `builtin`  | one of   | Built-in query ID (see `getBuiltinQueries()` in the engine) |
| `query`    | one of   | Custom tree-sitter S-expression query                       |

Either `builtin` or `query` must be provided.

## `type: regex`

File-scoped regex check. By default the regex is forbidden — any match is a violation.

```yaml
checks:
  - type: regex
    id: no-stripe-key
    pattern: "sk_(?:live|test)_[A-Za-z0-9]{16,}"
    flags: "g"
    files: ["**/*.ts", "**/*.tsx", "**/*.js"]
    forbidden: true
    severity: error
    message: "Hardcoded Stripe key. Move to environment variable."
```

| Field        | Required | Notes                                                       |
|--------------|----------|-------------------------------------------------------------|
| `pattern`    | yes      | JavaScript-flavored regex                                   |
| `flags`      | no       | Regex flags                                                 |
| `files`      | no       | Glob list. Defaults to all source files.                    |
| `forbidden`  | no       | If `true` (default), match = violation                      |
| `require`    | no       | If `true`, absence of any match = violation                 |

Built-in secret patterns are available; see `SECRET_PATTERNS` exported from `@rulebound/engine`.

## `type: file-exists`

```yaml
checks:
  - type: file-exists
    id: license-required
    path: "LICENSE"
    severity: error
    message: "LICENSE file missing at repo root."
```

## `type: file-not-exists`

```yaml
checks:
  - type: file-not-exists
    id: no-env-checked-in
    path: ".env"
    severity: error
    message: ".env must not be committed."
```

## `type: diff-evidence`

"When X changes, Y must (or must not) change."

```yaml
checks:
  - type: diff-evidence
    id: schema-needs-migration
    when_changed:
      - "packages/server/src/db/schema.ts"
    require_changed:
      - "packages/server/migrations/**/*.sql"
    severity: error
    message: "Schema change without a corresponding migration."
```

| Field                | Notes                                                                       |
|----------------------|-----------------------------------------------------------------------------|
| `when_changed`       | Globs. If none of these changed, the check is `NOT_APPLICABLE`.            |
| `require_changed`    | At least one matching file must be in the changeset.                        |
| `require_not_changed`| None of these files may be in the changeset.                                |
| `branch_matches`     | Regex on branch name. Skip unless matched.                                  |
| `path_scope`         | Restrict the check to changes inside these paths.                           |

Diff context comes from `rulebound check --staged`, `--diff`, `--base <branch>`, or `--ref <ref>`.

## `type: forbidden-import`

Import-boundary check. Files matching `from` may not import modules matching `importing`.

```yaml
checks:
  - type: forbidden-import
    id: domain-no-infra
    from: ["src/domain/**/*.ts"]
    importing: ["src/infra/**", "@/infra/**"]
    severity: error
    message: "Domain layer must not depend on infra."
```

## `type: command`

Runs a shell command. Only executes when `rulebound check --allow-commands` is passed.

```yaml
checks:
  - type: command
    id: typecheck
    run: "pnpm tsc --noEmit"
    pass_exit_codes: [0]
    timeout_ms: 120000
    severity: error
```

| Field             | Notes                                                          |
|-------------------|----------------------------------------------------------------|
| `run`             | Shell command, executed via `/bin/sh -c`                       |
| `pass_exit_codes` | Defaults to `[0]`                                              |
| `timeout_ms`      | Defaults to 600000 (10 minutes)                                |
| `cwd`             | Override working directory                                     |
| `env`             | Extra env vars                                                 |
| `env_allowlist`   | Allowlist of env var names to pass through                     |

If `--allow-commands` is not set, the check returns `NOT_APPLICABLE` (it does not silently pass).

## `type: analyzer`

Runs (or reads the report of) an external analyzer and normalizes its output.

```yaml
checks:
  - type: analyzer
    id: pmd-main
    analyzer: pmd
    run: "mvn -q pmd:check"
    report: "target/pmd.xml"
    report_format: pmd-xml
    severity: error
```

Supported `analyzer` values: `pmd`, `checkstyle`, `spotbugs`, `junit`, `eslint`, `tsc`, `semgrep`, `gitleaks`, `dependency-cruiser`, `sarif`, `generic`.

Supported `report_format` parsers: `pmd-xml`, `checkstyle-xml`, `spotbugs-xml`, `junit-xml`, `sarif`, `json`, `text`.

If `run` is provided, the command runs only with `--allow-commands`. If `run` is omitted, Rulebound reads the existing `report` file (useful when CI runs the analyzer first and Rulebound only reports).

Details: [analyzer-orchestration.md](analyzer-orchestration.md).

## `type: agent-process`

Asserts that an agent performed a required workflow step. Signals are passed from the MCP layer (or test fixtures) into `validateDeterministic({ agentSignals })`.

```yaml
checks:
  - type: agent-process
    id: bugfix-spec-required
    require: bugfix_spec_present
    severity: error
    message: "fix/** branches require a bugfix spec."
```

Supported `require` values:

- `find_rules_called`
- `validate_plan_called`
- `bugfix_spec_present`
- `regression_test_added`

Outside an MCP-driven run, signals are absent and the check will be `VIOLATED`. Use `branch_matches` on a paired `diff-evidence` check, or scope these rules to relevant branches, to avoid noise.

## Planned: `type: scenario`

`scenario` is not implemented yet. Do not put it in production rules until the
engine supports it and the examples are covered by tests.

Planned intent:

```yaml
# PSEUDO / PLANNED ONLY
checks:
  - type: scenario
    id: github-pr-comment-flow
    report: "reports/scenarios/github-pr-comment.json"
    require_status: passed
    max_age_minutes: 60
    severity: error
```

The intended role is to consume deterministic reports from external sandboxes,
API twins, Playwright/Cypress, or service test harnesses. Rulebound would block
on missing/stale/failed reports; it would not LLM-judge whether the scenario
"looked good".

## Result shape

Each check produces a `CheckResult`:

```ts
{
  ruleId: string
  checkId: string
  status: "PASS" | "VIOLATED" | "NOT_APPLICABLE" | "ERROR"
  source: "ast" | "regex" | "diff" | "file" | "import-boundary"
         | "command" | "analyzer" | "agent-process"
  deterministic: true
  confidence: "exact" | "high" | "medium" | "low" | "advisory"
  blocking: boolean
  reason: string
  evidence?: { filePath?, line?, column?, snippet?, ... }
  suggestedFix?: string
}
```

The report aggregates results per rule and produces an overall `status` of `PASSED`, `PASSED_WITH_WARNINGS`, or `FAILED`. Only `FAILED` exits with code 1.

## Invalid examples

Strict schema validation fails closed. These examples are invalid and should
produce actionable config errors instead of silently passing.

Missing required regex pattern:

```yaml
checks:
  - type: regex
    id: broken-regex-rule
    files: ["**/*.ts"]
```

Unknown check type:

```yaml
checks:
  - type: scenario
    id: not-yet-implemented
    report: "scenario.json"
```

Command without a `run` string:

```yaml
checks:
  - type: command
    id: broken-command
    pass_exit_codes: [0]
```

## Rules without checks

A rule with no `checks:` block is **advisory only**. It contributes to the Markdown context shipped to the agent but cannot block CI by itself. `rulebound doctor` reports the deterministic-vs-advisory split.
