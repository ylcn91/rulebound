<!--
Keep this template terse. For release PRs, the full readiness checklist
lives in docs/amp-91-new.md §9 and docs/release-gate.md. Link to them
instead of pasting the whole list.
-->

## Summary

<!-- Why is this change needed? 1-3 bullet points. -->

## Type

- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor
- [ ] test
- [ ] chore
- [ ] release

## Release scope (only for `release` PRs)

Pick one. Canonical checklist:
[`docs/release-gate.md`](../docs/release-gate.md) +
[`docs/amp-91-new.md` §9](../docs/amp-91-new.md#9-production-launch-checklist).
Per-gate core-vs-full requirements are defined in
[§8 verification matrix](../docs/amp-91-new.md#8-verification-matrix).

- [ ] **Core release** (CLI + engine + MCP + CI): all release-gate
      stages green; `sdk-parity` may be skipped with skipped SDKs listed
      in release notes; server / gateway / dashboard / native SDK gates
      not required.
- [ ] **Full platform release** (adds server, gateway, dashboard, native
      SDKs): core checklist complete; server real-Postgres integration,
      dashboard e2e, gateway provider contract tests, and native SDK
      parity all green (or each skip explicitly scoped out in release
      notes).

## Verification

- [ ] `pnpm run check:rulebound` PASS (deterministic self-dogfood).
- [ ] Relevant tests / lints PASS for touched packages.
- [ ] Docs updated if surface or behaviour changed.

## Notes

<!-- Drift, follow-ups, or scope intentionally left for other tickets. -->
