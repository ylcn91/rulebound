import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.RULEBOUND_ENCRYPTION_KEY
  if (!hex) {
    throw new Error("RULEBOUND_ENCRYPTION_KEY environment variable is required")
  }
  if (hex.length !== 64) {
    throw new Error("RULEBOUND_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
  }
  return Buffer.from(hex, "hex")
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":")
}

/**
 * Decrypts a string produced by encrypt().
 * Throws if the format is invalid or authentication fails.
 */
export function decrypt(encrypted: string): string {
  const parts = encrypted.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format: expected iv:authTag:ciphertext")
  }

  const [ivHex, authTagHex, ciphertextHex] = parts
  const key = getKey()
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const ciphertext = Buffer.from(ciphertextHex, "hex")

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString("utf8")
}
