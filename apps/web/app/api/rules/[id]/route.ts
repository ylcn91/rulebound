import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rules } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [rule] = await db.select().from(rules).where(eq(rules.id, id))

    if (!rule) {
      return NextResponse.json(
        { success: false, error: "Rule not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: rule })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch rule"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const [existing] = await db.select().from(rules).where(eq(rules.id, id))

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Rule not found" },
        { status: 404 }
      )
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.title !== undefined) updates.title = body.title
    if (body.content !== undefined) updates.content = body.content
    if (body.category !== undefined) updates.category = body.category
    if (body.severity !== undefined) updates.severity = body.severity
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.isActive !== undefined) updates.isActive = body.isActive

    const [updated] = await db
      .update(rules)
      .set(updates)
      .where(eq(rules.id, id))
      .returning()

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update rule"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [existing] = await db.select().from(rules).where(eq(rules.id, id))

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Rule not found" },
        { status: 404 }
      )
    }

    await db.delete(rules).where(eq(rules.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete rule"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
