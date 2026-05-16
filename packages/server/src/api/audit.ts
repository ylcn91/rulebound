import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { auditCreateSchema } from "../schemas.js"
import { requireMatchingOrg, requireRequestIdentity } from "../lib/request-context.js"
import { listAuditEntries, renderAuditCsv } from "../lib/audit.js"
import { resolveProjectForOrg } from "../lib/projects.js"
import { writeAuditEntry } from "../lib/activity.js"
import { requireScope } from "../middleware/require-scope.js"
import { invalidQueryResponse, parsePaginationQuery } from "./query.js"

const app = new Hono()

app.get("/", requireScope("audit:read"), async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const orgScope = requireMatchingOrg(c, identity, c.req.query("org_id"))
  if (orgScope instanceof Response) return orgScope

  const pagination = parsePaginationQuery({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
    defaultLimit: 50,
    maxLimit: 500,
    maxOffset: 10_000,
  })

  if (!pagination.ok) {
    return c.json(invalidQueryResponse(pagination.issue), 400)
  }

  const db = getDb()
  const entries = await listAuditEntries(db, identity.orgId, {
    projectIdentifier: c.req.query("project_id"),
    action: c.req.query("action"),
    since: c.req.query("since"),
    until: c.req.query("until"),
    limit: pagination.value.limit,
    offset: pagination.value.offset,
  })

  return c.json({ data: entries, total: entries.length })
})

app.get("/export", requireScope("audit:read"), async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const orgScope = requireMatchingOrg(c, identity, c.req.query("org_id"))
  if (orgScope instanceof Response) return orgScope

  const pagination = parsePaginationQuery({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
    defaultLimit: 50,
    maxLimit: 500,
    maxOffset: 10_000,
  })

  if (!pagination.ok) {
    return c.json(invalidQueryResponse(pagination.issue), 400)
  }

  const db = getDb()
  const entries = await listAuditEntries(db, identity.orgId, {
    projectIdentifier: c.req.query("project_id"),
    action: c.req.query("action"),
    since: c.req.query("since"),
    until: c.req.query("until"),
    limit: pagination.value.limit,
    offset: pagination.value.offset,
  })

  const csv = renderAuditCsv(entries)

  c.header("Content-Type", "text/csv; charset=utf-8")
  c.header("Content-Disposition", `attachment; filename="audit-${identity.orgId}.csv"`)

  return c.body(csv)
})

app.post("/", requireScope("audit:write"), async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = auditCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  if (parsed.data.userId && parsed.data.userId !== identity.userId) {
    return c.json({ error: "Forbidden: user scope mismatch" }, 403)
  }

  const project = parsed.data.projectId
    ? await resolveProjectForOrg(db, identity.orgId, parsed.data.projectId)
    : null

  if (parsed.data.projectId && !project) {
    return c.json({ error: "Project not found" }, 404)
  }

  const [created] = await db
    .insert(schema.auditLog)
    .values({
      orgId: identity.orgId,
      projectId: project?.id ?? null,
      userId: identity.userId,
      action: parsed.data.action,
      ruleId: parsed.data.ruleId,
      status: parsed.data.status,
      metadata: parsed.data.metadata,
    })
    .returning()

  return c.json({ data: created }, 201)
})

export { app as auditApi }
