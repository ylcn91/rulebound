# AMP-91-NEW — Rulebound Production Readiness Master Plan

Tarih: 2026-05-15  
Durum: planning / execution backlog  
Kapsam: Rulebound monorepo'nun production öncesi tamamlaması gereken tüm core, preview, hardening, test, documentation, release ve operational işler.

## 1. Amaç

Bu dokümanın amacı Rulebound'u production'a hazırlamak için gereken bütün işleri tek bir hedef plan altında toplamaktır. Bu plan tamamlandığında ekip şu soruya güvenle cevap verebilmelidir:

> “Rulebound'u production-ready olarak yayınlayabilir miyiz?”

Bu doküman yalnızca öncelik listesi değildir. Aşağıdakileri kapsar:

- ürün hedefi ve maturity sınırları,
- production readiness tanımı,
- ana use case'ler,
- kullanıcı ve sistem akışları,
- mimari sınırlar,
- tüm task backlog'u,
- acceptance criteria,
- test ve doğrulama stratejisi,
- dokümantasyon stale-risk planı,
- security / hardening işleri,
- release gate ve operasyonel hazırlık,
- plan tamamlandığında ulaşılacak hedef durum.

## 2. Mevcut durum özeti

Rulebound'un en güçlü ve release'e en yakın yüzeyi şudur:

- `@rulebound/engine`: deterministic rule loading, checks, analyzer orchestration, waivers, report schema.
- `@rulebound/cli`: `rulebound check` canonical deterministic gate, `doctor`, `evidence`, `heal`, `bugfix`, packs.
- `@rulebound/mcp`: agent loop içinde rules discovery, plan validation ve deterministic check tools.
- GitHub Action / CI examples: PR gate, SARIF, GitHub annotations, PR markdown summary.

Production öncesi en önemli karar:

> Rulebound v0.1 production surface = CLI + engine + MCP + CI deterministic gate.  
> Server, dashboard, gateway, LSP ve native SDK'lar production core değil; preview / beta / secondary surface olarak yönetilecek.

Bu karar tamamlanmadan bütün yüzeyleri aynı anda production-ready yapmaya çalışmak bakım maliyetini ve güvenlik riskini gereksiz artırır.

## 3. Maturity hedefleri

| Surface | Hedef maturity | Production kriteri |
| --- | --- | --- |
| Engine | Stable core | Deterministic report schema, checks, waivers, analyzers, tests ve public API net. |
| CLI | Stable core | `check` authoritative gate, install/smoke/release path güvenilir. |
| MCP | Beta / core-adjacent | Deterministic MCP tools CLI ile aynı report shape'i üretir; advisory tools final gate değildir. |
| GitHub Action / CI | Stable core | PR gate deterministic failures ile bloklar; output formatları güvenilir. |
| Rule packs | Beta | Starter/typescript/security/agent-workflow packs düşük gürültülü ve testli. |
| Server API | Preview → controlled beta | Migrations, auth scopes, CORS, rate-limit story, Postgres integration test olmadan prod-ready değildir. |
| Dashboard | Preview | Self-hosted audit viewer; SaaS/auth/org/RBAC iddiası yok. |
| Gateway | Preview | LLM proxy olduğu için privacy, streaming ve provider contract hardening bitmeden core değildir. |
| LSP | Experimental | Editor diagnostics; adoption sinyali gelene kadar sınırlı tutulur. |
| SDKs | Preview | TypeScript canonical; native SDK parity ayrı matrix ve toolchain ile doğrulanır. |

## 4. Production readiness tanımı

Bu planın sonunda “production-ready” diyebilmek için aşağıdaki şartlar sağlanmalıdır.

### 4.1 Core production readiness

Core production-ready sayılmak için:

1. `rulebound check` deterministic gate local ve CI'da yeşil çalışmalı.
2. `pnpm lint` yeşil olmalı.
3. TypeScript packages test/build yeşil olmalı.
4. CLI pack smoke test yeşil olmalı.
5. GitHub Action PR flow test edilmiş olmalı.
6. MCP deterministic tools CLI report shape'i ile uyumlu olmalı.
7. README quickstart komutları gerçek temp repo üzerinde çalışmalı.
8. Analyzer orchestration docs + examples testli olmalı.
9. Docs stale drift için otomatik check olmalı.
10. Release gate açık ve tekrar edilebilir olmalı.

### 4.2 Preview surfaces readiness

Preview yüzeyler production core'u bloklamaz; ama yanlış pazarlanmamalıdır.

Server/dashboard/gateway için:

1. README ve docs açıkça preview / advanced / self-hosted olarak işaretlemeli.
2. Known limitations listesi güncel olmalı.
3. Güvenlik riski taşıyan varsayılanlar belgelenmeli.
4. Core release gate bu yüzeylere gereksiz bağımlı olmamalı.

### 4.3 Full platform readiness

Rulebound'u tüm yüzeyleriyle production platform olarak konumlandırmadan önce ayrıca şunlar tamamlanmalıdır:

1. Server DB migrations.
2. Server auth scope enforcement.
3. Server CORS allowlist.
4. Rate limiting deployment story veya in-process implementation.
5. Real Postgres integration suite.
6. Dashboard e2e smoke tests.
7. Gateway provider contract suite.
8. Gateway privacy / body logging / streaming hardening.
9. Native SDK parity matrix yeşil.
10. Security scans ve dependency vulnerability scans release gate'e bağlanmış olmalı.

## 5. Ana use case'ler

### UC-1 — Yeni repo ilk kurulum

Aktör: developer / platform engineer  
Amaç: Rulebound'u 10 dakika içinde yeni bir repo'ya deterministic gate olarak kurmak.

Akış:

```diagram
╭────────────╮     ╭──────────────╮     ╭──────────────╮
│ Developer  │────▶│ rulebound init│────▶│ .rulebound/  │
╰─────┬──────╯     ╰──────┬───────╯     │ rules/config │
      │                   │             ╰──────┬───────╯
      ▼                   ▼                    ▼
╭────────────╮     ╭──────────────╮     ╭──────────────╮
│ doctor     │────▶│ check        │────▶│ CI gate       │
╰────────────╯     ╰──────────────╯     ╰──────────────╯
```

Acceptance:

- `rulebound init --pack starter --no-hook` fresh temp repo'da çalışır.
- `rulebound doctor` actionable output verir.
- `rulebound check` no-op/fresh starter repo'da geçer.
- README quickstart bu akışla birebir uyumludur.

### UC-2 — PR deterministic gate

Aktör: developer / CI  
Amaç: PR'da repo policy ihlalini deterministik olarak bloklamak.

Akış:

```diagram
╭────────╮     ╭────────────╮     ╭──────────────────╮
│ PR diff│────▶│ CI checkout│────▶│ rulebound check   │
╰────────╯     ╰────────────╯     │ --format github   │
                                  ╰────────┬─────────╯
                                           │
                 ╭─────────────────────────┴─────────────────────────╮
                 ▼                                                   ▼
          ╭──────────────╮                                    ╭──────────────╮
          │ annotations  │                                    │ exit code    │
          │ summary      │                                    │ pass/fail    │
          ╰──────────────╯                                    ╰──────────────╯
```

Acceptance:

- Deterministic blocker varsa CI non-zero çıkar.
- Advisory-only bulgular default olarak final blocker olmaz.
- GitHub annotations dosya/satır/title/message formatını doğru üretir.
- SARIF ve PR markdown aynı report modelinden türetilir.

### UC-3 — Agent MCP ile kuralları takip eder

Aktör: AI coding agent  
Amaç: Agent implementasyondan önce kuralları bulur, planı advisory olarak kontrol eder, koddan sonra deterministic check çalıştırır.

Akış:

```diagram
╭────────╮     ╭────────────────────╮     ╭──────────────────────╮
│ Agent  │────▶│ find_rules          │────▶│ relevant rules       │
╰───┬────╯     ╰──────────┬─────────╯     ╰──────────┬───────────╯
    │                     ▼                          │
    │            ╭────────────────────╮              │
    ├───────────▶│ validate_plan       │◀─────────────╯
    │            │ advisory            │
    │            ╰──────────┬─────────╯
    │                       ▼
    │            ╭────────────────────╮
    └───────────▶│ run_deterministic   │
                 │ checks / check_diff │
                 ╰──────────┬─────────╯
                            ▼
                    ╭──────────────╮
                    │ same report   │
                    │ as CLI check  │
                    ╰──────────────╯
```

Acceptance:

- MCP deterministic tools `DeterministicReport` shape'ini CLI ile paylaşır.
- Advisory MCP tools “final authority” gibi belgelenmez.
- MCP tool errors structured ve actionable olur.
- Bugfix workflow signals deterministic engine'e doğru taşınır.

### UC-4 — Bugfix workflow

Aktör: developer / agent  
Amaç: `fix/**` branch'lerinde bug condition, postcondition, preservation scenario ve regression test kanıtı üretmek.

Akış:

```diagram
╭────────────╮     ╭────────────────────╮     ╭────────────────────╮
│ fix branch │────▶│ bugfix spec start   │────▶│ implement fix       │
╰─────┬──────╯     ╰──────────┬─────────╯     ╰─────────┬──────────╯
      │                       │                         │
      ▼                       ▼                         ▼
╭────────────╮     ╭────────────────────╮     ╭────────────────────╮
│ condition  │     │ regression test     │────▶│ rulebound check     │
│ preserved  │     │ evidence            │     │ agent-process       │
╰────────────╯     ╰────────────────────╯     ╰────────────────────╯
```

Acceptance:

- `rulebound bugfix start` akışı dokümante ve testli.
- MCP signal yoksa agent-process checks noise yaratmayacak şekilde branch/scope ile yönetilir.
- Regression test yoksa deterministic gate fail eder.

### UC-5 — Analyzer orchestration

Aktör: repo owner / CI  
Amaç: PMD, Checkstyle, SpotBugs, ESLint, Semgrep, gitleaks, tsc, JUnit gibi mevcut analyzer'ları Rulebound report modeline normalize etmek.

Akış:

```diagram
╭──────────────╮     ╭──────────────╮     ╭────────────────────╮
│ external tool│────▶│ report file   │────▶│ rulebound analyzer │
│ eslint/pmd   │     │ xml/json/sarif│     │ parser             │
╰──────────────╯     ╰──────────────╯     ╰──────────┬─────────╯
                                                       ▼
                                             ╭────────────────────╮
                                             │ deterministic gate  │
                                             ╰────────────────────╯
```

Acceptance:

- Analyzer checks command execution olmadan existing reports okuyabilir.
- `--allow-commands` gerektiren durumlar açık ve testli.
- Missing report, malformed report ve failing severity davranışları predictable olur.

### UC-6 — Self-hosted server/dashboard preview

Aktör: platform team  
Amaç: CLI/CI evidence'ı self-hosted dashboard'da görmek.

Acceptance:

- Dashboard “optional audit viewer” olarak çalışır.
- Backend config missing durumda UI doğru error state gösterir.
- Server token auth, scopes, CORS ve migrations tamamlanmadan production SaaS iddiası yapılmaz.

### UC-7 — Gateway preview

Aktör: advanced user / security-conscious platform team  
Amaç: LLM traffic proxy üzerinden rule injection ve response scanning denemek.

Acceptance:

- Default body logging kapalıdır.
- Provider-specific streaming ve non-streaming fixtures testlidir.
- Privacy ve operational riskler docs'ta açık yazılır.

## 6. Production öncesi task backlog'u

Task ID formatı: `AMP91-<area>-<number>`.

### 6.1 Program management ve product boundary

#### AMP91-PM-001 — Production surface kararını README ve docs'ta sabitle

Amaç: Kullanıcıların neyin stable, neyin preview olduğunu yanlış anlamasını engellemek.

İşler:

- README'de maturity tablosunu güncelle.
- `apps/web/content/docs/getting-started/introduction.ts` içindeki surface tanımını root README ile sync et.
- Server/dashboard/gateway/LSP/SDK dokümanlarında “preview / beta / experimental” etiketlerini tutarlı hale getir.
- `rulebound check` için “authoritative gate” ifadesini CLI docs boyunca tutarlı kullan.

Acceptance:

- Yeni kullanıcı 5 dakika içinde stable core'un CLI + MCP + CI olduğunu anlar.
- Server/dashboard/gateway hiçbir yerde production SaaS gibi anlatılmaz.

#### AMP91-PM-002 — Production readiness checklist'i release gate ile bağla

Amaç: Bu dokümandaki checklist'in release sırasında unutulmaması.

İşler:

- `docs/release-gate.md` içine AMP-91 checklist referansı ekle.
- Release PR template veya GitHub issue checklist'i oluştur.
- “Core release” ve “full platform release” checklist'lerini ayır.

Acceptance:

- Release hazırlayan kişi hangi gates zorunlu, hangileri preview-specific biliyor.

### 6.2 CI / release gate / toolchain

#### AMP91-CI-001 — Core CI ile native SDK parity'yi ayır

Amaç: Core product release'i local/native SDK toolchain eksikleriyle kırılmasın.

İşler:

- `.github/workflows/ci.yml` içinde `pnpm test` yerine core TS package test/build akışını netleştir.
- Native SDK test/build jobs `sdk-parity.yml` içinde ayrı matrix olarak kalsın.
- Root `pnpm test` davranışı yeniden kararlaştırılsın:
  - seçenek A: full test olarak kalsın ve toolchain gereksinimlerini fail-fast göstersin,
  - seçenek B: `test:core` ve `test:all` olarak ayrışsın.
- Dokümantasyonda local development için hangi test komutu öneriliyor yazılsın.

Acceptance:

- Core CI Node/pnpm dışında native SDK gerektirmeden core'u doğrular.
- SDK parity CI dotnet 8, Java, Go, Rust, Python toolchain'lerini explicit kurar.
- Lokal `.NET 6` olan ortamda hata mesajı anlaşılır olur.

#### AMP91-CI-002 — .NET 8 toolchain fail-fast / skip policy

Amaç: `NETSDK1045` gibi düşük seviyeli hata yerine actionable release mesajı vermek.

İşler:

- `scripts/test-sdks.sh` dotnet major version kontrolü yapsın.
- `scripts/build-sdks.sh` dotnet major version kontrolü yapsın.
- .NET 8 yoksa:
  - full gate için açık fail mesajı,
  - explicit `--skip-dotnet` veya `--skip-sdks` durumunda açık skip mesajı.
- Release notes'ta skipped native SDK varsa yazılması zorunlu olsun.

Acceptance:

- Hata mesajı “Install .NET 8 or run explicit skip” şeklinde olur.
- Silent skip yoktur.

#### AMP91-CI-003 — Release gate'i staged ve deterministic yap

Amaç: Production öncesi tek komutla güvenilir karar vermek.

İşler:

- `scripts/release-gate.sh` stage çıktıları machine-readable JSON olarak da üretilebilsin.
- Stage listesi:
  1. install,
  2. lint,
  3. core tests,
  4. core build,
  5. web build,
  6. CLI smoke,
  7. self dogfood check,
  8. docs drift,
  9. secret scan,
  10. artefact hygiene,
  11. optional SDK parity.
- `--skip-sdks` çıktısı summary'de SKIP olarak görünmeye devam etsin.

Acceptance:

- Release gate summary PASS/FAIL/SKIP olarak net.
- Failed stage owner ve next action dokümante.

#### AMP91-CI-004 — Artefact hygiene kapsamını genişlet

Amaç: build çıktıları, cache ve generated dosyalar repo'ya sızmasın.

İşler:

- `.gitignore` ile release gate hygiene regex'i sync et.
- `.claude/`, `.next/`, `dist/`, `target/`, `bin/`, `obj/`, `.venv/`, `__pycache__`, `.egg-info`, `*.tsbuildinfo` için davranışı netleştir.
- `git ls-files` ile yanlışlıkla tracked generated artefact var mı CI'da kontrol et.

Acceptance:

- Generated artefact tracked değil.
- Untracked artefact release gate'i bozuyorsa mesaj actionable.

### 6.3 Engine ve deterministic core

#### AMP91-ENG-001 — Deterministic report schema'yı stable contract yap

Amaç: CLI, MCP, GitHub Action, dashboard ve SDK'lar aynı report modeline güvenebilsin.

İşler:

- `docs/report-schema.md` ile `packages/engine/src/report-schema.ts` drift check'i yaz.
- `validateDeterministicReport` testleri genişlet.
- Schema version bump policy yaz.
- CLI output formatlarının hangi field'ları kullandığı testli olsun.

Acceptance:

- Report schema değişirse tests/docs birlikte güncellenmeden CI geçmez.

#### AMP91-ENG-002 — Analyzer parser contract tests genişlet

Amaç: Existing analyzers orchestrated promise'ını güvenilir yapmak.

İşler:

- PMD XML, Checkstyle XML, SpotBugs XML, JUnit XML, SARIF, ESLint JSON, tsc text için fixture tests.
- Malformed report behavior.
- Missing report behavior.
- Severity threshold behavior.
- Large report truncation / memory behavior.

Acceptance:

- Analyzer output parser failures deterministic `ERROR` veya documented `NOT_APPLICABLE` olur.

#### AMP91-ENG-003 — Command/analyzer execution safety

Amaç: `--allow-commands` güvenlik sınırını net ve güvenli yapmak.

İşler:

- Command timeout defaultları test edilsin.
- Environment variable allow/deny behavior dokümante edilsin.
- Working directory behavior test edilsin.
- Shell injection riskleri için config validation eklenip eklenmeyeceği değerlendirilsin.

Acceptance:

- Command checks sadece explicit opt-in ile çalışır.
- Timeout ve error messages predictable olur.

#### AMP91-ENG-004 — Diff evidence edge cases

Amaç: PR gate'te yanlış pass/fail riskini azaltmak.

İşler:

- Base branch missing / detached HEAD / shallow checkout cases.
- Rename/delete detection expectations.
- Staged vs unstaged behavior.
- `--base main` fallback `origin/main` behavior tests.

Acceptance:

- CI-style checkout'larda diff evidence güvenilir.

#### AMP91-ENG-005 — Waivers hardening

Amaç: Waiver'lar audit edilebilir ve güvenli olsun.

İşler:

- Expired waiver behavior tests.
- Invalid waiver file exit code behavior tests.
- Waiver summary PR markdown ve SARIF output'ta görünür olsun.
- Waiver reason ve expiration required policy değerlendirilsin.

Acceptance:

- Waiver ambiguous durumda gate fail eder.

### 6.4 CLI

#### AMP91-CLI-001 — CLI quickstart smoke test

Amaç: README'deki ilk deneyimin gerçekten çalıştığını garanti etmek.

İşler:

- Temp repo oluştur.
- Packed CLI kur.
- `rulebound init --pack starter --no-hook` çalıştır.
- `rulebound doctor` çalıştır.
- `rulebound check` çalıştır.
- Output snapshot veya behavioral assertions ekle.

Acceptance:

- README quickstart kırılırsa CI fail eder.

#### AMP91-CLI-002 — Exit code matrix tests

Amaç: CI ve automation kullanıcıları için stable contract.

İşler:

- Exit 0: pass.
- Exit 1: deterministic blocker.
- Exit 2: config/runtime/schema error.
- Exit 3: advisory fail when `--fail-on-advisory`.
- Machine formats stderr/stdout behavior.

Acceptance:

- Exit code behavior docs ve tests birebir eşleşir.

#### AMP91-CLI-003 — `doctor` actionable diagnostics

Amaç: Kullanıcı toolchain/analyzer/config problemini hızlı çözsün.

İşler:

- Dotnet/Java/Go/Rust/Python toolchain detection.
- Analyzer availability detection.
- Missing report detection.
- Rule schema validation summary.
- “Next action” önerileri.

Acceptance:

- `doctor` çıktısı sadece problem değil çözüm komutu da verir.

#### AMP91-CLI-004 — Advisory vs deterministic command UX cleanup

Amaç: Yeni kullanıcı `validate`, `diff`, `review` gibi legacy/advisory komutları final gate sanmasın.

İşler:

- CLI help group labels review.
- Advisory commands output header'ında “not final gate” uyarısı.
- Docs cross-link: “Use check for gate”.

Acceptance:

- `rulebound --help` çıktısı canonical `check` komutunu açıkça öne çıkarır.

#### AMP91-CLI-005 — Repair JSON contract

Amaç: Agent repair loop için deterministic failure payload stabil olsun.

İşler:

- `--format repair-json` schema docs.
- Fixture tests.
- Suggested fixes ve rerun hints stable olsun.

Acceptance:

- Agent repair loop payload changes schema version olmadan kırılmaz.

### 6.5 MCP

#### AMP91-MCP-001 — CLI/MCP deterministic parity tests

Amaç: MCP deterministic tools ile CLI aynı authority modelini paylaşsın.

İşler:

- Aynı fixture repo'da CLI `check --format json` ve MCP `run_deterministic_checks` output karşılaştır.
- `check_diff` ile CLI diff behavior karşılaştır.
- Waivers ve parse errors parity.

Acceptance:

- MCP deterministic report CLI report shape'i ile uyumlu.

#### AMP91-MCP-002 — MCP error model hardening

Amaç: Agent'lar hata durumunda doğru repair aksiyonu alsın.

İşler:

- Missing rules dir.
- Invalid rule schema.
- Git diff invalid base.
- Analyzer report missing.
- Command checks without allow flag.

Acceptance:

- MCP tool errors structured, machine-readable ve human-readable olur.

#### AMP91-MCP-003 — Agent-process signals contract

Amaç: `find_rules_called`, `validate_plan_called`, `bugfix_spec_present`, `regression_test_added` gibi sinyaller doğru enforcement sağlar.

İşler:

- Signal names docs ve types sync.
- Missing signals behavior.
- Branch/scope examples.
- Bugfix branch fixtures.

Acceptance:

- MCP dışında bu rules gereksiz noise üretmeyecek şekilde belgelenir.

#### AMP91-MCP-004 — MCP setup smoke docs

Amaç: Claude Code, Cursor, Amp ve generic MCP client setup'ı çalışır olsun.

İşler:

- Docs examples build path ile uyumlu.
- `node packages/mcp/dist/index.js` local iteration instructions test edilir.
- `npx @rulebound/mcp` veya package binary naming doğrulanır.

Acceptance:

- Kullanıcı docs'tan MCP server'ı bağlayabilir.

### 6.6 GitHub Action / CI integration

#### AMP91-GHA-001 — Composite action smoke test

Amaç: Published action veya local action PR gate olarak çalışsın.

İşler:

- `.github/actions/rulebound/action.yml` inputs review.
- Example workflows fresh fixture repo ile test edilir.
- `format=github`, `format=pr-markdown`, `format=sarif` davranışları doğrulanır.

Acceptance:

- Action outputs GitHub annotations ve summary üretir.

#### AMP91-GHA-002 — Double-run safety docs

Amaç: SARIF/summary için check'i iki kez çalıştırmanın ne zaman güvenli olduğunu belgelemek.

İşler:

- `allow-commands=true` iken double-run uyarısı.
- Analyzer commands side-effect riskleri.
- Recommended CI pattern: analyzer first, Rulebound reads reports.

Acceptance:

- CI docs command/analyzer side-effect riskini açıkça anlatır.

### 6.7 Rule packs ve examples

#### AMP91-PACK-001 — Starter pack low-noise guarantee

Amaç: İlk kurulumda kullanıcı gereksiz analyzer/toolchain warning'i görmesin.

İşler:

- Starter pack pure deterministic, no external analyzer olmalı.
- Fresh repo smoke.
- Rule count ve expected files snapshot.

Acceptance:

- Starter pack kurulumdan sonra `rulebound check` yeşil.

#### AMP91-PACK-002 — Analyzer packs explicit opt-in

Amaç: Analyzer packs kullanıcıya toolchain beklentisini net iletsin.

İşler:

- TypeScript analyzer pack: eslint + tsc expectations.
- Java analyzer pack: pmd + checkstyle + spotbugs + junit expectations.
- Security analyzer pack: semgrep + gitleaks expectations.
- `doctor` integration.

Acceptance:

- Analyzer tool yoksa kullanıcı ne kuracağını görür.

#### AMP91-PACK-003 — Example rules quality lint

Amaç: Bundled examples ürün kalitesini yansıtsın.

İşler:

- `rulebound rules lint` threshold belirle.
- Excessive WIP/TODO examples review.
- Deterministic examples docs ile sync.

Acceptance:

- Example rules lint score minimum threshold üstünde.

### 6.8 Server API hardening

#### AMP91-SRV-001 — Drizzle migrations

Amaç: Fresh database bootstrappable olsun.

İşler:

- `packages/server/src/db/schema.ts` için versioned migrations generate et.
- Migration review.
- Migration apply command docs.
- CI migration drift check.

Acceptance:

- Boş Postgres DB migration ile ayağa kalkar.
- Schema change migration olmadan CI fail eder.

#### AMP91-SRV-002 — Auth scope enforcement

Amaç: Token scopes gerçekten yetki sınırı uygulasın.

İşler:

- Scope taxonomy tanımla: `rules:read`, `rules:write`, `projects:read`, `projects:write`, `audit:read`, `tokens:write`, `webhooks:write`, `validate:run`, vb.
- Middleware veya route wrapper ile scope check.
- Existing tokens backward compatibility kararı.
- Negative-path tests.

Acceptance:

- Scope'u olmayan token ilgili route'ta 403 alır.
- Tests org isolation ve route permissions kapsar.

#### AMP91-SRV-003 — CORS allowlist

Amaç: Browser-trusted dashboard dışındaki origin'leri kontrol etmek.

İşler:

- `RULEBOUND_ALLOWED_ORIGINS` env.
- Dev default ve prod default kararı.
- Tests: allowed, denied, no origin.
- Docs update.

Acceptance:

- Prod deployment default'u allow-all değildir veya açıkça config gerektirir.

#### AMP91-SRV-004 — Rate limiting strategy

Amaç: API brute force ve abuse risklerini azaltmak.

İşler:

- Reverse proxy required docs veya in-process limiter kararı.
- Token/IP based limits.
- 429 response contract.
- Health route exception.

Acceptance:

- Production deployment runbook rate limiting'i zorunlu kılar.

#### AMP91-SRV-005 — Real Postgres integration suite

Amaç: Drizzle queries ve migrations gerçek DB üzerinde doğrulansın.

İşler:

- Testcontainers veya CI service Postgres.
- Migration apply.
- CRUD smoke: projects, rules, tokens, audit, compliance, webhooks.
- Transaction/concurrency edge cases.

Acceptance:

- Server package unit test + integration test ayrımı net.

#### AMP91-SRV-006 — Webhook SSRF and delivery hardening

Amaç: Outbound webhook endpoint'leri abuse/SSRF riski yaratmasın.

İşler:

- Private IP / localhost deny policy veya explicit allow.
- Redirect policy.
- Max response body stored.
- Delivery timeout/retry docs.
- Signature verification docs.

Acceptance:

- Webhook delivery güvenlik sınırları testli ve dokümante.

#### AMP91-SRV-007 — Audit retention and PII policy

Amaç: Audit metadata'nın hassas veri taşıma riskini yönetmek.

İşler:

- Audit metadata schema guidance.
- Retention strategy docs.
- Export redaction policy.
- Dashboard display redaction.

Acceptance:

- Operators audit table'ı production'da nasıl yöneteceğini bilir.

### 6.9 Dashboard hardening

#### AMP91-WEB-001 — Dashboard e2e smoke suite

Amaç: Self-hosted preview dashboard temel akışları kırılmasın.

İşler:

- Passcode login.
- Missing backend config error state.
- Rules list/create/edit.
- Projects list/create/edit/delete.
- Webhooks list/create/test/delete.
- Audit export.
- Compliance page.

Acceptance:

- Dashboard smoke suite CI'da çalışır veya nightly olarak koşar.

#### AMP91-WEB-002 — Dashboard auth/RBAC scope statement

Amaç: Dashboard'un neyi yapmadığını netleştirmek.

İşler:

- Passcode-only session limitations docs.
- One deployment per trust boundary guidance.
- No org membership / no SSO / no role enforcement warnings.

Acceptance:

- Dashboard production SaaS gibi pazarlanmaz.

#### AMP91-WEB-003 — UI dead actions cleanup

Amaç: Preview UI'da çalışmayan buton kalmasın.

İşler:

- `UserCard` delete TODO'sunu ya implement et ya component kullanımını kaldır.
- Settings/tokens/webhooks failure states review.
- Loading and empty states review.

Acceptance:

- Kullanıcı tıklanabilir ama davranışsız UI elementi görmez.

#### AMP91-WEB-004 — Accessibility and design pass

Amaç: Dashboard ve marketing sayfaları repo design/accessibility rules'a uyumlu olsun.

İşler:

- Keyboard navigation.
- Focus states.
- Contrast audit.
- Lucide icons only; no emoji icons.
- `cursor-pointer` clickable elements.
- Reduced motion behavior.

Acceptance:

- WCAG AA temel kontrolleri geçer.

### 6.10 Gateway hardening

#### AMP91-GW-001 — Provider contract fixtures

Amaç: OpenAI, Anthropic, Google provider shape drift'ini yakalamak.

İşler:

- Non-streaming request/response fixtures.
- Streaming fixtures.
- Tool call / multimodal / empty content edge cases.
- Passthrough routes.

Acceptance:

- Provider adapter değişiklikleri fixture tests ile korunur.

#### AMP91-GW-002 — Privacy and logging hardening

Amaç: LLM prompts/responses yanlışlıkla loglanmasın.

İşler:

- Full body logging default off testleri.
- DEBUG_FULL_BODIES docs warning.
- Structured logger redaction parity.
- Request IDs without payload leak.

Acceptance:

- Default logs prompt/response body içermez.

#### AMP91-GW-003 — Streaming bounds and failure modes

Amaç: Streaming scanner memory ve partial response risklerini yönetmek.

İşler:

- Max buffered bytes.
- Malformed chunks.
- Provider disconnect.
- Scan timeout.
- Block/warn behavior by enforcement mode.

Acceptance:

- Gateway streaming under stress predictable davranır.

#### AMP91-GW-004 — Gateway deployment boundary

Amaç: Gateway'in preview olduğunu ve risklerini açıkça anlatmak.

İşler:

- Self-hosted docs preview warning.
- API key forwarding guidance.
- Network placement guidance.
- No hosted proxy promise.

Acceptance:

- Kullanıcı gateway'i production LLM traffic proxy olarak bilinçsiz kullanmaz.

### 6.11 LSP

#### AMP91-LSP-001 — LSP scope freeze

Amaç: LSP bakım maliyetini sınırlamak.

İşler:

- LSP experimental label.
- Supported diagnostics list.
- Known limitations.
- No production blocker dependency.

Acceptance:

- LSP core release'i bloklamaz.

#### AMP91-LSP-002 — Basic editor setup smoke

Amaç: LSP docs gerçekçi olsun.

İşler:

- VS Code/generic LSP config example review.
- Server starts on stdio.
- Diagnostics fixture.

Acceptance:

- Basic LSP startup smoke test yeşil.

### 6.12 SDKs

#### AMP91-SDK-001 — TypeScript SDK canonical contract

Amaç: API client/types için canonical SDK belirlemek.

İşler:

- TypeScript SDK public types review.
- Server API response types ile sync.
- Error model docs.
- Compatibility test.

Acceptance:

- TypeScript SDK diğer SDK'lar için reference olur.

#### AMP91-SDK-002 — Native SDK parity strategy

Amaç: Python/Go/Java/.NET/Rust bakım maliyetini kontrol etmek.

İşler:

- Hangi endpoint'ler parity scope içinde karar ver.
- Generated client / OpenAPI opsiyonunu değerlendir.
- Each SDK matrix requirements docs.
- Toolchain versions pinned.

Acceptance:

- Native SDK'lar core release'i gereksiz kırmaz, ama parity CI'da doğrulanır.

#### AMP91-SDK-003 — SDK release packaging

Amaç: SDK'ların publish edilebilirliği net olsun.

İşler:

- npm package name conflict review (`sdks/typescript` package name `rulebound`).
- Python package metadata.
- NuGet/Maven/Crates/go module release strategy.
- Versioning policy.

Acceptance:

- SDK release kararları dokümante.

### 6.13 Documentation

#### AMP91-DOC-001 — Docs source-of-truth policy

Amaç: `docs/*.md` ve `apps/web/content/docs/*.ts` drift riskini azaltmak.

İşler:

- Root docs authoritative mi, web docs mirror mı karar ver.
- Sync workflow yaz.
- Planned-only docs label standardı.

Acceptance:

- Aynı konu iki yerde farklı anlatılmaz.

#### AMP91-DOC-002 — Docs drift checker

Amaç: CLI/docs drift'ini otomatik yakalamak.

İşler:

- `rulebound --help` command list vs docs.
- `rulebound packs list --format json` vs docs.
- README quickstart smoke.
- Docs links check.

Acceptance:

- CLI değişince docs güncellenmeden CI geçmez.

#### AMP91-DOC-003 — Production runbooks

Amaç: Operators production deployment kararlarını doğru alabilsin.

İşler:

- Core CLI/CI runbook.
- Server deployment runbook.
- Dashboard deployment runbook.
- Gateway deployment warning/runbook.
- Incident / rollback / secret rotation docs.

Acceptance:

- Production operator deployment ve rollback adımlarını bilir.

#### AMP91-DOC-004 — Stale / planned feature audit

Amaç: Implement edilmemiş feature'lar product copy gibi görünmesin.

İşler:

- Scenario evidence pages “planned only” kalmalı.
- Server/dashboard/gateway preview copy review.
- Docs içinde `future`, `planned`, `not implemented` ifadeleri audit.

Acceptance:

- Planned features production capability gibi sunulmaz.

### 6.14 Security and compliance

#### AMP91-SEC-001 — Secret scanning gate

Amaç: Hardcoded secrets release'e girmesin.

İşler:

- gitleaks config / command.
- Rulebound analyzer integration.
- CI/release gate stage.
- False positive waiver policy.

Acceptance:

- Secret scan fail ederse release gate fail eder.

#### AMP91-SEC-002 — Dependency vulnerability scan

Amaç: Known vulnerable deps release öncesi yakalansın.

İşler:

- `pnpm audit` veya trivy/npm audit strategy.
- Native SDK deps scan strategy.
- Severity threshold.
- Waiver/exception process.

Acceptance:

- Critical/high vulnerabilities explicit exception olmadan release bloklar.

#### AMP91-SEC-003 — Threat model docs

Amaç: Product riskleri bilinçli yönetilsin.

İşler:

- CLI threat model: command/analyzer execution.
- MCP threat model: tool invocation by agents.
- Server threat model: API tokens, org isolation, audit data.
- Gateway threat model: prompt/response privacy, key forwarding.

Acceptance:

- Her surface için trust boundary ve mitigations dokümante.

#### AMP91-SEC-004 — Logging redaction consistency

Amaç: Tokens, keys, secrets logs'a düşmesin.

İşler:

- Shared logger usage audit.
- Gateway/server tests.
- Dashboard proxy error payload review.
- Analyzer stdout/stderr handling policy.

Acceptance:

- Sensitive headers/fields logs ve persisted reports'ta redacted veya documented olur.

### 6.15 Clean code and maintainability

#### AMP91-CLN-001 — Large file decomposition plan

Amaç: Yeni feature ekledikçe god-file oluşmasını engellemek.

İşler:

- `packages/cli/src/commands/check.ts` formatters/helpers modüllerine bölünebilir mi analiz.
- `apps/web/lib/dashboard-data.ts` API client/domain transforms ayrımı.
- `packages/gateway/src/proxy.ts` provider/request/scan response ayrımı.
- Refactor sadece test coverage varken yapılmalı.

Acceptance:

- Large files için incremental refactor issue'ları ve tests mevcut.

#### AMP91-CLN-002 — Shared utilities source cleanup

Amaç: `packages/shared/src` içindeki JS/DTS/TS dosya karışıklığı netleşsin.

İşler:

- Shared package build strategy karar ver.
- Checked-in JS/DTS dosyaları bilinçli mi generated mı analiz.
- Package exports ve TS build outputs standardize.

Acceptance:

- Shared package source/build contract açık.

#### AMP91-CLN-003 — Error handling consistency

Amaç: Runtime errors predictable ve actionable olsun.

İşler:

- CLI commands throw/exit behavior review.
- Server API error payload standard.
- MCP tool error payload standard.
- Gateway error payload standard.

Acceptance:

- Kullanıcı aynı tür hatalarda aynı formatı görür.

## 7. Execution phases

### Phase 0 — Plan alignment and cleanup

Hedef: Eski analiz dokümanları yerine tek master plan.

Tasks:

- Eski analiz dokümanlarını kaldır.
- `docs/amp-91-new.md` master planını ekle.
- `pnpm run check:rulebound` ile dogfood doğrula.

Exit criteria:

- Tek production readiness planı var.
- Eski/çakışan analiz dokümanı yok.

### Phase 1 — Core gate stabilization

Hedef: CLI + engine + MCP + CI release-ready.

Tasks:

- AMP91-CI-001..004
- AMP91-ENG-001..005
- AMP91-CLI-001..005
- AMP91-MCP-001..004
- AMP91-GHA-001..002
- AMP91-PACK-001..003
- AMP91-DOC-001..002

Exit criteria:

- Core CI green.
- Release gate core mode green.
- Quickstart smoke green.
- CLI/MCP parity green.
- Docs drift checker green.

### Phase 2 — Preview surfaces hardening

Hedef: Server/dashboard/gateway preview yüzeylerini güvenli controlled beta seviyesine getirmek.

Tasks:

- AMP91-SRV-001..007
- AMP91-WEB-001..004
- AMP91-GW-001..004
- AMP91-LSP-001..002

Exit criteria:

- Server migrations + scope + CORS + Postgres integration tamam.
- Dashboard e2e smoke var.
- Gateway privacy/provider/streaming tests var.
- Preview docs güncel.

### Phase 3 — SDK and platform release hardening

Hedef: Full platform release iddiası için SDK ve security gates.

Tasks:

- AMP91-SDK-001..003
- AMP91-SEC-001..004
- AMP91-DOC-003..004
- AMP91-CLN-001..003

Exit criteria:

- Native SDK parity matrix green veya explicit scoped release policy var.
- Security scans release gate'e bağlı.
- Threat model ve runbooks tamam.
- Clean code follow-up refactors planlı ve testli.

## 8. Verification matrix

| Gate | Command / mechanism | Required for core | Required for full platform |
| --- | --- | --- | --- |
| Dogfood check | `pnpm run check:rulebound` | Yes | Yes |
| Lint | `pnpm lint` | Yes | Yes |
| Core TS tests | package tests / `test:core` | Yes | Yes |
| Core build | package build / `build:core` | Yes | Yes |
| Web build | `@rulebound/web build` | Recommended | Yes |
| CLI smoke | `pnpm smoke:cli` | Yes | Yes |
| MCP parity | dedicated tests | Yes | Yes |
| Docs drift | dedicated script | Yes | Yes |
| Secret scan | gitleaks/trivy | Yes | Yes |
| Dependency scan | audit/trivy | Recommended | Yes |
| Server integration | Postgres suite | No | Yes |
| Dashboard e2e | Playwright or equivalent | No | Yes |
| Gateway contracts | provider fixtures | No | Yes |
| Native SDK parity | sdk matrix | No | Yes / release-specific |

## 9. Production launch checklist

### Core production launch checklist

- [ ] `pnpm run check:rulebound` PASS.
- [ ] `pnpm lint` PASS.
- [ ] Core tests PASS.
- [ ] Core build PASS.
- [ ] CLI smoke PASS.
- [ ] MCP parity PASS.
- [ ] GitHub Action examples validated.
- [ ] Docs drift check PASS.
- [ ] README quickstart smoke PASS.
- [ ] Secret scan PASS.
- [ ] Dependency scan reviewed.
- [ ] Release notes state stable vs preview surfaces.
- [ ] Known limitations documented.

### Full platform production checklist

- [ ] Core checklist complete.
- [ ] Server migrations committed and tested.
- [ ] Server auth scopes enforced.
- [ ] CORS allowlist configured.
- [ ] Rate limiting documented or implemented.
- [ ] Real Postgres integration tests PASS.
- [ ] Dashboard e2e PASS.
- [ ] Gateway provider contract tests PASS.
- [ ] Gateway privacy / logging tests PASS.
- [ ] Native SDK parity PASS or explicitly scoped out.
- [ ] Threat model docs complete.
- [ ] Runbooks complete.
- [ ] Rollback plan complete.
- [ ] Secret rotation procedure complete.

## 10. Out of scope until core readiness

Bu işler core production readiness tamamlanana kadar başlatılmamalı veya production blocker yapılmamalı:

- Hosted SaaS dashboard.
- Billing / quota enforcement.
- Organization invitation flows.
- Full RBAC UI.
- Scenario runner implementation.
- API twins / MCP twins built into Rulebound.
- Broad code-smell analyzer replacement features.
- Gateway hosted proxy offering.
- Expanding native SDK feature surface beyond API client/types.

## 11. Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Product surface too wide | High | Stable/beta/preview labels; core gate first. |
| Native SDK toolchains break core release | High | Separate SDK parity matrix; explicit skip/fail policy. |
| Server auth scopes missing | High | Scope enforcement before controlled beta. |
| DB migrations missing | High | Versioned migrations and drift check. |
| Gateway body leak | High | Logging redaction tests and DEBUG_FULL_BODIES warnings. |
| Docs drift | Medium | CLI/docs drift checker. |
| Analyzer side effects | Medium | `--allow-commands` docs, double-run safety, timeout. |
| Waiver abuse | Medium | Expiration/reason policy and audit visibility. |
| UI preview overpromised | Medium | Dashboard readiness docs and product copy review. |

## 12. Review plan after completion

Bu plan tamamlandıktan sonra final production review şu sırayla yapılmalı:

1. Worktree hygiene review.
2. Release gate full run review.
3. Core product walkthrough:
   - fresh repo init,
   - check,
   - CI annotations,
   - MCP deterministic tool.
4. Security review:
   - secrets,
   - command execution,
   - auth scopes,
   - logging redaction,
   - webhook SSRF.
5. Docs review:
   - README,
   - quickstart,
   - MCP setup,
   - CI action,
   - release gate,
   - preview limitations.
6. Preview surface review:
   - server,
   - dashboard,
   - gateway,
   - LSP,
   - SDKs.
7. Release decision:
   - Core production release,
   - full platform beta,
   - or block with explicit remaining tasks.

## 13. Goal section — bu plan bittiğinde neye ulaşmış olacağız?

Bu plan tamamlandığında Rulebound için hedef durum şudur:

1. **Core ürün net ve güvenilir olacak.**  
   Rulebound, CLI + engine + MCP + CI deterministic gate olarak production'a hazır kabul edilebilecek. Kullanıcı `rulebound check` çıktısına final authority olarak güvenebilecek.

2. **İlk kullanıcı deneyimi çalışır olacak.**  
   Yeni bir repo'da quickstart komutları gerçek smoke test ile doğrulanmış olacak. Kullanıcı starter pack ile düşük gürültülü şekilde başlayacak.

3. **CI ve release kararları deterministik olacak.**  
   Release gate hangi stage'in geçtiğini, kaldığını veya explicit skip edildiğini gösterecek. Native SDK toolchain eksikleri core release'i belirsiz şekilde kırmayacak.

4. **Agent entegrasyonu güvenilir olacak.**  
   MCP deterministic tools CLI ile aynı report modeline dayanacak. Agent advisory feedback ile final deterministic gate ayrımını doğru takip edecek.

5. **Dokümantasyon stale kalmayacak.**  
   CLI command list, packs ve quickstart docs otomatik kontrollerle korunacak. Planned-only ve preview feature'lar production capability gibi görünmeyecek.

6. **Server/dashboard/gateway riskleri bilinçli yönetilecek.**  
   Bu yüzeyler ya controlled beta için harden edilmiş olacak ya da preview olarak açıkça sınırlanacak. Auth scopes, migrations, CORS, rate limiting, privacy ve provider contract riskleri görünür olacak.

7. **Production öncesi review yapılabilir hale gelecek.**  
   Plan tamamlandığında son review sadece “ne eksik?” keşfi değil, checklist üzerinden objektif production decision olacak.

Final hedef:

> Bir ekip Rulebound'u production'da deterministic guardrail olarak kullanmaya başladığında, agent'ın beyanına değil, Rulebound'un kanıtlanmış deterministic checks, stable report schema, CI gate ve MCP parity sözleşmesine güvenmiş olacak.
