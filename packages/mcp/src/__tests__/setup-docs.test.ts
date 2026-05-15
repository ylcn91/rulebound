import { describe, it, expect, beforeAll } from "vitest"
import { existsSync, readFileSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { createRequire } from "node:module"

/**
 * MCP-004 — `docs/mcp-setup.md` references the published bin / dist path,
 * and that path actually exists post-build.
 *
 * Two invariants:
 *   1. `docs/mcp-setup.md` mentions `packages/mcp/dist/index.js` (or the
 *      published equivalent path) so the local-development section is not
 *      stale.
 *   2. `packages/mcp/package.json` `bin.rulebound-mcp` resolves to a real
 *      file after `pnpm --filter @rulebound/mcp build`.
 *
 * The test invokes the package build if `dist/index.js` is missing so the
 * suite is hermetic — running it in a fresh checkout (no prior `pnpm build`)
 * still passes.
 */

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..")
const MCP_PKG_DIR = resolve(REPO_ROOT, "packages", "mcp")
const MCP_PKG_JSON = resolve(MCP_PKG_DIR, "package.json")
const MCP_DIST_INDEX = resolve(MCP_PKG_DIR, "dist", "index.js")
const SETUP_DOC = resolve(REPO_ROOT, "docs", "mcp-setup.md")

function ensureBuilt(): void {
  if (existsSync(MCP_DIST_INDEX)) return
  execFileSync("pnpm", ["--filter", "@rulebound/mcp", "build"], {
    cwd: REPO_ROOT,
    stdio: "ignore",
  })
}

describe("MCP setup docs (MCP-004)", () => {
  beforeAll(() => {
    ensureBuilt()
  }, 60_000)

  it("docs/mcp-setup.md references packages/mcp/dist/index.js (local iteration path)", () => {
    const md = readFileSync(SETUP_DOC, "utf-8")
    expect(md).toContain("packages/mcp/dist/index.js")
  })

  it("docs/mcp-setup.md also references the published `@rulebound/mcp` binary entry", () => {
    const md = readFileSync(SETUP_DOC, "utf-8")
    // Both the npx invocation (`npx -y @rulebound/mcp`) and the package name
    // appear in the doc; either is acceptable as evidence the binary is
    // documented.
    const mentionsPackage = md.includes("@rulebound/mcp")
    expect(mentionsPackage).toBe(true)
  })

  it("packages/mcp/package.json `bin.rulebound-mcp` resolves to a real file post-build", () => {
    const require = createRequire(import.meta.url)
    const pkg = require(MCP_PKG_JSON) as {
      bin?: Record<string, string>
    }
    expect(pkg.bin).toBeDefined()
    expect(pkg.bin?.["rulebound-mcp"]).toBeDefined()

    const binRel = pkg.bin?.["rulebound-mcp"] ?? ""
    expect(binRel.length).toBeGreaterThan(0)

    const binAbs = resolve(MCP_PKG_DIR, binRel)
    expect(existsSync(binAbs)).toBe(true)
    expect(statSync(binAbs).isFile()).toBe(true)
  })

  it("dist/index.js is the same file the doc references", () => {
    // Both paths must resolve to the same real file.
    expect(existsSync(MCP_DIST_INDEX)).toBe(true)
    const require = createRequire(import.meta.url)
    const pkg = require(MCP_PKG_JSON) as { bin?: Record<string, string> }
    const binAbs = resolve(MCP_PKG_DIR, pkg.bin?.["rulebound-mcp"] ?? "")
    expect(binAbs).toBe(MCP_DIST_INDEX)
  })
})
