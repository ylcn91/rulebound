import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  assertSafeOutboundUrl,
  UnsafeOutboundUrlError,
} from "../lib/url-policy.js"

function lookup(records: Array<{ address: string }>) {
  return {
    lookup: vi.fn(async () => records),
  }
}

describe("assertSafeOutboundUrl", () => {
  const originalEnv = process.env.RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS

  beforeEach(() => {
    delete process.env.RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS
    } else {
      process.env.RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS = originalEnv
    }
  })

  it.each([
    {
      label: "loopback IPv4 literal",
      url: "https://127.0.0.1/hook",
      reasonFragment: "loopback",
    },
    {
      label: "loopback IPv6 literal",
      url: "http://[::1]/hook",
      reasonFragment: "loopback",
    },
    {
      label: "metadata IP",
      url: "http://169.254.169.254/latest/meta-data",
      reasonFragment: "metadata",
    },
    {
      label: "RFC1918 10/8",
      url: "https://10.0.0.5/hook",
      reasonFragment: "private",
    },
    {
      label: "RFC1918 172.16/12",
      url: "https://172.20.10.4/hook",
      reasonFragment: "private",
    },
    {
      label: "RFC1918 192.168/16",
      url: "https://192.168.1.5/hook",
      reasonFragment: "private",
    },
    {
      label: "link-local 169.254/16",
      url: "https://169.254.0.42/hook",
      reasonFragment: "link-local",
    },
    {
      label: "IPv6 link-local fe80::",
      url: "http://[fe80::1]/hook",
      reasonFragment: "link-local",
    },
    {
      label: "this-network 0.0.0.0/8",
      url: "https://0.0.0.0/hook",
      reasonFragment: "this-network",
    },
  ])("rejects $label", async ({ url, reasonFragment }) => {
    await expect(assertSafeOutboundUrl(url)).rejects.toThrow(
      UnsafeOutboundUrlError,
    )
    try {
      await assertSafeOutboundUrl(url)
    } catch (err) {
      expect(err).toBeInstanceOf(UnsafeOutboundUrlError)
      expect((err as UnsafeOutboundUrlError).reason.toLowerCase()).toContain(
        reasonFragment,
      )
    }
  })

  it("rejects non-http(s) protocols", async () => {
    await expect(
      assertSafeOutboundUrl("file:///etc/passwd"),
    ).rejects.toThrow(/protocol/)
  })

  it("rejects malformed URLs", async () => {
    await expect(
      assertSafeOutboundUrl("definitely not a url"),
    ).rejects.toThrow(/invalid URL/i)
  })

  it("rejects hostnames whose DNS lookup returns a private IP", async () => {
    await expect(
      assertSafeOutboundUrl("https://internal.example", {
        lookup: lookup([{ address: "10.0.0.1" }]),
      }),
    ).rejects.toThrow(/private/)
  })

  it("rejects when DNS lookup returns a mix of public and private (rebind defence)", async () => {
    await expect(
      assertSafeOutboundUrl("https://rebind.example", {
        lookup: lookup([
          { address: "1.2.3.4" },
          { address: "127.0.0.1" },
        ]),
      }),
    ).rejects.toThrow(/loopback/)
  })

  it("rejects when DNS lookup returns no records", async () => {
    await expect(
      assertSafeOutboundUrl("https://nx.example", {
        lookup: lookup([]),
      }),
    ).rejects.toThrow(/no records/)
  })

  it("accepts public IP literal", async () => {
    await expect(
      assertSafeOutboundUrl("https://1.2.3.4/hook"),
    ).resolves.toBeUndefined()
  })

  it("accepts hostname that resolves to public IP only", async () => {
    await expect(
      assertSafeOutboundUrl("https://api.example", {
        lookup: lookup([{ address: "203.0.113.10" }]),
      }),
    ).resolves.toBeUndefined()
  })

  it("opt-out env allows private targets", async () => {
    process.env.RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS = "1"
    await expect(
      assertSafeOutboundUrl("http://127.0.0.1/hook"),
    ).resolves.toBeUndefined()
    await expect(
      assertSafeOutboundUrl("https://internal.example", {
        lookup: lookup([{ address: "10.0.0.1" }]),
      }),
    ).resolves.toBeUndefined()
  })

  it("opt-out env does not bypass invalid-URL / unsupported-protocol checks", async () => {
    process.env.RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS = "1"
    await expect(
      assertSafeOutboundUrl("ftp://1.2.3.4/hook"),
    ).rejects.toThrow(/protocol/)
  })
})
