# Rulebound Detaylı Proje Analizi ve Eksik Listesi

Tarih: 2026-05-14  
Kapsam: repository mimarisi, ürün yüzeyi, paket sınırları, test/build durumu, dokümantasyon, CI/release hijyeni ve kısa/orta vadeli eksikler.

## Yönetici özeti

Rulebound güçlü ve net bir ürün fikrine sahip: AI coding agent çıktısını LLM yargısıyla değil, deterministik policy evidence ile doğrulamak. Repo bu fikri `engine + CLI + MCP + CI` hattında somutlaştırmış durumda. En sağlıklı ürün odağı da bu hat olmalı.

Mevcut kod tabanı test kapsaması ve paket ayrımı açısından beklenenden iyi görünüyor: engine, CLI, MCP, gateway, server ve web testleri ayrı ayrı yeşil. Local workspace CLI ile `rulebound check` de geçiyor. Ana riskler; ürün yüzeyinin fazla genişlemesi, native SDK toolchain bağımlılıklarının release gate'i kırması, generated artefact hijyeni, server/dashboard/gateway gibi ikincil yüzeylerin maturity sınırlarının daha net belgelenmesi ve canonical report/schema sözleşmesinin ürüne dönüştürülmemiş olması.

En yüksek öncelikli aksiyonlar:

1. Core ürün sınırını `engine + CLI + MCP + CI/GitHub Action` olarak sabitle.
2. Gateway, server/dashboard, LSP ve multi-language SDK'ları açıkça preview/experimental maturity etiketiyle yönet.
3. Native SDK gate'ini toolchain-aware yap; .NET 8 yoksa bütün root `pnpm build` kırılmasın ya da gereksinim açıkça fail-fast bildirilsin.
4. Generated artefact ignore/cleanup politikasını sertleştir (`sdks/java/target`, `sdks/dotnet/**/bin`, `sdks/dotnet/**/obj`, Python egg-info/cache vb.).
5. Canonical deterministic report schema'yı public sözleşme haline getir.

## Çalıştırılan kontroller

| Kontrol | Sonuç | Not |
| --- | --- | --- |
| `rulebound check` | Başarısız | Global `rulebound` komutu PATH'te yok: `command not found`. |
| `node packages/cli/dist/index.js check --format pretty` | Başarılı | `PASSED — 3 pass · 0 violated · 4 n/a · 0 error · 0 blocking · 0 waived`. |
| `pnpm --filter @rulebound/engine test` | Başarılı | 7 test dosyası, 128 test geçti. |
| `pnpm --filter @rulebound/cli test` | Başarılı | 26 test dosyası, 135 test geçti. |
| `pnpm --filter @rulebound/mcp test` | Başarılı | 5 test dosyası, 50 test geçti. Git olmayan temp dir log'u debug olarak görünüyor ama test fail değil. |
| `pnpm --filter @rulebound/gateway test` | Başarılı | 9 test dosyası, 87 test geçti. Test logları oldukça gürültülü. |
| `pnpm --filter @rulebound/server test` | Başarılı | 9 test dosyası, 61 test geçti. |
| `pnpm --filter @rulebound/web test` | Başarılı | CSS variable kontrolü + 4 test dosyası, 10 test geçti. |
| `pnpm lint` | Başarılı | Turbo lint yeşil. |
| `pnpm build` | Başarısız | TS/web build kısmı yeşil; native SDK build .NET tarafında `NETSDK1045` ile kırılıyor. Local dotnet SDK 6, proje .NET 8 hedefliyor. |
| `pnpm test:sdks:native` | Başarısız | Python ve Go geçti; .NET 8 hedefi local SDK 6 ile çalışmadığı için kırıldı. |

Ortam bilgisi:

- Node: `v22.19.0`
- pnpm: `10.28.2`
- turbo: `2.8.10`
- Local dotnet: Homebrew `dotnet@6`; .NET SDK 8 gerekli.

## Mevcut mimari

```diagram
╭────────────────────────────╮
│ İnsan-okunur policy         │
│ AGENTS.md / CLAUDE.md /     │
│ .rulebound/rules/*.md       │
╰─────────────┬──────────────╯
              │ parse + normalize
              ▼
╭────────────────────────────╮
│ @rulebound/engine           │
│ rule loader, checks, AST,    │
│ analyzers, waivers, report   │
╰──────┬──────────┬──────────╯
       │          │
       ▼          ▼
╭──────────╮  ╭──────────╮       ╭────────────╮
│ CLI      │  │ MCP      │       │ Gateway    │
│ check    │  │ agent    │       │ LLM proxy  │
│ doctor   │  │ tools    │       │ scanner    │
│ heal     │  ╰────┬─────╯       ╰─────┬──────╯
╰────┬─────╯       │                   │
     ▼             ▼                   ▼
╭──────────╮  ╭──────────╮       ╭────────────╮
│ CI / GH  │  │ Coding   │       │ Prompt /   │
│ SARIF    │  │ agents   │       │ response   │
│ summary  │  │          │       │ guardrails │
╰──────────╯  ╰──────────╯       ╰────────────╯

╭────────────────────────────╮
│ Server + Web dashboard      │
│ optional control plane:      │
│ projects, rules, tokens,     │
│ audit, compliance, webhooks  │
╰────────────────────────────╯

╭────────────────────────────╮
│ SDKs + rule packs            │
│ TS, Python, Go, Java, Rust,   │
│ .NET; React/Security/TS rules │
╰────────────────────────────╯
```

## Paket ve yüzey analizi

### `@rulebound/engine`

Rol: ürünün kalbi. Rule loading, deterministic check runner'ları, AST, analyzer parsing, waivers, bugfix modeli ve advisory matcher'lar burada.

Güçlü yönler:

- Check türleri modüler: `regex`, `ast`, `diff`, `file`, `import`, `command`, `analyzer` runner'ları ayrılmış.
- Analyzer parser testleri ve waiver testleri var.
- Tree-sitter AST hattı için fixture seviyesinde testler bulunuyor.

Eksikler / riskler:

- Public report modeli ürün sözleşmesi olarak yeterince görünür değil. CLI, MCP, SARIF, GitHub annotation, repair-json ve pr-markdown aynı canonical schema'dan türediğini daha açık göstermeli.
- Advisory matcher'lar (`keyword`, `semantic`, `llm`) ile deterministic engine aynı pakette duruyor; bu doğru olabilir ama public API'de “authoritative” ve “advisory/legacy” ayrımı net olmalı.
- Analyzer provenance metadata'sı daha güçlü olmalı: tool version, command, duration, report path/hash, stale report bilgisi.

Öneri:

- `docs/report-schema.md` ekle.
- `packages/engine` içinde stable export yüzeyi ile internal/experimental yüzeyi ayır.
- Her finding için canonical alanlar: `id`, `ruleId`, `checkId`, `source`, `deterministic`, `severity`, `status`, `message`, `location`, `evidence`, `provenance`, `waiver`.

### `@rulebound/cli`

Rol: ana kullanıcı deneyimi ve CI gate. `check`, `init`, `doctor`, `evidence`, `advise`, `heal`, `packs`, `bugfix` ve legacy komutları içeriyor.

Güçlü yönler:

- CLI test kapsamı iyi: 26 dosya / 135 test.
- `check` komutu çok formatlı output üretiyor: pretty/json/github/repair-json/sarif/pr-markdown.
- `smoke-test-cli.sh` paketlenmiş CLI installability için değerli bir e2e kontrol.

Eksikler / riskler:

- Global `rulebound check` bu ortamda yok. Repo geliştirme akışında local CLI kullanımı daha discoverable olmalı.
- Komut yüzeyi geniş: `validate`, `diff`, `ci`, `review` gibi legacy/advisory komutlar yeni kullanıcıda authoritative gate algısını bulanıklaştırabilir.
- Root `package.json` içinde doğrudan self-check script'i yok.

Öneri:

- Root script ekle: `"check:rulebound": "node packages/cli/dist/index.js check"`.
- CLI help'te `check` komutunu “authoritative deterministic gate” olarak öne çıkar.
- Legacy/advisory komutları help ve docs içinde ayrı gruba taşı.

### `@rulebound/mcp`

Rol: coding agent entegrasyonu. Agent'ın kuralları bulması, plan/diff doğrulaması, deterministic check çalıştırması ve bugfix workflow sinyali üretmesi için kritik.

Güçlü yönler:

- Deterministic tool testleri mevcut.
- Bugfix workflow MCP yüzeyine bağlanmış.
- Agent process evidence ürün farklılaştırıcısı olmaya uygun.

Eksikler / riskler:

- Testlerde git olmayan temp directory durumunda uzun `git diff` usage output'u loglanıyor. Test geçse de log hijyeni zayıf.
- MCP tool contract'ı external agent'lar için schema/version policy olarak belgelenmeli.

Öneri:

- `docs/mcp-tool-contract.md` veya mevcut MCP docs içinde tool input/output schema tablosu.
- Git olmayan dizinlerde debug log'u daha kısa ve kontrollü yap.
- `agent-process` evidence sinyallerini CI report ile ilişkilendir.

### `@rulebound/gateway`

Rol: LLM proxy; request'e rule context enjekte eder, response/code block tarar, strict/moderate modlarda block/warn davranışı üretir.

Güçlü yönler:

- Provider adapter, streaming scanner, post-response ve body-leak testleri var.
- Body logging riskine karşı test bulunması iyi.

Eksikler / riskler:

- Gateway yüksek privacy/security riski taşıyan bir yüzey. Core ürün olarak değil preview olarak kalmalı.
- Test output'u çok fazla info/warn log üretiyor; CI logları gereksiz büyüyebilir.
- Provider uyumluluğu zamanla kırılmaya açık; contract test yaklaşımı daha sistematik olmalı.

Öneri:

- Gateway docs'ta “preview / advanced / privacy-sensitive” etiketi korunmalı.
- Test ortamında logger seviyesini düşür veya structured log capture kullan.
- Provider fixture matrix oluştur: OpenAI, Anthropic, Google streaming/non-streaming response şekilleri.

### `@rulebound/server` ve `apps/web`

Rol: optional control plane / dashboard. Projects, rules, tokens, audit, compliance, webhooks, analytics ve dashboard-auth yüzeyleri var.

Güçlü yönler:

- Server testleri yeşil ve geniş alanları kapsıyor: audit, compliance, validate, webhooks, sync, startup checks.
- Dashboard kendisini “self-hosted optional audit viewer” olarak konumlandırmış; bu doğru.
- Next.js build geçiyor ve routes listesi kapsamlı.

Eksikler / riskler:

- Server/dashboard ürün maturity'si core ile karışmamalı. Optional/preview sınırını hem README hem dashboard copy hem release docs korumalı.
- DB migration lifecycle netleşmeli. Drizzle schema var ama migration governance ve drift kontrolü ürün kontratı olarak görünmeli.
- Dashboard session modeli passcode tabanlı; public internet için authz/rate-limit/tenant isolation yok. Bu zaten docs'ta yazıyor ama ürün copy'si buna göre sıkı tutulmalı.

Öneri:

- `packages/server/migrations/` ve `db:migrate` / `db:generate` scripts netleştirilsin.
- Role/scope matrix taslağı çıkarılsın: project viewer/admin, token scopes, webhook admin.
- Dashboard readiness dokümanı release checklist'e bağlansın.

### Rule packs ve örnek kurallar

Rol: adoption hızlandırıcı. Starter, deterministic examples, TypeScript/Security/React packages ve analyzer recipes bulunuyor.

Güçlü yönler:

- Analyzer orchestration yaklaşımı doğru: PMD/Checkstyle/SpotBugs/ESLint/Semgrep/gitleaks yeniden yazılmıyor, normalize ediliyor.
- README quickstart starter pack'i düşük gürültülü yol olarak öne çıkarıyor.

Eksikler / riskler:

- Rule ID stability/deprecation policy eksik.
- Pack manifest ve analyzer dependency metadata daha açık olmalı.
- Rule authoring için fixture-based test harness görünmüyor.

Öneri:

- `rulebound rules test` komutu: pass/fail fixture dosyalarıyla kural test etme.
- Pack manifest: `name`, `version`, `rules`, `requires`, `analyzers`, `maturity`, `deprecated/replacedBy`.
- `doctor` içinde pack-analyzer dependency açıklığını artır.

### Native SDK'lar

Rol: Rulebound API/SDK yüzeyini farklı ekosistemlere taşımak: Python, Go, Java, Rust, .NET, TypeScript.

Güçlü yönler:

- Python ve Go testleri local ortamda geçti.
- Root build/test SDK script'leri native toolchain varsa çalıştırmayı deniyor.

Eksikler / riskler:

- .NET SDK hedefi .NET 8; local ortamda dotnet 6 olduğu için `pnpm build` ve `pnpm test:sdks:native` kırılıyor.
- Native SDK script'leri “tool var mı?” kontrolü yapıyor ama “uygun major version mı?” kontrolü yapmıyor.
- SDK build output'ları worktree'de büyük artefact bırakıyor: Rust target yaklaşık 939 MB, Python venv 33 MB, Java target, .NET bin/obj.

Öneri:

- `scripts/build-sdks.sh` ve `scripts/test-sdks.sh` içine version-aware checks ekle:
  - .NET: `dotnet --list-sdks` içinde `8.` yoksa açık mesajla skip/fail policy.
  - Java/Maven, Rust/Cargo, Go, Python için minimum version dokümante et.
- Root build için iki mod ayır:
  - Core release: TS/web + smoke CLI.
  - Full SDK release: native matrix.
- `.gitignore` genişlet ve release gate'e generated artefact kontrolü ekle.

## Worktree ve artefact hijyeni

Analiz sırasında worktree'de analiz öncesinden gelen çok sayıda modified/untracked dosya vardı. Bunlara müdahale edilmedi. Dikkat çeken artefact'ler:

| Path | Durum / risk |
| --- | --- |
| `sdks/rust/target/` | Yaklaşık 939 MB; ignore var ama local disk/CI cache kontrolü gerek. |
| `sdks/python/.venv/` | Yaklaşık 33 MB; ignore var. Script her çalışmada yaratıyor. |
| `sdks/python/dist/` | Build artefact; ignore var. |
| `sdks/python/rulebound.egg-info/` | `*.egg-info/` ignore ile kapsanıyor olmalı. |
| `sdks/java/target/` | Maven artefact; `.gitignore` içinde açık ignore yok gibi görünüyor. |
| `sdks/dotnet/**/bin`, `sdks/dotnet/**/obj` | .NET artefact; `.gitignore` içinde açık ignore yok gibi görünüyor. |
| `packages/*/dist`, `apps/web/.next` | Global `dist/`, `.next/` ignore ile kapsanıyor. |

Önerilen `.gitignore` ekleri:

```gitignore
sdks/java/target/
sdks/dotnet/**/bin/
sdks/dotnet/**/obj/
sdks/python/.pytest_cache/
sdks/typescript/node_modules/
sdks/typescript/.turbo/
```

Release gate'e ayrıca şu kontrol eklenebilir:

```bash
git status --short --ignored \
  sdks/java/target \
  sdks/dotnet \
  sdks/python/.venv \
  sdks/rust/target
```

Amaç build output'larını commit'ten uzak tutmak ve CI cache stratejisini bilinçli kurmak.

## CI ve release gate değerlendirmesi

Mevcut CI güçlü tarafları:

- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`, self dogfood check, smoke CLI var.
- GitHub Action composite action detaylı input/output sunuyor.
- Rulebound self-dogfood workflow ayrı var.

Riskler:

- `ci.yml` Node 22 kullanırken `rulebound-self.yml` Node 20 kullanıyor. MCP build target Node 22 olarak görünüyor; Node version policy netleşmeli.
- Root `pnpm build`, native SDK build'e bağlı olduğu için local/CI toolchain farklarında kırılmaya yatkın.
- Native SDK'lar için en sağlıklısı matrix job: dotnet 8, Java, Rust, Go, Python ayrı kurulumlarla test edilmeli.

Öneri:

1. Node policy: README, CI ve package targets aynı çizgide olsun. Eğer Node 22 gerekiyorsa tüm workflow'lar Node 22.
2. `pnpm build` core mı full release mi karar verilsin. Core build native SDK'lara bağlı kalmayabilir.
3. Native SDK job'ları ayrı matrix'e taşınsın:
   - `sdk-python`
   - `sdk-go`
   - `sdk-java`
   - `sdk-dotnet` with SDK 8
   - `sdk-rust`
4. Release gate summary mevcut; buna environment/toolchain version summary eklenmeli.

## Dokümantasyon durumu

Güçlü yönler:

- README ürün konumlandırmasını iyi anlatıyor.
- Deterministic/advisory ayrımı net.
- Analyzer orchestration, self-healing, bugfix workflow, CI action, waivers ve quickstart dokümanları mevcut.
- Dashboard readiness dokümanı doğru beklenti yönetimi yapıyor.

Eksikler:

- “Developing Rulebound” dokümanı eksik: local CLI nasıl çalıştırılır, self-check nasıl yapılır, SDK toolchain nasıl kurulur, generated artefact nasıl temizlenir.
- Report schema dokümanı eksik.
- MCP tool contract dokümanı daha detaylı olmalı.
- Maturity matrix tek yerde olmalı.

Önerilen yeni/iyileştirilecek dokümanlar:

1. `docs/developing-rulebound.md`
   - Node/pnpm version
   - `pnpm install`, `pnpm lint`, `pnpm test`, `pnpm build`
   - local `node packages/cli/dist/index.js check`
   - native SDK prerequisites
   - cleanup commands
2. `docs/report-schema.md`
   - Canonical JSON report
   - finding schema
   - exit code mapping
   - SARIF/GitHub/pr-markdown derivation
3. `docs/maturity-matrix.md`
   - Stable: engine, CLI check, deterministic core
   - Beta: MCP, GitHub Action, starter packs
   - Preview: gateway, server/dashboard
   - Experimental: LSP, non-TS SDKs
4. `docs/mcp-tool-contract.md`
   - tool list
   - input/output schemas
   - versioning guarantees

## Eksik / yapılacaklar listesi

### P0 — Hemen ele alınmalı

- [ ] Native SDK scripts version-aware olsun; .NET 8 yoksa anlaşılır hata veya bilinçli skip.
- [ ] `pnpm build` kırılmasının release policy açısından anlamı netleştirilsin: core build mi full SDK build mi?
- [ ] `.gitignore` Java target ve .NET bin/obj artefact'lerini açıkça kapsasın.
- [ ] Root self-check script'i eklensin: local `rulebound check` kullanımını kolaylaştır.
- [ ] Node version policy CI/workflow/package target arasında hizalansın.
- [ ] Gateway/MCP test log gürültüsü azaltılsın.

### P1 — Core product kalitesini artırır

- [ ] Canonical deterministic report schema dokümante edilsin ve snapshot testlerle korunmalı.
- [ ] Engine public API stable/internal olarak ayrıştırılsın.
- [ ] Analyzer provenance ve stale-report bilgisi report'a eklensin.
- [ ] Rule pack manifest ve rule ID stability policy yazılsın.
- [ ] `rulebound rules test` fixture harness MVP çıkarılsın.
- [ ] `doctor --fix` güvenli otomatik düzeltmeler için tasarlansın.
- [ ] MCP tool schema/version contract dokümante edilsin.

### P2 — Ürünleşme ve adoption

- [ ] PR evidence summary daha ürünleşmiş hale getirilsin: blockers, warnings, waivers, analyzer provenance, repair hints.
- [ ] Policy coverage report: hangi path/stack hangi deterministic check ile kapsanıyor?
- [ ] Server/dashboard authz, token scopes ve tenancy modeli netleştirilsin.
- [ ] Gateway provider contract fixture matrix genişletilsin.
- [ ] SDK'lar OpenAPI/generated client stratejisiyle standardize edilsin.

## Önerilen yol haritası

### 0–2 hafta

1. Build kırılmasını çöz: .NET 8 requirement + script policy.
2. Generated artefact ignore/cleanup PR'ı.
3. `docs/developing-rulebound.md` ve root `check:rulebound` script'i.
4. CI Node version hizalama.
5. Gateway/MCP test log cleanup.

### 2–6 hafta

1. Canonical report schema ve `docs/report-schema.md`.
2. Rule pack manifest + ID stability policy.
3. Analyzer provenance metadata.
4. `rulebound rules test` MVP.
5. MCP contract docs.

### 6–12 hafta

1. Server/dashboard maturity hardening: authz, scopes, migrations, audit taxonomy.
2. Gateway preview hardening: provider matrix, privacy docs, streaming edge cases.
3. Native SDK matrix CI.
4. Policy coverage report.

## Sonuç

Rulebound'un çekirdeği doğru yerde: deterministik engine, CLI check, MCP agent entegrasyonu ve CI gate. Test sonuçları bu çekirdeğin sağlıklı ilerlediğini gösteriyor. En önemli problem kod kalitesinden çok ürün ve release sınırları: çok sayıda yüzey aynı anda büyüyor ve native SDK toolchain'leri root build'i kırabiliyor.

Kısa vadede hedef şu olmalı:

> Yeni bir ekip 10 dakika içinde Rulebound'u kurup CI'da deterministic gate çalıştırabilmeli; agent MCP üzerinden aynı kuralları görebilmeli; repo geliştiricisi de tek komutla local self-check yapabilmeli.

Bu hedef için P0 listesindeki build/toolchain/artefact/script işleri önce çözülürse, projenin mevcut güçlü çekirdeği daha güvenilir ve yayınlanabilir hale gelir.
