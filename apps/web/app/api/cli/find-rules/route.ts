import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rules } from "@/lib/db/schema"
import { and, eq, ilike, arrayContains } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const title = searchParams.get("title")
  const category = searchParams.get("category")
  const tags = searchParams.get("tags")

  const conditions = [eq(rules.isActive, true)]

  if (title) {
    conditions.push(ilike(rules.title, `%${title}%`))
  }

  if (category) {
    conditions.push(eq(rules.category, category))
  }

  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim())
    for (const tag of tagList) {
      conditions.push(arrayContains(rules.tags, [tag]))
    }
  }

  const results = await db
    .select()
    .from(rules)
    .where(and(...conditions))

  return NextResponse.json(results)
}
