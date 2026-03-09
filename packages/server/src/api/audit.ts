import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { auditCreateSchema } from "../schemas.js"
import { requireMatchingOrg, requireRequestIdentity } from "../lib/request-context.js"
import { listAuditEntries, renderAuditCsv } from "../lib/audit.js"
import { resolveProjectForOrg } from "../lib/projects.js"
import { writeAuditEntry } from "../lib/activity.js"

const app = new Hono()

app.get("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const orgScope = requireMatchingOrg(c, identity, c.req.query("org_id"))
  if (orgScope instanceof Response) return orgScope

  const db = getDb()
  const entries = await listAuditEntries(db, identity.orgId, {
    projectIdentifier: c.req.query("project_id"),
    action: c.req.query("action"),
    since: c.req.query("since"),
    until: c.req.query("until"),
    limit: parseInt(c.req.query("limit") ?? "50", 10),
    offset: parseInt(c.req.query("offset") ?? "0", 10),
  })

  return c.json({ data: entries, total: entries.length })
})

app.get("/export", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const orgScope = requireMatchingOrg(c, identity, c.req.query("org_id"))
  if (orgScope instanceof Response) return orgScope

  const db = getDb()
  const entries = await listAuditEntries(db, identity.orgId, {
    projectIdentifier: c.req.query("project_id"),
    action: c.req.query("action"),
    since: c.req.query("since"),
    until: c.req.query("until"),
    limit: parseInt(c.req.query("limit") ?? "50", 10),
    offset: parseInt(c.req.query("offset") ?? "0", 10),
  })

  const csv = renderAuditCsv(entries)

  c.header("Content-Type", "text/csv; charset=utf-8")
  c.header("Content-Disposition", `attachment; filename="audit-${identity.orgId}.csv"`)

  return c.body(csv)
})

app.post("/", async (c) => {
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
