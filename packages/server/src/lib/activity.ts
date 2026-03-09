import { desc, eq } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"
import { dispatchWebhooks } from "../webhooks/service.js"
import { calculateComplianceScore } from "./rules.js"
import type { WebhookEvent } from "../webhooks/dispatcher.js"

type Db = ReturnType<typeof getDb>

export async function writeAuditEntry(
  db: Db,
  entry: typeof schema.auditLog.$inferInsert
): Promise<void> {
  await db.insert(schema.auditLog).values(entry)
}

export async function emitWebhookEvent(
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  await dispatchWebhooks(orgId, event, data)
}

export async function createComplianceSnapshot(
  db: Db,
  projectId: string,
  summary: {
    pass: number
    violated: number
    notCovered: number
  }
): Promise<{
  snapshot: typeof schema.complianceSnapshots.$inferSelect
  previousScore: number | null
}> {
  const [previous] = await db
    .select()
    .from(schema.complianceSnapshots)
    .where(eq(schema.complianceSnapshots.projectId, projectId))
    .orderBy(desc(schema.complianceSnapshots.snapshotAt))
    .limit(1)

  const score = calculateComplianceScore(summary)

  const [snapshot] = await db
    .insert(schema.complianceSnapshots)
    .values({
      projectId,
      score,
      passCount: summary.pass,
      violatedCount: summary.violated,
      notCoveredCount: summary.notCovered,
    })
    .returning()

  return {
    snapshot,
    previousScore: previous?.score ?? null,
  }
}
