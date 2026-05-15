// Scope taxonomy for API tokens. See packages/server/docs/scope-taxonomy.md
// for the design rationale and rollout plan. Lead verdict B4 fixes this list
// at 11 scopes for v0.2; adding scopes later is additive, removing/renaming
// is a breaking change that requires a fresh lead verdict.

export const SCOPES = [
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
] as const

export type Scope = (typeof SCOPES)[number]

const SCOPE_SET: ReadonlySet<string> = new Set(SCOPES)

export function isKnownScope(value: string): value is Scope {
  return SCOPE_SET.has(value)
}

// Mapping from legacy v0.1 scope strings to the new taxonomy. Tokens created
// before v0.2 default to `["read", "validate"]`; we expand these into the
// new fine-grained scopes so the middleware can authorise requests without
// requiring a token rotation in the same minor release.
export const LEGACY_SCOPE_MAPPING: Readonly<Record<string, readonly Scope[]>> = {
  read: ["audit:read", "rules:read", "projects:read", "compliance:read"],
  validate: ["validate:run"],
}

export function expandLegacyScope(value: string): readonly Scope[] | null {
  if (value in LEGACY_SCOPE_MAPPING) {
    return LEGACY_SCOPE_MAPPING[value]
  }
  return null
}

// Default scope set issued when a caller creates a new token without
// explicitly enumerating scopes. Write scopes are opt-in.
export const DEFAULT_TOKEN_SCOPES: readonly Scope[] = [
  "audit:read",
  "rules:read",
  "validate:run",
]

// Resolves a stored token's scope array (which may contain legacy strings,
// new-style scopes, or both) into the effective set of new-style scopes the
// middleware uses for authorisation. Unknown strings are dropped silently —
// the middleware then 403s the request, which is the correct fail-closed
// behaviour for malformed scope arrays.
export function resolveEffectiveScopes(stored: readonly string[]): Set<Scope> {
  const effective = new Set<Scope>()
  for (const value of stored) {
    if (isKnownScope(value)) {
      effective.add(value)
      continue
    }
    const expanded = expandLegacyScope(value)
    if (expanded) {
      for (const scope of expanded) {
        effective.add(scope)
      }
    }
  }
  return effective
}

// Detects legacy scope strings on a stored token so the middleware can emit
// a single deprecation log line per request.
export function findLegacyScopes(stored: readonly string[]): string[] {
  return stored.filter((value) => value in LEGACY_SCOPE_MAPPING)
}
