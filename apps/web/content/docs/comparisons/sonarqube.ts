import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "comparisons/sonarqube",
  title: "Rulebound vs SonarQube",
  description:
    "Different categories. SonarQube is a broad static code quality platform; Rulebound is a deterministic guardrail layer for AI coding agents that orchestrates existing analyzers instead of reimplementing them.",
  content: `## Rulebound vs SonarQube

Short answer: they are different categories. Run both side by side.

For PR-review-bot comparisons, see [Rulebound vs CodeRabbit](/docs/comparisons/coderabbit).

SonarQube is a general static code quality and security analysis platform. It scans your entire codebase against a broad ruleset to produce a quality gate decision over the whole project, with a long-running server and history.

Rulebound is a deterministic guardrail layer for AI coding agents. It enforces **your team's policies** on the agent's plan, diff, and code, and runs deterministic checks (your rules, plus existing analyzers it orchestrates) at the CLI / MCP / CI boundary.

## Side by side

| Dimension                          | SonarQube                                       | Rulebound                                                            |
|------------------------------------|-------------------------------------------------|----------------------------------------------------------------------|
| Primary user                       | Engineering org, security team                  | Engineering team operating AI coding agents                          |
| Primary input                      | Full codebase, periodic scan                    | Agent plan, current diff, repo policies                              |
| Primary output                     | Quality gate, issue list, history server        | Deterministic pass/fail report, repair JSON, agent context           |
| Ruleset                            | Thousands of language rules, opinionated by SQ  | Small built-in set + the team's rules + orchestrated analyzers       |
| Coverage strategy                  | Reimplements rules per language                 | Orchestrates PMD, Checkstyle, SpotBugs, ESLint, Semgrep, gitleaks, ... |
| Agent workflow awareness           | None                                            | First-class (bugfix boundary, plan/diff evidence, MCP signals)       |
| LLM/keyword findings               | Not in scope                                    | Present, but always advisory — never the final blocker               |
| Deployment                         | Long-running server, DB                         | CLI binary; optional server                                          |
| Where it runs                      | CI / nightly                                    | CLI locally, MCP inside the agent, CI on every PR                    |

## When to use which

**Use SonarQube (or Sonar*Cloud*, or your existing analyzer of choice) for:**

- Broad, language-wide static analysis maintained by someone else.
- Long-term quality gate history across a project's lifetime.
- Security analysis with a curated ruleset.
- Org-wide reporting and dashboards.

**Use Rulebound for:**

- Enforcing **your repo's** policies on AI-generated diffs (e.g. schema change requires migration, bugfix requires test, domain cannot import infra).
- Making the agent prove it followed the right rules for the task.
- Normalizing existing analyzer reports (including SonarQube's, via SARIF, if you produce SARIF) into one agent-facing report.
- Strict deterministic gating in CI where the rules are repo-specific.

## Running them together

A typical setup:

1. SonarQube runs on its own schedule and surfaces broad code-quality issues.
2. Rulebound runs on every PR and on the agent's local loop. It enforces repo-specific policies and consumes analyzer reports — including SonarQube-emitted SARIF — through \`type: analyzer\`.
3. CI fails the PR only on Rulebound's deterministic violations. SonarQube findings remain advisory unless your team has explicitly promoted them to blocking via Rulebound.

This split keeps the gate that blocks the PR under your team's deterministic control, while still giving you the breadth of a general analyzer.

## What Rulebound will not become

- It will not ship a language ruleset comparable to SonarQube's. That work belongs to the analyzers Rulebound orchestrates.
- It will not host a long-running project history server as the primary surface.
- It will not become an LLM-as-judge product.
- It will not become a full sandbox/twin provider. Future scenario evidence can require deterministic reports from external sandboxes or API twins; those systems provide the environment, Rulebound consumes the evidence.

## Related

- [vs CodeRabbit](/docs/comparisons/coderabbit) — different scope, different surface.
- [Analyzer Orchestration](/docs/recipes/orchestration) — how Rulebound consumes existing analyzer reports.
`,
}

export default doc
