# Rulebound Proje Analizi ve İyileştirme Önerileri

Tarih: 2026-05-14

Bu doküman, mevcut repository yapısı, paket sınırları, ürün konumlandırması ve teknik riskler üzerinden hazırlanmış hızlı ama kapsamlı bir değerlendirmedir. Amaç; projenin ne yaptığını, nereye evrilebileceğini ve hangi mimari/feature yatırımlarının en yüksek kaldıraç sağlayacağını netleştirmektir.

## Kısa özet

Rulebound, AI coding agent’lar için deterministik bir guardrail/policy-as-code katmanı olarak konumlanıyor. Ana ürün yüzeyi CLI + MCP + CI; server, gateway, dashboard, LSP ve SDK’lar ise bu çekirdeği farklı kullanım bağlamlarına taşıyan ikincil/yardımcı yüzeyler.

En güçlü fikir: “LLM’e güvenme; planı, diff’i, kanıtı ve kodu deterministik kontrollerle doğrula.” Bu konumlandırma doğru ve ayrıştırıcı. Projenin mevcut hali, bu fikri CLI/MCP/CI ile somutlaştırmış; ayrıca analyzer orchestration, waivers, bugfix workflow, self-healing ve gateway gibi daha ileri kullanım alanlarının temelini atmış.

En önemli risk: yüzey alanı çok hızlı büyümüş. CLI, engine, MCP, gateway, server, dashboard, LSP, çok dilli SDK’lar, rule packs ve docs aynı anda ilerliyor. Kısa vadede ürün odağı “deterministic core + release-ready CLI/MCP/CI” üzerinde keskinleştirilmezse bakım maliyeti ve güvenilirlik riski artar.

## Analiz sırasında çalıştırılan kontroller

- `rulebound check`: çalıştırılamadı; bu ortamda global `rulebound` komutu PATH’te yok.
- `node packages/cli/dist/index.js check --format pretty`: geçti.
  - Sonuç: `PASSED`
  - Özet: `3 pass · 0 violated · 4 n/a · 0 error · 0 blocking · 0 waived`

Not: Worktree’de analiz öncesinden gelen çok sayıda değiştirilmiş/silinmiş/untracked dosya bulunuyor. Bu rapor yalnızca yeni doküman olarak eklenmiştir; mevcut değişikliklere müdahale edilmemiştir.

## Proje ne iş yapıyor?

Rulebound şu problemi hedefliyor: AI coding agent’lar nondeterministic çalışır; plan, diff ve kod çıktılarının ekip kurallarına uyup uymadığını yalnızca agent’ın beyanına bırakmak güvenilir değildir. Rulebound bu boşluğu deterministik kontrollerle doldurur.

Temel yetenekler:

1. **Rule loading ve inheritance**
   - Markdown + YAML front matter ile insan-okunur kurallar yükleniyor.
   - `checks:` veya fenced `rulebound` blokları ile makine-çalıştırılabilir policy tanımlanıyor.

2. **Deterministik check engine**
   - Regex, AST, file exists/not exists, diff evidence, forbidden import, command, analyzer, agent-process kontrolleri.
   - Blocking kararı deterministic/advisory ayrımına göre veriliyor.

3. **CLI yüzeyi**
   - `init`, `check`, `doctor`, `evidence`, `advise`, `heal`, `bugfix`, `packs`, legacy advisory komutları.
   - CI formatları: pretty/json/github/repair-json/sarif/pr-markdown.

4. **MCP yüzeyi**
   - Agent’ların kural bulması, plan doğrulaması ve deterministic check çalıştırması için tool’lar.
   - Bugfix workflow tool’ları ile “bug condition / postcondition / preservation scenario” yaklaşımı.

5. **Gateway yüzeyi**
   - LLM proxy olarak prompt’a kural enjekte etme ve response içindeki code block’ları tarama.
   - Streaming ve non-streaming response scanning başlangıcı.

6. **Server + Dashboard**
   - Merkezi rules/projects/tokens/audit/compliance/webhook yönetimi için Hono API ve Next.js dashboard.
   - Ürün dokümanlarına göre ana ürün değil; enterprise/control-plane adayı.

7. **SDK’lar ve rule packs**
   - TypeScript, Python, Go, Rust, Java, .NET SDK yüzeyleri.
   - TypeScript/React/Security rule packages ve örnek kurallar.

## Mevcut mimari görünüm

```diagram
╭──────────────────────────╮
│ Human-readable rules      │
│ AGENTS.md / CLAUDE.md /   │
│ .rulebound/rules/*.md     │
╰────────────┬─────────────╯
             │ load + parse
             ▼
╭──────────────────────────╮
│ @rulebound/engine         │
│ rule loader, matchers,    │
│ deterministic checks      │
╰──────┬────────┬──────────╯
       │        │
       │        ├─────────────────────╮
       ▼        ▼                     ▼
╭──────────╮ ╭──────────╮       ╭────────────╮
│ CLI      │ │ MCP      │       │ Gateway    │
│ check CI │ │ agent    │       │ proxy +    │
│ doctor   │ │ tools    │       │ scanner    │
╰────┬─────╯ ╰────┬─────╯       ╰─────┬──────╯
     │            │                   │
     ▼            ▼                   ▼
╭──────────╮ ╭──────────╮       ╭────────────╮
│ CI/GitHub│ │ Coding   │       │ LLM traffic│
│ SARIF    │ │ agents   │       │ enforcement│
╰──────────╯ ╰──────────╯       ╰────────────╯

╭──────────────────────────╮
│ Server + Dashboard        │
│ optional control plane     │
│ projects, tokens, audit    │
╰──────────────────────────╯
```

## Güçlü yönler

### 1. Ürün konumlandırması net ve savunulabilir

“Deterministic checks block, advisory findings warn” ayrımı doğru bir ürün ilkesi. CodeRabbit/SonarQube/LLM-as-judge alanlarından ayrışmayı sağlıyor.

### 2. CLI/MCP/CI üçgeni doğru ana yüzey

Agent workflow için en hızlı değer bu üçgende:

- CLI: geliştirici ve CI kullanımı.
- MCP: agent’ın kendi çalışma döngüsüne policy dahil etmesi.
- CI: son güven sınırı.

### 3. Analyzer orchestration yaklaşımı doğru

PMD, Checkstyle, SpotBugs, ESLint, Semgrep, gitleaks gibi araçları yeniden yazmak yerine normalize etmek doğru strateji. Rulebound’un değeri “policy + evidence + agent workflow” katmanında kalıyor.

### 4. Bugfix workflow güçlü bir farklılaştırıcı

Bug condition, postcondition ve preservation scenario yaklaşımı, AI agent bugfix’lerinde sık görülen “fazla geniş ve regresyon üreten fix” problemini hedefliyor. Bu özellik ürünün en ilginç alanlarından biri.

### 5. Dogfooding başlamış

Repo içinde `.rulebound/rules` ve GitHub workflow’ları ile kendi kendini kontrol etme fikri uygulanmış. Bu, ürün güveni açısından önemli.

## Ana riskler ve darboğazlar

### 1. Yüzey alanı çok geniş

CLI, MCP, Gateway, Server, Dashboard, LSP, SDK’lar ve rule packs aynı anda ilerliyor. Hepsi değerli olabilir; fakat erken aşamada hepsini “production-ready” tutmak zor.

Öneri: kısa vadeli product north star şu olmalı:

> Rulebound = deterministic CLI/MCP/CI gate for AI coding agents.

Server, dashboard, gateway, LSP ve SDK’lar “labs/preview” veya “secondary” olarak açıkça etiketlenmeli.

### 2. Build artefact’leri ve generated dosya hijyeni riski

Worktree’de SDK build output’ları (`bin`, `obj`, `target` vb.) untracked görünüyor. Bunlar yanlışlıkla commit edilirse repo gürültüsü ve release paketi riski yaratır.

Öneri: `.gitignore` ve release gate içinde generated artefact kontrolleri sertleştirilmeli.

### 3. Server/dashboard migration hikayesi olgunlaşmamış görünüyor

Drizzle schema var; docs/rule da migration beklentisini anlatıyor. Fakat migration dizini/süreci net bir ürün kontratı olarak görünmüyor.

Öneri: server control-plane ciddi kullanılacaksa ilk iş migration lifecycle olmalı:

- `packages/server/migrations/`
- `db:migrate`, `db:generate`, `db:studio` script’leri
- CI’da migration drift kontrolü

### 4. CLI global erişim ile workspace erişimi ayrışıyor

Global `rulebound check` bu ortamda yok; workspace dist üzerinden check geçiyor. Geliştirici deneyimi açısından “repo içinde nasıl çalıştırılır?” net olmalı.

Öneri:

- Root script: `"check:rulebound": "node packages/cli/dist/index.js check"`
- Ya da `pnpm rulebound check` benzeri paket script’i.
- README quickstart içinde “developing this repo” bölümü.

### 5. Advisory ve deterministic yüzeyler karışmaya açık

README ayrımı iyi yapıyor; fakat CLI’da legacy/advisory komutların sayısı fazla. Yeni kullanıcı hangi komutun authoritative olduğunu kaçırabilir.

Öneri:

- CLI help metinlerinde `check` daha baskın yapılmalı.
- `validate`, `diff`, `ci`, `review` komutları “advisory/legacy” etiketiyle gruplanmalı.
- Docs’ta “authoritative command matrix” tek sayfada sunulmalı.

## Mimari iyileştirme önerileri

### P0 — Çekirdek ürün sınırını sabitle

Kısa vadede “core product” ve “adjacent/preview” ayrımı yapılmalı.

Önerilen sınıflama:

| Alan | Durum | Not |
| --- | --- | --- |
| `@rulebound/engine` | Core | Rule parsing, deterministic execution, waivers, reports |
| `@rulebound/cli` | Core | Main UX ve CI gate |
| `@rulebound/mcp` | Core | Agent integration |
| GitHub Action / CI examples | Core | Adoption için kritik |
| Rule packs | Core-adjacent | Starter + deterministic packs öncelikli |
| Gateway | Preview | Güçlü fikir ama daha riskli; ayrı roadmap |
| Server/Dashboard | Preview/Enterprise | Control plane; core’dan ayrı release maturity |
| LSP | Experimental | Faydalı ama core adoption’a göre ikincil |
| SDK’lar | Preview | API stabil olmadan çok dilli SDK maliyetli |

### P0 — Engine API kontratını daralt ve stabilize et

`@rulebound/engine` dış tüketiciler için en kritik paket. Public export yüzeyi büyüdükçe breaking change riski artar.

Öneriler:

- `engine` export’larını “stable” ve “internal/experimental” olarak ayır.
- Deterministic runner için tek ana API tasarla:
  - input: cwd, rulesDir/config, changedFiles/diff options, waivers, allowCommands
  - output: report, exit-code intent, repair payload
- CLI/MCP/Gateway aynı report modelini kullansın.

### P0 — Deterministic report schema’yı ürün kontratı yap

SARIF, GitHub annotation, repair-json, pr-markdown gibi formatlar aynı canonical report’tan türemeli. Bu report JSON schema olarak dokümante edilmeli ve snapshot testlerle korunmalı.

Öneri:

- `docs/report-schema.md`
- `packages/engine/src/report-schema.ts` veya zod schema
- JSON schema export
- Compatibility policy: patch/minor’da alan silinmez

### P1 — Rule lifecycle ve rule pack versiyonlama

Rule packs ürünün adoption alanı. Burada paket içeriği kadar lifecycle önemli.

Öneriler:

- Rule ID stability policy.
- Rule deprecation metadata (`deprecated`, `replacedBy`, `since`).
- Pack manifest: name, version, dependencies, analyzers required.
- `rulebound packs list --json` ve `doctor` içinde analyzer/toolchain açıklığı.

### P1 — Analyzer orchestration için cache ve provenance

Analyzer sonuçları pahalı ve heterojen. Report normalize edilirken provenance bilgisi güçlü tutulmalı.

Öneriler:

- Analyzer run metadata: command, version, working dir, duration, report path, report hash.
- Cache key: analyzer config + lockfile + changed files + tool version.
- “Report stale” uyarısı: report var ama diff/report timestamp uyuşmuyor.

### P1 — Gateway’i core’dan gevşek bağla

Gateway çok değerli ama güvenlik ve privacy riski yüksek bir yüzey. Prompt/response gövdeleri, streaming parser, provider uyumluluğu ve log redaction hassas.

Öneriler:

- Gateway’i `preview` olarak belgelemeye devam et.
- Default olarak body logging kapalı kalmalı.
- Provider adapter testleri contract-test şeklinde büyütülmeli.
- Gateway deterministic engine ile aynı canonical finding modeline yaklaşmalı.

### P1 — Server/dashboard için tenancy ve auth sınırlarını netleştir

Schema organizations/projects/tokens/audit/webhooks gibi enterprise sinyalleri taşıyor. Bu alan büyüyecekse auth/authorization modeli erken netleşmeli.

Öneriler:

- Organization role matrix: owner/admin/member/viewer.
- API token scope matrix.
- Row-level authorization helper’ları.
- Audit event taxonomy.
- Dashboard ile server arasında “service token proxy” modelinin güvenlik dokümanı.

### P2 — LSP ve SDK’ları adoption sinyali gelene kadar sınırlı tut

LSP ve çok dilli SDK’lar güzel ama bakım maliyetli. API stabil olmadan SDK çoğaltmak ileride migration yükü doğurur.

Öneriler:

- SDK’ları “API client + types only” seviyesinde tut.
- Önce TypeScript SDK’yı canonical yap.
- Diğer SDK’larda generated client veya OpenAPI üzerinden üretim düşün.

## Feature önerileri

### 1. `rulebound explain <finding>`

Bir violation için neden oluştuğunu, hangi rule/check’in çalıştığını, nasıl düzeltileceğini ve nasıl waiver alınacağını açıklayan komut.

Değer: developer UX ve agent repair loop’u güçlenir.

### 2. `rulebound doctor --fix`

Eksik config, starter pack, hook, script gibi güvenli otomatik düzeltmeleri yapar.

Değer: ilk kurulum sürtünmesini düşürür.

### 3. Rule test harness

Kural yazarları için fixture tabanlı test:

```text
rules/no-debugger.md
rules/no-debugger.pass.ts
rules/no-debugger.fail.ts
```

Komut:

```bash
rulebound rules test
```

Değer: rule pack kalitesi artar.

### 4. Policy coverage report

Repo içinde hangi path/stack için deterministik coverage var, hangi kurallar advisory-only, hangi analyzer raporları stale gösterir.

Değer: enterprise adoption ve güven konuşması için güçlü metrik.

### 5. PR evidence bot summary

`pr-markdown` formatı üzerine daha ürünleşmiş PR özeti:

- Blocking findings
- Advisory findings
- Waivers
- Analyzer provenance
- Changed policy coverage
- Repair instructions

### 6. Self-healing loop için bounded repair contract

`rulebound heal` güçlü fikir. Risk: repair command fazla geniş değişiklik yapabilir.

Öneri:

- allowlist paths
- max attempts
- diff size budget
- required post-checks
- generated repair log

### 7. Agent process telemetry

MCP üzerinden `find_rules_called`, `validate_plan_called`, `run_deterministic_checks_called` gibi sinyaller zaten düşünülmüş. Bunları CI evidence ile ilişkilendirmek farklılaştırıcı olur.

Değer: “agent kuralları gördü mü, planı doğruladı mı, sonra check geçti mi?” sorusuna deterministik cevap.

## Test ve kalite önerileri

### Kısa vadeli test hedefleri

1. CLI `check` için exit code matrix testleri.
2. Deterministic runner için her check type’a fixture testleri.
3. SARIF/GitHub/pr-markdown snapshot testleri.
4. MCP tool contract testleri.
5. Gateway provider adapter contract testleri.
6. Server auth/scope negative-path testleri.

### Release gate önerisi

Release öncesi minimum gate:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
node packages/cli/dist/index.js check --format github --base main
pnpm smoke:cli
```

SDK’lar ayrı matrix’e alınabilir; core release’i native SDK bağımlılıklarına gereksiz bağlamamak daha hızlı iterasyon sağlar.

## Dokümantasyon önerileri

### README akışı

README güçlü ama çok kapsamlı. İlk 2 ekran şu sorulara cevap vermeli:

1. Rulebound hangi problemi çözer?
2. 10 dakikada nasıl kurulur?
3. CI’da authoritative gate nasıl çalışır?
4. MCP ile agent’a nasıl bağlanır?
5. Analyzer’lar nasıl eklenir?

Detaylı karşılaştırmalar ve ileri özellikler alt dokümanlara taşınabilir.

### “Developing Rulebound” dokümanı

Bu repo üzerinde çalışanlar için ayrı kısa doküman önerilir:

- workspace install/build/test
- local CLI nasıl çalıştırılır
- rulebound self-check nasıl çalıştırılır
- package release/smoke test
- generated artefact temizliği

### Product maturity badges

Her yüzey için maturity etiketi:

- Stable: CLI check, deterministic engine
- Beta: MCP, rule packs, GitHub Action
- Preview: Gateway, server/dashboard
- Experimental: LSP, bazı SDK’lar

## Önceliklendirilmiş yol haritası

### 0–2 hafta: core stabilizasyon

- `rulebound check` local developer script’i ekle.
- Generated artefact ignore/cleanup kontrolünü sertleştir.
- Deterministic report schema dokümante et.
- CLI help ve README’de `check` komutunu authoritative gate olarak daha görünür yap.
- Server migration durumunu ya netleştir ya preview olarak işaretle.

### 2–6 hafta: adoption ve güven

- Rule test harness MVP.
- `doctor --fix` MVP.
- PR evidence summary iyileştirmesi.
- Analyzer provenance metadata.
- MCP deterministic tool contract testlerini genişlet.

### 6–12 hafta: enterprise/control-plane ayrımı

- Server/dashboard tenancy + auth scope modeli.
- Audit/compliance event taxonomy.
- Dashboard readiness checklist.
- Gateway preview hardening: provider contract tests, privacy guardrails, streaming edge cases.

## En yüksek etkili 10 öneri

1. Core ürün sınırını CLI + MCP + CI + engine olarak netleştir.
2. Server/dashboard/gateway/LSP/SDK yüzeylerini maturity etiketiyle ayrıştır.
3. Canonical deterministic report schema oluştur ve tüm formatları bundan türet.
4. Rule pack lifecycle ve rule ID stability policy yaz.
5. Analyzer provenance/staleness bilgisini report’a ekle.
6. `rulebound rules test` ile rule authoring kalitesini artır.
7. `doctor --fix` ile ilk kurulum sürtünmesini azalt.
8. Bugfix workflow’u ürünün ana farklılaştırıcılarından biri olarak öne çıkar.
9. Generated artefact hijyenini CI/release gate ile garanti altına al.
10. README’i “quick adoption” ve “advanced architecture” olarak iki seviyeye böl.

## Sonuç

Rulebound’un çekirdek fikri güçlü: AI coding agent çıktısını LLM yargısıyla değil, deterministik policy evidence ile doğrulamak. Mevcut repo bu fikri birçok yüzeye taşımış durumda; şimdi en önemli iş, yüzey alanını ürün olgunluğu seviyelerine ayırıp core path’i çok güvenilir hale getirmek.

Kısa vadede başarı ölçütü şu olmalı:

> Yeni bir ekip 10 dakika içinde Rulebound’u kurup CI’da deterministic gate çalıştırabilmeli; agent da MCP üzerinden aynı kuralları görüp repair loop’a girebilmeli.

Bu sağlandığında gateway, dashboard, server ve SDK’lar çok daha sağlam bir temel üzerinde büyüyebilir.
