import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { validateDeterministicReport } from "../report-schema.js"

// ENG-001 — schema drift guard.
//
// The example JSON in docs/report-schema.md is the canonical illustration of
// the DeterministicReport contract. If runtime guard validation drifts away
// from that example (field rename, enum removal, required-field tightening),
// this test fails — forcing docs and code to update together.

const SCHEMA_DOC_PATH = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "docs",
  "report-schema.md",
)

function extractJsonBlocks(markdown: string): string[] {
  const blocks: string[] = []
  const fence = /```json\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = fence.exec(markdown)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

describe("report-schema docs drift", () => {
  const markdown = readFileSync(SCHEMA_DOC_PATH, "utf-8")
  const blocks = extractJsonBlocks(markdown)

  it("docs/report-schema.md contains at least one example JSON block", () => {
    expect(blocks.length).toBeGreaterThan(0)
  })

  it.each(blocks.map((b, i) => [i, b]))(
    "example JSON block #%i validates against validateDeterministicReport",
    (_, block) => {
      const parsed = JSON.parse(block)
      // Throws on any field/enum drift between docs and runtime guard.
      expect(() => validateDeterministicReport(parsed)).not.toThrow()
    },
  )
})
