import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { LocalRule } from "../lib/local-rules.js"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
export const FIXTURES_DIR = join(__dirname, "fixtures")

export function makeRule(overrides: Partial<LocalRule> = {}): LocalRule {
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
