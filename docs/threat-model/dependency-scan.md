# Threat Model — Dependency Vulnerability Scan (AMP91-SEC-002)

Scope: the dependency-scan release gate that runs on every PR touching
a dependency manifest, on a nightly cron, and on operator demand. It
covers the JS/TS workspace plus four of the five native SDKs (Python,
Go, Rust, .NET). The Java SDK is delegated to Dependabot per the
architectural plan.

Audience: platform operator + outside security reviewer. For the
incident-triage flow once a high/critical advisory blocks the gate, see
[`incident-response`](../runbooks/incident-response.md).

## 1. Surface description

Per ecosystem:

| Ecosystem | Tool | Manifest | Threshold |
| --- | --- | --- | --- |
| JS / TS workspace | `pnpm audit --audit-level=high` | `pnpm-lock.yaml`, `package.json` | high+ FAIL, moderate WARN |
| Python SDK | `pip-audit` over the active env (post `pip install -e sdks/python[dev]`) | `sdks/python/pyproject.toml` | high+ FAIL, moderate WARN |
| Go SDK | `govulncheck ./...` | `sdks/go/go.mod`, `go.sum` | any FAIL (binary scope is tight) |
| Rust SDK | `cargo audit --deny warnings` | `sdks/rust/Cargo.lock` | warnings FAIL (RUSTSEC advisories) |
| .NET SDK | `dotnet list package --vulnerable --include-transitive` | `sdks/dotnet/Rulebound/Rulebound.csproj` | high+ FAIL, moderate WARN |
| Java SDK | Dependabot weekly PRs | `sdks/java/pom.xml` | n/a — see §3 |

Three execution contexts:

1. **PR context** — triggered by `paths:` filter on the workflow when a
   dependency manifest changes. Fast (~3–6 min per job, parallel).
2. **Nightly cron** — `cron: "17 4 * * *"` (≈04:17 UTC daily) runs every
   job plus the `secret-scan-history` companion. Catches advisories
   published after the last PR merge.
3. **Operator on-demand** — `workflow_dispatch` allows a manual rerun
   ahead of a release candidate.

Findings are uploaded as workflow artefacts (`pnpm-audit-<run-id>`,
`pip-audit-<run-id>`, `dotnet-vuln-<run-id>`) with 30-day retention.

## 2. Trust boundary

| Inside | Outside |
| --- | --- |
| `pnpm-lock.yaml`, SDK manifests + lockfiles at the time of the scan. | Upstream package registries (npm, PyPI, crates.io, NuGet, Maven Central) — Rulebound trusts each registry's chain of custody. |
| Advisory databases queried by each tool — GitHub Advisory DB (pnpm), PyPI Advisory DB (pip-audit), `golang.org/x/vuln` DB, RustSec, NuGet vulnerability data. | The advisory databases themselves — false negatives upstream are out-of-scope until upstream catches them. |
| `audit-ci.json` allowlist and `sdks/rust/.cargo-audit.toml` ignore list (when present). | Allowlist entries past their 90-day TTL — these are treated as if the waiver never existed (§5). |
| CI runner state for the duration of the workflow. | Long-lived developer environments; the scan does not run on every laptop. |

The gate's authority ends when an artefact is published to a registry —
once `@rulebound/sdk@0.1.1` is on npm, an advisory published after the
fact is a *consumer* problem until the next release cycle.

## 3. Why Java is delegated to Dependabot

Per arch-c plan and lead verdict, the Java SDK does not run an OWASP
Dependency-Check or Snyk scan in CI for v0.1. Rationale:

- The Java SDK currently has three runtime dependencies (Apache HTTP
  client + Jackson core/databind + SLF4J API). The blast radius of a
  Java-only vulnerability is bounded by what the Java SDK actually
  imports.
- Dependency-Check requires a ~6 GB NVD download per run; cache misses
  push CI runs past 15 minutes. Cost not justified for three direct
  deps.
- Dependabot weekly PR cadence catches Maven Central advisories at
  near-real-time for the dependency set we have today.

Revisit trigger: the Java SDK grows past 5 direct third-party deps OR a
high-severity Java advisory ships in v0.1 production. At that point the
trade-off flips and we wire in `dependency-check-maven` or `snyk`.

## 4. Assets behind the boundary

- **Server runtime dependencies** (`packages/server/**`) — vulnerabilities
  here directly translate to server compromise. Hardest blast radius.
- **CLI runtime dependencies** (`packages/cli/**`, `@rulebound/engine`)
  — code-execution vulnerabilities in a CLI dep run with the developer's
  privileges. Tracked through `pnpm audit`.
- **SDK runtime dependencies** — each native SDK is the entry point for
  consumers' Rulebound integrations; a vulnerable SDK dep is a supply-chain
  risk for downstream apps.
- **Build-time dev dependencies** (`vitest`, `tsx`, `tailwindcss`, etc.)
  — lower direct risk; covered by pnpm audit at the workspace root.

## 5. Threats

| ID | STRIDE | Description | Mitigation | Residual risk |
| --- | --- | --- | --- | --- |
| SEC2-T1 | Elevation of privilege | A high/critical CVE ships in a server runtime dep (`hono`, `drizzle-orm`, `pg`); RCE / data exfil possible. | `pnpm audit --audit-level=high` runs on every dep-manifest PR and nightly. High+ findings FAIL the gate; the PR cannot merge. | Advisory database lag — between disclosure and DB update, the gate is silent. Nightly cron narrows the window to 24h. |
| SEC2-T2 | Elevation of privilege (transitive) | Transitive dep introduces a high/critical CVE; the direct dep's lockfile pin needs an update. | pnpm reports transitives by default. `dotnet list --include-transitive` flag is explicit; cargo audit walks transitives. | A dep that pins a vulnerable transitive *intentionally* (e.g. compatibility) is invisible at the gate; lockfile review catches this in PR. |
| SEC2-T3 | Denial of service (gate flakiness) | A tool's advisory DB temporarily returns 500s, the gate fails for non-security reasons. | Each job has a 10-min timeout. The release-gate stage records the failure but the operator can workflow-dispatch a rerun. | A persistent advisory DB outage stalls releases; documented escape hatch is the workflow-dispatch with a one-time waiver. |
| SEC2-T4 | Tampering | Allowlist abuse — a high/critical CVE is added to `audit-ci.json` `allowlist[]` without justification, masking a real risk. | Each `allowlist` entry requires CVE/GHSA ID, `reason` field, `expires` ≤ today + 90 days, and 2-reviewer approval (Team C + security). CODEOWNERS protects `audit-ci.json`. | A reviewer rubber-stamping the entry. Mitigated by the explicit `expires` field — even an approved entry auto-expires inside 90 days. |
| SEC2-T5 | Repudiation | After a release, no record of which CVEs were waived at gate-time. | The workflow uploads `pnpm-audit-<run-id>` etc. as artefacts (30 day retention). `audit-ci.json` is git-tracked; every waiver is a commit. Release notes call out moderate-severity warnings. | Artefact retention is shorter than the 90-day waiver TTL. Mitigated by snapshotting the allowlist into the release notes at cut time. |
| SEC2-T6 | Information disclosure | The audit report includes vulnerable version strings + advisory URLs that attackers can use to map our dep tree. | Workflow artefacts are private to repo collaborators (GitHub default). The report does not leak the full lockfile. | A leaked CI log exposes the same data; mitigated by treating CI logs as repo-confidential. |
| SEC2-T7 | Elevation of privilege (Java blind spot) | A high-severity Maven advisory ships against the Java SDK; Dependabot lags. | Dependabot weekly cadence is acceptable while the Java SDK has < 5 direct deps. Manual review on release. | If the Java SDK grows or a critical Maven advisory drops between Dependabot runs, the gate misses it. Documented revisit trigger in §3. |
| SEC2-T8 | Spoofing (registry compromise) | npm / PyPI / crates.io / NuGet account compromise leads to a poisoned package being installed and scanned-clean (no advisory exists yet). | Out of scope for the dep-scan gate. Mitigations live in the threat models for each surface (provenance attestations, SLSA, lockfile pinning). | Real — supply-chain attacks bypass the advisory DB. Tracked separately in v0.2 supply-chain hardening. |

## 6. Waiver policy

### 6.1 Severity tiers (per lead verdict C6)

| Severity | Action | Documentation |
| --- | --- | --- |
| Critical | Block release. Patch within 48 h or pin to a non-vulnerable version. | PR description must link the CVE and the patched version. |
| High | Block release. Patch within 7 d. | Same as critical. |
| Moderate | Warn-only. Release notes record the finding. | Release-cut checklist captures the list of moderate findings carried into the release. |
| Low / informational | Surface in the artefact; no gate action. | Quarterly review during the cleanup sprint. |

### 6.2 Allowlist entry requirements

A new entry in `audit-ci.json` `allowlist[]` (or
`sdks/rust/.cargo-audit.toml`, when introduced) requires:

1. **Advisory ID** — CVE-YYYY-NNNNN, GHSA-xxxx-xxxx-xxxx, or
   RUSTSEC-YYYY-NNNN. Each entry waives exactly one advisory.
2. **Inline `reason` field** — one sentence stating why the advisory
   does not apply (e.g. "we do not invoke the vulnerable XML parser
   path"). Generic reasons ("dependency does not yet have a patch")
   need an additional sentence stating the compensating control.
3. **`expires` field** — ISO-8601 date no more than 90 days from the
   PR date. After expiration the gate fails again automatically.
4. **2-reviewer approval** — Team C maintainer (CODEOWNERS) plus one
   `@rulebound/security` reviewer.
5. **Linked patch tracking issue** — open a follow-up issue
   referencing the advisory so the expiration date has a path to a
   real fix.

Reviewers reject any PR missing any of the five.

### 6.3 What is **not** a waiver

- "Tool noise" — moderate / low findings that are not actually
  applicable are warnings, not failures. They do not need a waiver
  entry; they need a release-notes line.
- "We will patch next sprint" — that is the *plan* a waiver entry
  documents, not a reason to skip the waiver entry. If the patch is
  shipping in this release, do not waive; ship the patch.
- "Dependabot will handle it" — Dependabot is the *path to the patch*,
  not the waiver. Once Dependabot opens a PR the patch lands and the
  finding clears on its own.

## 7. Operator checklist

Before approving a release, the operator confirms:

- [ ] All `dependency-scan` workflow jobs are green on the release
      candidate commit.
- [ ] No `audit-ci.json` `allowlist[]` entries past their `expires`
      date.
- [ ] Java SDK Dependabot PRs from the last 7 days are reviewed.
- [ ] The release notes include a "Known moderate dependency
      findings" section (or "None" if the warn-only jobs were green).
- [ ] Workflow artefacts for the release commit are downloaded and
      archived alongside the release manifest.
- [ ] `audit-ci.json`, `.github/workflows/dependency-scan.yml`, and
      `sdks/rust/.cargo-audit.toml` (when present) are CODEOWNER-
      protected.

## 8. Open questions

1. **Snyk vs Dependabot vs OWASP Dependency-Check for Java.** Today
   we delegate to Dependabot. Re-evaluate at the v0.2 cycle when the
   Java SDK either grows past 5 deps or a critical Maven advisory
   drops in production. Tracked: `AMP91-SEC-002-FOLLOWUP-01`.
2. **Native SDK lockfiles.** `sdks/dotnet` does not commit
   `packages.lock.json` today; the scan walks the transitive graph
   resolved at restore time, not a pinned lockfile. Decision: ship
   lockfile pinning as part of `AMP91-SEC-002-FOLLOWUP-02` for v0.2.
3. **Audit-ci wiring.** The pnpm-audit job invokes `pnpm audit`
   directly. Once `audit-ci.json` has its first entry, the job
   switches to `npx audit-ci --config audit-ci.json` so the allowlist
   is honoured automatically. Tracked: `AMP91-SEC-002-FOLLOWUP-03`.
4. **Supply-chain integrity (SLSA, provenance).** Not in v0.1 scope;
   covered by SEC2-T8 as documented residual risk. Re-evaluate at
   v0.3 when the release surface is broader.
5. **Cron skew.** Nightly at 04:17 UTC was chosen to dodge npm and
   GitHub maintenance windows. If we observe regular Sunday outages,
   add a Sunday-skip clause to the cron.

## 9. Cross-references

- [`.github/workflows/dependency-scan.yml`](../../.github/workflows/dependency-scan.yml)
  — the workflow.
- [`audit-ci.json`](../../audit-ci.json) — pnpm-audit waiver policy.
- [`scripts/release-gate.sh`](../../scripts/release-gate.sh) — stage 12
  invokes `pnpm audit --audit-level=high` for the local release gate
  (owned by Team A).
- [`docs/threat-model/secret-scan.md`](./secret-scan.md) — sister
  document for AMP91-SEC-001.
- [`docs/runbooks/incident-response.md`](../runbooks/incident-response.md)
  — triage flow when a high/critical advisory blocks the gate.
- [`docs/amp-91-new.md`](../amp-91-new.md) §6.14 AMP91-SEC-002 — task
  acceptance criteria.
