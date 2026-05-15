import { randomUUID } from "node:crypto"
import { createHash } from "node:crypto"
import { getDb, schema } from "../../db/index.js"
import { createApp } from "../../index.js"

export interface SeedOptions {
  scopes?: string[]
  orgSlug?: string
}

export interface SeedResult {
  orgId: string
  userId: string
  token: string
  tokenId: string
}

/**
 * Seeds an organisation, a user, a membership row, and an API token. Returns
 * the bearer token string so the test can call the API as a real client. Each
 * call uses fresh UUIDs so suites are isolated even when run in series
 * against the same container.
 */
export async function seedOrgAndToken(
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const db = getDb()
  const scopes = opts.scopes ?? [
    "rules:read",
    "rules:write",
    "projects:read",
    "projects:write",
    "audit:read",
    "audit:write",
    "tokens:write",
    "webhooks:write",
    "validate:run",
    "compliance:read",
    "sync:write",
  ]

  const [user] = await db
    .insert(schema.users)
    .values({ email: `${randomUUID()}@example.com`, name: "Integration Tester" })
    .returning()

  const orgSlug = opts.orgSlug ?? `org-${randomUUID().slice(0, 8)}`
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: orgSlug, slug: orgSlug, ownerId: user.id })
    .returning()

  await db.insert(schema.orgMembers).values({
    orgId: org.id,
    userId: user.id,
    role: "owner",
  })

  const token = `rb_${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const [created] = await db
    .insert(schema.apiTokens)
    .values({
      orgId: org.id,
      userId: user.id,
      name: "integration-token",
      tokenHash,
      tokenPrefix: token.slice(0, 10),
      scopes,
    })
    .returning()

  return {
    orgId: org.id,
    userId: user.id,
    token,
    tokenId: created.id,
  }
}

export function buildApp() {
  return createApp()
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}
