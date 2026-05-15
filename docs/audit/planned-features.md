# DOC-004 — Stale / Planned Feature Audit

**Date:** 2026-05-15
**Owner:** Team C (coder-c)
**Status:** Audit only — **DO NOT APPLY patches in this wave.**

This document lists every reference in `docs/**.md` and
`apps/web/content/docs/**.ts` that signals a future-tense, planned,
not-yet-implemented, or design-only feature. For each finding it
records `file:line`, the exact current text, and a recommended patch
using the standardized "PLANNED — not in v0.1" callout.

## Why audit-only

Per [`.claude/lead-decisions.md`](../../.claude/lead-decisions.md) §2.4,
Team A's **DOC-001** (source-of-truth policy: root `.md` authoritative,
`apps/web/content/docs/*.ts` mirror) must merge **before** any copy
patch is applied. Patching now would create drift between two trees
that DOC-001 will reorganize.

Team A → DOC-001 → DOC-002 (drift checker) → Team C → DOC-004 patches.

When patches are applied (later wave), every entry in this audit gets
the patch from the "Recommended patch" column.

## Standard callout

Every patch uses one of three standard shapes:

1. **Blockquote callout** (for prose paragraphs):
   ```
   > **PLANNED — not in v0.1.** <reason or scope>. Tracked in AMP91-XXX-NNN.
   ```
2. **Inline tag** (for short lines in a list):
   ```
   - <statement>  *(PLANNED — not in v0.1; AMP91-XXX-NNN)*
   ```
3. **Section header annotation** (for whole sections):
   ```
   ## Planned: `type: scenario` *(NOT IN v0.1)*
   ```

Findings flagged `OK as-is` are deliberate planned-only sections that
already carry an unambiguous disclaimer in the body — no patch needed
beyond a heading annotation for searchability.

## Findings

### Group A — `type: scenario` design-only references

These are deliberately documented as design-only and most of them are
already gated by an explicit "DESIGN ONLY / not implemented in v0.1"
banner. Patches are minor: standardize the header annotation so a
casual reader sees the status without scrolling.

| # | File | Line | Current text | Recommended patch | Verdict |
| --- | --- | --- | --- | --- | --- |
| A1 | `docs/scenario-evidence.md` | 1 | `# Scenario evidence (design)` | `# Scenario evidence (PLANNED — not in v0.1)` | Patch — sharpen the heading. |
| A2 | `docs/scenario-evidence.md` | 5 | `**DESIGN ONLY — not implemented in v0.1.**` | Keep as-is. | OK as-is. |
| A3 | `docs/scenario-evidence.md` | 91 | `A planned \`type: scenario\` check would reference this file:` | Keep — fenced "PROPOSED — not implemented in v0.1" follows. | OK as-is. |
| A4 | `docs/scenario-evidence.md` | 110 | `## First Rulebound-owned scenarios (planned)` | `## First Rulebound-owned scenarios (PLANNED — not in v0.1)` | Patch — make planned status explicit. |
| A5 | `docs/deterministic-rule-schema.md` | 240 | `## Planned: \`type: scenario\`` | `## Planned: \`type: scenario\` *(NOT IN v0.1; AMP91 — no ticket open)*` | Patch — add ticket-shaped reminder. |
| A6 | `docs/deterministic-rule-schema.md` | 242 | `\`scenario\` is not implemented yet. Do not put it in production rules until the engine supports it and the examples are covered by tests.` | Keep — already explicit. | OK as-is. |
| A7 | `docs/deterministic-rule-schema.md` | 245 | `Planned intent:` | `Planned intent (PLANNED — not in v0.1):` | Patch — minor. |
| A8 | `docs/deterministic-rule-schema.md` | 248 | `# PSEUDO / PLANNED ONLY` | Keep. | OK as-is. |
| A9 | `docs/self-healing.md` | 118 | `- Scenario evidence is planned. Once implemented, repairs must re-run the same` | `- Scenario evidence is **PLANNED — not in v0.1.** Once implemented, repairs must re-run the same` | Patch — bold-ify "PLANNED". |
| A10 | `docs/mcp-setup.md` | 126 | `- It does not judge future scenario evidence with an LLM. When scenario evidence` | `- It does not judge **planned (v0.2+)** scenario evidence with an LLM. When that evidence ships,` | Patch — replace "future" with explicit version. |
| A11 | `docs/rulebound-vs-sonarqube.md` | 57 | `- It will not become a full sandbox/twin provider. Future scenario evidence can` | `- It will not become a full sandbox/twin provider. Planned (v0.2+) scenario evidence can` | Patch — replace "Future" with versioned label. |
| A12 | `apps/web/content/docs/workflows/scenario-evidence.ts` | 5-7 | `description: "DESIGN ONLY — not implemented in v0.1. The planned shape for consuming deterministic scenario reports from external runners (Playwright, Cypress, API twins, MCP twins)."` | Keep — description already explicit. | OK as-is. |
| A13 | `apps/web/content/docs/workflows/scenario-evidence.ts` | 12 | `**DESIGN ONLY — not implemented in v0.1.**` | Keep. | OK as-is. |
| A14 | `apps/web/content/docs/workflows/scenario-evidence.ts` | 86 | `A planned \`type: scenario\` check would reference this file:` | Keep — fenced block has "PROPOSED — not implemented in v0.1" annotation. | OK as-is. |
| A15 | `apps/web/content/docs/workflows/scenario-evidence.ts` | 89 | `# PROPOSED — not implemented in v0.1.` | Keep. | OK as-is. |
| A16 | `apps/web/content/docs/workflows/scenario-evidence.ts` | 103 | `## First Rulebound-owned scenarios (planned)` | `## First Rulebound-owned scenarios (PLANNED — not in v0.1)` | Patch — mirror A4. |
| A17 | `apps/web/content/docs/workflows/self-healing.ts` | 124 | `- Scenario evidence is planned. Once implemented, repairs must re-run the same deterministic scenario report/check; an LLM explanation of the scenario is never enough.` | `- Scenario evidence is **PLANNED — not in v0.1.** Once implemented, repairs must re-run the same deterministic scenario report/check; an LLM explanation of the scenario is never enough.` | Patch — mirror A9. |
| A18 | `apps/web/content/docs/rules/deterministic-checks.ts` | 244 | `## Planned: \`type: scenario\`` | `## Planned: \`type: scenario\` *(NOT IN v0.1)*` | Patch — mirror A5. |
| A19 | `apps/web/content/docs/rules/deterministic-checks.ts` | 246 | `\`scenario\` is not implemented yet. Do not put it in production rules until the engine supports it and the examples are covered by tests.` | Keep. | OK as-is. |
| A20 | `apps/web/content/docs/rules/deterministic-checks.ts` | 248 | `Planned intent:` | `Planned intent (PLANNED — not in v0.1):` | Patch — mirror A7. |
| A21 | `apps/web/content/docs/rules/deterministic-checks.ts` | 251 | `# PSEUDO / PLANNED ONLY` | Keep. | OK as-is. |
| A22 | `apps/web/content/docs/comparisons/sonarqube.ts` | 63 | `- It will not become a full sandbox/twin provider. Future scenario evidence can require deterministic reports from external sandboxes or API twins; those systems provide the environment, Rulebound consumes the evidence.` | `- It will not become a full sandbox/twin provider. Planned (v0.2+) scenario evidence can require deterministic reports from external sandboxes or API twins; those systems provide the environment, Rulebound consumes the evidence.` | Patch — mirror A11. |
| A23 | `apps/web/content/docs/mcp/overview.ts` | 56 | `- It does not judge future scenario evidence with an LLM. When scenario evidence is added, MCP should pass deterministic scenario reports from external tools into the same evidence/check loop.` | `- It does not judge **planned (v0.2+)** scenario evidence with an LLM. When that evidence ships, MCP should pass deterministic scenario reports from external tools into the same evidence/check loop.` | Patch — mirror A10. |
| A24 | `apps/web/content/docs/mcp/setup.ts` | 128 | `- It does not judge future scenario evidence with an LLM. When scenario evidence is added, MCP should pass deterministic scenario reports from external tools into the same evidence/check loop.` | Mirror A23 patch. | Patch. |

### Group B — Action / SARIF "future enhancement" prose

These references are not feature promises; they describe internal
optimization opportunities. They should still get a tracking ticket so
a reader does not mistake them for "coming in v0.1.x".

| # | File | Line | Current text | Recommended patch | Verdict |
| --- | --- | --- | --- | --- | --- |
| B1 | `docs/ci-github-action.md` | 114-116 | `A future change may switch the action to render annotations and markdown from\na single JSON run, eliminating the trade-off. Until then, this input is the\nexplicit knob.` | `> **PLANNED — not in v0.1.** A future change may render annotations and markdown from a single JSON run, eliminating the trade-off. Until then, this input is the explicit knob. Tracked in AMP91-GHA-002.` | Patch — wrap in callout, link AMP91-GHA-002. |
| B2 | `docs/ci-github-action.md` | 140-142 | `> Note: the SARIF emitter is intentionally minimal. Helpful fields (rule\n> descriptions, fingerprints for de-duplication across runs, fix suggestions as\n> SARIF \`fixes\`) are future enhancements. File an issue if you need them.` | `> **PLANNED — not in v0.1.** The SARIF emitter is intentionally minimal. Helpful fields (rule descriptions, fingerprints for de-duplication across runs, fix suggestions as SARIF \`fixes\`) are tracked as future enhancements; file an issue if you need them.` | Patch — standardize callout. |
| B3 | `apps/web/content/docs/ci/github-action.ts` | 92 | `A future change may switch the action to render annotations and markdown from a single JSON run, eliminating the trade-off. Until then, this input is the explicit knob.` | Mirror B1 patch (single-line in `.ts` template). | Patch. |
| B4 | `apps/web/content/docs/ci/github-action.ts` | 110 | `> Note: the SARIF emitter is intentionally minimal. Helpful fields (rule descriptions, fingerprints for de-duplication across runs, fix suggestions as SARIF \`fixes\`) are future enhancements. File an issue if you need them.` | Mirror B2 patch. | Patch. |

### Group C — `dashboard-readiness.md` "not implemented" list

This is a deliberate "out of scope for v0.1" list. The current heading
is `## Out of scope for v0.1`, which is already explicit. The body
text mentions "not implemented" inside a list context.

| # | File | Line | Current text | Recommended patch | Verdict |
| --- | --- | --- | --- | --- | --- |
| C1 | `docs/dashboard-readiness.md` | 62-65 | `## Out of scope for v0.1\n\nThe following are not implemented and should not be promised in\nproduct copy:` | Keep — heading is already version-anchored and the list immediately follows. No patch required. | OK as-is. |

### Group D — `amp-91-new.md` self-references

`docs/amp-91-new.md` is the master plan itself. References to "future
work" or "planned" inside the plan are tracking entries, not user copy.
No patch needed.

| # | File | Line | Current text | Recommended patch | Verdict |
| --- | --- | --- | --- | --- | --- |
| D1 | `docs/amp-91-new.md` | 1001 | `- Planned-only docs label standardı.` | Keep — plan content. | OK as-is. |
| D2 | `docs/amp-91-new.md` | 1038 | `#### AMP91-DOC-004 — Stale / planned feature audit` | Keep — task heading. | OK as-is. |
| D3 | `docs/amp-91-new.md` | 1044 | `- Scenario evidence pages "planned only" kalmalı.` | Keep. | OK as-is. |
| D4 | `docs/amp-91-new.md` | 1046 | `` - Docs içinde `future`, `planned`, `not implemented` ifadeleri audit. `` | Keep. | OK as-is. |
| D5 | `docs/amp-91-new.md` | 1050 | `- Planned features production capability gibi sunulmaz.` | Keep. | OK as-is. |
| D6 | `docs/amp-91-new.md` | 1369 | `CLI command list, packs ve quickstart docs otomatik kontrollerle korunacak. Planned-only ve preview feature'lar production capability gibi görünmeyecek.` | Keep — goal statement. | OK as-is. |

### Group E — Runbook self-references (this wave's additions)

The runbooks introduced in this wave (`docs/runbooks/*.md`) reference
"planned" features by AMP91 task ID. These are scope-appropriate —
the runbook explicitly tells the operator "feature X is planned in
AMP91-YYY-NNN, until then do Z." Listed for transparency.

| # | File | Line | Current text | Recommended patch | Verdict |
| --- | --- | --- | --- | --- | --- |
| E1 | `docs/runbooks/server-deploy.md` | 11 | `…in-process rate limiting (planned in AMP91-SRV-004).` | Keep. | OK as-is — already linked. |
| E2 | `docs/runbooks/server-deploy.md` | multiple | "until SRV-006 ships", "Wave 2 task", etc. | Keep — task-linked. | OK as-is. |
| E3 | `docs/runbooks/incident-response.md` | 28 | `Contact points: **TBD** — operators populate their own…` | Keep — explicit placeholder per scope. | OK as-is. |
| E4 | `docs/runbooks/incident-response.md` | 198 | `AMP91-GW-003 has not yet capped the stream buffer…` | Keep — task-linked. | OK as-is. |

### Group F — Threat model "future" references

The threat model documents written in this wave use the word "future"
in a defensive sense (e.g. CLI-T6 "Future engine changes that use
`execSync` instead of `execFileSync` would re-introduce shell
parsing…"). These are residual-risk statements, not product-copy
promises. Listed for transparency.

| # | File | Line | Current text | Recommended patch | Verdict |
| --- | --- | --- | --- | --- | --- |
| F1 | `docs/threat-model/cli.md` | CLI-T6 row | `…Future engine changes that use \`execSync\` instead of \`execFileSync\`…` | Keep — residual risk language. | OK as-is. |

## Patch application order (for the follow-up wave)

When Team A's DOC-001 lands and DOC-004 patches are applied:

1. Apply Group A patches (24 entries: 13 patches, 11 already-OK).
2. Apply Group B patches (4 entries).
3. Skip Groups C, D, E, F (already conforming or out of scope).
4. Run the docs drift checker (AMP91-DOC-002) to confirm no new
   drifted entries appeared.
5. Re-run the audit grep commands below; output should be empty (per
   `.claude/team-c-plan.md` §5 Wave 3 acceptance signal).

## Verification grep commands

Run these from the repo root to confirm the audit captured every
relevant occurrence.

```sh
# Primary scan — all forward-looking terms in both doc trees.
rg -niH 'future|planned|not implemented|coming soon|not yet|TBD|design[- ]only' \
  docs/ apps/web/content/docs/

# Secondary scan — softer future-tense markers.
rg -niH 'soon|will|upcoming|deferred|out of scope|out-of-scope|roadmap' \
  docs/ apps/web/content/docs/

# After patches land, the standardized phrase should appear exactly N
# times where N matches the patched line count.
rg -niH 'PLANNED — not in v0.1' docs/ apps/web/content/docs/

# Confirm no orphan "future change" / "future enhancement" wording
# remains outside a PLANNED callout.
rg -nH 'future (change|enhancement|scenario evidence)' \
  docs/ apps/web/content/docs/ | grep -v 'PLANNED — not in v0.1'
```

The last command's output must be empty after patches apply. Until
patches apply, it returns the rows listed in Groups A2/A3, B1-B4, and
A22/A23/A24.

## Out of audit scope

Not flagged here:

- `apps/web/content/docs/getting-started/*.ts` neutral future-tense
  ("Your project will contain…") — not a feature claim.
- `apps/web/content/docs/cli/*.ts` neutral future-tense ("Re-running
  `init` will not overwrite…") — operational behavior description.
- `packages/*/docs/*.md` readiness docs (e.g.
  `packages/lsp/docs/lsp-readiness.md`,
  `packages/gateway/docs/gateway-readiness.md`) — these are
  surface-specific readiness documents owned by their package; they
  carry their own "what is in scope" sections. Out of DOC-004 audit
  scope unless they contain unflagged feature promises.

If patches land and any of the above categories surface an issue
during DOC-002 drift check, add them as a follow-up audit row.

## Cross-references

- [`docs/amp-91-new.md`](../amp-91-new.md) §6.13 — DOC-001 through
  DOC-004 task definitions.
- [`.claude/lead-decisions.md`](../../.claude/lead-decisions.md) §2.4
  — patch-after-DOC-001 ordering rule.
- [`.claude/team-c-plan.md`](../../.claude/team-c-plan.md) §5 Wave 3 —
  acceptance signals for this audit.
- [`docs/threat-model/`](../threat-model/) — threat model docs added
  alongside this audit in Wave 3.
- [`docs/runbooks/`](../runbooks/) — runbook docs added alongside this
  audit in Wave 3.
