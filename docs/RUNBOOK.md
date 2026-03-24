# Rulebound PoC Runbook

**Tarih:** 2026-03-10
**Versiyon:** 0.1.0
**Ortam:** macOS, Node.js 22+, PostgreSQL 17, pnpm

Bu dokuman Rulebound platformunu sifirdan calistirip tum bilesenleri test eden adim adim bir rehberdir. Her adim gercek komutlar ve gercek ciktilarla dokumante edilmistir.

---

## Icindekiler

1. [Genel Mimari](#1-genel-mimari)
2. [Onkoşullar ve Kurulum](#2-onkosullar-ve-kurulum)
3. [Proje Kurallari](#3-proje-kurallari)
4. [CLI — Kural Listeleme ve Gosterim](#4-cli--kural-listeleme-ve-gosterim)
5. [CLI — Plan Validasyonu](#5-cli--plan-validasyonu)
6. [CLI — AST Kod Analizi](#6-cli--ast-kod-analizi)
7. [CLI — Skor ve Analitik](#7-cli--skor-ve-analitik)
8. [MCP Server — AI Agent Entegrasyonu](#8-mcp-server--ai-agent-entegrasyonu)
9. [API Server — CRUD Islemleri](#9-api-server--crud-islemleri)
10. [Web Dashboard — UI](#10-web-dashboard--ui)
11. [Gateway — LLM Proxy ve Kural Enjeksiyonu](#11-gateway--llm-proxy-ve-kural-enjeksiyonu)
12. [Testler](#12-testler)
13. [Ozet](#13-ozet)

---

## 1. Genel Mimari

Rulebound, AI kodlama ajanlarinin (Claude Code, Cursor, Codex, Copilot vb.) proje kurallarini zorunlu olarak takip etmesini saglar. Uc katmanli zorunluluk:

```
Developer (herhangi bir AI arac)
        │
        ▼
   ┌─────────────┐
   │ MCP Server  │  Agent seviyesinde kural kontrolu
   │ (7 tool)    │  Agent kod yazmadan ONCE kurallari kontrol eder
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  Gateway    │  LLM proxy, kural injection + response scanning
   │  (proxy)    │  Arac-agnostik: MCP desteklemese bile calisir
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  CLI / CI   │  Son kapi, merge oncesi kontrol
   │  (terminal) │  Pre-commit hook veya CI pipeline
   └─────────────┘
```

**Hangisinden kacsa digerinde yakalanir.**

### Paketler

| Paket | Port | Amac |
|-------|------|------|
| `packages/engine` | — | Cekirdek validasyon (4 katmanli pipeline: Keyword → Semantic → LLM → AST) |
| `packages/cli` | — | Terminal arayuzu (18+ komut) |
| `packages/mcp` | stdio | MCP sunucusu (7 tool, AI agent entegrasyonu) |
| `packages/gateway` | 4001 | LLM proxy (OpenAI/Anthropic/Google kural enjeksiyonu) |
| `packages/server` | 3001 | Enterprise API (Hono + PostgreSQL, CRUD, audit, webhook) |
| `apps/web` | 3000 | Web dashboard (Next.js 16 + React 19) |
| `packages/lsp` | — | IDE entegrasyonu (VS Code inline diagnostics) |

### Validasyon Pipeline (Engine)

```
Girdi (plan veya kod)
    ↓
Katman 1: Keyword Matcher — Yasak tespiti, negasyon kontrolu
    ↓
Katman 2: Semantic Matcher — TF-IDF, kosinus benzerlik (esik: 0.3)
    ↓
Katman 3: LLM Matcher — Anthropic/OpenAI (opsiyonel, --llm flag)
    ↓
Katman 4: AST Matcher — Tree-sitter WASM, 36 sorgu, 10+ dil
    ↓
Sonuc: PASS | VIOLATED | NOT_COVERED
```

---

## 2. Onkosullar ve Kurulum

### Gereksinimler

- Node.js 22+
- pnpm 10+
- PostgreSQL 17 (dashboard ve server icin)

### Build

```bash
pnpm install
pnpm build
```

Build ciktisi:
```
engine   → dist/index.js (70 KB)
cli      → dist/index.js (1.16 MB)
mcp      → dist/index.js (34 KB)
gateway  → dist/index.js (27 KB)
server   → dist/index.js (185 KB)
```

---

## 3. Proje Kurallari

Kurallar `.rulebound/rules/` altinda YAML frontmatter'li Markdown dosyalari olarak tanimlanir.

### Konfigurasyon (`.rulebound/config.json`)

```json
{
  "project": {
    "name": "rulebound",
    "stack": ["typescript", "react", "nextjs", "node"],
    "scope": ["fullstack"],
    "team": "platform"
  },
  "extends": [],
  "rulesDir": ".rulebound/rules"
}
```

### Tanimli Kurallar (15 adet)

```
.rulebound/rules/
├── architecture/
│   └── file-size-limit.md          (SHOULD) Dosyalar 400 satir altinda olmali
├── global/
│   ├── code-review-standards.md    (MUST)   PR standartlari
│   ├── error-handling.md           (MUST)   Yapilandirilmis hata yonetimi
│   ├── no-hardcoded-secrets.md     (MUST)   Kodda sir olmamali
│   └── testing-requirements.md     (MUST)   %80 test coverage
├── react/
│   └── server-components-default.md (MUST)  Server Components varsayilan
├── security/
│   ├── authentication-authorization.md (MUST) RBAC/ABAC zorunlu
│   └── input-sanitization.md       (MUST)   XSS/SQLi onleme
├── style/
│   ├── immutability.md             (MUST)   Mutasyon yasak
│   └── no-console-log.md          (MUST)   console.log yasak
├── typescript/
│   ├── no-any.md                   (MUST)   any tipi yasak
│   ├── strict-types.md            (MUST)   Strict typing
│   └── zod-validation.md          (MUST)   Zod ile input validasyonu
└── workflow/
    ├── branch-naming.md            (SHOULD) Branch isimlendirme
    └── git-author-identity.md     (MUST)   Git author korunmali
```

### Kural Formati Ornegi

```markdown
---
title: No Console Log in Production
category: style
severity: warning
modality: must
tags: [console, logging, debug, production]
stack: [typescript, javascript]
scope: [all]
---

# No Console Log in Production

Production code MUST NOT contain `console.log` statements.

## Rules
- Never commit `console.log` to production code
- Use a proper logger (winston, pino) for runtime logging
- `console.error` is acceptable for error boundaries only

## Good Example
```typescript
import { logger } from "@rulebound/shared/logger"
logger.info("Server started", { port: 3000 })
```

## Bad Example
```typescript
console.log("Server started on port", port)
```
```

---

## 4. CLI — Kural Listeleme ve Gosterim

### Tum Kurallari Listele

```bash
node packages/cli/dist/index.js rules list
```

Cikti:
```
ID                            CATEGORY      SEVERITY  MODE    STACK               TITLE
────────────────────────────────────────────────────────────────────────────────────────
architecture.file-size-limit  architecture  warning   SHOULD  typescript, java... File Size Limits
global.code-review-standards  style         warning   MUST    global              Code Review Standards
global.error-handling         architecture  error     MUST    global              Structured Error Handling
global.no-hardcoded-secrets   security      error     MUST    global              No Hardcoded Secrets
global.testing-requirements   testing       error     MUST    global              Testing Requirements
react.server-components-de... architecture  error     MUST    react, nextjs       Server Components by Default
security.authentication-au... security      error     MUST    global              Authentication and Authorization
security.input-sanitization   security      error     MUST    global              Input Sanitization
style.immutability            style         error     MUST    typescript, java... Immutable Data Patterns
style.no-console-log          style         warning   MUST    typescript, java... No Console Log in Production
typescript.no-any             style         error     MUST    typescript          No any Type
typescript.strict-types       style         error     MUST    typescript, node    Strict TypeScript Types
typescript.zod-validation     security      error     MUST    typescript, node    Zod Schema Validation
workflow.branch-naming        workflow      warning   SHOULD  global              Branch Naming Convention
workflow.git-author-identity  workflow      error     MUST    global              Git Author Identity Preservation

15 rules total
```

### Gorevle Ilgili Kurallari Bul

```bash
node packages/cli/dist/index.js find-rules --task "add authentication endpoint"
```

Cikti: Gorevle ilgili 6 kural bulundu (Authentication, Error Handling, Testing, Zod, Branch Naming, Git Author).

### Kural Detayi Goster

```bash
node packages/cli/dist/index.js rules show style.immutability
```

Kuralın tam icerigi, metadata'si, iyi/kotu ornekler gosterilir.

---

## 5. CLI — Plan Validasyonu

### Senaryo A: Kotu Plan (FAILED bekleniyor)

```bash
node packages/cli/dist/index.js validate \
  --plan "I will store the API key sk_live_abc123 directly in the source code as a constant. I will use console.log for all debugging output. I will skip writing tests to save time."
```

Cikti:
```
VALIDATION REPORT
══════════════════════════════════════════════════════════════
  Rules matched: 5 of 13

  ✗ [VIOLATED] MUST: No Console Log in Production
    Plan violates prohibition: "console log in"
    → Follow: Never commit `console.log` to production code

  ✗ [VIOLATED] MUST: No Hardcoded Secrets
    Plan violates prohibition: "source"
    → Follow: Never hardcode API keys, passwords, or tokens in source files

  ✗ [VIOLATED] MUST: Testing Requirements
    Plan violates prohibition: "tests"
    → Follow: Minimum 80% code coverage for all new code

  ✗ [VIOLATED] MUST: Code Review Standards
    Plan violates prohibition: "console"

──────────────────────────────────────────────────────────────
  1 PASS | 4 VIOLATED | 8 NOT COVERED

FAILED — resolve violations before proceeding
```

**Exit code: 1** (CI pipeline'da build fail eder)

### Senaryo B: Iyi Plan (PASSED bekleniyor)

```bash
node packages/cli/dist/index.js validate \
  --plan "I will load all secrets from environment variables using process.env. I will validate all input with Zod schemas at the API boundary. I will implement RBAC access control on every endpoint. I will use httpOnly cookies for token storage. I will write unit tests first following TDD with 80% coverage. I will use a structured logger (pino) instead of console.log."
```

Cikti:
```
VALIDATION REPORT
══════════════════════════════════════════════════════════════
  Rules matched: 5 of 13

  ✓ [PASS] MUST: Zod Schema Validation
  ✓ [PASS] MUST: Code Review Standards
  ✓ [PASS] MUST: Structured Error Handling
  ✓ [PASS] MUST: No Hardcoded Secrets
  ✓ [PASS] MUST: Testing Requirements

──────────────────────────────────────────────────────────────
  5 PASS | 0 VIOLATED | 8 NOT COVERED

PASSED with warnings — review NOT COVERED rules
```

**Exit code: 0** (CI pipeline'da basarili)

---

## 6. CLI — AST Kod Analizi

Tree-sitter WASM kullanarak kaynak kodda yapisal anti-pattern tespiti yapar.

### Kotu Kod Ornegi

```typescript
// /tmp/rulebound-bad-code.ts
function addUser(users: any[], name: string) {
  users.push(name)
  console.log("Added user:", name)
  return users
}
```

```bash
node packages/cli/dist/index.js check-code --file /tmp/rulebound-bad-code.ts
```

Cikti:
```
AST CODE ANALYSIS
────────────────────────────────────────────────────────────
File:     /tmp/rulebound-bad-code.ts
Language: typescript
Nodes:    54
Parse:    16ms
Query:    41ms
────────────────────────────────────────────────────────────

  ERROR No 'any' Type (ts-no-any)
         Use 'unknown' with type guards instead of 'any'
         L1:25 any
         Fix: Replace 'any' with 'unknown' and add type narrowing

  WARN  No console.log (ts-no-console-log)
         Remove console.log before committing. Use a structured logger.
         L3:3 console.log("Added user:", name)
         Fix: Replace with a logger (e.g., winston, pino) or remove entirely

────────────────────────────────────────────────────────────
  1 error(s) | 1 warning(s) in 2 finding(s)
```

**Satir numarasi ve kolon pozisyonu ile hata tespiti.**

---

## 7. CLI — Skor ve Analitik

### Kural Kalite Skoru

```bash
node packages/cli/dist/index.js score
```

Cikti:
```
RULE QUALITY SCORE
────────────────────────────────────────

  Score: 95/100
  Rules: 15
  Grade: A

  Category Breakdown:
    architecture     100% (3 rules)
    style            95% (5 rules)
    security         93% (4 rules)
    testing          87% (1 rules)
    workflow         97% (2 rules)
```

### Validasyon Analitikleri

```bash
node packages/cli/dist/index.js stats
```

Cikti:
```
RULEBOUND STATS
──────────────────────────────────────────────────

  Period:        Last 30 days
  Validations:   39
  Avg Score:     59

  TOP VIOLATED RULES
  security.authentication-authorization   13 █████████████
  global.no-hardcoded-secrets              8 ████████
  typescript.no-any                        7 ███████
  style.no-console-log                     7 ███████
  global.testing-requirements              4 ████

  BY SOURCE
  cli                    34
  mcp                     5
```

---

## 8. MCP Server — AI Agent Entegrasyonu

MCP (Model Context Protocol) sunucusu, AI ajanlarinin (Claude Code, Cursor vb.) dogrudan kullanabilecegi 7 tool sunar.

### Baslat

```bash
node packages/mcp/dist/index.js
# stdio tabanli — AI arac yapilandirmasina eklenir
```

### Claude Code Yapilandirmasi

```json
// .claude/mcp.json
{
  "mcpServers": {
    "rulebound": {
      "command": "node",
      "args": ["/path/to/packages/mcp/dist/index.js"]
    }
  }
}
```

### Tool: validate_plan (kotu plan)

```json
// Girdi
{"name": "validate_plan", "arguments": {
  "plan": "I will store the API key sk_live_abc123 directly in the source code. I will use console.log for debugging and skip writing tests.",
  "task": "Add payment API endpoint"
}}

// Cikti
{
  "status": "FAILED",
  "summary": {"pass": 2, "violated": 2, "notCovered": 10},
  "violations": [
    {"rule": "Structured Error Handling", "severity": "error",
     "reason": "console.log usage planned",
     "fix": "Use a structured logger instead of console.log"},
    {"rule": "No Console Log in Production", "severity": "warning",
     "reason": "console.log usage planned",
     "fix": "Use a structured logger instead of console.log"}
  ]
}
```

### Tool: validate_before_write (AST + Semantic)

En guclu tool — hem Tree-sitter AST analizi hem semantic kural eslesmesi yapar.

```json
// Girdi
{"name": "validate_before_write", "arguments": {
  "code": "function addUser(users: any[], name: string) {\n  users.push(name)\n  console.log(\"Added user:\", name)\n  return users\n}",
  "file_path": "src/users.ts"
}}

// Cikti
{
  "approved": false,
  "file_path": "src/users.ts",
  "language": "typescript",
  "violations": [
    {"rule": "ts-no-any",          "line": 1, "source": "ast",      "severity": "error",
     "message": "Use 'unknown' with type guards instead of 'any'"},
    {"rule": "ts-no-console-log",  "line": 3, "source": "ast",      "severity": "warning",
     "message": "Remove console.log before committing."},
    {"rule": "global.error-handling",         "source": "semantic", "severity": "error",
     "message": "console.log detected"},
    {"rule": "style.immutability",            "source": "semantic", "severity": "error",
     "message": "Array mutation via push()"},
    {"rule": "style.no-console-log",          "source": "semantic", "severity": "warning",
     "message": "console.log detected"},
    {"rule": "typescript.no-any",             "source": "semantic", "severity": "error",
     "message": "TypeScript 'any' type usage"}
  ],
  "score": 6,
  "hasMustViolation": true,
  "message": "6 violation(s) found — review before writing"
}
```

**6 ihlal: 2 AST (satir numarali) + 4 semantic. `approved: false` — AI agent bu kodu yazamaz.**

---

## 9. API Server — CRUD Islemleri

### Baslat

```bash
DATABASE_URL=postgresql://localhost:5432/rulebound \
PORT=3001 \
node packages/server/dist/index.js
```

Cikti:
```
Rulebound API server running on http://localhost:3001
Health check: http://localhost:3001/health
```

### Health Check

```bash
curl http://localhost:3001/health
```
```json
{"status": "ok", "version": "0.1.0"}
```

### Kurallari Listele

```bash
curl -H "Authorization: Bearer rulebound-poc-token-2024" \
  http://localhost:3001/v1/rules
```
```json
{
  "data": [
    {"title": "Never hardcode secrets ever", "severity": "error", "modality": "must"},
    {"title": "No console logs in app code", "severity": "warning", "modality": "should"},
    {"title": "No Hardcoded Secrets", "severity": "error", "modality": "must"},
    {"title": "Server Components by Default", "severity": "warning", "modality": "should"},
    {"title": "Testing Required", "severity": "warning", "modality": "should"}
  ]
}
```

### Kural Olustur (POST)

```bash
curl -X POST http://localhost:3001/v1/rules \
  -H "Authorization: Bearer rulebound-poc-token-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleSetId": "33333333-3333-3333-3333-333333333333",
    "title": "No Magic Numbers",
    "content": "Avoid magic numbers. Use named constants instead.",
    "category": "style",
    "severity": "warning",
    "modality": "should",
    "tags": ["magic-numbers","readability"],
    "stack": ["typescript"]
  }'
```
```json
{"data": {"id": "f16c4056-...", "title": "No Magic Numbers", "version": 1}}
```

### Kural Guncelle (PUT — versiyonlu)

```bash
curl -X PUT http://localhost:3001/v1/rules/<id> \
  -H "Authorization: Bearer rulebound-poc-token-2024" \
  -H "Content-Type: application/json" \
  -d '{"severity":"error","modality":"must","changeNote":"Upgraded to MUST"}'
```
```json
{"data": {"title": "No Magic Numbers", "severity": "error", "modality": "must", "version": 2}}
```

**Versiyon 1 → 2'ye yukseldi. Eski versiyon `rule_versions` tablosunda saklanir.**

### Kural Sil (DELETE)

```bash
curl -X DELETE http://localhost:3001/v1/rules/<id> \
  -H "Authorization: Bearer rulebound-poc-token-2024"
```
```json
{"data": {"deleted": true}}
```

### Audit Log

```bash
curl -H "Authorization: Bearer rulebound-poc-token-2024" \
  http://localhost:3001/v1/audit
```
```json
[
  {"action": "rule.deleted", "status": "success", "createdAt": "2026-03-10T21:33:35Z"},
  {"action": "rule.updated", "status": "success", "createdAt": "2026-03-10T21:33:35Z"},
  {"action": "rule.created", "status": "success", "createdAt": "2026-03-10T21:33:25Z"}
]
```

**Tum CRUD islemleri otomatik olarak audit log'a yazilir.**

### Diger Endpoint'ler

| Endpoint | Metod | Test Sonucu |
|----------|-------|-------------|
| `GET /v1/rules` | Listele | 5 kural dondu |
| `POST /v1/rules` | Olustur | Kural olusturuldu (v1) |
| `PUT /v1/rules/:id` | Guncelle | Versiyonlandi (v1→v2) |
| `DELETE /v1/rules/:id` | Sil | Silindi |
| `POST /v1/validate` | Dogrula | Plan validasyonu calisti |
| `GET /v1/audit` | Audit | 27+ kayit |
| `GET /v1/projects` | Projeler | 2 proje listelendi |

---

## 10. Web Dashboard — UI

### Baslat

```bash
# .env.local dosyasi olustur
cat > apps/web/.env.local << 'EOF'
DATABASE_URL=postgresql://localhost:5432/rulebound
RULEBOUND_DASHBOARD_PASSCODE=poc-demo-2024
RULEBOUND_API_URL=http://localhost:3001
RULEBOUND_API_TOKEN=rulebound-poc-token-2024
EOF

cd apps/web && npx next dev --turbopack --port 3000
```

Cikti:
```
▲ Next.js 16.1.6 (Turbopack)
- Local: http://localhost:3000
- Environments: .env.local
✓ Ready in 575ms
```

### Giris (Login)

```bash
# Form data ile POST (cookie set eder)
curl -X POST http://localhost:3000/api/dashboard-auth/session \
  -d "passcode=poc-demo-2024&next=/dashboard" \
  -c cookies.txt
```

Cikti:
```
HTTP/1.1 307 Temporary Redirect
location: http://localhost:3000/dashboard
set-cookie: rulebound_dashboard_session=poc-demo-2024; Path=/; HttpOnly; SameSite=lax
```

### Sayfa Testi Sonuclari

| URL | HTTP | Durum |
|-----|------|-------|
| `/` (landing) | 200 | Landing page basariyla yuklendi |
| `/access` (login) | 200 | Passcode giris formu |
| `/dashboard` | 200 | Ana dashboard |
| `/rules` | 200 | Kural listesi (veriler render edildi) |
| `/rules/new` | 200 | Yeni kural olusturma formu |
| `/analytics` | 200 | Validasyon analitikleri |
| `/audit` | 200 | Audit log goruntuleme |
| `/projects` | 200 | Proje yonetimi |
| `/compliance` | 200 | Uyumluluk izleme |
| `/settings` | 200 | Ayarlar |
| `/webhooks` | 200 | Webhook yapilandirmasi |
| `/import` | 200 | Toplu kural iceaktarimi |
| `/docs` | 200 | Dokumantasyon |

**Tum 13 sayfa HTTP 200 ile basariyla yukleniyor.**

### Veri Dogrulama

Rules sayfasinda sunlar render ediliyor:
- "hardcode" (5 kez) — No Hardcoded Secrets kurali
- "console" (13 kez) — No Console Log kurali
- "Testing" (5 kez) — Testing Requirements kurali
- "Server Component" (6 kez) — Server Components kurali

---

## 11. Gateway — LLM Proxy ve Kural Enjeksiyonu

Gateway, AI araclarinin LLM isteklerini yakalayarak system prompt'a proje kurallarini enjekte eder. Hangi AI arac kullanilirsa kullanilsin (Claude Code, Cursor, Codex, ChatGPT), kurallar otomatik uygulanir.

### Baslat

```bash
GATEWAY_PORT=4001 \
RULEBOUND_STACK=typescript,javascript \
RULEBOUND_INJECT_RULES=true \
RULEBOUND_ENFORCEMENT=advisory \
node packages/gateway/dist/index.js
```

Cikti:
```
Rulebound Gateway running on http://localhost:4001

Route your AI tools through this gateway:
  OpenAI:    OPENAI_API_BASE=http://localhost:4001/openai/v1
  Anthropic: ANTHROPIC_API_BASE=http://localhost:4001/anthropic

Enforcement: advisory
Rule injection: enabled
Response scanning: disabled
```

### Health Check

```bash
curl http://localhost:4001/health
```
```json
{"status": "ok", "type": "gateway", "version": "0.1.0"}
```

### Anthropic Kural Enjeksiyonu (Claude Code icin)

**Orijinal istek:**
```json
{
  "system": "You are a helpful coding assistant.",
  "messages": [{"role": "user", "content": "Write a function to add a user"}]
}
```

**Gateway'den gecince:**
```
system prompt icerigi:

You are a helpful coding assistant.

<rulebound_rules>
The following project rules MUST be followed when writing code:

[SHOULD] File Size Limits
  # File Size Limits
  Source files SHOULD stay under 400 lines...

[MUST] Structured Error Handling
  All errors MUST be caught, logged with context...

[MUST] No Hardcoded Secrets
  Never hardcode API keys, passwords, or tokens...

[MUST] Testing Requirements
  All features MUST have tests...

[MUST] Immutable Data Patterns
  All data transformations MUST create new objects...

[MUST] No Console Log in Production
  Production code MUST NOT contain console.log...

[MUST] No any Type
  TypeScript code MUST NOT use the any type...

... (14 kural toplam)
</rulebound_rules>

Toplam system prompt uzunlugu: 4598 karakter
Enjekte edilen kural sayisi: 14
```

### OpenAI Kural Enjeksiyonu (Codex/ChatGPT icin)

**Orijinal istek:** 1 mesaj (user)
**Gateway'den gecince:** 2 mesaj (system + user)
- System prompt uzunlugu: 4561 karakter
- `<rulebound_rules>` enjekte edildi: true

### Claude Code'u Gateway Uzerinden Kullanma

```bash
ANTHROPIC_BASE_URL=http://localhost:4001/anthropic claude-code
```

Bu sekilde Claude Code'un tum istekleri gateway uzerinden gecer ve kurallar otomatik enjekte edilir.

### Desteklenen Provider'lar

| Provider | Gateway Path | Enjeksiyon Noktasi |
|----------|-------------|-------------------|
| Anthropic | `/anthropic/v1/messages` | `system` field |
| OpenAI | `/openai/v1/chat/completions` | `messages[0]` (system role) |
| Google Gemini | `/google/...` | `systemInstruction` |

---

## 12. Testler

```bash
pnpm --filter @rulebound/engine test    # 73 passed
pnpm --filter @rulebound/cli test       # 87 passed
pnpm --filter @rulebound/mcp test       # 39 passed
pnpm --filter @rulebound/gateway test   # 83 passed
```

| Paket | Test | Sonuc |
|-------|------|-------|
| Engine | 73/73 | PASS |
| CLI | 87/87 | PASS |
| MCP | 39/39 | PASS |
| Gateway | 83/83 | PASS |
| **Toplam** | **282/282** | **PASS** |

---

## 13. Ozet

### Calisan Bilesenler

| Bilesen | Durum | Dogrulama |
|---------|-------|-----------|
| CLI — rules list | ✅ | 15 kural listelendi |
| CLI — find-rules | ✅ | Gorev bazli kural eslesmesi |
| CLI — validate (kotu) | ✅ | FAILED, 4 ihlal, exit code 1 |
| CLI — validate (iyi) | ✅ | PASSED, 5 PASS, 0 ihlal |
| CLI — check-code (AST) | ✅ | 2 bulgu (any: L1, console.log: L3) |
| CLI — score | ✅ | 95/100, Grade A |
| CLI — stats | ✅ | 39 validasyon, trend grafigi |
| MCP — validate_plan | ✅ | FAILED, 2 violation |
| MCP — validate_before_write | ✅ | 6 violation (AST+semantic), approved:false |
| MCP — check_code | ✅ | 4 violation |
| MCP — list_rules | ✅ | 14 kural |
| API — Health | ✅ | {"status":"ok"} |
| API — CRUD Rules | ✅ | Create/Read/Update/Delete calisiyor |
| API — Versiyonlama | ✅ | v1→v2 gecisi, eski versiyon saklaniyor |
| API — Audit Log | ✅ | 27+ kayit, tum islemler loglanir |
| API — Validate | ✅ | Plan validasyonu calisiyor |
| API — Projects | ✅ | 2 proje listelendi |
| Dashboard — Landing | ✅ | HTTP 200 |
| Dashboard — Login | ✅ | Passcode ile cookie, 307 redirect |
| Dashboard — 13 sayfa | ✅ | Tumu HTTP 200 |
| Dashboard — Veri | ✅ | Kurallar sayfada render ediliyor |
| Gateway — Health | ✅ | {"status":"ok","type":"gateway"} |
| Gateway — Anthropic injection | ✅ | 4598 char, 14 kural enjekte |
| Gateway — OpenAI injection | ✅ | 4561 char, system mesaji eklendi |
| Gateway — Lokal kural yukleme | ✅ | .rulebound/rules/ fallback |
| Testler | ✅ | 282/282 gecen |

### PoC Demo Baslat Komutu

```bash
# Terminal 1: API Server
DATABASE_URL=postgresql://localhost:5432/rulebound PORT=3001 node packages/server/dist/index.js

# Terminal 2: Web Dashboard
cd apps/web && npx next dev --turbopack --port 3000

# Terminal 3: Gateway
GATEWAY_PORT=4001 RULEBOUND_STACK=typescript,javascript node packages/gateway/dist/index.js

# Terminal 4: Demo
node packages/cli/dist/index.js rules list
node packages/cli/dist/index.js validate --plan "kotu plan"
node packages/cli/dist/index.js validate --plan "iyi plan"
```
