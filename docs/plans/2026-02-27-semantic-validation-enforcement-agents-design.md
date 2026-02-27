# Design: Semantic Validation, Progressive Enforcement & Multi-Agent Coordination

**Date:** 2026-02-27
**Status:** Approved

---

## Summary

Three major improvements to Rulebound CLI:

1. **Layered Validation Engine** — Replace monolithic keyword matcher with a 3-layer pipeline (keyword + semantic + LLM)
2. **Progressive Enforcement** — Advisory → moderate → strict, config-driven, score-threshold aware
3. **`rulebound ci` Command** — Generic CI/CD integration with GitHub annotations
4. **Vercel AI SDK Integration** — Multi-provider LLM support (Anthropic default + OpenAI)
5. **Agent Profiles & Multi-Agent Coordination** — Local-first multi-agent identity, debate/consensus protocol

---

## Section 1: Layered Validation Engine

### Architecture

```
Layer 3: LLM Matcher (--llm)        ← Vercel AI SDK, optional
Layer 2: Semantic Matcher             ← TF-IDF cosine similarity, offline
Layer 1: Keyword Matcher (bugfixed)   ← Zero dependency, always runs
```

### Layer behavior

- **Default:** Layer 1 + Layer 2 (offline, fast)
- **`--llm` flag:** Layer 1 + Layer 2 + Layer 3 (API key required)
- Each layer returns `MatchResult { status, confidence, reason }`
- Results merged: highest confidence wins, upper layer takes priority on conflict

### Keyword Matcher bug fixes

- **Negation awareness:** "We will ensure no hardcoded secrets" → PASS, not VIOLATED
- **Phrase matching:** n-gram matching instead of single words
- **`matchRulesByContext` line 205 bug:** `rule.scope.length === 0` always returns true for global rules, making task filter ineffective

### File structure

```
packages/cli/src/lib/
  matchers/
    types.ts          ← MatchResult, Matcher interface
    keyword.ts        ← Layer 1 (current logic refactored + bugfix)
    semantic.ts       ← Layer 2 (TF-IDF, cosine similarity)
    llm.ts            ← Layer 3 (Vercel AI SDK)
    pipeline.ts       ← Orchestrator: run layers, merge results
  validation.ts       ← New validatePlanAgainstRules (uses pipeline)
```

---

## Section 2: Progressive Enforcement

### Modes

| Mode | MUST violation | SHOULD violation | MAY |
|------|---------------|-----------------|-----|
| `advisory` | Log only | Log only | Log only |
| `moderate` | CI fail only (commit passes) | Log | Log |
| `strict` | Block commit + CI fail | CI warning | Log |

### Config additions (`.rulebound/config.json`)

```json
{
  "enforcement": {
    "mode": "advisory",
    "scoreThreshold": 70,
    "autoPromote": true
  }
}
```

- `mode`: `"advisory"` | `"moderate"` | `"strict"`
- `scoreThreshold`: below this score, `moderate` mode also blocks commits
- `autoPromote`: when `true`, CLI suggests upgrading to strict when score consistently > 90

### CLI commands

```bash
rulebound enforce              # show current mode
rulebound enforce --mode strict  # change mode
rulebound enforce --threshold 80 # set score threshold
```

### Pre-commit hook behavior

- `advisory`: hook runs, prints report, always `exit 0`
- `moderate`: MUST + score threshold violation → `exit 1`
- `strict`: any MUST violation or score < threshold → `exit 1`

---

## Section 3: `rulebound ci` Command

### Usage

```bash
rulebound ci                          # diff against main
rulebound ci --base develop           # custom base branch
rulebound ci --format github          # GitHub Actions annotations
rulebound ci --llm                    # LLM-powered deep validation
rulebound ci --format json > report.json
```

### Behavior

1. `git diff origin/main...HEAD` — all PR changes
2. Load rules (with inheritance)
3. Run validation pipeline (Layer 1+2, optionally Layer 3)
4. Exit code based on enforcement mode
5. `--format github` outputs GitHub Actions annotations

### GitHub annotations (`--format github`)

```
::error file=src/auth.ts,line=42::MUST violation: No Hardcoded Secrets
::warning file=src/api.ts::SHOULD: Input validation not detected
```

### Exit codes

- `0` = passed
- `1` = failed (violations exceed enforcement threshold)
- `2` = configuration error

---

## Section 4: Vercel AI SDK Integration

### Dependencies

```json
{
  "optionalDependencies": {
    "ai": "^4",
    "@ai-sdk/anthropic": "^1",
    "@ai-sdk/openai": "^1"
  }
}
```

Added as `optionalDependencies` — users who don't use `--llm` don't need these packages.

### Provider config

Config (`.rulebound/config.json`):
```json
{
  "llm": {
    "provider": "anthropic"
  }
}
```

Or env vars:
```bash
RULEBOUND_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Anthropic is the default provider.

### LLM Matcher strategy

- Structured prompt per rule: "Does this plan comply with this rule?"
- `generateObject` for structured output (status + confidence + reason)
- Parallel requests per rule (rate-limit aware)
- Fallback: if AI SDK import fails (optional dep not installed), clear error message

---

## Section 5: Agent Profiles & Multi-Agent Coordination

### Config (`.rulebound/agents.json`)

```json
{
  "agents": {
    "claude": {
      "roles": ["architect", "implementer"],
      "rules": ["all"],
      "enforcement": "strict"
    },
    "claude-admin": {
      "roles": ["reviewer", "security"],
      "rules": ["security/*", "global/*"],
      "enforcement": "strict"
    },
    "codex": {
      "rules": ["all"],
      "enforcement": "moderate"
    },
    "opencode": {
      "rules": ["all"],
      "enforcement": "moderate"
    }
  }
}
```

Rulebound manages: **which roles, which rules, which enforcement level per agent.**
Model, provider, API key — all managed by the user's own tool (Claude Code, Codex, OpenCode). Rulebound does not touch these.

### CLI commands

```bash
rulebound agents list              # list all agents
rulebound agents add claude-qa     # add new agent profile
rulebound agents run claude-admin  # validate with specific agent profile

# Multi-agent coordination
rulebound review --agents claude,claude-admin,codex
rulebound review --agents claude,claude-admin --diff
```

### Coordination protocol (local-first)

```
Debate Phase
  Each agent reviews from its perspective:
  - architect: structural compliance
  - security: security rule violations
  - implementer: implementation feasibility
  - qa: test coverage

Consensus Phase
  Results merged:
  - Unanimous PASS → PASS
  - Any MUST violation → FAIL
  - Conflict → highest-role priority

Report
  Per-agent breakdown + consensus result
```

### Collision prevention

File-level lock — when an agent claims a file for review, others are blocked from duplicating the effort. Implemented via `.rulebound/.locks/`.

### File structure

```
packages/cli/src/lib/
  agents/
    types.ts        ← AgentProfile, CoordinationResult
    registry.ts     ← Agent config loading
    coordinator.ts  ← Debate → Consensus → Report pipeline
    lock.ts         ← File-level collision prevention
  commands/
    agents.ts       ← list, add, run commands
    review.ts       ← multi-agent review command
```

---

## Verification

Each section verified by tests:

- **Layer 1 bugfix:** `plan="We will ensure no hardcoded secrets"` + `rule="No Hardcoded Secrets"` → PASS (was VIOLATED)
- **Layer 2 semantic:** `plan="JWT tokens in httpOnly cookies"` + `rule="Authentication Authorization"` → PASS (was NOT_COVERED)
- **Layer 3 LLM:** `rulebound validate --plan "..." --llm` → LLM-powered analysis with reasoning
- **Enforcement:** mode transitions advisory → moderate → strict with correct exit codes
- **CI:** `rulebound ci --format github` → valid GitHub annotations
- **Agents:** `rulebound review --agents claude,claude-admin` → per-agent breakdown + consensus
