import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { encrypt, decrypt } from "../lib/crypto.js"

const TEST_KEY = "a".repeat(64) // 32 bytes as 64-char hex

describe("crypto", () => {
  let originalKey: string | undefined

  beforeEach(() => {
    originalKey = process.env.RULEBOUND_ENCRYPTION_KEY
    process.env.RULEBOUND_ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.RULEBOUND_ENCRYPTION_KEY
    } else {
      process.env.RULEBOUND_ENCRYPTION_KEY = originalKey
    }
  })

  it("encrypt returns a string in iv:authTag:ciphertext format", () => {
    const result = encrypt("hello")
    const parts = result.split(":")
    expect(parts.length).toBe(3)
    // iv = 12 bytes = 24 hex chars
    expect(parts[0].length).toBe(24)
    // authTag = 16 bytes = 32 hex chars
    expect(parts[1].length).toBe(32)
    // ciphertext: non-empty
    expect(parts[2].length).toBeGreaterThan(0)
  })

  it("decrypt reverses encrypt", () => {
    const plaintext = "whsec_mysecrettoken123"
    const encrypted = encrypt(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it("each encrypt call produces a different ciphertext (unique IV)", () => {
    const plaintext = "same-secret"
    const first = encrypt(plaintext)
    const second = encrypt(plaintext)
    expect(first).not.toBe(second)
    // Both still decrypt correctly
    expect(decrypt(first)).toBe(plaintext)
    expect(decrypt(second)).toBe(plaintext)
  })

  it("encrypt handles special characters", () => {
    const plaintext = "whsec_abc!@#$%^&*()_+-=[]{}|;':\",./<>?"
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it("throws if RULEBOUND_ENCRYPTION_KEY is missing", () => {
    delete process.env.RULEBOUND_ENCRYPTION_KEY
    expect(() => encrypt("test")).toThrow("RULEBOUND_ENCRYPTION_KEY")
  })

  it("throws if RULEBOUND_ENCRYPTION_KEY is wrong length", () => {
    process.env.RULEBOUND_ENCRYPTION_KEY = "tooshort"
    expect(() => encrypt("test")).toThrow()
  })

  it("decrypt throws on tampered ciphertext", () => {
    const encrypted = encrypt("sensitive")
    const [iv, authTag, _ct] = encrypted.split(":")
    const tampered = `${iv}:${authTag}:deadbeef00000000`
    expect(() => decrypt(tampered)).toThrow()
  })

  it("decrypt throws on invalid format", () => {
    expect(() => decrypt("not-valid-format")).toThrow()
  })
})
