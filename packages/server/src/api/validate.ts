import { Hono } from "hono"
import { validate, type Rule } from "@rulebound/engine"
import { getDb, schema } from "../db/index.js"
import { eq, and, or, isNull, arrayOverlaps } from "drizzle-orm"
import { validateBodySchema } from "../schemas.js"
import { logger } from "@rulebound/shared/logger"

const app = new Hono()

function dbRuleToEngineRule(dbRule: typeof schema.rules.$inferSelect): Rule {
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

app.post("/", async (c) => {
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = validateBodySchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const { plan, code, language, project, task, useLlm } = parsed.data

  const textToValidate = plan ?? code
  if (!textToValidate) {
    return c.json({ error: "Either 'plan' or 'code' is required" }, 400)
  }
  const db = getDb()

  const conditions = [eq(schema.rules.isActive, true)]

  if (language) {
    conditions.push(
      or(
        arrayOverlaps(schema.rules.stack, [language.toLowerCase()]),
        isNull(schema.rules.stack),
      )!
    )
  }

  const dbRules = await db.select().from(schema.rules).where(and(...conditions))

  const rules = dbRules.map(dbRuleToEngineRule)
  const report = await validate({
    plan: textToValidate,
    rules,
    task: task ?? textToValidate.slice(0, 100),
    useLlm: useLlm ?? false,
  })

  const orgId = c.get("orgId" as never) as string | undefined
  if (orgId) {
    try {
      for (const result of report.results.filter((r) => r.status === "VIOLATED")) {
        await db.insert(schema.auditLog).values({
          orgId,
          action: "validation.violation",
          ruleId: result.ruleId,
          status: result.status,
          metadata: { reason: result.reason, severity: result.severity },
        })
      }
    } catch (error) {
      logger.warn("Audit log insert failed (best-effort)", {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return c.json(report)
})

export { app as validateApi }
