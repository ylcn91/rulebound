import { Hono } from "hono"
import { and, desc, eq } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"
import { projectCreateSchema, projectUpdateSchema } from "../schemas.js"
import { requireRequestIdentity } from "../lib/request-context.js"
import {
  hydrateProjectsWithRuleSetIds,
  replaceProjectRuleSetLinks,
  resolveProjectForOrg,
  slugifyProjectName,
} from "../lib/projects.js"

const app = new Hono()

app.get("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const projects = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.orgId, identity.orgId))
    .orderBy(desc(schema.projects.updatedAt))

  const hydrated = await hydrateProjectsWithRuleSetIds(db, projects)

  return c.json({ data: hydrated, total: hydrated.length })
})

app.post("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = projectCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const db = getDb()
  const slug = parsed.data.slug ?? slugifyProjectName(parsed.data.name)

  const [existingSlug] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.orgId, identity.orgId), eq(schema.projects.slug, slug)))

  if (existingSlug) {
    return c.json({ error: "Project slug already exists" }, 409)
  }

  const [created] = await db
    .insert(schema.projects)
    .values({
      orgId: identity.orgId,
      name: parsed.data.name,
      slug,
      repoUrl: parsed.data.repoUrl ?? null,
      stack: parsed.data.stack ?? [],
    })
    .returning()

  let ruleSetIds: string[]
  try {
    ruleSetIds = await replaceProjectRuleSetLinks(
      db,
      identity.orgId,
      created.id,
      parsed.data.ruleSetIds ?? []
    )
  } catch (error) {
    await db.delete(schema.projects).where(eq(schema.projects.id, created.id))
    return c.json(
      { error: error instanceof Error ? error.message : "Invalid rule set links" },
      400
    )
  }

  return c.json({ data: { ...created, ruleSetIds } }, 201)
})

app.get("/:id", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const project = await resolveProjectForOrg(db, identity.orgId, id)

  if (!project) return c.json({ error: "Project not found" }, 404)

  const [hydrated] = await hydrateProjectsWithRuleSetIds(db, [project])
  return c.json({ data: hydrated })
})

app.put("/:id", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = projectUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const db = getDb()
  const id = c.req.param("id")
  const existing = await resolveProjectForOrg(db, identity.orgId, id)

  if (!existing) return c.json({ error: "Project not found" }, 404)

  const updates: Partial<typeof schema.projects.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug
  if (parsed.data.repoUrl !== undefined) updates.repoUrl = parsed.data.repoUrl
  if (parsed.data.stack !== undefined) updates.stack = parsed.data.stack

  if (updates.slug) {
    const [conflictingSlug] = await db
      .select()
      .from(schema.projects)
      .where(and(eq(schema.projects.orgId, identity.orgId), eq(schema.projects.slug, updates.slug)))

    if (conflictingSlug && conflictingSlug.id !== existing.id) {
      return c.json({ error: "Project slug already exists" }, 409)
    }
  }

  const [updated] = await db
    .update(schema.projects)
    .set(updates)
    .where(eq(schema.projects.id, existing.id))
    .returning()

  let ruleSetIds: string[] | undefined
  if (parsed.data.ruleSetIds !== undefined) {
    try {
      ruleSetIds = await replaceProjectRuleSetLinks(
        db,
        identity.orgId,
        existing.id,
        parsed.data.ruleSetIds
      )
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Invalid rule set links" },
        400
      )
    }
  }

  const [hydrated] = await hydrateProjectsWithRuleSetIds(db, [updated])
  return c.json({
    data: {
      ...hydrated,
      ruleSetIds: ruleSetIds ?? hydrated.ruleSetIds,
    },
  })
})

app.delete("/:id", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const existing = await resolveProjectForOrg(db, identity.orgId, id)

  if (!existing) return c.json({ error: "Project not found" }, 404)

  await db.delete(schema.projectRuleSets).where(eq(schema.projectRuleSets.projectId, existing.id))
  await db.delete(schema.ruleSyncState).where(eq(schema.ruleSyncState.projectId, existing.id))
  await db.delete(schema.complianceSnapshots).where(eq(schema.complianceSnapshots.projectId, existing.id))
  await db
    .update(schema.auditLog)
    .set({ projectId: null })
    .where(eq(schema.auditLog.projectId, existing.id))
  await db.delete(schema.projects).where(eq(schema.projects.id, existing.id))

  return c.json({ data: { deleted: true } })
})

export { app as projectsApi }
