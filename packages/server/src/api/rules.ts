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
import { withTransaction } from "../lib/transaction.js"
import { requireScope } from "../middleware/require-scope.js"
import { invalidQueryResponse, parsePaginationQuery } from "./query.js"

const app = new Hono()

app.get("/", requireScope("rules:read"), async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const category = c.req.query("category")
  const tag = c.req.query("tag")
  const search = c.req.query("q")
  const stack = c.req.query("stack")
  const projectIdentifier = c.req.query("project")
  const pagination = parsePaginationQuery({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
    defaultLimit: 100,
    maxLimit: 500,
    maxOffset: 10_000,
  })

  if (!pagination.ok) {
    return c.json(invalidQueryResponse(pagination.issue), 400)
  }

  const { limit, offset } = pagination.value
  const db = getDb()

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

app.get("/:id", requireScope("rules:read"), async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const rule = await getOrgRuleById(db, identity.orgId, id)

  if (!rule) return c.json({ error: "Rule not found" }, 404)
  return c.json({ data: rule })
})

app.post("/", requireScope("rules:write"), async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = ruleCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  let ruleSetNotFound = false
  const created = await withTransaction(db, async (tx) => {
    let ruleSetId = parsed.data.ruleSetId

    if (ruleSetId) {
      const [existingRuleSet] = await tx
        .select()
        .from(schema.ruleSets)
        .where(eq(schema.ruleSets.id, ruleSetId))

      if (!existingRuleSet || existingRuleSet.orgId !== identity.orgId) {
        ruleSetNotFound = true
        return null
      }
    } else {
      ruleSetId = (await getOrCreateDefaultGlobalRuleSet(tx, identity.orgId)).id
    }

    const [inserted] = await tx
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

    await writeAuditEntry(tx, {
      orgId: identity.orgId,
      userId: identity.userId,
      action: "rule.created",
      ruleId: inserted.id,
      status: "success",
      metadata: {
        title: inserted.title,
        ruleSetId: inserted.ruleSetId,
      },
    })

    return inserted
  })

  if (ruleSetNotFound || !created) {
    return c.json({ error: "Rule set not found" }, 404)
  }

  await emitWebhookEvent(identity.orgId, "rule.created", {
    ruleId: created.id,
    title: created.title,
    ruleSetId: created.ruleSetId,
    userId: identity.userId,
  })

  return c.json({ data: created }, 201)
})

app.put("/:id", requireScope("rules:write"), async (c) => {
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

  const updated = await withTransaction(db, async (tx) => {
    const existing = await getOrgRuleById(tx, identity.orgId, id)
    if (!existing) return null

    await tx.insert(schema.ruleVersions).values({
      ruleId: id,
      version: existing.version,
      content: existing.content,
      changedBy: identity.userId,
      changeNote: parsed.data.changeNote,
    })

    const [updatedRule] = await tx
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

    await writeAuditEntry(tx, {
      orgId: identity.orgId,
      userId: identity.userId,
      action: "rule.updated",
      ruleId: updatedRule.id,
      status: "success",
      metadata: {
        title: updatedRule.title,
        changeNote: parsed.data.changeNote ?? null,
        version: updatedRule.version,
      },
    })

    return updatedRule
  })

  if (!updated) return c.json({ error: "Rule not found" }, 404)

  await emitWebhookEvent(identity.orgId, "rule.updated", {
    ruleId: updated.id,
    title: updated.title,
    changeNote: parsed.data.changeNote ?? null,
    version: updated.version,
    userId: identity.userId,
  })

  return c.json({ data: updated })
})

app.delete("/:id", requireScope("rules:write"), async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const deleted = await withTransaction(db, async (tx) => {
    const existing = await getOrgRuleById(tx, identity.orgId, id)
    if (!existing) return null

    await tx
      .update(schema.auditLog)
      .set({ ruleId: null })
      .where(eq(schema.auditLog.ruleId, id))
    await tx.delete(schema.ruleVersions).where(eq(schema.ruleVersions.ruleId, id))
    const [deletedRule] = await tx.delete(schema.rules).where(eq(schema.rules.id, id)).returning()

    if (!deletedRule) return null

    await writeAuditEntry(tx, {
      orgId: identity.orgId,
      userId: identity.userId,
      action: "rule.deleted",
      status: "success",
      metadata: {
        ruleId: deletedRule.id,
        title: deletedRule.title,
      },
    })

    return deletedRule
  })

  if (!deleted) return c.json({ error: "Rule not found" }, 404)

  await emitWebhookEvent(identity.orgId, "rule.deleted", {
    ruleId: deleted.id,
    title: deleted.title,
    userId: identity.userId,
  })

  return c.json({ data: { deleted: true } })
})

export { app as rulesApi }
