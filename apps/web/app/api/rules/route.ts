import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rules } from "@/lib/db/schema"
import { ilike, eq, or, arrayContains } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const category = searchParams.get("category")
    const tag = searchParams.get("tag")
    const search = searchParams.get("q")

    const conditions = []

    if (category) {
      conditions.push(eq(rules.category, category))
    }

    if (tag) {
      conditions.push(arrayContains(rules.tags, [tag]))
    }

    if (search) {
      conditions.push(
        or(
          ilike(rules.title, `%${search}%`),
          ilike(rules.content, `%${search}%`)
        )!
      )
    }

    const result =
      conditions.length > 0
        ? await db
            .select()
            .from(rules)
            .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        : await db.select().from(rules)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch rules"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { title, content, category, severity, tags, ruleSetId } = body

    if (!title || !content || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: title, content, category" },
        { status: 400 }
      )
    }

    const validCategories = [
      "architecture",
      "security",
      "style",
      "testing",
      "performance",
    ]
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      )
    }

    const validSeverities = ["error", "warning", "info"]
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json(
        { success: false, error: `Invalid severity. Must be one of: ${validSeverities.join(", ")}` },
        { status: 400 }
      )
    }

    const [created] = await db
      .insert(rules)
      .values({
        title,
        content,
        category,
        severity: severity || "warning",
        tags: tags || [],
        ruleSetId: ruleSetId || "00000000-0000-0000-0000-000000000000",
      })
      .returning()

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create rule"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
