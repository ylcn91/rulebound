// CORS allowlist policy. Lead verdict B1 fixes the defaults:
//   - dev (NODE_ENV !== "production"): allow http://localhost:3000
//   - prod: empty allowlist; browsers blocked unless RULEBOUND_ALLOWED_ORIGINS
//     lists explicit origins.
//
// Non-browser bearer clients send no Origin header, so they are unaffected by
// the allowlist — Hono's cors() returns no Access-Control-Allow-Origin in
// that case and the request proceeds normally. The allowlist only constrains
// browser-initiated cross-origin requests.

const DEV_DEFAULT_ORIGINS: readonly string[] = ["http://localhost:3000"]

export interface CorsPolicyEnv {
  RULEBOUND_ALLOWED_ORIGINS?: string
  NODE_ENV?: string
}

export function parseAllowedOrigins(env: CorsPolicyEnv = process.env): string[] {
  const raw = env.RULEBOUND_ALLOWED_ORIGINS
  if (raw && raw.trim().length > 0) {
    return raw
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  }
  if (env.NODE_ENV !== "production") {
    return [...DEV_DEFAULT_ORIGINS]
  }
  return []
}

// originAllowedFor returns the value Hono's cors() should echo back as
// Access-Control-Allow-Origin for the given request origin. Returning null
// means "do not set the header" (blocks the browser preflight). Returning
// the origin string means "allow this origin". Wildcard ("*") is intentionally
// not supported — operators must list origins explicitly per lead verdict B1.
export function originAllowedFor(
  origin: string | undefined,
  env: CorsPolicyEnv = process.env,
): string | null {
  if (!origin) {
    return null
  }
  const allowed = parseAllowedOrigins(env)
  return allowed.includes(origin) ? origin : null
}
