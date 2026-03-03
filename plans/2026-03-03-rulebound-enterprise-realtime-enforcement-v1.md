# Rulebound: Enterprise-Grade Real-Time Rule Enforcement Platform

## Objective

Transform Rulebound from a local, developer-initiated CLI tool into a **company-wide, real-time enforcement platform** that governs LLM-generated code across all AI coding agents (Claude Code, Cursor, Codex, Gemini, etc.) — regardless of which tool or language a developer uses. The goal is to ensure that every line of AI-generated code complies with organizational standards for code quality, architecture, security, and style — in real-time, not post-hoc.

---

## Current State Analysis

### What Exists Today (Source: codebase at `/Users/yalcindoksanbir/rulebound`)

| Component | Status | Location |
|-----------|--------|----------|
| CLI (14 commands) | Functional | `packages/cli/` — find-rules, validate, diff, ci, score, hook, enforce, review, generate, lint, history |
| MCP Server (4 tools) | Functional | `packages/mcp/` — find_rules, validate_plan, check_code, list_rules |
| Validation Pipeline | 3-layer (Keyword + Semantic + LLM) | `packages/cli/src/lib/matchers/` |
| Rule Format | Markdown + YAML front matter | `examples/rules/` — 24 example rules across 8 categories |
| Rule Inheritance | Parent/npm extends | `packages/cli/src/lib/inheritance.ts` |
| Enforcement Modes | advisory/moderate/strict | `packages/cli/src/lib/enforcement.ts` |
| Multi-Agent Review | Agent profiles + consensus | `packages/cli/src/lib/agents/` |
| Web Dashboard | Next.js 16 + Drizzle ORM | `apps/web/` — 8 DB tables (users, orgs, projects, rules, versions, tokens) |
| CI/CD Integration | GitHub Actions annotations | `packages/cli/src/commands/ci.ts` |

### Critical Gaps for Enterprise Real-Time Enforcement

1. **No centralized rule distribution** — Rules are local per-repo, not org-wide
2. **No real-time interception** — Validation is developer-initiated (manual `rulebound validate`), not automatic
3. **No compliance telemetry** — No visibility into who violated what, when, how often
4. **No policy-as-code governance** — No approval workflows for rule changes
5. **No agent-agnostic proxy layer** — MCP server works only for MCP-compatible agents
6. **No team/project segmentation at scale** — DB schema has org/project tables but no active enforcement layer
7. **No API gateway for remote rule serving** — CLI reads from local filesystem only
8. **No drift detection** — No mechanism to detect if generated code drifted from validated plan

---

## Architecture Vision

```
                    ┌─────────────────────────────────────────┐
                    │         RULEBOUND CONTROL PLANE          │
                    │  (Central Rule Registry + Policy Engine) │
                    │                                          │
                    │  ┌──────────┐  ┌──────────┐  ┌────────┐│
                    │  │ Rule     │  │ Policy   │  │Teleme- ││
                    │  │ Registry │  │ Engine   │  │try/Audit││
                    │  └────┬─────┘  └────┬─────┘  └────┬───┘│
                    └───────┼─────────────┼─────────────┼────┘
                            │             │             │
              ┌─────────────┼─────────────┼─────────────┼──────────┐
              │             ▼             ▼             ▼          │
              │      ┌──────────────────────────────────────┐      │
              │      │       ENFORCEMENT GATEWAY (API)      │      │
              │      │   /validate  /rules  /score  /audit  │      │
              │      └──────────────┬───────────────────────┘      │
              │                     │                               │
    ┌─────────┼─────────┬──────────┼──────────┬───────────────────┤
    │         │         │          │          │                    │
    ▼         ▼         ▼          ▼          ▼                    ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐         ┌───────────┐
│Claude │ │Cursor │ │Codex  │ │Gemini │ │Any    │         │ CI/CD     │
│Code   │ │       │ │       │ │       │ │Agent  │         │ Pipeline  │
│(MCP)  │ │(.rules│ │(API)  │ │(API)  │ │(API)  │         │(GH Action)│
└───┬───┘ │.md)   │ └───┬───┘ └───┬───┘ └───┬───┘         └─────┬─────┘
    │     └───┬───┘     │         │         │                     │
    │         │         │         │         │                     │
    ▼         ▼         ▼         ▼         ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCAL ENFORCEMENT LAYER                          │
│  Pre-commit hooks  │  File watchers  │  IDE extensions  │  MCP     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Central Rule Registry & API Gateway

**Rationale:** The foundation — rules must flow from a single source of truth, not scattered `.rulebound/` directories. This enables org-wide governance.

- [ ] 1.1 **Design the Rule Sync Protocol** — Define how rules flow from central registry to local `.rulebound/` directories. Design a `rulebound pull` command that fetches org rules from the API and merges with local overrides. This replaces the current filesystem-only model (`packages/cli/src/lib/local-rules.ts:82-96`) with a hybrid local+remote approach.

- [ ] 1.2 **Build the Enforcement API** — Create a new `packages/api/` package (or extend `apps/web/app/api/`) with REST endpoints:
  - `POST /api/v1/validate` — Accept plan text + project context, return validation report
  - `GET /api/v1/rules` — Serve rules filtered by org, project, stack, scope
  - `POST /api/v1/score` — Calculate compliance score for a diff/plan
  - `POST /api/v1/audit` — Log validation events (who, when, what, result)
  - `GET /api/v1/config/:project` — Serve enforcement config (mode, threshold) for a project
  
  Authentication via API tokens (schema already exists at `apps/web/lib/db/schema.ts:126-137`).

- [ ] 1.3 **Extend the DB Schema for Central Governance** — Add tables to support:
  - `enforcement_policies` — per-org/per-project enforcement configs (mode, threshold, blocked categories)
  - `validation_events` — audit log (timestamp, user, project, agent, rule violations, score, blocked?)
  - `rule_assignments` — which rule sets apply to which projects/teams (extend existing `projectRuleSets`)
  - `org_settings` — org-level defaults (default enforcement mode, mandatory rule sets, approved stacks)

- [ ] 1.4 **Implement `rulebound pull` / `rulebound push` CLI Commands** — `pull` downloads org rules + enforcement config from the API into local `.rulebound/`. `push` uploads local rules to the registry (for rule authors). This builds on the existing inheritance system (`packages/cli/src/lib/inheritance.ts`) but adds API-backed resolution.

- [ ] 1.5 **Upgrade MCP Server to Hybrid Mode** — Modify `packages/mcp/src/index.ts` to check for API connectivity first. If an API token is configured, fetch rules from the central registry. Fall back to local filesystem. This ensures MCP-compatible agents (Claude Code) get real-time org rules without manual `pull`.

### Phase 2: Real-Time Interception Layer

**Rationale:** The core differentiator — enforcement must happen *as code is written*, not when the developer remembers to run a command.

- [ ] 2.1 **Build a File Watcher Daemon (`rulebound watch`)** — A persistent process that monitors file changes in the project directory. On save, it:
  1. Detects changed files and their diffs
  2. Matches relevant rules based on file type, stack, and change content
  3. Runs the validation pipeline (Keyword + Semantic, optionally LLM)
  4. Reports violations in real-time via terminal output, desktop notifications, or IDE integration
  
  This is the "always-on guardian" mode — developer writes code with any AI agent, the daemon catches violations instantly.

- [ ] 2.2 **Create a Language Server Protocol (LSP) Server** — Build `packages/lsp/` that implements LSP diagnostics. This enables real-time rule violation warnings directly in any editor (VS Code, JetBrains, Neovim) regardless of which AI agent generated the code. Violations appear as inline warnings/errors, just like linting.

- [ ] 2.3 **Enhance MCP Server with Proactive Validation** — Currently, the MCP server (`packages/mcp/src/index.ts:96-133`) has a `check_code` tool that agents call reactively. Add a `pre_write` tool that agents MUST call before writing any file. The tool description should instruct agents: "Before writing any code to disk, call pre_write with the intended file content. If violations are returned, fix them before writing."

- [ ] 2.4 **Implement Pre-Commit Hook with Full Pipeline** — The existing hook (`packages/cli/src/commands/hook.ts`) is basic. Upgrade it to:
  1. Run the full validation pipeline (not just keyword matching)
  2. Respect the project's enforcement mode from the central config
  3. Report violations with GitHub-style annotations
  4. Optionally use LLM validation for high-severity rules
  5. Cache results for unchanged files to keep hook fast (< 3s)

- [ ] 2.5 **Build IDE Extension Infrastructure** — Create a VS Code extension (`packages/vscode/`) that:
  1. Integrates with the LSP server for real-time diagnostics
  2. Shows a "Rulebound" panel with current project rules, compliance score, and recent violations
  3. Provides "Quick Fix" actions for common violations
  4. Works with any AI agent since it monitors file changes, not agent-specific protocols

### Phase 3: Compliance Telemetry & Organizational Dashboard

**Rationale:** Without visibility, enforcement is a black box. Leaders need to see compliance trends, teams need to see their hotspots, and security needs an audit trail.

- [ ] 3.1 **Build the Telemetry Ingestion Pipeline** — Every validation event (CLI, MCP, LSP, CI, hook) sends structured telemetry to the API:
  ```
  { timestamp, userId, projectId, orgId, agent, command, rulesChecked, violations[], score, blocked, duration }
  ```
  Use the `validation_events` table from Phase 1. Design for high volume (batch inserts, async writes).

- [ ] 3.2 **Build the Compliance Dashboard** — Extend `apps/web/` with new dashboard pages:
  - **Org Overview** — Aggregate compliance score across all projects, trend chart, worst-performing projects
  - **Project Detail** — Per-project score, most violated rules, violation timeline, top offending files
  - **Rule Analytics** — Per-rule violation frequency, which teams violate it most, trending violations
  - **Developer Activity** — Per-developer compliance score (anonymized or team-aggregated), improvement trends
  - **Audit Log** — Full searchable history of all validation events with filters by agent, project, rule, outcome

- [ ] 3.3 **Implement Alerting & Notifications** — Configurable alerts:
  - Slack/Teams webhook when a project's score drops below threshold
  - Email digest (daily/weekly) with compliance summary per project
  - GitHub PR comment with Rulebound validation summary (extend `packages/cli/src/commands/ci.ts`)

- [ ] 3.4 **Build Compliance Reports & Export** — Generate downloadable reports (PDF/CSV) for:
  - Monthly compliance snapshots per org/project
  - Rule coverage analysis (which rules are never triggered, which are always violated)
  - Audit reports for compliance frameworks (SOC2, ISO 27001 evidence)

### Phase 4: Policy-as-Code Governance

**Rationale:** In enterprise settings, rules themselves need governance — who can change them, what's the approval process, how do changes propagate.

- [ ] 4.1 **Implement Rule Change Approval Workflows** — When a rule is modified via `rulebound push` or the web UI:
  1. Create a "rule change request" (similar to a PR)
  2. Require approval from designated reviewers (rule owners, security team)
  3. Track the change in `rule_versions` table (already exists at `apps/web/lib/db/schema.ts:97-107`)
  4. Propagate approved changes to all projects that reference the rule set

- [ ] 4.2 **Build Rule Inheritance Hierarchies** — Extend the current `extends` mechanism (`packages/cli/src/lib/inheritance.ts:49-78`):
  - **Org-level mandatory rules** — Cannot be overridden by projects (e.g., security rules)
  - **Team-level defaults** — Can be overridden by projects with justification
  - **Project-level customs** — Local rules that don't propagate upward
  - **Lock mechanism** — Certain rules can be "locked" so they cannot be weakened at lower levels

- [ ] 4.3 **Implement Enforcement Escalation** — Automatic enforcement mode promotion based on project maturity:
  - New projects start in `advisory` mode
  - After 2 weeks with score > 80, auto-promote to `moderate` (leveraging existing `shouldSuggestPromotion` at `packages/cli/src/lib/enforcement.ts:36-38`)
  - Security-critical projects can be locked to `strict` mode by org admins
  - Add `rulebound enforce --lock strict` for admin-level enforcement locking

- [ ] 4.4 **Build Role-Based Access Control (RBAC)** — Extend the web dashboard:
  - **Org Admin** — Full control over rules, enforcement modes, and policies
  - **Rule Author** — Can create/edit rules, submit change requests
  - **Project Lead** — Can override non-locked rules for their project
  - **Developer** — Read-only rule access, receives validation feedback
  - Use existing `orgMembers.role` field (`apps/web/lib/db/schema.ts:44`) as the foundation

### Phase 5: Advanced Validation & Multi-Language Support

**Rationale:** The current validation is text-based (keyword + TF-IDF semantic). For real enterprise enforcement, validation needs to understand code structure, not just text patterns.

- [ ] 5.1 **Build AST-Aware Validation Layer** — Add a new matcher to the pipeline (`packages/cli/src/lib/matchers/`) that:
  - Parses code into ASTs for supported languages (TypeScript via ts-morph, Python via tree-sitter, Java via tree-sitter, Go via tree-sitter)
  - Checks structural rules (e.g., "all services must implement the repository pattern", "no function longer than 50 lines")
  - Integrates as a 4th layer in the `ValidationPipeline` (`packages/cli/src/lib/matchers/pipeline.ts`)

- [ ] 5.2 **Implement Pattern-Based Code Checks** — Allow rules to define code patterns (regex or AST queries) in their front matter:
  ```yaml
  patterns:
    prohibited:
      - "console\\.log\\("          # No console.log in production
      - "any\\s+as\\s+\\w+"         # No type assertions
    required:
      - "try\\s*\\{"                # Must have error handling
  ```
  The existing `check_code` MCP tool (`packages/mcp/src/index.ts:96-133`) currently uses plan validation on code — this would replace it with real pattern matching.

- [ ] 5.3 **Build Language-Specific Rule Templates** — Create curated rule packs for enterprise stacks:
  - **Java/Spring Boot Pack** — Expand existing 7 rules to 25+ (add: API versioning, pagination patterns, circuit breaker, CQRS, event sourcing)
  - **Python/FastAPI Pack** — Pydantic validation, async patterns, dependency injection, testing with pytest
  - **Go Pack** — Expand existing 2 rules to 15+ (add: context propagation, goroutine patterns, interface segregation)
  - **Kubernetes/IaC Pack** — Expand existing 4 rules to 20+ (add: network policies, RBAC, resource quotas, HPA)

- [ ] 5.4 **Implement Cross-File Relationship Validation** — Some rules span multiple files (e.g., "every API endpoint must have a corresponding test"). Build a cross-file analyzer that:
  - Maps file relationships (source -> test, controller -> service -> repository)
  - Validates architectural rules across the dependency graph
  - Reports missing counterparts (e.g., "UserController has no test file")

### Phase 6: Agent-Agnostic Integration Layer

**Rationale:** Not all AI agents support MCP. Enterprise needs to enforce rules regardless of which AI tool a developer uses.

- [ ] 6.1 **Build Universal Agent Config Generator** — Extend `packages/cli/src/commands/generate.ts` to produce configs for additional agents:
  - **Windsurf** — `.windsurf/rules.md`
  - **Cody (Sourcegraph)** — `.cody/rules.json`
  - **Amazon Q Developer** — `.amazonq/rules.md`
  - **JetBrains AI** — `.idea/rulebound.xml`
  - All generated from the same central rule source

- [ ] 6.2 **Build a Proxy API for Non-MCP Agents** — For agents that don't support MCP but allow HTTP tool calls or custom commands:
  - REST API that mirrors MCP tool signatures (`find_rules`, `validate_plan`, `check_code`)
  - Webhook mode for agents that support webhook integrations
  - This ensures any agent with HTTP capability can validate against org rules

- [ ] 6.3 **Implement Git-Based Enforcement (Agent-Agnostic)** — The ultimate fallback — regardless of which agent generates code:
  - Enhanced pre-commit hook (Phase 2.4) blocks non-compliant commits
  - Server-side git hooks (pre-receive) for organizations using GitHub Enterprise / GitLab
  - GitHub App that validates PRs and adds check status (pass/fail based on enforcement mode)

- [ ] 6.4 **Build a CLI Watch Mode for Team Servers** — A daemon version of the CLI that runs on a shared development server, monitoring all developer activity:
  - Watches shared project directories
  - Validates changes as they're written
  - Reports to the central telemetry API
  - Useful for environments where developers work on shared infrastructure

---

## Verification Criteria

- Central API serves rules to 3+ different agent types (MCP, CLI, REST) with < 200ms latency
- File watcher daemon detects violations within 2 seconds of file save
- LSP server shows inline diagnostics in VS Code within 1 second
- Pre-commit hook completes validation in < 3 seconds for typical changesets
- Dashboard shows real-time compliance scores updated within 5 minutes of validation events
- Rule inheritance correctly resolves org -> team -> project hierarchy with lock enforcement
- CI pipeline integration produces GitHub check status and PR comments
- System handles 100+ concurrent validation requests without degradation
- Audit log captures 100% of validation events across all enforcement surfaces
- Generated agent configs are valid and functional for each supported AI coding agent

---

## Potential Risks and Mitigations

1. **Performance Bottleneck in Real-Time Validation**
   Mitigation: Use tiered validation — keyword matcher (fast, < 50ms) runs always; semantic matcher runs on save; LLM matcher runs only on commit/CI. Cache rule parsing and AST results aggressively. The existing pipeline architecture (`packages/cli/src/lib/matchers/pipeline.ts:41-58`) already supports sequential matcher execution, making it straightforward to skip expensive layers.

2. **Developer Friction / Resistance**
   Mitigation: Start every project in `advisory` mode (existing default at `packages/cli/src/lib/enforcement.ts:9-13`). Never block silently — always explain why with suggested fixes. The existing `suggestedFix` field in validation results is the foundation. Provide a `rulebound explain <rule-id>` command for context.

3. **False Positives from Keyword/Semantic Matchers**
   Mitigation: The existing negation-awareness in `KeywordMatcher` (`packages/cli/src/lib/matchers/keyword.ts:183-204`) is a good start. Invest in the AST-aware layer (Phase 5.1) for structural rules and keep text-based matchers for intent-level rules. Allow per-rule `// rulebound-ignore` inline suppression.

4. **Rule Sprawl / Conflicting Rules Across Teams**
   Mitigation: The rule quality scoring system (`rulebound rules lint`) already scores rules on Atomicity, Completeness, and Clarity. Extend this to detect conflicts between rules (e.g., two rules with contradicting requirements). Enforce rule review workflows (Phase 4.1).

5. **API Availability / Single Point of Failure**
   Mitigation: Design the system to work offline — local `.rulebound/` directory is the fallback cache. The `rulebound pull` command syncs periodically. If the API is down, validation continues with cached rules. Never block a developer because the central server is unreachable.

6. **Multi-Language Complexity**
   Mitigation: Use tree-sitter for AST parsing (supports 100+ languages from a single library). Start with the 4 most common enterprise languages (TypeScript, Java, Python, Go) and expand based on telemetry data showing which stacks have the most violations.

---

## Alternative Approaches

1. **Git-Only Enforcement (No Central API)** — Instead of building a central control plane, enforce entirely through git hooks and CI. Simpler to deploy but loses real-time feedback and centralized visibility. Suitable for smaller organizations (< 50 developers).

2. **IDE Extension-First** — Instead of building an LSP server, build direct VS Code/JetBrains extensions that bundle the validation engine. Faster to market but creates platform lock-in and makes updates harder to distribute.

3. **LLM-Only Validation** — Instead of the multi-layer pipeline, use LLM validation for everything. Higher accuracy but 10-100x more expensive and 10x slower. The current architecture wisely uses LLM as the final, optional layer (`packages/cli/src/lib/validation.ts:100-116`). This approach should remain.

4. **Adopt Existing Policy Engines (OPA/Rego)** — Instead of building a custom policy engine, integrate Open Policy Agent for rule evaluation. Proven at scale but adds operational complexity and requires teams to learn Rego. Better suited for infrastructure-only rules.

---

## Priority & Sequencing

| Phase | Priority | Dependencies | Impact |
|-------|----------|--------------|--------|
| Phase 1: Central Registry + API | **P0 - Critical** | None | Foundation for everything else |
| Phase 2: Real-Time Interception | **P0 - Critical** | Phase 1 (API for remote rules) | Core value proposition |
| Phase 3: Telemetry + Dashboard | **P1 - High** | Phase 1 (API for events), Phase 2 (event sources) | Organizational visibility |
| Phase 6: Agent-Agnostic Layer | **P1 - High** | Phase 1 (API) | Broader adoption |
| Phase 4: Policy Governance | **P2 - Medium** | Phase 1, Phase 3 | Enterprise maturity |
| Phase 5: Advanced Validation | **P2 - Medium** | Phase 2 (pipeline integration) | Accuracy improvement |

Phases 1 and 2 should be developed in parallel. Phase 3 builds on telemetry events from Phase 2. Phase 6 can start as soon as Phase 1 API is available. Phases 4 and 5 are enhancements that increase enterprise readiness and validation accuracy respectively.
