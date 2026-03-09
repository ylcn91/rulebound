import type { Context, Next } from "hono"
import { createHash } from "node:crypto"
import { getDb, schema } from "../db/index.js"
import { eq } from "drizzle-orm"
import { logger } from "@rulebound/shared/logger"

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401)
  }

  if (!authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header must use Bearer scheme" }, 401)
  }

  const token = authHeader.slice(7).trim()

  if (!token) {
    return c.json({ error: "Invalid token format" }, 401)
  }

  try {
    const db = getDb()
    const tokenHash = hashToken(token)

    const [apiToken] = await db
      .select()
      .from(schema.apiTokens)
      .where(eq(schema.apiTokens.tokenHash, tokenHash))

    if (!apiToken) {
      return c.json({ error: "Invalid API token" }, 401)
    }

    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return c.json({ error: "Token expired" }, 401)
    }

    await db
      .update(schema.apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiTokens.id, apiToken.id))

    c.set("orgId" as never, apiToken.orgId as never)
    c.set("userId" as never, apiToken.userId as never)
    c.set("tokenScopes" as never, (apiToken.scopes ?? []) as never)
  } catch (error) {
    logger.error("Authentication middleware failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return c.json({ error: "Authentication failed" }, 500)
  }

  await next()
}

export function optionalAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization")
    if (authHeader) {
      return authMiddleware(c, next)
    }
    await next()
  }
}
