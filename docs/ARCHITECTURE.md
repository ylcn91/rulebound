# Rulebound Architecture

**Version:** 1.1
**Date:** 2026-03-04

---

## System Overview

Rulebound is a monorepo-based platform for enforcing coding rules when AI agents generate code. It consists of 8 packages plus a web dashboard.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RULEBOUND MONOREPO                           │
│                    (Turborepo + pnpm workspaces)                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   @rulebound  │  │   @rulebound  │  │   @rulebound  │             │
│  │    /engine    │  │    /server   │  │   /gateway   │             │
│  │  (core lib)   │  │  (HTTP API)  │  │  (LLM proxy) │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                  │                      │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐             │
│  │   @rulebound  │  │   @rulebound  │  │   @rulebound  │             │
│  │     /cli      │  │     /mcp     │  │     /web     │             │
│  │  (terminal)   │  │ (AI protocol)│  │ (dashboard)  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐                               │
│  │   @rulebound  │  │   @rulebound  │                               │
│  │     /lsp      │  │    /shared   │                               │
│  │ (IDE server)  │  │ (types/log)  │                               │
│  └──────────────┘  └──────────────┘                               │
│                                                                     │
│  ┌────────────────────────────────────────────────────┐            │
│  │              SDKs (6 languages)                     │            │
│  │  Python · Go · TypeScript · Java · C#/.NET · Rust   │            │
│  └────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Package Dependency Graph

```
                    ┌──────────┐
                    │  engine  │  (zero runtime deps)
                    └────┬─────┘
                         │ imported by
       ┌─────────────────┼─────────────────┐
       │            │    │    │             │
  ┌────▼───┐  ┌────▼──┐ │ ┌──▼────┐  ┌────▼────┐
  │  cli   │  │  mcp  │ │ │  lsp  │  │ gateway │
  └────────┘  └───────┘ │ └───────┘  └────┬────┘
                         │                 │ calls
                    ┌────▼────┐       ┌────▼────┐
                    │ shared  │       │ server  │
                    │(types)  │       └────┬────┘
                    └─────────┘            │ serves
                                      ┌────▼────┐
                                      │   web   │
                                      └─────────┘
```

---

## Data Flow

### How AI Code Gets Validated

```
  Developer          AI Tool           Gateway            LLM API
     │                  │                 │                  │
     │  "Add auth"      │                 │                  │
     ├─────────────────►│                 │                  │
     │                  │  API request    │                  │
     │                  ├────────────────►│                  │
     │                  │                 │                  │
     │                  │    ┌────────────┤                  │
     │                  │    │ 1. Load    │                  │
     │                  │    │    rules   │                  │
     │                  │    │ 2. Inject  │                  │
     │                  │    │    into    │                  │
     │                  │    │    system  │                  │
     │                  │    │    prompt  │                  │
     │                  │    └────────────┤                  │
     │                  │                 │  Augmented req   │
     │                  │                 ├─────────────────►│
     │                  │                 │                  │
     │                  │                 │  LLM response    │
     │                  │                 │◄─────────────────┤
     │                  │    ┌────────────┤                  │
     │                  │    │ 3. Scan    │                  │
     │                  │    │    code    │                  │
     │                  │    │    blocks  │                  │
     │                  │    │ 4. Run     │                  │
     │                  │    │    engine  │                  │
     │                  │    │ 5. Audit   │                  │
     │                  │    │    log     │                  │
     │                  │    └────────────┤                  │
     │                  │  Response       │                  │
     │                  │◄────────────────┤                  │
     │  Code + warnings │                 │                  │
     │◄─────────────────┤                 │                  │
     │                  │                 │                  │

  ┌──────────────────────────────────────────────────────────────┐
  │  Advisory mode:  Appends warning to response                 │
  │  Moderate mode:  Blocks if MUST violation + low score        │
  │  Strict mode:    Blocks on any violation (HTTP 422)          │
  └──────────────────────────────────────────────────────────────┘
```

---

## Engine Architecture

The core validation engine uses a 4-layer pipeline.

```
                    ┌─────────────────┐
                    │   Source Input   │
                    │  (plan / code)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Rule Loader   │
                    │                 │
                    │ • Parse YAML    │
                    │ • Stack detect  │
                    │ • Inheritance   │
                    │ • Context match │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │     Validation Pipeline      │
              │                              │
              │  Layer 1: Keyword Matcher    │
              │  ┌────────────────────────┐  │
              │  │ Prohibition detection  │  │
              │  │ Negation context       │  │
              │  │ Compliance indicators  │  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  Layer 2: Semantic Matcher   │
              │  ┌────────────────────────┐  │
              │  │ TF-IDF vectorization   │  │
              │  │ Cosine similarity      │  │
              │  │ Threshold: 0.3         │  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  Layer 3: LLM Matcher       │
              │  ┌────────────────────────┐  │
              │  │ Anthropic / OpenAI     │  │
              │  │ Structured output      │  │
              │  │ Optional (--llm flag)  │  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  Layer 4: AST Matcher       │
              │  ┌────────────────────────┐  │
              │  │ web-tree-sitter WASM   │  │
              │  │ 36 built-in queries    │  │
              │  │ 10 languages           │  │
              │  │ Structural matching    │  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  ┌───────────▼────────────┐  │
              │  │ Result Merger          │  │
              │  │ Higher confidence wins │  │
              │  │ Later layer overrides  │  │
              │  └───────────┬────────────┘  │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │   Enforcement   │
                    │                 │
                    │ • Score calc    │
                    │ • Block check   │
                    │ • Mode routing  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ ValidationReport│
                    │                 │
                    │ status: PASSED  │
                    │    PASSED_WARN  │
                    │    FAILED       │
                    └─────────────────┘
```

### AST Analysis Detail

```
  Source File (.ts/.py/.java/.go/.rs)
        │
        ▼
  ┌─────────────┐    ┌──────────────────┐
  │ tree-sitter  │◄───│ Language WASM    │
  │ WASM Parser  │    │ (tree-sitter-    │
  │              │    │  wasms package)  │
  └──────┬──────┘    └──────────────────┘
         │
         ▼
  ┌─────────────┐
  │ Parse Tree   │  (AST nodes with positions)
  └──────┬──────┘
         │
         ▼
  ┌──────────────────┐
  │ Query Engine     │
  │                  │
  │ For each query:  │
  │  1. S-expression │
  │     pattern      │
  │     matching     │
  │  2. Capture      │
  │     filter       │
  │     evaluation   │
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │ ASTMatch[]       │
  │                  │
  │ • queryId        │
  │ • location       │
  │ • severity       │
  │ • matchedText    │
  │ • suggestedFix   │
  └──────────────────┘

  Supported Languages:
  ┌────────────┬──────────────────────┬─────────┐
  │ Language   │ WASM File            │ Queries │
  ├────────────┼──────────────────────┼─────────┤
  │ TypeScript │ tree-sitter-ts.wasm  │ 10      │
  │ JavaScript │ tree-sitter-js.wasm  │ 7       │
  │ Python     │ tree-sitter-py.wasm  │ 7       │
  │ Java       │ tree-sitter-java.wasm│ 5       │
  │ Go         │ tree-sitter-go.wasm  │ 3       │
  │ Rust       │ tree-sitter-rust.wasm│ 4       │
  │ C#         │ tree-sitter-cs.wasm  │ —       │
  │ C++        │ tree-sitter-cpp.wasm │ —       │
  │ Ruby       │ tree-sitter-rb.wasm  │ —       │
  │ Bash       │ tree-sitter-bash.wasm│ —       │
  └────────────┴──────────────────────┴─────────┘
```

---

## Server Architecture

```
  ┌─────────────────────────────────────────────────────┐
  │                  @rulebound/server                   │
  │                  (Hono HTTP API)                     │
  │                                                     │
  │  Middleware                                          │
  │  ┌─────────────────────────────────────────────┐   │
  │  │ Auth: Bearer token / API key hash verify    │   │
  │  └─────────────────────────────────────────────┘   │
  │                                                     │
  │  API Routes                                         │
  │  ┌────────────────┬────────────────────────────┐   │
  │  │ POST /validate │ Real-time code validation  │   │
  │  │ GET  /rules    │ List rules (with versions) │   │
  │  │ POST /rules    │ Create rule                │   │
  │  │ PUT  /rules/:id│ Update rule (version++)    │   │
  │  │ GET  /sync     │ Pull latest rules          │   │
  │  │ POST /sync/ack │ Acknowledge sync           │   │
  │  │ GET  /audit    │ Query audit log            │   │
  │  │ GET  /compliance/:id │ Score + trend        │   │
  │  │ POST /tokens   │ Create API token           │   │
  │  │ POST /webhooks/endpoints │ Register hook    │   │
  │  │ POST /webhooks/in │ Inbound (GitHub/GitLab) │   │
  │  └────────────────┴────────────────────────────┘   │
  │                                                     │
  │  Database (PostgreSQL + Drizzle ORM)                │
  │  ┌─────────────────────────────────────────────┐   │
  │  │ rules          │ audit_log                   │   │
  │  │ api_tokens     │ webhook_endpoints           │   │
  │  │ projects       │ webhook_deliveries          │   │
  │  │ organizations  │ compliance_snapshots        │   │
  │  │                │ rule_sync_state             │   │
  │  └─────────────────────────────────────────────┘   │
  │                                                     │
  │  Webhooks (Bidirectional)                           │
  │  ┌─────────────────────────────────────────────┐   │
  │  │ Outbound: HMAC-SHA256, 3x retry, exp backoff│   │
  │  │ Inbound:  GitHub/GitLab signature verify     │   │
  │  └─────────────────────────────────────────────┘   │
  │                                                     │
  │  Notifications                                      │
  │  ┌────────┬────────┬─────────┬──────────────┐     │
  │  │ Slack  │ Teams  │ Discord │  PagerDuty   │     │
  │  │ Block  │ Message│ Embed   │  Events v2   │     │
  │  │ Kit    │ Card   │         │              │     │
  │  └────────┴────────┴─────────┴──────────────┘     │
  └─────────────────────────────────────────────────────┘
```

---

## Gateway Architecture

```
  ┌──────────────────────────────────────────────────────────┐
  │                    @rulebound/gateway                      │
  │                    (LLM Transparent Proxy)                 │
  │                                                            │
  │  ┌──────────────────┐                                     │
  │  │  Incoming Request │  (from Cursor / Claude Code / etc) │
  │  └────────┬─────────┘                                     │
  │           │                                                │
  │  ┌────────▼─────────┐                                     │
  │  │  Pre-Request      │                                     │
  │  │  Interceptor      │                                     │
  │  │                   │                                     │
  │  │  • Load rules     │◄──── Rule Cache (60s TTL)          │
  │  │    from server    │                                     │
  │  │  • Inject into    │                                     │
  │  │    system prompt  │                                     │
  │  │  • OpenAI format  │                                     │
  │  │  • Anthropic fmt  │                                     │
  │  └────────┬─────────┘                                     │
  │           │                                                │
  │  ┌────────▼─────────┐        ┌──────────────┐            │
  │  │  HTTP Proxy       │───────►│  LLM API     │            │
  │  │  (forward)        │◄───────│  (OpenAI /   │            │
  │  └────────┬─────────┘        │   Anthropic / │            │
  │           │                   │   Google)     │            │
  │           │                   └──────────────┘            │
  │  ┌────────▼──────────────┐                                │
  │  │  Post-Response         │                                │
  │  │  Interceptor           │                                │
  │  │                        │                                │
  │  │  Regular response:     │                                │
  │  │  • Extract code blocks │                                │
  │  │  • AST scan code blocks│                                │
  │  │  • Run engine.validate │                                │
  │  │  • Append warnings     │                                │
  │  │                        │                                │
  │  │  SSE stream:           │                                │
  │  │  • Buffer chunks       │                                │
  │  │  • Detect code fences  │                                │
  │  │  • AST scan on close   │                                │
  │  │  • Scan on complete    │                                │
  │  └────────┬──────────────┘                                │
  │           │                                                │
  │  ┌────────▼─────────┐                                     │
  │  │  Audit + Notify   │                                     │
  │  │  • Log to server  │                                     │
  │  │  • Trigger webhook│                                     │
  │  └──────────────────┘                                     │
  └──────────────────────────────────────────────────────────┘
```

---

## CLI Architecture

```
  rulebound <command> [options]
       │
       ├── init              Create .rulebound/ directory
       ├── find-rules        Search rules by task context
       ├── validate          Validate plan against rules
       ├── generate          Create CLAUDE.md / .cursor/rules.md / copilot-*
       ├── diff              Validate git diff
       ├── score             Calculate compliance score (0-100)
       ├── hook              Install/remove pre-commit hook
       ├── enforce           Set enforcement mode
       ├── ci                CI/CD pipeline validation
       ├── review            Multi-agent review with consensus
       ├── check-code        AST-based code analysis (tree-sitter)
       ├── watch             Real-time file monitoring (debounced)
       ├── agents list       List agent profiles
       └── rules
            ├── list          List all rules
            ├── show <id>     Show rule detail
            ├── lint          Quality scoring
            └── history <id>  Git-based version history
```

---

## Notification Flow

```
  Violation Event
       │
       ▼
  ┌────────────────────┐
  │ NotificationManager│
  │                    │
  │ Event routing:     │
  │ violation.detected │──┐
  │ compliance.changed │──┤
  │ rule.updated       │──┤
  │ * (wildcard)       │──┤
  └────────────────────┘  │
                          │
       ┌──────────────────┤
       │                  │
  ┌────▼─────┐   ┌───────▼────┐   ┌─────────┐   ┌──────────┐
  │  Slack   │   │  MS Teams  │   │ Discord │   │PagerDuty │
  │          │   │            │   │         │   │          │
  │ Block Kit│   │ MessageCard│   │ Embed   │   │Events v2 │
  │ webhook  │   │ webhook    │   │ webhook │   │ /enqueue │
  └──────────┘   └────────────┘   └─────────┘   └──────────┘

  Severity Mapping:
  ┌──────────┬────────┬──────────┬────────────┐
  │ Internal │ Slack  │ Discord  │ PagerDuty  │
  ├──────────┼────────┼──────────┼────────────┤
  │ error    │ :red:  │ #ED4245  │ critical   │
  │ warning  │ :warn: │ #FEE75C  │ warning    │
  │ info     │ :info: │ #5865F2  │ info       │
  └──────────┴────────┴──────────┴────────────┘
```

---

## Database Schema (ER Diagram)

```
  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
  │ organizations│     │    projects       │     │     rules        │
  ├──────────────┤     ├──────────────────┤     ├──────────────────┤
  │ id (PK)      │◄────│ org_id (FK)      │     │ id (PK)          │
  │ name         │     │ id (PK)          │◄────│ project_id (FK)  │
  │ created_at   │     │ name             │     │ title            │
  └──────────────┘     │ stack            │     │ content          │
                       └──────────────────┘     │ category         │
                                                │ severity         │
  ┌──────────────────┐                          │ modality         │
  │   audit_log      │                          │ version          │
  ├──────────────────┤                          └──────────────────┘
  │ id (PK)          │
  │ org_id (FK)      │     ┌──────────────────────┐
  │ project_id (FK)  │     │ webhook_endpoints    │
  │ action           │     ├──────────────────────┤
  │ rule_id          │     │ id (PK)              │
  │ status           │     │ org_id (FK)          │
  │ metadata (JSON)  │     │ url                  │
  │ created_at       │     │ secret               │
  │ INDEX(org,date)  │     │ events[]             │
  └──────────────────┘     │ is_active            │
                           └───────┬──────────────┘
  ┌──────────────────────┐         │
  │ compliance_snapshots │         │
  ├──────────────────────┤  ┌──────▼──────────────┐
  │ id (PK)              │  │ webhook_deliveries  │
  │ project_id (FK)      │  ├─────────────────────┤
  │ score                │  │ id (PK)             │
  │ rules_pass           │  │ endpoint_id (FK)    │
  │ rules_violated       │  │ event               │
  │ rules_not_covered    │  │ payload (JSON)      │
  │ snapshot_date        │  │ status              │
  │ INDEX(proj,date)     │  │ response_code       │
  └──────────────────────┘  │ attempts            │
                            └─────────────────────┘
  ┌──────────────────┐
  │ rule_sync_state  │
  ├──────────────────┤
  │ project_id (FK)  │
  │ version_hash     │
  │ last_synced_at   │
  └──────────────────┘
```

---

## Package Stats

| Package    | Files | Lines  | Tests | Dependencies                       |
|------------|-------|--------|-------|------------------------------------|
| engine     | 20    | ~3,100 | 68    | web-tree-sitter, tree-sitter-wasms |
| cli        | 46    | ~5,100 | 61    | commander, chalk, engine           |
| server     | 30    | ~3,300 | 57    | hono, drizzle                      |
| gateway    | 15    | ~1,500 | 58    | engine (AST scanner)               |
| mcp        | 6     | ~1,300 | 25    | @modelcontextprotocol/sdk          |
| lsp        | 5     | ~400   | 15    | vscode-languageserver, engine      |
| shared     | 2     | ~200   | --    | (types + logger)                   |
| web        | 44    | ~770   | 2     | next, react, drizzle               |
| SDKs (6)   | 8     | ~1,100 | 24    | language-native HTTP               |
| **Total**  |**176**|**~16,800**|**310**|                                |

---

## Technology Stack

| Layer         | Technology                                    |
|---------------|-----------------------------------------------|
| Runtime       | Node.js 22+, TypeScript 5.9 (strict mode)     |
| Build         | Turborepo, tsup, pnpm workspaces              |
| Web           | Next.js 16, React 19, Tailwind CSS 4          |
| UI            | Radix UI, Lucide Icons, JetBrains Mono + IBM Plex Sans |
| Database      | PostgreSQL 17, Drizzle ORM                    |
| AST Parsing   | web-tree-sitter 0.24.7 (WASM), tree-sitter-wasms, 36 queries |
| Server        | Hono (lightweight HTTP framework)             |
| LSP           | vscode-languageserver (IDE diagnostics)       |
| Auth          | Bearer tokens, HMAC-SHA256 webhook signatures |
| AI (optional) | Anthropic SDK, OpenAI SDK, Vercel AI SDK      |
| Testing       | Vitest 4 (310 tests across 30 test files)     |
