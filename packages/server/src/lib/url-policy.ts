import { promises as dns } from "node:dns"
import { isIP } from "node:net"

// Webhook URL safety policy. Lead verdict B3 requires:
//   - deny loopback (127/8, ::1), private (10/8, 172.16/12, 192.168/16),
//     link-local (169.254/16, fe80::/10), and metadata (169.254.169.254)
//   - opt-out: RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS=1 for self-hosted dev
//   - DNS-rebind defense: callers must re-validate before each fetch attempt

export class UnsafeOutboundUrlError extends Error {
  readonly code = "unsafe_outbound_url"
  readonly reason: string
  readonly target: string

  constructor(reason: string, target: string) {
    super(`Refusing to call ${target}: ${reason}`)
    this.name = "UnsafeOutboundUrlError"
    this.reason = reason
    this.target = target
  }
}

interface DnsLookup {
  lookup: (hostname: string) => Promise<Array<{ address: string }>>
}

const DEFAULT_LOOKUP: DnsLookup = {
  lookup: (hostname) => dns.lookup(hostname, { all: true, verbatim: true }),
}

function isPrivateBypassEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS === "1"
}

// IPv4 range checks. Each helper takes the four octets and returns true if
// the address falls inside the named block.
function isLoopbackV4(octets: number[]): boolean {
  return octets[0] === 127
}

function isPrivateV4(octets: number[]): boolean {
  if (octets[0] === 10) return true
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true
  if (octets[0] === 192 && octets[1] === 168) return true
  return false
}

function isLinkLocalV4(octets: number[]): boolean {
  return octets[0] === 169 && octets[1] === 254
}

function isMetadataV4(octets: number[]): boolean {
  return (
    octets[0] === 169 &&
    octets[1] === 254 &&
    octets[2] === 169 &&
    octets[3] === 254
  )
}

function classifyIPv4(address: string): string | null {
  const parts = address.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return "invalid IPv4"
  }
  if (isMetadataV4(parts)) return "metadata IP (169.254.169.254)"
  if (isLoopbackV4(parts)) return "loopback (127.0.0.0/8)"
  if (isPrivateV4(parts)) return "private network (RFC1918)"
  if (isLinkLocalV4(parts)) return "link-local (169.254.0.0/16)"
  if (parts[0] === 0) return "this-network (0.0.0.0/8)"
  return null
}

function classifyIPv6(address: string): string | null {
  const normalized = address.toLowerCase()
  // Strip zone id.
  const bare = normalized.split("%")[0]
  if (bare === "::1") return "loopback (::1)"
  if (bare === "::" || bare === "0:0:0:0:0:0:0:0") return "unspecified (::)"
  // Link-local fe80::/10.
  if (/^fe[89ab][0-9a-f]:/.test(bare)) return "IPv6 link-local (fe80::/10)"
  // Unique local fc00::/7.
  if (/^f[cd][0-9a-f]{2}:/.test(bare)) return "IPv6 unique-local (fc00::/7)"
  // IPv4-mapped ::ffff:a.b.c.d → check the embedded IPv4.
  const mapped = bare.match(/^::ffff:([0-9.]+)$/)
  if (mapped) {
    const inner = classifyIPv4(mapped[1])
    if (inner) return `IPv4-mapped ${inner}`
  }
  return null
}

function classifyAddress(address: string): string | null {
  const version = isIP(address)
  if (version === 4) return classifyIPv4(address)
  if (version === 6) return classifyIPv6(address)
  return null
}

export interface AssertOptions {
  env?: NodeJS.ProcessEnv
  lookup?: DnsLookup
}

// assertSafeOutboundUrl resolves the hostname and throws
// UnsafeOutboundUrlError if any A/AAAA record points at a denied range.
// All records are checked (not just the first) so a multi-record DNS-rebind
// trick that mixes a public and a private address still blocks.
export async function assertSafeOutboundUrl(
  url: string,
  options: AssertOptions = {},
): Promise<void> {
  const env = options.env ?? process.env
  const lookup = options.lookup ?? DEFAULT_LOOKUP

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UnsafeOutboundUrlError("invalid URL", url)
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeOutboundUrlError(
      `protocol ${parsed.protocol} not allowed`,
      url,
    )
  }

  // Strip [..] brackets from IPv6 literal so isIP / classification work.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "")
  const literalVersion = isIP(hostname)

  if (literalVersion !== 0) {
    const reason = classifyAddress(hostname)
    if (reason) {
      if (isPrivateBypassEnabled(env)) return
      throw new UnsafeOutboundUrlError(reason, url)
    }
    return
  }

  // Hostname is a name — resolve and check every record.
  let records: Array<{ address: string }>
  try {
    records = await lookup.lookup(hostname)
  } catch (err) {
    throw new UnsafeOutboundUrlError(
      `DNS resolution failed (${err instanceof Error ? err.message : String(err)})`,
      url,
    )
  }

  if (records.length === 0) {
    throw new UnsafeOutboundUrlError("DNS returned no records", url)
  }

  if (isPrivateBypassEnabled(env)) return

  for (const record of records) {
    const reason = classifyAddress(record.address)
    if (reason) {
      throw new UnsafeOutboundUrlError(
        `${hostname} resolves to ${reason} (${record.address})`,
        url,
      )
    }
  }
}
