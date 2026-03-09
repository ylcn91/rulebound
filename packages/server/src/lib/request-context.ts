import type { Context } from "hono"

export interface RequestIdentity {
  orgId: string
  userId: string
  scopes: string[]
}

export function getRequestIdentity(c: Context): RequestIdentity | null {
  const orgId = c.get("orgId" as never) as string | undefined
  const userId = c.get("userId" as never) as string | undefined
  const scopes = (c.get("tokenScopes" as never) as string[] | undefined) ?? []

  if (!orgId || !userId) {
    return null
  }

  return { orgId, userId, scopes }
}

export function requireRequestIdentity(c: Context): RequestIdentity | Response {
  const identity = getRequestIdentity(c)

  if (!identity) {
    return c.json({ error: "Authentication required" }, 401)
  }

  return identity
}

export function requireMatchingOrg(
  c: Context,
  identity: RequestIdentity,
  requestedOrgId?: string | null
): string | Response {
  if (requestedOrgId && requestedOrgId !== identity.orgId) {
    return c.json({ error: "Forbidden: org scope mismatch" }, 403)
  }

  return identity.orgId
}
