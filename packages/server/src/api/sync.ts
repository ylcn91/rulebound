import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq } from "drizzle-orm"
import { createHash } from "node:crypto"
import { syncAckSchema } from "../schemas.js"
import { requireRequestIdentity } from "../lib/request-context.js"
import { resolveProjectForOrg } from "../lib/projects.js"
import { getEffectiveRuleSetIds, resolveRulesForRuleSetIds } from "../lib/rules.js"
import { emitWebhookEvent, writeAuditEntry } from "../lib/activity.js"

const app = new Hono()

function computeRulesHash(rules: Array<{ id: string; content: string; version: number }>): string {
  const hash = createHash("sha256")
  for (const rule of rules.sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(`${rule.id}:${rule.version}:${rule.content}`)
  }
  return hash.digest("hex").slice(0, 16)
}

app.get("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const projectIdentifier = c.req.query("project")
  const since = c.req.query("since")
  const stack = c.req.query("stack")

  const project = projectIdentifier
    ? await resolveProjectForOrg(db, identity.orgId, projectIdentifier)
    : null

  if (projectIdentifier && !project) {
    return c.json({ error: "Project not found" }, 404)
  }

  const ruleSetIds = await getEffectiveRuleSetIds(db, identity.orgId, project?.id)
  const dbRules = await resolveRulesForRuleSetIds(db, ruleSetIds, {
    since,
    stack: stack ? stack.split(",") : null,
  })

  const versionHash = computeRulesHash(dbRules)

  const rulesPayload = dbRules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    content: rule.content,
    category: rule.category,
    severity: rule.severity,
    modality: rule.modality,
    tags: rule.tags ?? [],
    stack: rule.stack ?? [],
    version: rule.version,
    updatedAt: rule.updatedAt,
  }))

  return c.json({
    data: rulesPayload,
    meta: {
      total: rulesPayload.length,
      versionHash,
      syncedAt: new Date().toISOString(),
    },
  })
})

app.post("/ack", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = syncAckSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const project = await resolveProjectForOrg(db, identity.orgId, parsed.data.projectId)
  if (!project) {
    return c.json({ error: "Project not found" }, 404)
  }

  const [existing] = await db
    .select()
    .from(schema.ruleSyncState)
    .where(eq(schema.ruleSyncState.projectId, project.id))

  if (existing) {
    await db
      .update(schema.ruleSyncState)
      .set({
        ruleVersionHash: parsed.data.ruleVersionHash,
        status: "synced",
        lastSyncedAt: new Date(),
      })
      .where(eq(schema.ruleSyncState.id, existing.id))
  } else {
    await db.insert(schema.ruleSyncState).values({
      projectId: project.id,
      ruleVersionHash: parsed.data.ruleVersionHash,
      status: "synced",
    })
  }

  await writeAuditEntry(db, {
    orgId: identity.orgId,
    projectId: project.id,
    userId: identity.userId,
    action: "sync.completed",
    status: "success",
    metadata: {
      project: project.slug,
      ruleVersionHash: parsed.data.ruleVersionHash,
    },
  })

  await emitWebhookEvent(identity.orgId, "sync.completed", {
    projectId: project.id,
    projectSlug: project.slug,
    ruleVersionHash: parsed.data.ruleVersionHash,
  })

  return c.json({ data: { synced: true } })
})

export { app as syncApi }
