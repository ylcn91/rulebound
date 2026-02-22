import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rules } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

interface ValidationResult {
  ruleId: string
  ruleTitle: string
  severity: string
  status: "PASS" | "WARN" | "FAIL"
  message: string
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const plan: string = body.plan

  if (!plan || typeof plan !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'plan' field" },
      { status: 400 }
    )
  }

  const activeRules = await db
    .select()
    .from(rules)
    .where(eq(rules.isActive, true))

  const planLower = plan.toLowerCase()
  const results: ValidationResult[] = []

  for (const rule of activeRules) {
    const status = evaluateRule(rule, planLower)
    results.push(status)
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === "PASS").length,
    warn: results.filter((r) => r.status === "WARN").length,
    fail: results.filter((r) => r.status === "FAIL").length,
  }

  return NextResponse.json({ results, summary })
}

function evaluateRule(
  rule: typeof rules.$inferSelect,
  planLower: string
): ValidationResult {
  const keywords = extractKeywords(rule)
  const matchedKeywords = keywords.filter((kw) => planLower.includes(kw))
  const matchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0

  if (matchRatio === 0) {
    return {
      ruleId: rule.id,
      ruleTitle: rule.title,
      severity: rule.severity,
      status: "PASS",
      message: "Rule not applicable to this plan.",
    }
  }

  const planMentionsRuleConcept = matchRatio > 0.3

  if (planMentionsRuleConcept) {
    if (matchRatio > 0.6) {
      return {
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        status: "PASS",
        message: `Plan addresses: ${matchedKeywords.join(", ")}.`,
      }
    }

    const status = rule.severity === "error" ? "FAIL" as const : "WARN" as const
    return {
      ruleId: rule.id,
      ruleTitle: rule.title,
      severity: rule.severity,
      status,
      message: `Plan partially addresses rule. Found: ${matchedKeywords.join(", ")}. Consider reviewing full rule.`,
    }
  }

  return {
    ruleId: rule.id,
    ruleTitle: rule.title,
    severity: rule.severity,
    status: "PASS",
    message: "Rule not applicable to this plan.",
  }
}

function extractKeywords(rule: typeof rules.$inferSelect): string[] {
  const words = new Set<string>()

  const titleWords = rule.title.toLowerCase().split(/\s+/)
  for (const word of titleWords) {
    if (word.length > 3) words.add(word)
  }

  if (rule.tags) {
    for (const tag of rule.tags) {
      if (tag) words.add(tag.toLowerCase())
    }
  }

  words.add(rule.category.toLowerCase())

  return [...words]
}
