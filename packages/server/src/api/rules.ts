import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"
import { ruleCreateSchema, ruleUpdateSchema } from "../schemas.js"
import { requireRequestIdentity } from "../lib/request-context.js"
import {
  getAllOrgRuleSetIds,
  getEffectiveRuleSetIds,
  getOrgRuleById,
  getOrCreateDefaultGlobalRuleSet,
  resolveRulesForRuleSetIds,
} from "../lib/rules.js"
import { resolveProjectForOrg } from "../lib/projects.js"
import { emitWebhookEvent, writeAuditEntry } from "../lib/activity.js"

const app = new Hono()

app.get("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const category = c.req.query("category")
  const tag = c.req.query("tag")
  const search = c.req.query("q")
  const stack = c.req.query("stack")
  const projectIdentifier = c.req.query("project")
  const limit = parseInt(c.req.query("limit") ?? "100", 10)
  const offset = parseInt(c.req.query("offset") ?? "0", 10)

  const project = projectIdentifier
    ? await resolveProjectForOrg(db, identity.orgId, projectIdentifier)
    : null

  if (projectIdentifier && !project) {
    return c.json({ error: "Project not found" }, 404)
  }

  const ruleSetIds = project
    ? await getEffectiveRuleSetIds(db, identity.orgId, project.id)
    : await getAllOrgRuleSetIds(db, identity.orgId)

  const result = await resolveRulesForRuleSetIds(db, ruleSetIds, {
    activeOnly: false,
    category,
    tag,
    search,
    stack: stack ? [stack] : null,
  })

  const paged = [...result]
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    .slice(offset, offset + limit)

  return c.json({ data: paged, total: result.length })
})

app.get("/:id", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const rule = await getOrgRuleById(db, identity.orgId, id)

  if (!rule) return c.json({ error: "Rule not found" }, 404)
  return c.json({ data: rule })
})

app.post("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = ruleCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  let ruleSetId = parsed.data.ruleSetId

  if (ruleSetId) {
    const [existingRuleSet] = await db
      .select()
      .from(schema.ruleSets)
      .where(eq(schema.ruleSets.id, ruleSetId))

    if (!existingRuleSet || existingRuleSet.orgId !== identity.orgId) {
      return c.json({ error: "Rule set not found" }, 404)
    }
  } else {
    ruleSetId = (await getOrCreateDefaultGlobalRuleSet(db, identity.orgId)).id
  }

  const [created] = await db
    .insert(schema.rules)
    .values({
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      severity: parsed.data.severity ?? "warning",
      modality: parsed.data.modality ?? "should",
      tags: parsed.data.tags ?? [],
      stack: parsed.data.stack ?? [],
      ruleSetId,
    })
    .returning()

  await writeAuditEntry(db, {
    orgId: identity.orgId,
    userId: identity.userId,
    action: "rule.created",
    ruleId: created.id,
    status: "success",
    metadata: {
      title: created.title,
      ruleSetId: created.ruleSetId,
    },
  })

  await emitWebhookEvent(identity.orgId, "rule.created", {
    ruleId: created.id,
    title: created.title,
    ruleSetId: created.ruleSetId,
    userId: identity.userId,
  })

  return c.json({ data: created }, 201)
})

app.put("/:id", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = ruleUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const existing = await getOrgRuleById(db, identity.orgId, id)
  if (!existing) return c.json({ error: "Rule not found" }, 404)

  await db.insert(schema.ruleVersions).values({
    ruleId: id,
    version: existing.version,
    content: existing.content,
    changedBy: identity.userId,
    changeNote: parsed.data.changeNote,
  })

  const [updated] = await db
    .update(schema.rules)
    .set({
      title: parsed.data.title ?? existing.title,
      content: parsed.data.content ?? existing.content,
      category: parsed.data.category ?? existing.category,
      severity: parsed.data.severity ?? existing.severity,
      modality: parsed.data.modality ?? existing.modality,
      tags: parsed.data.tags ?? existing.tags,
      stack: parsed.data.stack ?? existing.stack,
      isActive: parsed.data.isActive ?? existing.isActive,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(schema.rules.id, id))
    .returning()

  await writeAuditEntry(db, {
    orgId: identity.orgId,
    userId: identity.userId,
    action: "rule.updated",
    ruleId: updated.id,
    status: "success",
    metadata: {
      title: updated.title,
      changeNote: parsed.data.changeNote ?? null,
      version: updated.version,
    },
  })

  await emitWebhookEvent(identity.orgId, "rule.updated", {
    ruleId: updated.id,
    title: updated.title,
    changeNote: parsed.data.changeNote ?? null,
    version: updated.version,
    userId: identity.userId,
  })

  return c.json({ data: updated })
})

app.delete("/:id", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const existing = await getOrgRuleById(db, identity.orgId, id)

  if (!existing) return c.json({ error: "Rule not found" }, 404)

  await db
    .update(schema.auditLog)
    .set({ ruleId: null })
    .where(eq(schema.auditLog.ruleId, id))
  await db.delete(schema.ruleVersions).where(eq(schema.ruleVersions.ruleId, id))
  const [deleted] = await db.delete(schema.rules).where(eq(schema.rules.id, id)).returning()

  if (!deleted) return c.json({ error: "Rule not found" }, 404)

  await writeAuditEntry(db, {
    orgId: identity.orgId,
    userId: identity.userId,
    action: "rule.deleted",
    status: "success",
    metadata: {
      ruleId: deleted.id,
      title: deleted.title,
    },
  })

  await emitWebhookEvent(identity.orgId, "rule.deleted", {
    ruleId: deleted.id,
    title: deleted.title,
    userId: identity.userId,
  })

  return c.json({ data: { deleted: true } })
})

export { app as rulesApi }
