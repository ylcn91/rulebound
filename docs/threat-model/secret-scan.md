# Threat Model — Secret Scan Gate (AMP91-SEC-001)

Scope: the secret-scan release gate that wraps gitleaks and runs as
release-gate stage 9 (`scripts/release-gate.sh`), as part of
`.github/workflows/ci.yml`, and on a nightly history scan in
`.github/workflows/dependency-scan.yml`.

Audience: platform operator + outside security reviewer. The matching
threat model for already-deployed secrets (rotation, key management) is
[`server.md`](./server.md) plus the
[`secret-rotation`](../runbooks/secret-rotation.md) runbook.

## 1. Surface description

Two execution contexts:

1. **PR / branch context** — `bash scripts/secret-scan.sh` walks the
   working tree (no-git mode). Triggered by `release-gate.sh` and by the
   CI workflow on every push. Fast (~1 s), exit-code 0/1.
2. **Nightly history scan** — `bash scripts/secret-scan.sh --history`
   walks the committed git history. Triggered by the dependency-scan
   workflow's `secret-scan-history` job on cron. Slower (~1 s per ~100
   commits today; scales with history depth). Catches secrets that
   slipped past `--no-git` because they were committed before the gate
   landed.

Both modes execute `gitleaks` against `.gitleaks.toml`. Findings are
written as JSON to `gitleaks-report.json`; gitleaks itself decides
pass/fail via exit code, the wrapper translates non-zero into an
actionable failure message.

## 2. Trust boundary

| Inside | Outside |
| --- | --- |
| Repository working tree + git history at the time of the scan. | Anything not in the repo: developer laptops, CI runner state, package registry tarballs, dependency caches. |
| `.gitleaks.toml` + `gitleaks` binary on the CI runner. | Upstream gitleaks releases, the gitleaks rule pack updates. |
| The two-reviewer policy enforced by GitHub branch protection on `.gitleaks.toml` and `scripts/secret-scan.sh`. | Branch protection bypasses (admin override), force-push to `main`. |

The gate's authority ends when a secret leaves the repo — once it has
been pushed to a public branch or shipped in a release tarball, the
gate cannot recall it. Detection at that point shifts to rotation, not
prevention.

## 3. Assets behind the boundary

- **Live credentials** — API tokens (`rb_<hex>`), webhook secrets,
  encryption keys (`RULEBOUND_ENCRYPTION_KEY`), npm publish tokens
  (`NPM_TOKEN`), provider keys (OpenAI, Anthropic, Google) — see the
  full inventory in [`secret-rotation`](../runbooks/secret-rotation.md).
- **Test fixtures containing redaction sentinels** — values like
  `must-not-leak-NNN` and `test-secret-<n>` that look like credentials
  but are intentional fixtures verifying redaction works. These are
  allowlisted by path in `.gitleaks.toml` (FP-09, FP-10).
- **Docs placeholders** — strings like `Bearer YOUR_TOKEN` and
  `apiKey = "sk_live_..."` that demonstrate forbidden patterns. These
  are allowlisted by path + regex (FP-06, FP-07, FP-08, FP-11).

A real credential being committed is the attacker's primary
opportunity; the rest of this document focuses on how the gate is
expected to fail.

## 4. Threats

| ID | STRIDE | Description (file/line) | Mitigation | Residual risk |
| --- | --- | --- | --- | --- |
| SEC1-T1 | Information disclosure | A developer pastes a live API token into a test fixture or doc snippet; the token reaches `main`. | gitleaks runs as release-gate stage 9 and on every CI push. PR cannot merge if the scan fails. (`scripts/release-gate.sh`, `.github/workflows/ci.yml`). | Token committed and pushed *before* the gate runs (e.g. force-push, admin override). Mitigated by branch protection + nightly history scan that catches retroactive leaks. |
| SEC1-T2 | Tampering | Allowlist tampering — a malicious PR adds a broad `[[allowlists]]` regex that silently covers real credentials. | `.gitleaks.toml` requires CODEOWNERS review (Team C + security reviewer). Each allowlist entry MUST carry an inline comment + `AMP91-SEC-001-FP-NN` reference; PR review rejects undocumented entries. | A reviewer approving an entry without verifying the matched literal. Mitigated by the two-reviewer requirement below. |
| SEC1-T3 | Denial of service (false positives) | A noisy upstream rule fires on test fixtures or generated artefacts, blocking the release gate. | `.gitleaks.toml` allowlists known FPs by narrow path + regex pairs. The wrapper documents the next-action for triage in its FAIL message. | Newly added fixtures triggering new FPs — handled by adding a narrow allowlist entry per the waiver policy below. |
| SEC1-T4 | Spoofing (rule bypass) | Developer wraps a real secret in a pattern that does not match any gitleaks rule (e.g. base64-encodes the token before committing). | gitleaks' `useDefault = true` keeps the upstream rule pack current; new detector versions ship as part of normal upgrades. The Rulebound rule pack at `packages/rules-security/rules/no-hardcoded-secrets.md` is *informational* and not the gate. | Sufficiently novel obfuscations bypass both gitleaks and code review. Treated as a code-review failure, not a gate failure. |
| SEC1-T5 | Repudiation | After a leak is rotated, no record of the leak window remains. | The `gitleaks-report.json` artefact is uploaded as a CI artefact (workflow retention 90 days). The rotation runbook records the leak ID, the report digest, and the rotation timestamp. | Operator skipping the rotation log entry. Mitigated by the runbook's "Rotation tracking" section and the incident-response runbook. |
| SEC1-T6 | Elevation of privilege | The scan is silently skipped on a CI runner without gitleaks installed; the gate reports green by accident. | `scripts/secret-scan.sh` exits 2 with an actionable install message if `command -v gitleaks` fails; the release gate stage treats non-zero as fail. There is no "skip" path. (Lead verdict C5.) | A CI workflow that catches exit 2 and treats it as success. Mitigated by the release-gate stage skeleton's strict exit-code propagation. |
| SEC1-T7 | Information disclosure (report contents) | `gitleaks-report.json` itself contains the matched secret in a `Secret` field when `--redact` is not passed. | The wrapper always passes `--redact`. The report shows the rule ID + file + line + redacted match preview, never the full secret. | Operator running `gitleaks` directly without `--redact` and uploading the report. Documented in the FAIL-path next steps. |

## 5. Waiver policy (CRITICAL)

**A real leaked secret is never waived. It is rotated.** This is the
single load-bearing policy of this document — every other rule below
flows from it.

### 5.1 What is and is not a waiver

| Case | Action |
| --- | --- |
| gitleaks fires on a docs placeholder, test fixture, or build artefact that is provably not a credential. | Add a narrow `[[allowlists]]` entry to `.gitleaks.toml` with an inline rationale and `AMP91-SEC-001-FP-NN` reference. Treat as a FP waiver. |
| gitleaks fires on a string that *was* a credential but has since been rotated and removed from the working tree. | The string in history is still a leak. Rotate again if rotation is in doubt. Remove from history (`git filter-repo`) only if the leak window is open. Do **not** add an allowlist entry to suppress the historic match — that hides the audit trail. |
| gitleaks fires on a string that is currently a credential (any form). | STOP. Do not commit a waiver. Trigger the secret-rotation runbook with the leaked-token urgency path. Re-scan once rotation is complete. |

There is no "skip this scan for one PR" mechanism. The release-gate
stage either passes or fails.

### 5.2 Two-reviewer policy for new allowlist entries

A new `[[allowlists]]` entry in `.gitleaks.toml` requires:

1. **Two-reviewer approval** on the PR — Team C maintainer (CODEOWNER)
   plus one security-tagged reviewer (`@rulebound/security` GitHub team,
   or an operator-designated equivalent).
2. **Inline rationale comment** above the entry naming what the false
   positive is and why it cannot be a real credential.
3. **`AMP91-SEC-001-FP-NN` reference** linking the entry to the
   master plan task. Reuse an existing `FP-NN` slot only when extending
   the same false-positive case (e.g. adding another fixture path);
   create a new slot for any new pattern class.
4. **Narrowest possible scope** — prefer `paths = [...]` + `regexes =
   [...]` together over a global `regexes = [...]`. A global allowlist
   that hides one fixture also hides every future similar leak.

If any of these are missing, the PR is rejected on review. There is no
fast-path for "we know this is a placeholder, trust me".

### 5.3 Rotation reminder cross-link

Whenever a real leak is detected, the on-call engineer follows the
[`secret-rotation`](../runbooks/secret-rotation.md) procedures plus the
[`incident-response`](../runbooks/incident-response.md) leak-triage
flow. The threat-model entries SEC1-T1 and SEC1-T5 above map directly
into those runbooks.

The rotation tracking table at the bottom of `secret-rotation.md` is
the canonical leak-history log. Every confirmed leak adds a row.

## 6. Operator checklist

Before approving a release, the operator confirms:

- [ ] `bash scripts/secret-scan.sh` exits 0 against the current working
      tree.
- [ ] The nightly history scan (CI `secret-scan-history` job) was green
      within the last 24 hours.
- [ ] No `[[allowlists]]` entries were added or modified in
      `.gitleaks.toml` without two-reviewer approval since the last
      release.
- [ ] gitleaks is installed and pinned on the CI runner (CI workflow
      uses `gitleaks/gitleaks-action@v2` or equivalent with a version
      tag).
- [ ] `.gitleaks.toml`, `scripts/secret-scan.sh`, and
      `.github/workflows/dependency-scan.yml` are CODEOWNER-protected.

## 7. Open questions

1. **History scan retention.** Currently the nightly job re-scans the
   full history every night. As the repository grows past ~10k commits
   this becomes wasteful. Open: move to `--since=<last-clean-tag>` once
   we have a clean baseline tag; track in `AMP91-SEC-001-FOLLOWUP-01`.
2. **Pre-commit hook.** Today there is no pre-commit gitleaks hook;
   developers can push then discover the failure in CI. A local
   pre-commit hook would shift the gate left. Open: bundle into
   `rulebound init` as an opt-in for the security pack;
   `AMP91-SEC-001-FOLLOWUP-02`.
3. **Allowlist drift detection.** No automated check verifies that
   every `AMP91-SEC-001-FP-NN` reference in `.gitleaks.toml`
   corresponds to a real allowlist entry, or vice versa. Open: add to
   the docs-drift checker (Team A DOC-002 follow-up) when stale.
4. **gitleaks version pin in CI.** CI today picks up the
   latest gitleaks Action; a regression in a future release could
   either miss leaks (silent FN) or flood findings (DoS). Open: pin
   `gitleaks-action@v2` to a SHA once 8.30+ has stabilised.

## 8. Cross-references

- [`scripts/secret-scan.sh`](../../scripts/secret-scan.sh) — the
  wrapper script.
- [`.gitleaks.toml`](../../.gitleaks.toml) — the allowlist config.
- [`.github/workflows/dependency-scan.yml`](../../.github/workflows/dependency-scan.yml)
  — nightly history-scan job.
- [`scripts/release-gate.sh`](../../scripts/release-gate.sh) — stage 9
  invokes this script (owned by Team A).
- [`docs/runbooks/secret-rotation.md`](../runbooks/secret-rotation.md)
  — rotation procedures for every secret class.
- [`docs/runbooks/incident-response.md`](../runbooks/incident-response.md)
  — leak-triage flow.
- [`docs/amp-91-new.md`](../amp-91-new.md) §6.14 AMP91-SEC-001 — task
  acceptance criteria.
