/**
 * Audit metadata can carry operator-supplied PII or secrets — webhook
 * payload snippets, IP addresses, error messages with tokens. We do not
 * trust callers to scrub before insert; export paths run a recursive
 * scrubber so the operator-facing UI never has to filter.
 *
 * The denylist is case-insensitive and matches both exact key names and
 * suffixes (`userEmail` -> matches `email`). Replacement value is the
 * fixed string "[REDACTED]" — opinionated and visible in CSV / JSON
 * output. We deliberately do not hash or partially mask: the goal is to
 * make leakage obvious, not to preserve searchability.
 */

export const DEFAULT_REDACTED_KEYS = [
  "token",
  "secret",
  "password",
  "email",
  "ip",
] as const

const REDACTED_PLACEHOLDER = "[REDACTED]"

function shouldRedactKey(key: string, denyList: readonly string[]): boolean {
  const lower = key.toLowerCase()
  for (const needle of denyList) {
    const lowerNeedle = needle.toLowerCase()
    if (lower === lowerNeedle) return true
    if (lower.endsWith(lowerNeedle)) return true
    // Allow embedded matches for compound keys like "client_secret_v2".
    if (lower.includes(lowerNeedle)) return true
  }
  return false
}

/**
 * Recursively walks a metadata value and replaces any leaf value whose
 * key path includes a denied substring with `[REDACTED]`. Returns a new
 * structure; the input is never mutated.
 *
 * Behaviour:
 *   - primitives (string/number/boolean/null/undefined) — returned as-is when
 *     the parent key is safe; redacted otherwise.
 *   - arrays — recursed element-by-element. Array indices are not keys, so
 *     a sensitive parent key redacts the whole array.
 *   - plain objects — recursed key-by-key. Sensitive keys are wholly redacted
 *     (we do not descend into them — operators do not need partial visibility
 *     into a "secrets" sub-tree).
 *   - Date instances, Maps, Sets, class instances — coerced via JSON.parse(
 *     JSON.stringify(...)) before walking, matching how jsonb is serialised on
 *     read.
 */
export function redactAuditMetadata(
  metadata: unknown,
  keys: readonly string[] = DEFAULT_REDACTED_KEYS,
): unknown {
  if (metadata === null || metadata === undefined) return metadata
  if (typeof metadata !== "object") return metadata

  // Normalise once at the entry so the recursion sees only plain JSON.
  let normalised: unknown
  try {
    normalised = JSON.parse(JSON.stringify(metadata))
  } catch {
    // If something cannot survive JSON serialisation (BigInt, etc.), return
    // a sentinel rather than risk leaking. This is the conservative path.
    return REDACTED_PLACEHOLDER
  }

  return walk(normalised, keys)
}

function walk(value: unknown, keys: readonly string[]): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, keys))
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (shouldRedactKey(key, keys)) {
        out[key] = REDACTED_PLACEHOLDER
        continue
      }
      out[key] = walk(val, keys)
    }
    return out
  }
  return value
}
