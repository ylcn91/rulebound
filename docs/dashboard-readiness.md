# Dashboard Readiness

Scope and limitations of the Rulebound web dashboard for v0.1.

## What it IS

- A **self-hosted, optional audit viewer** for deterministic runs.
- A read-mostly view of rules, projects, audit events, and compliance
  evidence produced by the CLI / MCP / CI primary path.
- A way to inspect blockers, advisory findings, waivers, and rule
  history on infrastructure you own.

## What it is NOT

- Not a hosted SaaS product.
- No org membership or organization model.
- No invite flow.
- No hosted authentication provider.
- No role-based access enforcement at the application layer.
- Not required for CLI / MCP / CI workflows. Those run standalone
  and are the primary surface for v0.1.

## Primary path

The CLI, MCP server, and CI integration are the supported way to run
Rulebound. The dashboard exists to read evidence the deterministic
pipeline emits. If the backend is offline, the CLI / MCP / CI path is
unaffected.

## Current limitations

The dashboard is a preview surface. Operators running it in front of
real traffic should be aware of the following:

- **Session model**: passcode-based sessions only. There is no SSO,
  no IdP integration, and no user account system.
- **Authorization**: the dashboard treats any holder of a valid session
  cookie as a viewer. Application-layer role enforcement is not
  implemented.
- **Rate limiting**: no per-route rate limit is enforced by the
  dashboard. Place it behind a reverse proxy / WAF if exposed to the
  public internet.
- **Multi-tenant isolation**: not designed for multi-tenant hosting.
  Run one deployment per trust boundary.
- **Audit retention**: governed by the backend store. The dashboard
  does not enforce retention or export schedules.
- **Webhooks UI**: self-hosted preview. Webhook delivery semantics and
  signing follow the backend contract; the UI is a thin viewer/editor.
- **Settings / tokens**: token issuance proxies the backend. There is
  no admin user management here.

## Deployment guidance

- Keep the dashboard on a private network or behind an authenticating
  proxy when feasible.
- Treat the dashboard as optional infrastructure. Removing it must
  never break CLI / MCP / CI.
- Do not advertise the dashboard as a SaaS endpoint. Copy in the
  product is intentionally framed as "self-hosted audit viewer" to
  match capability.

## Out of scope for v0.1

The following are not implemented and should not be promised in
product copy:

- Organization / workspace model.
- User invitations.
- Hosted authentication / SSO.
- Role management UI.
- Billing or quota enforcement.

When these land, this document is the source of truth for what is
production-ready and what remains preview.
