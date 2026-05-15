# Documentation Source-of-Truth Policy

Status: stable (v0.1)
Scope: all human-facing product documentation that lives in the repository.

This document codifies the source-of-truth contract between the two documentation
surfaces that Rulebound ships:

1. **Root markdown docs**: `docs/*.md` and subdirectories (e.g. `docs/recipes/`,
   `docs/runbooks/`, `docs/sdks/`, `docs/threat-model/`).
2. **In-app documentation site**: `apps/web/content/docs/**/*.ts` (TypeScript
   modules consumed by the Next.js docs route).

Both surfaces describe the same product. Without a written contract they drift —
one updates, the other goes stale, and users get conflicting answers depending
on whether they read the docs site or `docs/` in the repo.

## Verdict

**Root `docs/*.md` is authoritative. `apps/web/content/docs/*.ts` is a mirror.**

This was set by the AMP-91 lead decision A2 (2026-05-15). The reasoning:

- CLI and MCP help text already references markdown filenames in the repo
  (`docs/quickstart.md`, `docs/mcp-setup.md`, etc.). External consumers
  (GitHub README links, copy-paste from terminal output) read those paths.
- The Next.js docs route is a Phase 2 surface. Core team should not be on the
  hook for hand-syncing TypeScript module updates every time a markdown file
  changes.
- The deterministic gate (`rulebound check`) is the v0.1 product surface. The
  docs site is supporting material; tying its update cadence to the core gate
  release would slow shipping.

## Sync workflow

### Today (v0.1)

Sync is **manual**. When you change a `docs/*.md` file, you must:

1. Decide whether the change is user-facing copy (the user reads this in the
   product) or maintainer-only documentation (release-gate, runbooks, threat
   model — operator-facing).
2. If user-facing: locate the matching `apps/web/content/docs/**/*.ts` module
   and apply the equivalent edit. The TypeScript modules use a `DocPage` shape
   that wraps markdown; the textual content within is what gets mirrored.
3. If maintainer-only: no web mirror is required.

The `docs/audit/planned-features.md` audit lists which root docs have a web
mirror today and which are root-only.

### When the drift checker lands (DOC-002, this wave)

`scripts/check-docs-drift.sh` performs four mechanical drift checks:

1. CLI command list — `rulebound --help` parsed against `docs/quickstart.md`
   command-list references.
2. Pack list — `rulebound packs list --format json` parsed against
   `docs/quickstart.md` `--pack` examples.
3. Report schema field names — `@rulebound/engine` `report-schema.ts` field
   names diffed against the `docs/report-schema.md` field tables.
4. MCP bin path — `packages/mcp/dist/index.js` existence + `docs/mcp-setup.md`
   path reference parity.

The drift checker runs as stage 8 of `scripts/release-gate.sh`. Any drift
between authoritative source code and root markdown blocks the release gate.

### v0.2 (planned)

A generator script (`scripts/sync-web-docs.ts`) will produce
`apps/web/content/docs/**/*.ts` from `docs/*.md` automatically. The plan:

- Markdown is parsed; front-matter (`title`, `description`, `tags`) becomes the
  TypeScript module's exported metadata.
- The body remains markdown; the Next.js route renders it at request time.
- The generator script becomes stage X of the release gate. Hand-edited
  `apps/web/content/docs/*.ts` files fail the gate (generated-artefact check).

Once the generator ships, the "PR that edits the web mirror without editing the
root markdown" CI rule (described below) is automated. The mirror becomes
mechanically derived from the source.

## PR rule (when DOC-002 drift checker is wired into CI)

A PR that adds or modifies content in `apps/web/content/docs/**/*.ts` **must
also** update the corresponding `docs/*.md` file. The drift checker is
authoritative; if the web mirror has content the root markdown does not, the
gate fails.

This rule does not yet block in CI as of this wave's commit — the drift checker
(DOC-002) is shipping alongside this policy, and the four checks it implements
focus on mechanical drift between CLI/engine/MCP source and root markdown. A
follow-up extension of the drift checker will compare the web mirror to root
markdown directly; until then, web-only edits are a code-review concern and a
v0.2 generator scope item.

## What lives where

| Topic                                | Authoritative source           | Web mirror?                                          |
| ------------------------------------ | ------------------------------ | ---------------------------------------------------- |
| User quickstart                      | `docs/quickstart.md`           | yes — `apps/web/content/docs/getting-started/`       |
| Deterministic rule schema            | `docs/deterministic-rule-schema.md` | yes — `apps/web/content/docs/reference/`        |
| Report schema                        | `docs/report-schema.md`        | yes (subset) — `apps/web/content/docs/reference/`    |
| MCP setup                            | `docs/mcp-setup.md`            | yes — `apps/web/content/docs/integrations/`          |
| CI GitHub Action                     | `docs/ci-github-action.md`     | yes — `apps/web/content/docs/integrations/`          |
| Bugfix workflow                      | `docs/bugfix-workflow.md`      | yes — `apps/web/content/docs/workflows/`             |
| Analyzer orchestration               | `docs/analyzer-orchestration.md` | yes — `apps/web/content/docs/workflows/`           |
| Recipes (PMD, ESLint, ...)           | `docs/recipes/*.md`            | yes — `apps/web/content/docs/recipes/`               |
| Release gate                         | `docs/release-gate.md`         | no (operator-only)                                   |
| Production runbooks                  | `docs/runbooks/*.md`           | no (operator-only)                                   |
| Threat model                         | `docs/threat-model/*.md`       | no (operator-only)                                   |
| SDK parity matrix                    | `docs/sdks/*.md`               | no (engineering reference)                           |
| Stale / planned-feature audit        | `docs/audit/*.md`              | no (engineering reference)                           |
| AMP-91 master plan                   | `docs/amp-91-new.md`           | no (engineering reference)                           |
| Refactor plans                       | `docs/refactor/*.md`           | no (engineering reference)                           |

## Out of scope for this policy

- Inline help text emitted by the CLI (`rulebound --help`). The CLI is itself
  a source of truth: docs reference it but cannot replace it. The drift checker
  catches CLI help text changes that drift away from markdown command lists.
- README at the repo root. The README is the product landing page and links to
  the `docs/` folder; it is its own authoritative surface.
- Code comments. Inline source comments are not user-facing documentation.

## Open questions deferred to v0.2

- Should the web mirror be eliminated entirely (rendering root markdown via a
  Next.js MDX route)? Pro: zero drift surface. Con: the TypeScript metadata
  shape today lets the docs route render per-section navigation, related-links,
  and search tags. A simple MDX renderer would lose that affordance unless
  reimplemented as frontmatter.
- Should a `docs/CONTRIBUTING.md` document the manual sync workflow for
  contributors editing the web mirror today? Lead opinion: defer until the
  generator script lands; manual sync is a maintainer-only concern in v0.1.
