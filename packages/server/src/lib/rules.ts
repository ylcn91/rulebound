import { and, arrayContains, arrayOverlaps, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm"
import type { Rule } from "@rulebound/engine"
import { getDb, schema } from "../db/index.js"

type Db = ReturnType<typeof getDb>
type RuleRecord = typeof schema.rules.$inferSelect

export interface RuleQueryOptions {
  activeOnly?: boolean
  since?: string | null
  stack?: string[] | null
  category?: string | null
  tag?: string | null
  search?: string | null
}

export function dbRuleToEngineRule(dbRule: RuleRecord): Rule {
  return {
    id: dbRule.id,
    title: dbRule.title,
    content: dbRule.content,
    category: dbRule.category,
    severity: dbRule.severity,
    modality: dbRule.modality,
    tags: dbRule.tags ?? [],
    stack: dbRule.stack ?? [],
    scope: [],
    changeTypes: [],
    team: [],
    filePath: "",
  }
}

export function calculateComplianceScore(summary: {
  pass: number
  violated: number
  notCovered: number
}): number {
  const total = summary.pass + summary.violated + summary.notCovered

  if (total === 0) {
    return 100
  }

  const weighted = summary.pass + summary.notCovered * 0.5
  return Math.round((weighted / total) * 100)
}

export async function getOrCreateDefaultGlobalRuleSet(
  db: Db,
  orgId: string
): Promise<typeof schema.ruleSets.$inferSelect> {
  const existing = await db
    .select()
    .from(schema.ruleSets)
    .where(and(eq(schema.ruleSets.orgId, orgId), eq(schema.ruleSets.isGlobal, true)))

  if (existing.length > 0) {
    const defaultRuleSet = existing.find((ruleSet) => ruleSet.name === "Default Global")
    return defaultRuleSet ?? existing[0]
  }

  const [created] = await db
    .insert(schema.ruleSets)
    .values({
      orgId,
      name: "Default Global",
      description: "Auto-created global rule set for organization-wide rules",
      isGlobal: true,
    })
    .returning()

  return created
}

export async function getGlobalRuleSetIds(db: Db, orgId: string): Promise<string[]> {
  const globalRuleSets = await db
    .select()
    .from(schema.ruleSets)
    .where(and(eq(schema.ruleSets.orgId, orgId), eq(schema.ruleSets.isGlobal, true)))

  if (globalRuleSets.length > 0) {
    return globalRuleSets.map((ruleSet) => ruleSet.id)
  }

  const created = await getOrCreateDefaultGlobalRuleSet(db, orgId)
  return [created.id]
}

export async function getAllOrgRuleSetIds(db: Db, orgId: string): Promise<string[]> {
  const ruleSets = await db
    .select()
    .from(schema.ruleSets)
    .where(eq(schema.ruleSets.orgId, orgId))

  if (ruleSets.length > 0) {
    return ruleSets.map((ruleSet) => ruleSet.id)
  }

  const created = await getOrCreateDefaultGlobalRuleSet(db, orgId)
  return [created.id]
}

export async function getEffectiveRuleSetIds(
  db: Db,
  orgId: string,
  projectId?: string | null
): Promise<string[]> {
  const globalRuleSetIds = await getGlobalRuleSetIds(db, orgId)

  if (!projectId) {
    return globalRuleSetIds
  }

  const mappings = await db
    .select()
    .from(schema.projectRuleSets)
    .where(eq(schema.projectRuleSets.projectId, projectId))

  if (mappings.length === 0) {
    return globalRuleSetIds
  }

  const linkedRuleSets = await db
    .select()
    .from(schema.ruleSets)
    .where(and(eq(schema.ruleSets.orgId, orgId), inArray(
      schema.ruleSets.id,
      mappings.map((mapping) => mapping.ruleSetId)
    )))

  return [...new Set([...globalRuleSetIds, ...linkedRuleSets.map((ruleSet) => ruleSet.id)])]
}

export async function resolveRulesForRuleSetIds(
  db: Db,
  ruleSetIds: string[],
  options: RuleQueryOptions = {}
): Promise<RuleRecord[]> {
  if (ruleSetIds.length === 0) {
    return []
  }

  const conditions = [inArray(schema.rules.ruleSetId, ruleSetIds)]

  if (options.activeOnly !== false) {
    conditions.push(eq(schema.rules.isActive, true))
  }

  if (options.since) {
    conditions.push(gte(schema.rules.updatedAt, new Date(options.since)))
  }

  if (options.stack && options.stack.length > 0) {
    const normalizedStack = options.stack.map((value) => value.trim().toLowerCase()).filter(Boolean)
    if (normalizedStack.length > 0) {
      conditions.push(
        or(
          arrayOverlaps(schema.rules.stack, normalizedStack),
          isNull(schema.rules.stack),
          sql`coalesce(cardinality(${schema.rules.stack}), 0) = 0`
        )!
      )
    }
  }

  if (options.category) {
    conditions.push(eq(schema.rules.category, options.category))
  }

  if (options.tag) {
    conditions.push(arrayContains(schema.rules.tags, [options.tag]))
  }

  if (options.search) {
    conditions.push(
      or(
        ilike(schema.rules.title, `%${options.search}%`),
        ilike(schema.rules.content, `%${options.search}%`)
      )!
    )
  }

  return db.select().from(schema.rules).where(and(...conditions))
}

export async function getOrgRuleById(
  db: Db,
  orgId: string,
  ruleId: string
): Promise<RuleRecord | null> {
  const [rule] = await db
    .select()
    .from(schema.rules)
    .where(eq(schema.rules.id, ruleId))

  if (!rule) {
    return null
  }

  const [ruleSet] = await db
    .select()
    .from(schema.ruleSets)
    .where(and(eq(schema.ruleSets.id, rule.ruleSetId), eq(schema.ruleSets.orgId, orgId)))

  if (!ruleSet) {
    return null
  }

  return rule
}
