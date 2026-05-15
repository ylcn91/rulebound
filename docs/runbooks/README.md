# Rulebound Production Runbooks

Operator-facing playbooks for installing, deploying, rolling back, and
responding to incidents across the Rulebound surfaces. Audience: a
platform engineer who is *not* a Rulebound maintainer but needs to run
the product in their own environment.

Each runbook follows the same structure:

1. **Scope** — which surface, which deployment topology.
2. **Pre-deploy checklist** — env vars, secrets, version pins.
3. **Deploy steps** — the actual commands.
4. **Post-deploy verification** — what to check before declaring done.
5. **Rollback procedure** — how to revert without data loss.

## Index

| Runbook | Surface | When you need it |
| --- | --- | --- |
| [`core-cli.md`](./core-cli.md) | CLI + engine + MCP | Installing/upgrading the deterministic gate; CI wiring. |
| [`server-deploy.md`](./server-deploy.md) | `@rulebound/server` | Standing up the HTTP API + Postgres. |
| [`dashboard-deploy.md`](./dashboard-deploy.md) | `apps/web` | Self-hosted Next.js dashboard. |
| [`gateway-deploy.md`](./gateway-deploy.md) | `@rulebound/gateway` | LLM proxy preview. |
| [`incident-response.md`](./incident-response.md) | All | Production incident — what to do. |
| [`rollback.md`](./rollback.md) | All | Reverting a bad release. |
| [`secret-rotation.md`](./secret-rotation.md) | All | Token / API key / passcode rotation. |

## Conventions

- All commands assume Node 22.x, pnpm 10.x. Where a specific version is
  required, the runbook calls it out.
- Env vars use SHOUTY_CASE. Secrets are never written to the runbook —
  refer to your secret manager (Vault, AWS Secrets Manager, etc.).
- Where infrastructure depends on out-of-scope tooling (e.g. a helm
  chart that does not exist in v0.1), the runbook says so explicitly
  rather than handwaving a "see your platform docs" answer.

## Maturity contract

These runbooks reflect Rulebound v0.1's positioning:

- **CLI + engine + MCP** are stable core. Treat them as production.
- **Server, dashboard, gateway** are **preview** surfaces (see
  [`docs/amp-91-new.md`](../amp-91-new.md) §3). Treat them as controlled
  beta. Runbook steps for preview surfaces include explicit "what is
  not in v0.1" callouts.
- **LSP** is experimental. No runbook is provided in v0.1; see
  [`packages/lsp/docs/lsp-readiness.md`](../../packages/lsp/docs/lsp-readiness.md).
- **Native SDKs** are preview. Release packaging is covered in
  AMP91-SDK-003 (Phase 3 Wave 4) — not in these runbooks.

## Cross-references

- Threat models for each surface: [`docs/threat-model/`](../threat-model/).
- Release gate stages: [`docs/release-gate.md`](../release-gate.md).
- Schema and contract: [`docs/deterministic-rule-schema.md`](../deterministic-rule-schema.md),
  [`docs/report-schema.md`](../report-schema.md).
- Waiver policy: [`docs/waivers.md`](../waivers.md).

## How to update

1. Make the change in the relevant runbook file.
2. If a change crosses surfaces (e.g. a new env var on both server and
   dashboard), update both runbooks and add a cross-link.
3. Touch [`docs/release-gate.md`](../release-gate.md) only if the
   change affects the release-gate sequence.
4. Patches to docs in `apps/web/content/docs/` happen *after*
   AMP91-DOC-001 (source-of-truth policy, Team A) merges. Until then,
   runbooks live exclusively in `docs/runbooks/`.
