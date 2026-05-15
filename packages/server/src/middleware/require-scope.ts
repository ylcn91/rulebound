import type { Context, MiddlewareHandler, Next } from "hono"
import { logger } from "@rulebound/shared/logger"
import { getRequestIdentity } from "../lib/request-context.js"
import {
  findLegacyScopes,
  resolveEffectiveScopes,
  type Scope,
} from "../lib/scopes.js"

function legacyBypassEnabled(): boolean {
  return process.env.RULEBOUND_LEGACY_TOKEN_SCOPES === "1"
}

// requireScope returns a Hono middleware that enforces the token carries
// every scope in `required`. Behaviour:
//   - identity missing -> 401 (auth middleware should have caught it but we
//     fail closed)
//   - identity present, all scopes satisfied -> next()
//   - identity present, scope missing -> 403 with the missing list
//   - legacy-bypass env set AND token has an empty raw scope array -> next()
//     with a single deprecation log per request
//
// The legacy bypass exists so v0.1 fixtures and tokens with empty `scopes`
// arrays continue to authenticate during the v0.2 deprecation window. v0.3
// turns this into a no-op (see docs/scope-taxonomy.md).
export function requireScope(...required: readonly Scope[]): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const identity = getRequestIdentity(c)
    if (!identity) {
      return c.json({ error: "Authentication required" }, 401)
    }

    const rawScopes = identity.scopes
    const effective = resolveEffectiveScopes(rawScopes)

    const legacy = findLegacyScopes(rawScopes)
    if (legacy.length > 0) {
      logger.warn("deprecation: legacy scope strings observed", {
        orgId: identity.orgId,
        legacy,
      })
    }

    const missing = required.filter((scope) => !effective.has(scope))

    if (missing.length === 0) {
      await next()
      return
    }

    if (legacyBypassEnabled() && rawScopes.length === 0) {
      logger.warn("deprecation: legacy token bypass granted scope access", {
        orgId: identity.orgId,
        required,
      })
      await next()
      return
    }

    return c.json(
      {
        error: "Missing scope",
        required: [...required],
      },
      403,
    )
  }
}
