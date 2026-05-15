import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DIST_ENTRY = join(__dirname, "..", "dist", "index.js")

/**
 * LSP stdio smoke — boots the built server, sends an `initialize` request
 * over stdin using the LSP Content-Length framing, and asserts the server
 * answers with `capabilities` on stdout within a 5s timeout.
 *
 * If the dist entrypoint is missing (e.g. test runs before `pnpm build`),
 * the suite skips itself with a clear message rather than failing — the
 * smoke is a post-build acceptance signal, not a substitute for the build.
 */
describe("LSP stdio smoke", () => {
  const distExists = existsSync(DIST_ENTRY)

  it.skipIf(!distExists)(
    "responds to initialize with capabilities over stdio",
    async () => {
      const child = spawn(process.execPath, [DIST_ENTRY, "--stdio"], {
        stdio: ["pipe", "pipe", "pipe"],
      })

      const result = await new Promise<{
        capabilities: unknown
        responseId: number
      }>((resolve, reject) => {
        let buffer = Buffer.alloc(0)
        let settled = false

        const timer = setTimeout(() => {
          if (settled) return
          settled = true
          reject(new Error("LSP did not respond within 5s"))
          child.kill()
        }, 5000)

        child.stdout.on("data", (chunk: Buffer) => {
          buffer = Buffer.concat([buffer, chunk])
          // Parse Content-Length framed frames; bail out once we have one
          // complete response.
          while (true) {
            const headerEnd = buffer.indexOf("\r\n\r\n")
            if (headerEnd === -1) return
            const header = buffer.slice(0, headerEnd).toString("utf-8")
            const match = header.match(/Content-Length:\s*(\d+)/i)
            if (!match) {
              if (settled) return
              settled = true
              clearTimeout(timer)
              reject(new Error(`Missing Content-Length header: ${header}`))
              child.kill()
              return
            }
            const length = Number.parseInt(match[1]!, 10)
            const bodyStart = headerEnd + 4
            if (buffer.length < bodyStart + length) return
            const body = buffer.slice(bodyStart, bodyStart + length).toString("utf-8")
            buffer = buffer.slice(bodyStart + length)

            let parsed: { id?: number; result?: { capabilities?: unknown } }
            try {
              parsed = JSON.parse(body)
            } catch (error) {
              if (settled) return
              settled = true
              clearTimeout(timer)
              reject(new Error(`Invalid JSON-RPC body: ${(error as Error).message}`))
              child.kill()
              return
            }

            if (parsed.id === 1 && parsed.result?.capabilities) {
              if (settled) return
              settled = true
              clearTimeout(timer)
              resolve({
                capabilities: parsed.result.capabilities,
                responseId: parsed.id,
              })
              child.kill()
              return
            }
          }
        })

        child.on("error", (error) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          reject(error)
        })

        // Drain stderr so the subprocess does not block on a full pipe.
        child.stderr.on("data", () => {})

        const initialize = {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            processId: process.pid,
            rootUri: null,
            capabilities: {},
            workspaceFolders: null,
          },
        }
        const payload = JSON.stringify(initialize)
        const frame =
          `Content-Length: ${Buffer.byteLength(payload, "utf-8")}\r\n\r\n${payload}`
        child.stdin.write(frame)
      })

      expect(result.responseId).toBe(1)
      expect(result.capabilities).toBeTruthy()
      expect(typeof result.capabilities).toBe("object")
    },
    10_000,
  )

  it("documents the dist entrypoint location", () => {
    // Sanity check so a reviewer chasing a CI failure sees where the smoke
    // looks for the binary.
    expect(DIST_ENTRY.endsWith("packages/lsp/dist/index.js")).toBe(true)
  })
})
