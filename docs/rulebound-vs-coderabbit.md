# Rulebound vs CodeRabbit

Short answer: use PR review bots for broad suggestions; use Rulebound for
deterministic evidence that an AI coding agent followed your repo policies.

CodeRabbit-style tools review pull requests and leave comments. They are useful
for critique, explanations, refactor ideas, and finding issues humans may want
to inspect. Their core output is review feedback.

Rulebound's core output is a deterministic pass/fail report from
`rulebound check`. It asks narrower questions:

- Did the schema change include a migration?
- Did the bugfix include a regression test?
- Did a forbidden import boundary get crossed?
- Did PMD, Checkstyle, SpotBugs, ESLint, Semgrep, gitleaks, or another existing
  analyzer report a violation?
- Did the agent provide the required bugfix/process evidence?

## Side by side

| Dimension | CodeRabbit-style reviewer | Rulebound |
| --- | --- | --- |
| Primary job | Review and suggest improvements | Verify deterministic policy evidence |
| Final authority | Human review workflow | `rulebound check` / CI deterministic gate |
| LLM comments | Core surface | Advisory only |
| CI blocking by default | Review configuration dependent | Deterministic blockers only |
| Analyzer strategy | May include analysis as review context | Orchestrates existing analyzer reports through `type: analyzer` |
| PR output | Comments and review summary | GitHub annotations, SARIF, `pr-markdown`, repair JSON |

## PR reports without becoming a review bot

Rulebound can publish PR annotations and `pr-markdown` summaries, but those
reports are evidence/compliance oriented, not broad code critique. A healthy PR
summary says what deterministic blockers, warnings, waivers, analyzer findings,
and repair instructions exist.

Canonical CI commands:

```bash
rulebound check --format github --base main
rulebound check --format sarif --base main
rulebound check --format pr-markdown --base main
```

## What Rulebound will not do here

- It will not LLM-judge whether a PR is "good enough" to merge.
- It will not replace human review or review-bot suggestions.
- It will not treat advisory comments as blockers unless the team explicitly
  opts into `--fail-on-advisory`.
- It will not reimplement every analyzer a review bot might mention; it will
  orchestrate the analyzers your team already trusts.
