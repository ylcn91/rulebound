import { and, eq, inArray } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"

type Db = ReturnType<typeof getDb>
type ProjectRecord = typeof schema.projects.$inferSelect
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ProjectWithRuleSetIds extends ProjectRecord {
  ruleSetIds: string[]
}

export function slugifyProjectName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "project"
}

export async function resolveProjectForOrg(
  db: Db,
  orgId: string,
  identifier?: string | null
): Promise<ProjectRecord | null> {
  if (!identifier) {
    return null
  }

  if (UUID_PATTERN.test(identifier)) {
    const [byId] = await db
      .select()
      .from(schema.projects)
      .where(and(eq(schema.projects.orgId, orgId), eq(schema.projects.id, identifier)))

    if (byId) {
      return byId
    }
  }

  const [bySlug] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.orgId, orgId), eq(schema.projects.slug, identifier)))

  return bySlug ?? null
}

export async function getProjectRuleSetIds(
  db: Db,
  projectIds: string[]
): Promise<Map<string, string[]>> {
  const ids = [...new Set(projectIds.filter(Boolean))]

  if (ids.length === 0) {
    return new Map()
  }

  const mappings = await db
    .select()
    .from(schema.projectRuleSets)
    .where(inArray(schema.projectRuleSets.projectId, ids))

  const result = new Map<string, string[]>()

  for (const mapping of mappings) {
    const existing = result.get(mapping.projectId) ?? []
    existing.push(mapping.ruleSetId)
    result.set(mapping.projectId, existing)
  }

  return result
}

export async function hydrateProjectsWithRuleSetIds(
  db: Db,
  projects: ProjectRecord[]
): Promise<ProjectWithRuleSetIds[]> {
  const ruleSetIdsByProject = await getProjectRuleSetIds(db, projects.map((project) => project.id))

  return projects.map((project) => ({
    ...project,
    ruleSetIds: ruleSetIdsByProject.get(project.id) ?? [],
  }))
}

export async function validateRuleSetIdsForOrg(
  db: Db,
  orgId: string,
  ruleSetIds: string[]
): Promise<string[]> {
  const ids = [...new Set(ruleSetIds.filter(Boolean))]

  if (ids.length === 0) {
    return []
  }

  const ruleSets = await db
    .select()
    .from(schema.ruleSets)
    .where(and(eq(schema.ruleSets.orgId, orgId), inArray(schema.ruleSets.id, ids)))

  if (ruleSets.length !== ids.length) {
    throw new Error("One or more rule sets were not found in this organization")
  }

  return ids
}

export async function replaceProjectRuleSetLinks(
  db: Db,
  orgId: string,
  projectId: string,
  ruleSetIds: string[]
): Promise<string[]> {
  const validRuleSetIds = await validateRuleSetIdsForOrg(db, orgId, ruleSetIds)

  await db.delete(schema.projectRuleSets).where(eq(schema.projectRuleSets.projectId, projectId))

  if (validRuleSetIds.length > 0) {
    await db.insert(schema.projectRuleSets).values(
      validRuleSetIds.map((ruleSetId) => ({
        projectId,
        ruleSetId,
      }))
    )
  }

  return validRuleSetIds
}
