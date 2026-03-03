# Rulebound QA Test Plan

**Version:** 1.0
**Date:** 2026-03-03
**Packages:** engine, server, gateway, cli, mcp, web

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Unit Tests](#2-unit-tests)
3. [Integration Tests](#3-integration-tests)
4. [E2E Test Scenarios](#4-e2e-test-scenarios)
5. [Smoke Tests](#5-smoke-tests)
6. [UI Tests (Manual)](#6-ui-tests-manual)
7. [Performance Tests](#7-performance-tests)
8. [Security Tests](#8-security-tests)
9. [Regression Checklist](#9-regression-checklist)

---

## 1. Test Environment Setup

### Prerequisites

| Tool       | Version  | Purpose                |
|------------|----------|------------------------|
| Node.js    | 22+      | Runtime                |
| pnpm       | 10+      | Package manager        |
| PostgreSQL | 17       | Dashboard DB (optional)|
| Git        | 2.40+    | Diff/hook tests        |

### Bootstrap

```bash
git clone https://github.com/ylcn91/rulebound.git
cd rulebound
pnpm install
pnpm build          # all 6 packages
```

### Running All Tests

```bash
# Engine (52 tests — matchers + AST)
cd packages/engine && npx vitest run

# Gateway (13 tests — proxy + interceptors)
cd packages/gateway && npx vitest run

# Server (8 tests — notifications)
cd packages/server && npx vitest run

# CLI (39 tests — commands + pipeline)
cd packages/cli && npx vitest run

# Full suite (112 tests)
pnpm test   # or run each package above
```

---

## 2. Unit Tests

### 2.1 Engine — Core Validation (`packages/engine`)

| ID       | Test Case                                    | File                          | Status   |
|----------|----------------------------------------------|-------------------------------|----------|
| ENG-001  | KeywordMatcher detects prohibition violations | `engine.test.ts`              | Automated|
| ENG-002  | KeywordMatcher negation context (no FP)       | `engine.test.ts`              | Automated|
| ENG-003  | KeywordMatcher compliance language pass       | `engine.test.ts`              | Automated|
| ENG-004  | SemanticMatcher TF-IDF similarity scoring     | `engine.test.ts`              | Automated|
| ENG-005  | SemanticMatcher low-similarity NOT_COVERED    | `engine.test.ts`              | Automated|
| ENG-006  | Pipeline merges results by confidence         | `engine.test.ts`              | Automated|
| ENG-007  | Pipeline later-layer overrides lower          | `engine.test.ts`              | Automated|
| ENG-008  | Enforcement advisory mode never blocks        | `engine.test.ts`              | Automated|
| ENG-009  | Enforcement strict mode blocks any violation  | `engine.test.ts`              | Automated|
| ENG-010  | Enforcement moderate blocks MUST violations   | `engine.test.ts`              | Automated|
| ENG-011  | Score calculation (pass/violated/total)        | `engine.test.ts`              | Automated|
| ENG-012  | Rule loader parses frontmatter correctly      | `engine.test.ts`              | Automated|
| ENG-013  | Rule loader collects nested directories       | `engine.test.ts`              | Automated|
| ENG-014  | Stack auto-detection (package.json -> TS)     | `engine.test.ts`              | Automated|
| ENG-015  | Rule filtering by stack/category/tags         | `engine.test.ts`              | Automated|
| ENG-016  | Config loading from .rulebound/config.json    | `engine.test.ts`              | Automated|
| ENG-017  | Rule inheritance merges parent + local        | `engine.test.ts`              | Automated|
| ENG-018  | validate() returns correct ValidationReport   | `engine.test.ts`              | Automated|
| ENG-019  | validate() determines FAILED on MUST violation| `engine.test.ts`              | Automated|
| ENG-020  | validate() determines PASSED_WITH_WARNINGS    | `engine.test.ts`              | Automated|
| ENG-021  | validate() determines PASSED for clean plan   | `engine.test.ts`              | Automated|
| ENG-022  | LLMMatcher dynamic import fallback            | `engine.test.ts`              | Automated|

### 2.2 Engine — AST Analysis (`packages/engine`)

| ID       | Test Case                                    | File                          | Status   |
|----------|----------------------------------------------|-------------------------------|----------|
| AST-001  | Built-in query library has 25+ queries        | `ast.test.ts`                 | Automated|
| AST-002  | Language-specific query filtering             | `ast.test.ts`                 | Automated|
| AST-003  | Query lookup by ID                            | `ast.test.ts`                 | Automated|
| AST-004  | Unknown query ID returns undefined            | `ast.test.ts`                 | Automated|
| AST-005  | Query filtering by category                   | `ast.test.ts`                 | Automated|
| AST-006  | Query ID listing per language                 | `ast.test.ts`                 | Automated|
| AST-007  | JS queries subset of TS (no TS-specific)      | `ast.test.ts`                 | Automated|
| AST-008  | All queries have required fields              | `ast.test.ts`                 | Automated|
| AST-009  | Language detection from file path             | `ast.test.ts`                 | Automated|
| AST-010  | Supported language validation                 | `ast.test.ts`                 | Automated|
| AST-011  | WASM mappings for all 10 languages            | `ast.test.ts`                 | Automated|
| AST-012  | File extension mappings                       | `ast.test.ts`                 | Automated|
| AST-013  | TS: detects `any` type                        | `ast.test.ts`                 | Automated|
| AST-014  | TS: detects `eval()`                          | `ast.test.ts`                 | Automated|
| AST-015  | TS: detects `console.log()`                   | `ast.test.ts`                 | Automated|
| AST-016  | TS: detects `debugger`                        | `ast.test.ts`                 | Automated|
| AST-017  | TS: clean code returns no matches             | `ast.test.ts`                 | Automated|
| AST-018  | TS: detects `var` declaration                 | `ast.test.ts`                 | Automated|
| AST-019  | Python: detects `eval()`                      | `ast.test.ts`                 | Automated|
| AST-020  | Python: detects `print()`                     | `ast.test.ts`                 | Automated|
| AST-021  | Python: detects mutable default argument      | `ast.test.ts`                 | Automated|
| AST-022  | Java: detects `@Autowired` field injection    | `ast.test.ts`                 | Automated|
| AST-023  | Go: detects `fmt.Println`                     | `ast.test.ts`                 | Automated|
| AST-024  | Rust: detects `unwrap()`                      | `ast.test.ts`                 | Automated|
| AST-025  | Rust: detects `todo!()`                       | `ast.test.ts`                 | Automated|
| AST-026  | analyzeWithBuiltins runs all builtins         | `ast.test.ts`                 | Automated|
| AST-027  | analyzeWithBuiltins with specific IDs         | `ast.test.ts`                 | Automated|
| AST-028  | Reports parse time and query time             | `ast.test.ts`                 | Automated|
| AST-029  | ASTMatcher instantiation and name             | `ast.test.ts`                 | Automated|
| AST-030  | ASTMatcher returns NOT_COVERED for plain text | `ast.test.ts`                 | Automated|

### 2.3 Gateway (`packages/gateway`)

| ID       | Test Case                                    | File                          | Status   |
|----------|----------------------------------------------|-------------------------------|----------|
| GW-001   | Pre-request injects rules into OpenAI format  | `gateway.test.ts`             | Automated|
| GW-002   | Pre-request injects rules into Anthropic format| `gateway.test.ts`            | Automated|
| GW-003   | Pre-request preserves existing system prompts | `gateway.test.ts`             | Automated|
| GW-004   | Post-response extracts code blocks            | `gateway.test.ts`             | Automated|
| GW-005   | Post-response detects violations in code      | `gateway.test.ts`             | Automated|
| GW-006   | Post-response passes clean code               | `gateway.test.ts`             | Automated|
| GW-007   | Stream scanner buffers SSE chunks             | `gateway.test.ts`             | Automated|
| GW-008   | Stream scanner detects code in streamed data  | `gateway.test.ts`             | Automated|
| GW-009   | Rule cache loads from server                  | `gateway.test.ts`             | Automated|
| GW-010   | Rule cache respects TTL                       | `gateway.test.ts`             | Automated|
| GW-011   | Config loads from environment variables       | `gateway.test.ts`             | Automated|
| GW-012   | Proxy forwards request to target LLM          | `gateway.test.ts`             | Automated|
| GW-013   | Enforcement mode: strict blocks, advisory warns| `gateway.test.ts`            | Automated|

### 2.4 Server — Notifications (`packages/server`)

| ID       | Test Case                                    | File                          | Status   |
|----------|----------------------------------------------|-------------------------------|----------|
| SRV-001  | NotificationManager dispatches to matching    | `notifications.test.ts`       | Automated|
| SRV-002  | Disabled providers are skipped                | `notifications.test.ts`       | Automated|
| SRV-003  | All 4 provider types can be added             | `notifications.test.ts`       | Automated|
| SRV-004  | violationNotification builds correct payload  | `notifications.test.ts`       | Automated|
| SRV-005  | scoreChangedNotification detects drop         | `notifications.test.ts`       | Automated|
| SRV-006  | scoreChangedNotification detects improvement  | `notifications.test.ts`       | Automated|
| SRV-007  | scoreChangedNotification critical drop        | `notifications.test.ts`       | Automated|
| SRV-008  | ruleUpdatedNotification builds correct payload| `notifications.test.ts`       | Automated|

### 2.5 CLI (`packages/cli`)

| ID       | Test Case                                    | File                          | Status   |
|----------|----------------------------------------------|-------------------------------|----------|
| CLI-001  | Keyword matcher types                         | `types.test.ts`               | Automated|
| CLI-002  | Enforcement logic (block/warn)                | `enforcement.test.ts`         | Automated|
| CLI-003  | Agent coordinator delegation                  | `coordinator.test.ts`         | Automated|
| CLI-004  | Local rules loading                           | `local-rules.test.ts`         | Automated|
| CLI-005  | Agent registry management                     | `registry.test.ts`            | Automated|
| CLI-006  | Semantic matcher cosine similarity            | `semantic.test.ts`            | Automated|
| CLI-007  | Pipeline merge results                        | `pipeline.test.ts`            | Automated|
| CLI-008  | Keyword matcher patterns                      | `keyword.test.ts`             | Automated|
| CLI-009  | Integration: full pipeline validation         | `integration.test.ts`         | Automated|
| CLI-010  | CI command output formats                     | `ci.test.ts`                  | Automated|
| CLI-011  | LLM matcher fallback                          | `llm.test.ts`                 | Automated|

---

## 3. Integration Tests

### 3.1 Engine + CLI Integration

| ID       | Scenario                                     | Steps                         | Expected Result    |
|----------|----------------------------------------------|-------------------------------|--------------------|
| INT-001  | Engine validate() through CLI validate        | 1. Create temp rules dir<br>2. Write rule MD file<br>3. Run `rulebound validate --plan "use eval()" --dir <dir>` | Exit code 1, VIOLATED in output |
| INT-002  | AST check-code via CLI                        | 1. Create TS file with `any`<br>2. Run `rulebound check-code --file <file>` | Detects ts-no-any, exit 1 |
| INT-003  | Rule inheritance chain                        | 1. Create parent rules dir<br>2. Create child with config extends<br>3. Run `rulebound rules list` | Shows merged rules |
| INT-004  | Diff validation against rules                 | 1. Init git repo<br>2. Add rule<br>3. Commit code with violation<br>4. `rulebound diff` | Detects violation |

### 3.2 Server API Integration

| ID       | Scenario                                     | Steps                         | Expected Result    |
|----------|----------------------------------------------|-------------------------------|--------------------|
| INT-005  | POST /v1/validate returns report              | 1. Start server<br>2. POST code + rules<br>3. Check response | `{ status, results, summary }` |
| INT-006  | Rules CRUD lifecycle                          | 1. POST rule<br>2. GET rule<br>3. PUT update<br>4. GET verify version++ | Version incremented |
| INT-007  | Webhook outbound delivery                     | 1. Register endpoint<br>2. Trigger event<br>3. Check delivery log | delivery.status = "delivered" |
| INT-008  | Webhook inbound (GitHub push)                 | 1. POST to /v1/webhooks/in with GitHub signature<br>2. Check audit log | Event parsed & logged |

### 3.3 Gateway Integration

| ID       | Scenario                                     | Steps                         | Expected Result    |
|----------|----------------------------------------------|-------------------------------|--------------------|
| INT-009  | OpenAI proxy with rule injection              | 1. Set OPENAI_API_BASE to gateway<br>2. Send chat completion<br>3. Inspect forwarded request | System prompt contains rules |
| INT-010  | Response scanning blocks in strict mode       | 1. Configure strict mode<br>2. LLM returns code with eval()<br>3. Check response | 422 with violation details |
| INT-011  | Advisory mode appends warning                 | 1. Configure advisory<br>2. LLM returns code with eval()<br>3. Check response | Response includes warning block |

---

## 4. E2E Test Scenarios

### E2E-001: Full Validation Flow

```
Precondition: Project with .rulebound/rules/ containing no-hardcoded-secrets.md
Steps:
  1. Developer writes plan: "I will store the API key as a constant in config.ts"
  2. Run: rulebound validate --plan "<plan>"
  3. Verify: status = FAILED, violation = "hardcoded secrets"
  4. Run: rulebound check-code --file config.ts (with hardcoded key)
  5. Verify: AST detects literal string pattern
  6. Fix code to use process.env
  7. Re-run validate
  8. Verify: status = PASSED
Expected: Violations caught, clean code passes
```

### E2E-002: CI Pipeline Flow

```
Precondition: Git repo with rules, GitHub Actions configured
Steps:
  1. Create branch, add code with console.log
  2. Run: rulebound ci --base main --format github
  3. Verify: GitHub annotation format output
  4. Verify: exit code 1 for MUST violations, 0 for clean
  5. Fix violations, re-run
  6. Verify: exit code 0
Expected: CI blocks bad code, passes clean code
```

### E2E-003: Gateway Intercept Flow

```
Precondition: Gateway running, rules loaded, OpenAI key set
Steps:
  1. Configure app: OPENAI_API_BASE=http://localhost:4000/openai/v1
  2. Send chat completion: "Write a function that uses eval"
  3. Gateway injects rules into system prompt
  4. LLM responds with code
  5. Gateway scans response for code blocks
  6. If violation: advisory mode appends warning to response
  7. Verify audit log has entry
Expected: Rules injected, response scanned, audit logged
```

### E2E-004: Webhook + Notification Flow

```
Precondition: Server running, Slack webhook configured
Steps:
  1. Register Slack webhook endpoint via POST /v1/webhooks/endpoints
  2. Trigger violation via POST /v1/validate with bad code
  3. Server dispatches webhook to Slack
  4. Verify delivery log: status = delivered, response_code = 200
  5. Verify Slack receives Block Kit message with violation details
Expected: Real-time notification on violation
```

### E2E-005: SDK Validate Flow

```
Precondition: Server running on localhost:3001
Steps (repeat for each SDK: Python, Go, TS, Java, C#, Rust):
  1. Initialize client with base_url and api_key
  2. Call validate(code, rules)
  3. Verify response has status, results, summary
  4. Call get_rules()
  5. Verify returns array of rule objects
  6. Call get_compliance(project_id)
  7. Verify returns score + breakdown
Expected: All 6 SDKs return identical response shapes
```

### E2E-006: Multi-Language AST Analysis

```
Steps:
  1. Create test files with known anti-patterns for each language:
     - TypeScript: any, eval, console.log, debugger, empty catch, var
     - Python: eval, exec, print, bare except, pass in except, mutable default, star import
     - Java: @Autowired field, System.out.println, Thread.sleep, catch Throwable, empty catch
     - Go: fmt.Println, panic, unchecked error
     - Rust: unwrap, expect, println!, todo!
  2. Run: rulebound check-code --file <file> for each
  3. Verify: correct number of findings per file
  4. Verify: severity levels match (error/warning/info)
  5. Verify: line numbers accurate
  6. Verify: suggested fixes present where defined
Expected:
  - TS: 10 findings (5 error, 5 warning)
  - Python: 7 findings (5 error, 2 warning)
  - Java: 5 findings (3 error, 2 warning)
  - Go: 6 findings (4 error, 2 warning)
  - Rust: 5 findings (1 error, 3 warning, 1 info)
```

---

## 5. Smoke Tests

Run these after every build to ensure basic functionality.

```bash
#!/bin/bash
# smoke-test.sh

set -e
echo "=== Rulebound Smoke Tests ==="

# 1. Build
echo "[1/8] Building all packages..."
pnpm build

# 2. CLI help
echo "[2/8] CLI help..."
node packages/cli/dist/index.js --help | grep -q "check-code"

# 3. CLI commands exist
echo "[3/8] All CLI commands..."
for cmd in init find-rules validate generate diff score hook enforce ci review rules check-code; do
  node packages/cli/dist/index.js $cmd --help > /dev/null 2>&1
done

# 4. AST check-code (TypeScript)
echo "[4/8] AST: TypeScript..."
echo 'const x: any = 5; eval("code");' > /tmp/rb-smoke-ts.ts
node packages/cli/dist/index.js check-code --file /tmp/rb-smoke-ts.ts 2>&1 | grep -q "ts-no-any"

# 5. AST check-code (Python)
echo "[5/8] AST: Python..."
echo 'eval("code")' > /tmp/rb-smoke-py.py
node packages/cli/dist/index.js check-code --file /tmp/rb-smoke-py.py 2>&1 | grep -q "py-no-eval"

# 6. AST check-code (Java)
echo "[6/8] AST: Java..."
cat > /tmp/rb-smoke-java.java << 'EOF'
public class Test {
  public void run() { System.out.println("hi"); }
}
EOF
node packages/cli/dist/index.js check-code --file /tmp/rb-smoke-java.java 2>&1 | grep -q "java-system-out"

# 7. AST check-code (Go)
echo "[7/8] AST: Go..."
cat > /tmp/rb-smoke-go.go << 'EOF'
package main
import "fmt"
func main() { fmt.Println("hi") }
EOF
node packages/cli/dist/index.js check-code --file /tmp/rb-smoke-go.go 2>&1 | grep -q "go-fmt-println"

# 8. AST check-code (Rust)
echo "[8/8] AST: Rust..."
echo 'fn main() { todo!(); }' > /tmp/rb-smoke-rs.rs
node packages/cli/dist/index.js check-code --file /tmp/rb-smoke-rs.rs 2>&1 | grep -q "rust-todo"

echo ""
echo "=== All smoke tests passed ==="
```

### Quick Smoke Checklist (Manual)

| #  | Check                                      | Command / Action           | Pass |
|----|--------------------------------------------|----------------------------|------|
| S1 | `pnpm build` succeeds (6 packages)         | `pnpm build`               | [ ]  |
| S2 | 112 tests pass                             | Run vitest in each package | [ ]  |
| S3 | CLI `--help` shows 14 commands             | `rulebound --help`         | [ ]  |
| S4 | `check-code` detects TS `any`              | See smoke script           | [ ]  |
| S5 | `check-code` detects Python `eval`         | See smoke script           | [ ]  |
| S6 | `check-code` detects Java `@Autowired`     | See smoke script           | [ ]  |
| S7 | `check-code` detects Go `fmt.Println`      | See smoke script           | [ ]  |
| S8 | `check-code` detects Rust `todo!()`        | See smoke script           | [ ]  |
| S9 | `check-code --queries` filters correctly   | `--queries ts-no-eval`     | [ ]  |
| S10| Web dashboard builds (`next build`)        | `pnpm --filter web build`  | [ ]  |

---

## 6. UI Tests (Manual)

### 6.1 Marketing / Landing Page

| #   | Page / Component      | Check                                           | Pass |
|-----|-----------------------|-------------------------------------------------|------|
| U01 | Hero                  | Title, subtitle, CTA buttons visible             | [ ]  |
| U02 | Hero                  | Terminal demo animates cursor blink              | [ ]  |
| U03 | Hero                  | "Works with" badges: Claude Code, Cursor, Copilot| [ ]  |
| U04 | Problem               | Section renders with correct icon grid           | [ ]  |
| U05 | How It Works          | 4 steps with terminal blocks                     | [ ]  |
| U06 | Architecture Flow     | Animated flow diagram visible                    | [ ]  |
| U07 | Architecture Flow     | Boxes fade in sequentially on scroll             | [ ]  |
| U08 | Architecture Flow     | Dashed lines animate between boxes               | [ ]  |
| U09 | Architecture Flow     | Responsive: vertical on mobile, horizontal desktop| [ ]  |
| U10 | Architecture Flow     | prefers-reduced-motion: no animations            | [ ]  |
| U11 | Comparison            | Before/After comparison table                    | [ ]  |
| U12 | Features              | 20 feature cards with icons                      | [ ]  |
| U13 | Features              | Enterprise features present (Gateway, SDK, etc.) | [ ]  |
| U14 | Open Source           | GitHub link and MIT badge                        | [ ]  |
| U15 | CTA                   | Call to action section with buttons              | [ ]  |
| U16 | Footer                | Links, copyright visible                         | [ ]  |

### 6.2 Dashboard Pages

| #   | Page                  | Check                                           | Pass |
|-----|-----------------------|-------------------------------------------------|------|
| U20 | /dashboard            | Compliance score ring renders                    | [ ]  |
| U21 | /dashboard            | 4 stat cards with numbers                        | [ ]  |
| U22 | /dashboard            | Top violated rules list                          | [ ]  |
| U23 | /dashboard            | Recent activity feed                             | [ ]  |
| U24 | /audit                | Audit log table renders                          | [ ]  |
| U25 | /audit                | Filter by action/project/date works              | [ ]  |
| U26 | /compliance           | Sparkline trend charts                           | [ ]  |
| U27 | /compliance           | Progress bars per project                        | [ ]  |
| U28 | /webhooks             | Endpoint cards render                            | [ ]  |
| U29 | /webhooks             | Delivery history table                           | [ ]  |
| U30 | Sidebar               | All 8+ nav items visible                         | [ ]  |
| U31 | Sidebar               | Active state highlights correctly                | [ ]  |

### 6.3 Cross-Cutting

| #   | Check                                                     | Pass |
|-----|-----------------------------------------------------------|------|
| U40 | Dark mode toggle works on all pages                        | [ ]  |
| U41 | Fonts load: JetBrains Mono (headings), IBM Plex Sans (body)| [ ]  |
| U42 | No emoji in UI — all icons are Lucide SVGs                 | [ ]  |
| U43 | All clickable elements have cursor-pointer                 | [ ]  |
| U44 | Hover transitions 150-300ms, no layout shift               | [ ]  |
| U45 | Mobile responsive (320px, 375px, 768px, 1024px, 1440px)   | [ ]  |
| U46 | WCAG AA contrast ratios met (4.5:1 text)                   | [ ]  |
| U47 | Keyboard navigation works (Tab, Enter, Escape)             | [ ]  |
| U48 | Focus states visible on all interactive elements           | [ ]  |

---

## 7. Performance Tests

| #   | Test                                      | Threshold      | How to Measure              |
|-----|-------------------------------------------|----------------|-----------------------------|
| P01 | AST parse TypeScript (1000 lines)         | < 50ms         | `analyzeCode()` parseTimeMs |
| P02 | AST query TypeScript (10 queries)         | < 30ms         | `analyzeCode()` queryTimeMs |
| P03 | Engine validate (20 rules, 2000 char plan)| < 100ms        | `validate()` timing         |
| P04 | CLI cold start                            | < 500ms        | `time rulebound --help`     |
| P05 | `check-code` full scan (500 line file)    | < 200ms        | `time rulebound check-code` |
| P06 | `pnpm build` all packages                | < 5s           | Turborepo output            |
| P07 | WASM grammar load (first call)            | < 100ms        | parseTimeMs on first run    |
| P08 | WASM grammar load (cached)                | < 5ms          | parseTimeMs on second run   |

---

## 8. Security Tests

| #   | Test                                              | Severity | Pass |
|-----|---------------------------------------------------|----------|------|
| SEC-001 | No secrets in git history                     | Critical | [ ]  |
| SEC-002 | Webhook HMAC-SHA256 signature verification    | High     | [ ]  |
| SEC-003 | API token hashing (not stored in plaintext)   | High     | [ ]  |
| SEC-004 | Inbound webhook rejects invalid signatures    | High     | [ ]  |
| SEC-005 | SQL injection resistant (Drizzle parameterized)| High    | [ ]  |
| SEC-006 | No eval/exec in production code               | Medium   | [ ]  |
| SEC-007 | Environment variables for all secrets          | Medium   | [ ]  |
| SEC-008 | Rate limiting on API endpoints                | Medium   | [ ]  |
| SEC-009 | CORS configuration on server                  | Low      | [ ]  |

---

## 9. Regression Checklist

Run before every release. All items must pass.

| #  | Area                | Check                                           | Pass |
|----|---------------------|-------------------------------------------------|------|
| R1 | Build               | `pnpm build` — 6 packages, 0 errors             | [ ]  |
| R2 | Tests               | 112 tests pass (52+13+8+39)                      | [ ]  |
| R3 | CLI init            | `rulebound init --examples` creates dir + rules  | [ ]  |
| R4 | CLI find-rules      | Returns rules matching task context              | [ ]  |
| R5 | CLI validate        | Detects violations and passes clean plans        | [ ]  |
| R6 | CLI generate        | Creates CLAUDE.md, .cursor/rules.md, copilot-*   | [ ]  |
| R7 | CLI diff            | Validates git changes against rules              | [ ]  |
| R8 | CLI score           | Calculates 0-100 score                           | [ ]  |
| R9 | CLI hook            | Installs pre-commit hook                         | [ ]  |
| R10| CLI enforce         | Modes: advisory/moderate/strict                  | [ ]  |
| R11| CLI ci              | Outputs pretty/json/github format                | [ ]  |
| R12| CLI review          | Multi-agent consensus                            | [ ]  |
| R13| CLI check-code      | AST analysis for TS/PY/Java/Go/Rust              | [ ]  |
| R14| CLI rules           | list, show, lint, history subcommands            | [ ]  |
| R15| MCP server          | 4 tools: find_rules, validate_plan, check_code, list_rules | [ ] |
| R16| Engine exports      | All public APIs importable                       | [ ]  |
| R17| Gateway exports     | All public APIs importable                       | [ ]  |
| R18| Server exports      | All public APIs importable                       | [ ]  |
| R19| Web build           | `next build` succeeds                            | [ ]  |
| R20| Landing page        | All 7 sections render                            | [ ]  |
| R21| Dashboard           | 4 new pages render                               | [ ]  |

---

## Test Execution Summary

| Package  | Unit | Integration | Total | Framework |
|----------|------|-------------|-------|-----------|
| Engine   | 52   | 4           | 56    | Vitest    |
| Gateway  | 13   | 3           | 16    | Vitest    |
| Server   | 8    | 4           | 12    | Vitest    |
| CLI      | 39   | —           | 39    | Vitest    |
| Web      | —    | —           | —     | Manual    |
| **Total**| **112** | **11**   | **123**|           |

**Automated:** 112 tests
**Manual UI:** 30 checks
**E2E Scenarios:** 6 flows
**Smoke:** 10 checks
