import { Hono } from "hono"
import { validate } from "@rulebound/engine"
import { getDb } from "../db/index.js"
import { validateBodySchema } from "../schemas.js"
import { logger } from "@rulebound/shared/logger"
import { requireRequestIdentity } from "../lib/request-context.js"
import { createComplianceSnapshot, emitWebhookEvent, writeAuditEntry } from "../lib/activity.js"
import { resolveProjectForOrg } from "../lib/projects.js"
import {
  calculateComplianceScore,
  dbRuleToEngineRule,
  getEffectiveRuleSetIds,
  resolveRulesForRuleSetIds,
} from "../lib/rules.js"

const app = new Hono()

app.post("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = validateBodySchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const { plan, code, language, project: projectIdentifier, task, useLlm } = parsed.data
  const textToValidate = plan ?? code

  if (!textToValidate) {
    return c.json({ error: "Either 'plan' or 'code' is required" }, 400)
  }

  const db = getDb()
  const project = projectIdentifier
    ? await resolveProjectForOrg(db, identity.orgId, projectIdentifier)
    : null

  if (projectIdentifier && !project) {
    return c.json({ error: "Project not found" }, 404)
  }

  const ruleSetIds = await getEffectiveRuleSetIds(db, identity.orgId, project?.id)
  const dbRules = await resolveRulesForRuleSetIds(db, ruleSetIds, {
    stack: language ? [language] : null,
  })

  const rules = dbRules.map(dbRuleToEngineRule)
  const report = await validate({
    plan: textToValidate,
    rules,
    task: task ?? textToValidate.slice(0, 100),
    useLlm: useLlm ?? false,
  })

  try {
    const score = calculateComplianceScore(report.summary)

    await writeAuditEntry(db, {
      orgId: identity.orgId,
      projectId: project?.id ?? null,
      userId: identity.userId,
      action: "validation.completed",
      status: report.status,
      metadata: {
        project: project?.slug ?? null,
        score,
        rulesMatched: report.rulesMatched,
        rulesTotal: report.rulesTotal,
        summary: report.summary,
      },
    })

    for (const result of report.results.filter((item) => item.status === "VIOLATED")) {
      await writeAuditEntry(db, {
        orgId: identity.orgId,
        projectId: project?.id ?? null,
        userId: identity.userId,
        action: "validation.violation",
        ruleId: result.ruleId,
        status: result.status,
        metadata: {
          project: project?.slug ?? null,
          reason: result.reason,
          severity: result.severity,
          ruleTitle: result.ruleTitle,
        },
      })

      await emitWebhookEvent(identity.orgId, "violation.detected", {
        projectId: project?.id ?? null,
        projectSlug: project?.slug ?? null,
        ruleId: result.ruleId,
        ruleTitle: result.ruleTitle,
        severity: result.severity,
        reason: result.reason,
      })
    }

    if (project) {
      const { snapshot, previousScore } = await createComplianceSnapshot(db, project.id, report.summary)

      if (previousScore !== null && previousScore !== snapshot.score) {
        await writeAuditEntry(db, {
          orgId: identity.orgId,
          projectId: project.id,
          userId: identity.userId,
          action: "compliance.score_changed",
          status: "success",
          metadata: {
            previousScore,
            newScore: snapshot.score,
          },
        })

        await emitWebhookEvent(identity.orgId, "compliance.score_changed", {
          projectId: project.id,
          projectSlug: project.slug,
          previousScore,
          newScore: snapshot.score,
        })
      }
    }
  } catch (error) {
    logger.warn("Validation side-effects failed", {
      orgId: identity.orgId,
      projectId: project?.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return c.json(report)
})

export { app as validateApi }
