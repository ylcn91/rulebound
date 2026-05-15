# Rulebound Threat Model

Surface-level threat models for Rulebound v0.1. Audience: platform
operators self-hosting Rulebound, plus outside security reviewers asked
to sign off on a deployment.

The goal is **not** a formal STRIDE workbook for every interface. The
goal is to capture the trust boundaries, the assets behind each
boundary, and the threats that actually map to code that ships today.
Threats are grounded in real files; each entry lists the file and a line
that demonstrates the surface exists.

## Maturity context

Rulebound's stable core is the CLI, engine, and MCP server. The HTTP
server, Next.js dashboard, and LLM gateway are **preview** surfaces.
This split is set in [`docs/amp-91-new.md`](../amp-91-new.md) and
referenced throughout these documents.

When an operator chooses to run the preview surfaces, the threat models
below describe what they are signing up for.

## Documents

| Surface | File | Scope |
| --- | --- | --- |
| CLI | [`cli.md`](./cli.md) | `rulebound check`, analyzer execution, `--allow-commands`, waivers, evidence redaction. |
| MCP | [`mcp.md`](./mcp.md) | MCP stdio server, tool surface exposed to agents, advisory vs deterministic distinction. |
| Server | [`server.md`](./server.md) | HTTP API, API tokens, org isolation, audit retention, webhook dispatcher (SSRF), CORS. |
| Gateway | [`gateway.md`](./gateway.md) | LLM proxy, body logging, API key forwarding, prompt injection, streaming bounds. |
| Secret-scan gate | [`secret-scan.md`](./secret-scan.md) | gitleaks release-gate stage, `.gitleaks.toml` allowlist policy, waiver rules, rotation cross-link. |
| Dependency-scan gate | [`dependency-scan.md`](./dependency-scan.md) | pnpm/pip/cargo/govulncheck/dotnet vulnerability scan, severity tiers, waiver policy. |

## STRIDE-light template

Each document is structured as follows. Threat entries that do not
apply are explicitly marked `n/a` rather than omitted, so a reviewer can
tell the difference between "considered and rejected" and "forgotten".

1. **Surface description** — one paragraph, who calls it and how.
2. **Trust boundary** — what is inside the boundary, what is outside.
3. **Assets behind the boundary** — what an attacker would want.
4. **Threats** — table of:
   - **ID** (e.g. `CLI-T1`)
   - **STRIDE class** (Spoofing / Tampering / Repudiation / Information
     disclosure / Denial of service / Elevation of privilege)
   - **Description** grounded in a real file/line
   - **Mitigation** (what code or operator practice limits the threat)
   - **Residual risk** (what is still left after mitigation)
   - **Linked task** (AMP91-XXX-NNN when there is in-flight work)
5. **Operator checklist** — concrete things the deployer must do.
6. **Open questions** — items deferred to a later wave or to v0.2.

## Severity conventions

- **High** — would expose secrets, allow code execution outside the
  trust boundary, or break tenant isolation in a multi-org deployment.
- **Medium** — would degrade availability or leak metadata an attacker
  can pivot on.
- **Low** — auditing/forensics gaps or UX-level confusion.

A threat marked `High` with no shipped mitigation is a release blocker.
A threat marked `Medium` may ship with an operator checklist item.

## Cross-references

- [`docs/deterministic-rule-schema.md`](../deterministic-rule-schema.md)
  for the rule schema (command/analyzer check definitions).
- [`docs/self-healing.md`](../self-healing.md) for the repair-loop
  design that interacts with CLI exit codes.
- [`docs/waivers.md`](../waivers.md) for how findings can be silenced
  (relevant to CLI threats around waiver abuse).
- [`packages/server/docs/`](../../packages/server) preview-readiness
  docs (added under DOC-003 in this wave).
- [`packages/gateway/docs/gateway-readiness.md`](../../packages/gateway/docs/gateway-readiness.md)
  for gateway preview boundary statements.

## Out of scope

- Supply-chain threats against `pnpm` registry packages — covered by
  AMP91-SEC-002 (dependency scan) and not duplicated here.
- Secrets accidentally committed to the source tree — covered by
  AMP91-SEC-001 (gitleaks in release gate) and the project's
  `.gitleaks.toml` allowlist.
- Threats against the user's own analyzers (e.g. an attacker who can
  edit `eslint.config.js`). Rulebound consumes analyzer reports; the
  analyzer's own threat model is the responsibility of its maintainer.
- Hosted-SaaS-only threats (multi-tenant scaling, billing fraud).
  Rulebound v0.1 ships as self-hosted only; see
  [`docs/amp-91-new.md`](../amp-91-new.md) §10.

## How to update

1. Add or amend a threat in the relevant surface document.
2. Link the threat to a code file/line that demonstrates it exists.
3. If mitigation work is needed, file a `AMP91-SEC-*` or surface-area
   task and cross-link it in the threat's `Linked task` column.
4. Reviewer signs off in the surface document's footer.
