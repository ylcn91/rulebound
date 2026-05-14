// Force a stable, color-free help layout BEFORE the factory module is
// imported. Commander reads NO_COLOR / COLUMNS lazily via process.env when
// rendering help, so setting these here also covers any future changes that
// might read them at import time.
process.env.NO_COLOR = "1"
process.env.COLUMNS = "120"

import { describe, expect, it } from "vitest"
import { buildProgram } from "../index.js"

// Commander emits `addHelpText("after", …)` content through `outputHelp()`,
// not `helpInformation()`. We capture `outputHelp` via `configureOutput`
// so the substring assertion covers both the rendered groups and the
// trailing canonical-gate message.
function renderHelp(): string {
  const program = buildProgram()
  let captured = ""
  program.configureOutput({
    writeOut: (str) => {
      captured += str
    },
    writeErr: (str) => {
      captured += str
    },
  })
  program.outputHelp()
  return captured
}

describe("CLI --help groups", () => {
  it("renders Primary, Diagnostics / advisory, and Advisory / legacy groups in declared order with the canonical-gate footer", () => {
    const output = renderHelp()

    expect(output).toContain("Primary")
    expect(output).toContain("Advisory / legacy")

    const indexCheck = output.indexOf("check ")
    const indexHeal = output.indexOf("heal ")
    const indexDoctor = output.indexOf("doctor ")
    const indexValidate = output.indexOf("validate ")
    const indexDiff = output.indexOf("diff ")
    const indexCi = output.indexOf("ci ")
    const indexReview = output.indexOf("review ")

    for (const idx of [indexCheck, indexHeal, indexDoctor, indexValidate, indexDiff, indexCi, indexReview]) {
      expect(idx).toBeGreaterThanOrEqual(0)
    }

    const primaryMax = Math.max(indexCheck, indexHeal, indexDoctor)
    const legacyMin = Math.min(indexValidate, indexDiff, indexCi, indexReview)
    expect(primaryMax).toBeLessThan(legacyMin)

    expect(output).toContain("canonical deterministic gate")
  })
})
