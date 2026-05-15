# SDK versioning policy

**Status:** v0.1 policy. Synced semantic versioning across all Rulebound
SDKs, per lead-decision **C4** in
[`.claude/lead-decisions.md`](../../.claude/lead-decisions.md).

## TL;DR

All seven Rulebound SDKs bump versions together. Independent SDK
versioning is **not** allowed in v0.1. A server API contract change is
the only versioning trigger.

| SDK | Registry | Package identifier |
| --- | --- | --- |
| TypeScript | npm | `@rulebound/sdk` |
| Python | PyPI | `rulebound-sdk` |
| Go | Go modules | `github.com/rulebound/rulebound/sdks/go` |
| Java | Maven Central | `io.rulebound:rulebound-sdk` |
| .NET | NuGet | `Rulebound.Sdk` |
| Rust | crates.io | `rulebound-sdk` |

When the server API contract changes, all six native SDKs bump
together to the same version number. If only one SDK needs a patch
(e.g. a Go-only retry bug), every other SDK still publishes a patch
release with the same number, even if its code is unchanged. This is
a coordination cost, not a code cost.

## Why synced

Seven SDKs with independent semver is seven independent drift
opportunities against one server contract. Synced versioning means:

1. **One version answers "is my SDK current?"** A user on
   `@rulebound/sdk@0.3.1` knows the Python `rulebound-sdk==0.3.1`
   tracks the same server contract.
2. **One release notes file.** [`.github/workflows/sdk-parity.yml`](../../.github/workflows/sdk-parity.yml)
   builds all six SDKs against the same commit; one changelog covers
   them all.
3. **No "which SDK is canonical?" debate.** The TS SDK is the
   reference (it's the one the dashboard and `@rulebound/cli`
   consume internally), but for **publishing**, no SDK is privileged.

## Bump rules

| Rule | Trigger | All SDKs bump |
| --- | --- | --- |
| **Major** (`X.0.0`) | Breaking server API change (route removed, request/response shape changed, required field added, response field removed, error envelope `code` retired). Or breaking SDK API change (any public method/type signature change). | All six SDKs `0.x.y` → `(x+1).0.0`. |
| **Minor** (`0.X.0`) | Additive server API (new route, new optional response field, new error `code`). Or additive SDK API (new method, new optional parameter). | All six SDKs `0.x.y` → `0.(x+1).0`. |
| **Patch** (`0.0.X`) | Bug fix in one SDK (e.g. fix retry logic in Go SDK only). Internal refactor. Documentation. No public API change. | All six SDKs `0.x.y` → `0.x.(y+1)`. The SDKs that did not change still publish — the version number is the contract. |

### Concrete examples

- Server adds `POST /v1/audit/redact` (new optional endpoint):
  **Minor.** All six SDKs bump to `0.(x+1).0`. The native SDKs that
  do not yet expose the new endpoint still publish — their version
  number signals "this SDK pairs with the server release that added
  the redact endpoint, even though I don't have a method for it
  yet."
- Server changes `GET /v1/rules` response from
  `{ data: Rule[], total: number }` to `{ rules: Rule[], pagination: ... }`:
  **Major.** All SDKs to `(x+1).0.0`. Even SDKs that don't yet ship
  the new shape; they bump to signal incompatibility with the new
  server.
- Python SDK fixes a connection-pool leak that does not affect
  request/response shapes: **Patch.** All SDKs to `0.x.(y+1)` —
  five unchanged, one with the fix.

### Pre-1.0 caveat (current state)

While the SDKs are still in `0.x.y` (the v0.1 release window), the
**minor** position is the *effective major*: a breaking change bumps
the minor (e.g. `0.1.0` → `0.2.0`), per the convention common in
pre-1.0 software. The matrix above describes the post-1.0 state.

For v0.1 specifically:

- Any breaking change bumps **`0.1.x` → `0.2.0`**.
- Any additive change bumps **`0.1.x` → `0.1.(x+1)`**.
- A pure-patch (bugfix or doc) still bumps the patch position.
- `1.0.0` is gated on the master-plan production-readiness
  checklist (`docs/amp-91-new.md` §9). Until 1.0, any release MAY
  be considered preview by external consumers — the readme
  maturity tables are the source of truth.

## Release process (per release)

The same operator runs all six publishes in one session. Out-of-band
SDK releases (e.g. "let's just publish Python alone") are not
permitted.

1. Verify `.tool-versions` matches `.github/workflows/sdk-parity.yml`
   (drift fails the release gate — AMP91-CI-002).
2. Run `pnpm run check:rulebound` — deterministic gate.
3. Run `pnpm test` — TS-side test sweep (core packages + TS SDK).
4. Run `scripts/test-sdks.sh` — native SDK test sweep.
   `--skip-dotnet` is allowed iff explicitly logged in the release
   notes (per AMP91-CI-002).
5. Bump version in all six SDK manifests:
   - `sdks/typescript/package.json` `version`
   - `sdks/python/pyproject.toml` `[project] version`
   - `sdks/go/` — no manifest version. Go modules are tagged
     `sdks/go/v0.x.y` against the monorepo. The version is the
     tag.
   - `sdks/java/pom.xml` `<version>`
   - `sdks/dotnet/Rulebound/Rulebound.csproj` `<Version>`
   - `sdks/rust/Cargo.toml` `[package] version`
6. Also bump `User-Agent` strings in each SDK's HTTP client (they
   embed the version, e.g.
   `User-Agent: rulebound-sdk-ts/0.1.0`). The User-Agent suffix
   format is fixed across SDKs: `rulebound-sdk-<lang>/<version>`.
7. Update each SDK's CHANGELOG (or the unified one if the project
   moves to a single changelog later).
8. Run pre-publish dry-runs:
   - `pnpm --dir sdks/typescript publish --dry-run --access public`
   - `cd sdks/python && python -m build && twine check dist/*`
   - `cd sdks/rust && cargo publish --dry-run`
   - `cd sdks/dotnet && dotnet pack -c Release`
   - `cd sdks/java && mvn package`
   - `cd sdks/go && go build ./... && go vet ./...`
9. Publish in order: Go (tag-only), npm, PyPI, Maven, NuGet,
   crates.io. Order is not load-bearing — independent registries —
   but consistency aids the release runbook.
10. After publish, verify each registry shows the new version and
    one downstream install smoke (e.g.
    `npm install @rulebound/sdk@latest` against a temp project)
    works.

## Yanking / deprecating

If a published SDK version has a critical bug, the policy is:

- **Patch up.** Publish `0.x.(y+1)` across all six SDKs with the
  fix.
- **Do not yank.** Yanking creates lockfile churn for users and
  fragments per-SDK history. The exception is a security incident
  where the fix is "do not run this version" rather than "upgrade";
  that is an incident-response decision, not a versioning decision
  (see [`docs/runbooks/incident-response.md`](../runbooks/incident-response.md)).

## Out of scope for v0.1

- Independent per-SDK versioning. Re-visit on lead-decision update.
- A unified version-bump tool (`scripts/bump-sdk-versions.sh`). The
  v0.1 release operator runs the six edits manually; a tool can
  land in v0.2 if drift is observed.
- Automated registry publishing on tag push. v0.1 publishes are
  manual operator steps to avoid accidental publishes from CI
  pre-release branches.
- Pre-release channels (`@rulebound/sdk@next`, etc.). v0.1 ships
  only `latest` / stable tags.
