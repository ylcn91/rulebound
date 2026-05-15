/**
 * Redact obvious secret patterns from a free-form evidence snippet before it
 * is included in machine-readable output (`--format json`, `--format repair-json`,
 * `--format sarif`).
 *
 * Scope:
 *   - Authorization headers (Bearer / Basic / Token prefixes).
 *   - Inline key/value pairs for `password`, `passwd`, `token`, `api_key`,
 *     `apikey`, `secret` (JSON-ish and YAML-ish forms).
 *   - High-entropy AWS-style access keys (AKIA / ASIA) and GitHub tokens
 *     (ghp_, gho_, ghs_, ghu_, ghr_).
 *
 * NOT a general-purpose secret scanner — gitleaks (SEC-001) is the
 * authoritative gate. This is a best-effort hygiene pass for short
 * evidence excerpts so the CLI's own output does not echo accidental
 * credential leaks back to the caller (CI logs, agent transcripts, etc.).
 *
 * Idempotent and side-effect-free; non-string values short-circuit.
 */

const REDACTED = "[REDACTED]"

interface Pattern {
  readonly regex: RegExp
  readonly replacement: (match: string, ...groups: string[]) => string
}

const PATTERNS: readonly Pattern[] = [
  // Authorization: Bearer / Basic / Token <value>
  {
    regex: /\b(Authorization\s*[:=]\s*)(["']?)(Bearer|Basic|Token)\s+[A-Za-z0-9._\-+/=]+\2/gi,
    replacement: (_m, prefix, quote, scheme) => `${prefix}${quote}${scheme} ${REDACTED}${quote}`,
  },
  // key=value or "key": "value" for sensitive keys.
  // The leading `["']?KEY["']?` allows JSON-quoted keys (`"api-key": "..."`).
  // The `[^"'\s,;}]+` value match keeps the redaction tight (does not eat the
  // whole rest of the line) but still catches typical inline secrets.
  {
    regex:
      /(["']?)\b(password|passwd|passphrase|token|access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|secret|client[_-]?secret)\b\1(\s*[:=]\s*)(["']?)[^"'\s,;}]+\4/gi,
    replacement: (_m, kq, key, sep, vq) => `${kq}${key}${kq}${sep}${vq}${REDACTED}${vq}`,
  },
  // AWS access key IDs.
  {
    regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: () => REDACTED,
  },
  // GitHub-style PATs (40+ char body after typed prefix).
  {
    regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    replacement: () => REDACTED,
  },
]

export function redactSnippet(input: string | undefined): string | undefined {
  if (input === undefined || input === null) return input
  if (input.length === 0) return input
  let out = input
  for (const pattern of PATTERNS) {
    out = out.replace(pattern.regex, pattern.replacement as Parameters<string["replace"]>[1])
  }
  return out
}

/**
 * Walk a parsed deterministic report and return a copy with every
 * `evidence.snippet` field redacted. The report tree itself is not
 * mutated.
 */
export function redactReportSnippets<T>(report: T): T {
  return walk(report) as T
}

function walk(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(walk)
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k === "evidence" && v && typeof v === "object") {
        const ev = v as Record<string, unknown>
        out[k] = {
          ...ev,
          ...(typeof ev.snippet === "string" ? { snippet: redactSnippet(ev.snippet) } : {}),
        }
      } else {
        out[k] = walk(v)
      }
    }
    return out
  }
  return value
}
