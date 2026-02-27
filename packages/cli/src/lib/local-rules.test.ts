import { describe, it, expect } from "vitest"
import { matchRulesByContext } from "./local-rules.js"

function makeRule(overrides: Partial<import("./local-rules.js").LocalRule> = {}): import("./local-rules.js").LocalRule {
  return {
    id: "test.rule",
    title: "Test Rule",
    content: "Test content",
    category: "testing",
    severity: "error",
    modality: "must",
    tags: [],
    stack: [],
    scope: [],
    changeTypes: [],
    team: [],
    filePath: "test/rule.md",
    ...overrides,
  }
}

describe("matchRulesByContext", () => {
  it("filters global rules by task relevance", () => {
    const rules = [
      makeRule({ id: "auth", title: "Authentication", tags: ["auth"], category: "security" }),
      makeRule({ id: "css", title: "CSS Conventions", tags: ["css", "style"], category: "style" }),
    ]

    const matched = matchRulesByContext(rules, null, "add JWT authentication")
    const ids = matched.map((r) => r.id)

    expect(ids).toContain("auth")
    expect(ids).not.toContain("css")
  })

  it("includes global rules without task filter", () => {
    const rules = [
      makeRule({ id: "auth", title: "Authentication", tags: ["auth"], category: "security" }),
      makeRule({ id: "css", title: "CSS Conventions", tags: ["css"], category: "style" }),
    ]

    const matched = matchRulesByContext(rules, null)
    expect(matched).toHaveLength(2)
  })

  it("includes context-matched rules regardless of task", () => {
    const rules = [
      makeRule({ id: "spring", title: "Spring DI", stack: ["java", "spring-boot"], tags: ["di"] }),
    ]
    const matched = matchRulesByContext(rules, { stack: ["java", "spring-boot"] }, "add CSS animation")
    expect(matched).toHaveLength(1)
  })
})
