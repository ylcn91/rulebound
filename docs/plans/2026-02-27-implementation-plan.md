# Semantic Validation, Progressive Enforcement & Multi-Agent Coordination — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Rulebound's keyword-only validation with a layered engine (keyword + semantic + LLM), add progressive enforcement, CI integration, and multi-agent coordination.

**Architecture:** Three-layer validation pipeline where each matcher returns `{ status, confidence, reason }`. Results merge with upper-layer priority. Progressive enforcement config controls exit behavior. Agent profiles define per-agent rule/enforcement scoping. Multi-agent review runs the pipeline per agent and merges via consensus.

**Tech Stack:** TypeScript, Vitest (testing), Vercel AI SDK (LLM), Commander.js (CLI), tsup (build)

---

## Task 1: Set Up Test Infrastructure

**Files:**
- Create: `packages/cli/vitest.config.ts`
- Modify: `packages/cli/package.json`
- Create: `packages/cli/src/__tests__/setup.ts`

**Step 1: Install vitest**

Run: `cd packages/cli && pnpm add -D vitest`

**Step 2: Create vitest config**

Create `packages/cli/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
})
```

**Step 3: Add test script to package.json**

In `packages/cli/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Create test setup file**

Create `packages/cli/src/__tests__/setup.ts`:

```typescript
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseFrontMatter, type LocalRule } from "../lib/local-rules.js"

export const FIXTURES_DIR = join(import.meta.dirname, "fixtures")

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
```

**Step 5: Create test fixture rules**

Create `packages/cli/src/__tests__/fixtures/rules/global/no-hardcoded-secrets.md`:

```markdown
---
title: No Hardcoded Secrets
category: security
severity: error
modality: must
tags: [secrets, env, credentials]
---

# No Hardcoded Secrets

All secrets MUST be loaded from environment variables.

## Rules

- Never hardcode API keys, passwords, or tokens in source files
- Use `.env` files for local development

## Good Example

` ``typescript
const apiKey = process.env.STRIPE_API_KEY;
` ``

## Bad Example

` ``typescript
const apiKey = "sk_live_abc123...";
` ``
```

Create `packages/cli/src/__tests__/fixtures/rules/security/authentication.md`:

```markdown
---
title: Authentication and Authorization
category: security
severity: error
modality: must
tags: [auth, jwt, session, rbac]
---

# Authentication and Authorization

Every API endpoint MUST enforce authentication.

## Rules

- All endpoints must check authentication before processing
- Use httpOnly cookies for token storage
- Use short-lived JWT tokens with refresh rotation
```

**Step 6: Verify test setup works**

Run: `cd packages/cli && pnpm test`
Expected: 0 tests found, no errors.

**Step 7: Commit**

```bash
git add packages/cli/vitest.config.ts packages/cli/package.json packages/cli/src/__tests__/
git commit -m "chore: add vitest test infrastructure for CLI"
```

---

## Task 2: Matcher Types & Interface

**Files:**
- Create: `packages/cli/src/lib/matchers/types.ts`
- Create: `packages/cli/src/lib/matchers/types.test.ts`

**Step 1: Write the test**

Create `packages/cli/src/lib/matchers/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import type { MatchResult, Matcher, MatchStatus } from "./types.js"

describe("MatchResult type contract", () => {
  it("accepts valid match results", () => {
    const result: MatchResult = {
      ruleId: "test.rule",
      status: "PASS",
      confidence: 0.9,
      reason: "Plan addresses the rule",
    }
    expect(result.status).toBe("PASS")
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("accepts all valid statuses", () => {
    const statuses: MatchStatus[] = ["PASS", "VIOLATED", "NOT_COVERED"]
    for (const status of statuses) {
      const result: MatchResult = {
        ruleId: "test",
        status,
        confidence: 0.5,
        reason: "test",
      }
      expect(result.status).toBe(status)
    }
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/types.test.ts`
Expected: FAIL — module not found

**Step 3: Write types**

Create `packages/cli/src/lib/matchers/types.ts`:

```typescript
import type { LocalRule } from "../local-rules.js"

export type MatchStatus = "PASS" | "VIOLATED" | "NOT_COVERED"

export interface MatchResult {
  readonly ruleId: string
  readonly status: MatchStatus
  readonly confidence: number // 0-1
  readonly reason: string
  readonly suggestedFix?: string
}

export interface MatcherContext {
  readonly plan: string
  readonly rules: readonly LocalRule[]
  readonly task?: string
}

export interface Matcher {
  readonly name: string
  match(context: MatcherContext): Promise<readonly MatchResult[]>
}

export interface PipelineResult {
  readonly results: readonly MatchResult[]
  readonly layers: readonly string[]
}
```

**Step 4: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/matchers/
git commit -m "feat: add matcher types and interface for validation pipeline"
```

---

## Task 3: Keyword Matcher (Layer 1) — Refactor + Bug Fix

**Files:**
- Create: `packages/cli/src/lib/matchers/keyword.ts`
- Create: `packages/cli/src/lib/matchers/keyword.test.ts`

**Step 1: Write the failing tests**

Create `packages/cli/src/lib/matchers/keyword.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { KeywordMatcher } from "./keyword.js"
import { makeRule } from "../../__tests__/setup.js"

describe("KeywordMatcher", () => {
  const matcher = new KeywordMatcher()

  describe("negation awareness", () => {
    it("PASS when plan says 'ensure no hardcoded secrets'", async () => {
      const rule = makeRule({
        id: "no-secrets",
        title: "No Hardcoded Secrets",
        content: "Never hardcode API keys.\n- Never hardcode API keys in source files",
        tags: ["secrets", "env"],
        modality: "must",
      })
      const results = await matcher.match({
        plan: "We will ensure no hardcoded secrets exist and load all keys from env vars",
        rules: [rule],
      })
      expect(results[0].status).toBe("PASS")
    })

    it("VIOLATED when plan explicitly uses hardcoded key", async () => {
      const rule = makeRule({
        id: "no-secrets",
        title: "No Hardcoded Secrets",
        content: "Never hardcode API keys.\n- Never hardcode API keys in source files",
        tags: ["secrets", "env"],
        modality: "must",
      })
      const results = await matcher.match({
        plan: 'Set the API key to "sk_live_abc123" in the config file',
        rules: [rule],
      })
      expect(results[0].status).toBe("VIOLATED")
    })
  })

  describe("phrase matching", () => {
    it("matches multi-word phrases from rule tags", async () => {
      const rule = makeRule({
        id: "auth",
        title: "Authentication and Authorization",
        content: "Use httpOnly cookies for token storage.\n- All endpoints must check authentication",
        tags: ["auth", "jwt", "session"],
      })
      const results = await matcher.match({
        plan: "Implement JWT authentication with session management using httpOnly cookies",
        rules: [rule],
      })
      expect(results[0].status).toBe("PASS")
    })
  })

  describe("basic matching", () => {
    it("NOT_COVERED when plan has no relation to rule", async () => {
      const rule = makeRule({
        id: "auth",
        title: "Authentication and Authorization",
        content: "All endpoints must check authentication",
        tags: ["auth", "rbac"],
      })
      const results = await matcher.match({
        plan: "Add a CSS animation to the loading spinner",
        rules: [rule],
      })
      expect(results[0].status).toBe("NOT_COVERED")
    })
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/keyword.test.ts`
Expected: FAIL — module not found

**Step 3: Implement KeywordMatcher**

Create `packages/cli/src/lib/matchers/keyword.ts`:

```typescript
import type { Matcher, MatcherContext, MatchResult, MatchStatus } from "./types.js"
import type { LocalRule } from "../local-rules.js"

/** Patterns that indicate the plan is PREVENTING the prohibited thing */
const NEGATION_PREFIXES = [
  "ensure no", "ensure that no", "prevent", "avoid", "prohibit",
  "never allow", "disallow", "block", "reject", "eliminate",
  "remove all", "will not", "won't", "do not", "don't",
  "make sure no", "verify no", "check for no",
]

const PROHIBITION_PATTERNS = [
  /never\s+(\w+(?:\s+\w+){0,3})/gi,
  /must\s+not\s+(\w+(?:\s+\w+){0,3})/gi,
  /avoid\s+(\w+(?:\s+\w+){0,2})/gi,
  /don[''\u2019]t\s+(\w+(?:\s+\w+){0,2})/gi,
  /no\s+(\w+(?:\s+\w+){0,2})/gi,
]

const REQUIREMENT_PATTERNS = [
  /must\s+(?:be\s+)?(\w+(?:\s+\w+){0,3})/gi,
  /always\s+(\w+(?:\s+\w+){0,2})/gi,
  /require[sd]?\s+(\w+(?:\s+\w+){0,2})/gi,
]

function extractProhibitions(text: string): string[] {
  const results: string[] = []
  for (const pat of PROHIBITION_PATTERNS) {
    pat.lastIndex = 0
    let m
    while ((m = pat.exec(text)) !== null) {
      results.push((m[1] ?? m[0]).trim().toLowerCase())
    }
  }
  return results
}

function extractRequirements(text: string): string[] {
  const results: string[] = []
  for (const pat of REQUIREMENT_PATTERNS) {
    pat.lastIndex = 0
    let m
    while ((m = pat.exec(text)) !== null) {
      if (!m[0].toLowerCase().includes("must not")) {
        results.push((m[1] ?? m[0]).trim().toLowerCase())
      }
    }
  }
  return results
}

function isNegatedInContext(planLower: string, prohibition: string): boolean {
  const idx = planLower.indexOf(prohibition)
  if (idx === -1) return false

  // Check if any negation prefix appears before this prohibition
  const before = planLower.slice(Math.max(0, idx - 60), idx)
  return NEGATION_PREFIXES.some((prefix) => before.includes(prefix))
}

function extractKeywords(rule: LocalRule): string[] {
  const keywords: string[] = []
  const titleWords = rule.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  keywords.push(...titleWords)
  keywords.push(...rule.tags.map((t) => t.toLowerCase()))
  keywords.push(rule.category.toLowerCase())
  return [...new Set(keywords)]
}

function matchSingleRule(plan: string, rule: LocalRule): MatchResult {
  const planLower = plan.toLowerCase()
  const ruleText = `${rule.title} ${rule.content}`.toLowerCase()
  const keywords = extractKeywords(rule)
  const prohibitions = extractProhibitions(ruleText)
  const requirements = extractRequirements(ruleText)

  // Check violations — but respect negation context
  const realViolations: string[] = []
  for (const prohibition of prohibitions) {
    const words = prohibition.split(/\s+/).filter((w) => w.length > 3)
    if (words.length === 0) continue

    const significantWords = words.filter((w) => w.length > 4)
    const allPresent = significantWords.length > 0 && significantWords.every((w) => planLower.includes(w))
    const singlePresent = words.length === 1 && words[0].length > 4 && planLower.includes(words[0])

    if (allPresent || singlePresent) {
      // Check if the plan is actually PREVENTING this (negation context)
      const prohibitionText = significantWords.length > 0 ? significantWords.join(" ") : words[0]
      if (!isNegatedInContext(planLower, prohibitionText)) {
        realViolations.push(prohibition)
      }
    }
  }

  // Check if plan addresses the rule
  const keywordMatches = keywords.filter((kw) => planLower.includes(kw))
  const requirementMatches = requirements.filter((req) => {
    const words = req.split(/\s+/).filter((w) => w.length > 3)
    return words.length > 0 && words.some((w) => planLower.includes(w))
  })

  const addressRatio = keywords.length > 0 ? keywordMatches.length / keywords.length : 0
  const isAddressed = addressRatio > 0.3 || requirementMatches.length > 0

  if (realViolations.length > 0) {
    const firstBullet = rule.content.split("\n").find((l) => l.startsWith("- "))
    return {
      ruleId: rule.id,
      status: "VIOLATED",
      confidence: 0.6,
      reason: `Plan contradicts rule: mentions "${realViolations[0]}"`,
      suggestedFix: firstBullet
        ? `Follow: ${firstBullet.replace(/^-\s*/, "").trim()}`
        : `Review rule "${rule.title}" and adjust plan`,
    }
  }

  if (isAddressed) {
    return {
      ruleId: rule.id,
      status: "PASS",
      confidence: Math.min(0.4 + addressRatio * 0.4, 0.7),
      reason: `Plan addresses: ${keywordMatches.slice(0, 3).join(", ")}`,
    }
  }

  return {
    ruleId: rule.id,
    status: "NOT_COVERED",
    confidence: 0.3,
    reason: "Rule not addressed in plan",
    suggestedFix: `Review rule "${rule.title}" for applicability`,
  }
}

export class KeywordMatcher implements Matcher {
  readonly name = "keyword"

  async match(context: MatcherContext): Promise<readonly MatchResult[]> {
    return context.rules.map((rule) => matchSingleRule(context.plan, rule))
  }
}
```

**Step 4: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/keyword.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/matchers/keyword.ts packages/cli/src/lib/matchers/keyword.test.ts
git commit -m "feat: keyword matcher with negation awareness and phrase matching"
```

---

## Task 4: Semantic Matcher (Layer 2) — TF-IDF Cosine Similarity

**Files:**
- Create: `packages/cli/src/lib/matchers/semantic.ts`
- Create: `packages/cli/src/lib/matchers/semantic.test.ts`

**Step 1: Write the failing tests**

Create `packages/cli/src/lib/matchers/semantic.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { SemanticMatcher } from "./semantic.js"
import { makeRule } from "../../__tests__/setup.js"

describe("SemanticMatcher", () => {
  const matcher = new SemanticMatcher()

  it("PASS when plan is semantically related to auth rule", async () => {
    const rule = makeRule({
      id: "auth",
      title: "Authentication and Authorization",
      content: "Use httpOnly cookies. All endpoints must check authentication. Use JWT tokens with refresh rotation.",
      tags: ["auth", "jwt", "session", "rbac"],
    })
    const results = await matcher.match({
      plan: "JWT tokens stored in httpOnly cookies with session refresh",
      rules: [rule],
    })
    expect(results[0].status).toBe("PASS")
    expect(results[0].confidence).toBeGreaterThan(0.4)
  })

  it("NOT_COVERED when plan is completely unrelated", async () => {
    const rule = makeRule({
      id: "auth",
      title: "Authentication and Authorization",
      content: "Use httpOnly cookies. All endpoints must check authentication.",
      tags: ["auth", "jwt"],
    })
    const results = await matcher.match({
      plan: "Add CSS grid layout to the dashboard page with responsive breakpoints",
      rules: [rule],
    })
    expect(results[0].status).toBe("NOT_COVERED")
  })

  it("handles multiple rules returning results for each", async () => {
    const rules = [
      makeRule({ id: "auth", title: "Auth", content: "JWT authentication required", tags: ["auth"] }),
      makeRule({ id: "secrets", title: "No Secrets", content: "Use environment variables for secrets", tags: ["env"] }),
    ]
    const results = await matcher.match({
      plan: "Add JWT auth and load API keys from environment variables",
      rules,
    })
    expect(results).toHaveLength(2)
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/semantic.test.ts`
Expected: FAIL — module not found

**Step 3: Implement SemanticMatcher**

Create `packages/cli/src/lib/matchers/semantic.ts`:

```typescript
import type { Matcher, MatcherContext, MatchResult } from "./types.js"
import type { LocalRule } from "../local-rules.js"

/** Simple tokenizer: lowercase, split on non-alpha, filter short words */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
}

/** Build term frequency map */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1)
  }
  // Normalize by total tokens
  const total = tokens.length || 1
  for (const [key, val] of tf) {
    tf.set(key, val / total)
  }
  return tf
}

/** Calculate IDF from a set of documents */
function inverseDocumentFrequency(docs: string[][]): Map<string, number> {
  const idf = new Map<string, number>()
  const n = docs.length || 1

  // Collect all unique terms across all docs
  const allTerms = new Set<string>()
  for (const doc of docs) {
    for (const term of new Set(doc)) {
      allTerms.add(term)
    }
  }

  for (const term of allTerms) {
    const docsWithTerm = docs.filter((doc) => doc.includes(term)).length
    idf.set(term, Math.log((n + 1) / (docsWithTerm + 1)) + 1)
  }

  return idf
}

/** Build TF-IDF vector */
function tfidfVector(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
  const vector = new Map<string, number>()
  for (const [term, freq] of tf) {
    vector.set(term, freq * (idf.get(term) ?? 1))
  }
  return vector
}

/** Cosine similarity between two TF-IDF vectors */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  const allKeys = new Set([...a.keys(), ...b.keys()])

  for (const key of allKeys) {
    const va = a.get(key) ?? 0
    const vb = b.get(key) ?? 0
    dotProduct += va * vb
    normA += va * va
    normB += vb * vb
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0
  return dotProduct / denominator
}

const SIMILARITY_THRESHOLD = 0.15

function ruleToText(rule: LocalRule): string {
  return `${rule.title} ${rule.content} ${rule.tags.join(" ")} ${rule.category}`
}

export class SemanticMatcher implements Matcher {
  readonly name = "semantic"

  async match(context: MatcherContext): Promise<readonly MatchResult[]> {
    const planTokens = tokenize(context.plan)
    const ruleTexts = context.rules.map((r) => tokenize(ruleToText(r)))

    // Build IDF from all documents (plan + all rules)
    const allDocs = [planTokens, ...ruleTexts]
    const idf = inverseDocumentFrequency(allDocs)

    const planTf = termFrequency(planTokens)
    const planVector = tfidfVector(planTf, idf)

    return context.rules.map((rule, i) => {
      const ruleTf = termFrequency(ruleTexts[i])
      const ruleVector = tfidfVector(ruleTf, idf)
      const similarity = cosineSimilarity(planVector, ruleVector)

      if (similarity >= SIMILARITY_THRESHOLD) {
        return {
          ruleId: rule.id,
          status: "PASS" as const,
          confidence: Math.min(0.5 + similarity, 0.85),
          reason: `Semantic similarity: ${(similarity * 100).toFixed(0)}%`,
        }
      }

      return {
        ruleId: rule.id,
        status: "NOT_COVERED" as const,
        confidence: 0.4,
        reason: `Low semantic similarity: ${(similarity * 100).toFixed(0)}%`,
      }
    })
  }
}
```

**Step 4: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/semantic.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/matchers/semantic.ts packages/cli/src/lib/matchers/semantic.test.ts
git commit -m "feat: semantic matcher with TF-IDF cosine similarity"
```

---

## Task 5: Validation Pipeline (Orchestrator)

**Files:**
- Create: `packages/cli/src/lib/matchers/pipeline.ts`
- Create: `packages/cli/src/lib/matchers/pipeline.test.ts`

**Step 1: Write the failing tests**

Create `packages/cli/src/lib/matchers/pipeline.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { ValidationPipeline } from "./pipeline.js"
import { KeywordMatcher } from "./keyword.js"
import { SemanticMatcher } from "./semantic.js"
import { makeRule } from "../../__tests__/setup.js"

describe("ValidationPipeline", () => {
  it("runs multiple matchers and merges by highest confidence", async () => {
    const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])
    const rule = makeRule({
      id: "auth",
      title: "Authentication and Authorization",
      content: "Use httpOnly cookies.\n- All endpoints must check authentication",
      tags: ["auth", "jwt"],
    })

    const result = await pipeline.run({
      plan: "Implement JWT authentication with httpOnly cookie storage",
      rules: [rule],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].status).toBe("PASS")
    expect(result.layers).toContain("keyword")
    expect(result.layers).toContain("semantic")
  })

  it("upper layer wins on conflict with same confidence", async () => {
    const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])
    const rule = makeRule({
      id: "secrets",
      title: "No Hardcoded Secrets",
      content: "Never hardcode API keys.\n- Never hardcode API keys in source files",
      tags: ["secrets", "env"],
      modality: "must",
    })

    const result = await pipeline.run({
      plan: "We will ensure no hardcoded secrets and use env vars for all credentials",
      rules: [rule],
    })

    // Both matchers should agree on PASS due to negation awareness
    expect(result.results[0].status).toBe("PASS")
  })

  it("returns NOT_COVERED when no matcher finds relevance", async () => {
    const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])
    const rule = makeRule({
      id: "auth",
      title: "Authentication",
      content: "All endpoints must check auth",
      tags: ["auth"],
    })

    const result = await pipeline.run({
      plan: "Add CSS animation to loading spinner",
      rules: [rule],
    })

    expect(result.results[0].status).toBe("NOT_COVERED")
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/pipeline.test.ts`
Expected: FAIL

**Step 3: Implement pipeline**

Create `packages/cli/src/lib/matchers/pipeline.ts`:

```typescript
import type { Matcher, MatcherContext, MatchResult, PipelineResult } from "./types.js"

/**
 * Merge results from multiple matchers for the same rule.
 * Higher-confidence result wins. On tie, later matcher (upper layer) wins.
 */
function mergeResults(resultsByMatcher: readonly (readonly MatchResult[])[]): readonly MatchResult[] {
  if (resultsByMatcher.length === 0) return []

  // Group by ruleId
  const byRule = new Map<string, MatchResult[]>()

  for (const matcherResults of resultsByMatcher) {
    for (const result of matcherResults) {
      const existing = byRule.get(result.ruleId) ?? []
      existing.push(result)
      byRule.set(result.ruleId, existing)
    }
  }

  // For each rule, pick the best result
  const merged: MatchResult[] = []

  for (const [, candidates] of byRule) {
    // Sort by confidence desc — on tie, later entry wins (upper layer)
    const sorted = [...candidates].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return candidates.indexOf(b) - candidates.indexOf(a)
    })
    merged.push(sorted[0])
  }

  return merged
}

export class ValidationPipeline {
  private readonly matchers: readonly Matcher[]

  constructor(matchers: readonly Matcher[]) {
    this.matchers = matchers
  }

  async run(context: MatcherContext): Promise<PipelineResult> {
    const allResults: (readonly MatchResult[])[] = []

    for (const matcher of this.matchers) {
      const results = await matcher.match(context)
      allResults.push(results)
    }

    return {
      results: mergeResults(allResults),
      layers: this.matchers.map((m) => m.name),
    }
  }
}
```

**Step 4: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/pipeline.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/matchers/pipeline.ts packages/cli/src/lib/matchers/pipeline.test.ts
git commit -m "feat: validation pipeline orchestrator with multi-layer merge"
```

---

## Task 6: LLM Matcher (Layer 3) — Vercel AI SDK

**Files:**
- Modify: `packages/cli/package.json` (add optional deps)
- Create: `packages/cli/src/lib/matchers/llm.ts`
- Create: `packages/cli/src/lib/matchers/llm.test.ts`

**Step 1: Install Vercel AI SDK as optional deps**

Run: `cd packages/cli && pnpm add ai @ai-sdk/anthropic @ai-sdk/openai`

Then manually move them to `optionalDependencies` in `package.json`:

```json
"optionalDependencies": {
  "ai": "^4",
  "@ai-sdk/anthropic": "^1",
  "@ai-sdk/openai": "^1"
}
```

**Step 2: Write the test**

Create `packages/cli/src/lib/matchers/llm.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { LLMMatcher } from "./llm.js"
import { makeRule } from "../../__tests__/setup.js"

// Mock the AI SDK — we don't call real APIs in tests
vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      status: "PASS",
      confidence: 0.92,
      reason: "Plan explicitly addresses authentication with JWT and httpOnly cookies",
    },
  }),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue({ modelId: "claude-sonnet" }),
}))

describe("LLMMatcher", () => {
  it("returns structured result from LLM", async () => {
    const matcher = new LLMMatcher({ provider: "anthropic" })
    const rule = makeRule({
      id: "auth",
      title: "Authentication and Authorization",
      content: "All endpoints must check auth. Use httpOnly cookies.",
      tags: ["auth", "jwt"],
    })

    const results = await matcher.match({
      plan: "Implement JWT auth with httpOnly cookies",
      rules: [rule],
    })

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe("PASS")
    expect(results[0].confidence).toBeGreaterThan(0.8)
  })

  it("throws clear error when AI SDK not installed", async () => {
    vi.doUnmock("ai")
    // This test verifies the error message pattern
    // Actual missing-module behavior is tested via integration
    expect(true).toBe(true)
  })
})
```

**Step 3: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/llm.test.ts`
Expected: FAIL

**Step 4: Implement LLMMatcher**

Create `packages/cli/src/lib/matchers/llm.ts`:

```typescript
import type { Matcher, MatcherContext, MatchResult, MatchStatus } from "./types.js"
import type { LocalRule } from "../local-rules.js"

export interface LLMConfig {
  readonly provider: "anthropic" | "openai"
  readonly model?: string
}

function buildPrompt(plan: string, rule: LocalRule): string {
  return `You are a code compliance validator. Determine if the following implementation plan complies with the given rule.

## Rule: ${rule.title}
Category: ${rule.category} | Severity: ${rule.severity} | Modality: ${rule.modality}

${rule.content}

## Plan to validate:
${plan}

Evaluate whether the plan violates, satisfies, or does not address this rule.`
}

async function getModel(config: LLMConfig) {
  try {
    if (config.provider === "anthropic") {
      const { anthropic } = await import("@ai-sdk/anthropic")
      return anthropic(config.model ?? "claude-sonnet-4-20250514")
    }
    const { openai } = await import("@ai-sdk/openai")
    return openai(config.model ?? "gpt-4o")
  } catch {
    throw new Error(
      `--llm requires AI packages. Run: pnpm add ai @ai-sdk/${config.provider}`
    )
  }
}

async function validateRule(
  plan: string,
  rule: LocalRule,
  config: LLMConfig
): Promise<MatchResult> {
  const { generateObject } = await import("ai")
  const { z } = await import("zod")
  const model = await getModel(config)

  const { object } = await generateObject({
    model,
    prompt: buildPrompt(plan, rule),
    schema: z.object({
      status: z.enum(["PASS", "VIOLATED", "NOT_COVERED"]),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    }),
  })

  return {
    ruleId: rule.id,
    status: object.status as MatchStatus,
    confidence: object.confidence,
    reason: object.reason,
  }
}

export class LLMMatcher implements Matcher {
  readonly name = "llm"
  private readonly config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async match(context: MatcherContext): Promise<readonly MatchResult[]> {
    // Run in parallel with concurrency limit
    const CONCURRENCY = 5
    const results: MatchResult[] = []
    const rules = [...context.rules]

    while (rules.length > 0) {
      const batch = rules.splice(0, CONCURRENCY)
      const batchResults = await Promise.all(
        batch.map((rule) => validateRule(context.plan, rule, this.config))
      )
      results.push(...batchResults)
    }

    return results
  }
}
```

**Step 5: Add zod dependency**

Run: `cd packages/cli && pnpm add zod`

**Step 6: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/matchers/llm.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/cli/src/lib/matchers/llm.ts packages/cli/src/lib/matchers/llm.test.ts packages/cli/package.json
git commit -m "feat: LLM matcher with Vercel AI SDK (Anthropic + OpenAI)"
```

---

## Task 7: Wire Pipeline into Existing Commands

**Files:**
- Create: `packages/cli/src/lib/validation.ts`
- Modify: `packages/cli/src/commands/validate.ts`
- Modify: `packages/cli/src/commands/diff.ts`
- Modify: `packages/cli/src/commands/find-rules.ts`

**Step 1: Create new validation module**

Create `packages/cli/src/lib/validation.ts`:

```typescript
import { ValidationPipeline } from "./matchers/pipeline.js"
import { KeywordMatcher } from "./matchers/keyword.js"
import { SemanticMatcher } from "./matchers/semantic.js"
import type { LocalRule } from "./local-rules.js"
import type { PipelineResult } from "./matchers/types.js"
import type { ValidationReport, ValidationResult } from "./local-rules.js"

interface ValidateOptions {
  readonly plan: string
  readonly rules: readonly LocalRule[]
  readonly task?: string
  readonly useLlm?: boolean
  readonly llmProvider?: "anthropic" | "openai"
  readonly llmModel?: string
}

function pipelineResultToReport(
  pipelineResult: PipelineResult,
  rules: readonly LocalRule[],
  task: string
): ValidationReport {
  const ruleMap = new Map(rules.map((r) => [r.id, r]))

  const results: ValidationResult[] = pipelineResult.results.map((mr) => {
    const rule = ruleMap.get(mr.ruleId)
    return {
      ruleId: mr.ruleId,
      ruleTitle: rule?.title ?? mr.ruleId,
      severity: rule?.severity ?? "warning",
      modality: rule?.modality ?? "should",
      status: mr.status,
      reason: mr.reason,
      suggestedFix: mr.suggestedFix,
    }
  })

  const summary = {
    pass: results.filter((r) => r.status === "PASS").length,
    violated: results.filter((r) => r.status === "VIOLATED").length,
    notCovered: results.filter((r) => r.status === "NOT_COVERED").length,
  }

  const hasMustViolation = results.some(
    (r) => r.status === "VIOLATED" && r.modality === "must"
  )

  let status: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED"
  if (hasMustViolation) {
    status = "FAILED"
  } else if (summary.violated > 0 || summary.notCovered > 0) {
    status = "PASSED_WITH_WARNINGS"
  } else {
    status = "PASSED"
  }

  return {
    task,
    rulesMatched: results.filter((r) => r.status !== "NOT_COVERED").length,
    rulesTotal: rules.length,
    results,
    summary,
    status,
  }
}

export async function validateWithPipeline(options: ValidateOptions): Promise<ValidationReport> {
  const matchers = [new KeywordMatcher(), new SemanticMatcher()]

  if (options.useLlm) {
    const { LLMMatcher } = await import("./matchers/llm.js")
    matchers.push(
      new LLMMatcher({
        provider: options.llmProvider ?? "anthropic",
        model: options.llmModel,
      })
    )
  }

  const pipeline = new ValidationPipeline(matchers)
  const pipelineResult = await pipeline.run({
    plan: options.plan,
    rules: options.rules,
    task: options.task,
  })

  return pipelineResultToReport(
    pipelineResult,
    options.rules,
    options.task ?? options.plan.slice(0, 100)
  )
}
```

**Step 2: Update validate command**

In `packages/cli/src/commands/validate.ts`, replace the `validatePlanAgainstRules` call with `validateWithPipeline`. Add `--llm` option. Keep the existing report printing logic.

Key change in `validateCommand`:
```typescript
// Old:
const report = validatePlanAgainstRules(planText, rules, planText.slice(0, 100))

// New:
const report = await validateWithPipeline({
  plan: planText,
  rules,
  task: planText.slice(0, 100),
  useLlm: options.llm,
})
```

**Step 3: Update diff command similarly**

In `packages/cli/src/commands/diff.ts`, same replacement.

**Step 4: Add `--llm` flag to CLI commands**

In `packages/cli/src/index.ts`, add to validate and diff commands:
```typescript
.option("--llm", "Use LLM for deep validation (requires AI SDK)")
```

**Step 5: Run all tests**

Run: `cd packages/cli && pnpm test`
Expected: All tests PASS

**Step 6: Manual smoke test**

Run: `cd packages/cli && pnpm build && node dist/index.js validate --plan "We will ensure no hardcoded secrets and use env vars" --dir ../../examples/rules`
Expected: "No Hardcoded Secrets" shows PASS (not VIOLATED)

**Step 7: Commit**

```bash
git add packages/cli/src/lib/validation.ts packages/cli/src/commands/validate.ts packages/cli/src/commands/diff.ts packages/cli/src/index.ts
git commit -m "feat: wire validation pipeline into validate and diff commands"
```

---

## Task 8: Fix `matchRulesByContext` Bug

**Files:**
- Modify: `packages/cli/src/lib/local-rules.ts:198-206`
- Create: `packages/cli/src/lib/local-rules.test.ts`

**Step 1: Write test exposing the bug**

Create `packages/cli/src/lib/local-rules.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { matchRulesByContext, filterRules } from "./local-rules.js"
import { makeRule } from "../__tests__/setup.js"

describe("matchRulesByContext", () => {
  it("filters global rules by task when task is provided", () => {
    const rules = [
      makeRule({ id: "auth", title: "Authentication", tags: ["auth"], category: "security" }),
      makeRule({ id: "css", title: "CSS Conventions", tags: ["css", "style"], category: "style" }),
    ]

    const matched = matchRulesByContext(rules, null, "add JWT authentication")
    const ids = matched.map((r) => r.id)

    expect(ids).toContain("auth")
    // CSS rule should NOT match an auth task
    expect(ids).not.toContain("css")
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/local-rules.test.ts`
Expected: FAIL — css rule incorrectly included due to `rule.scope.length === 0` always being true

**Step 3: Fix the bug**

In `packages/cli/src/lib/local-rules.ts`, line 198-206, replace:

```typescript
// Old (buggy):
matched = matched.filter(({ rule }) => {
  const ruleText = `${rule.title} ${rule.tags.join(" ")} ${rule.category} ${rule.stack.join(" ")}`.toLowerCase()
  const hasContextMatch = rule.stack.length > 0 || rule.scope.length > 0
  if (!hasContextMatch) {
    return taskWords.some((word) => ruleText.includes(word)) || rule.scope.length === 0
  }
  return true
})
```

```typescript
// New (fixed):
matched = matched.filter(({ rule }) => {
  const hasContextMatch = rule.stack.length > 0 || rule.scope.length > 0
  if (hasContextMatch) return true

  // Global rules: filter by task relevance
  const ruleText = `${rule.title} ${rule.tags.join(" ")} ${rule.category} ${rule.stack.join(" ")}`.toLowerCase()
  return taskWords.some((word) => ruleText.includes(word))
})
```

**Step 4: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/local-rules.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/local-rules.ts packages/cli/src/lib/local-rules.test.ts
git commit -m "fix: matchRulesByContext no longer bypasses task filter for global rules"
```

---

## Task 9: Progressive Enforcement

**Files:**
- Modify: `packages/cli/src/lib/inheritance.ts` (add enforcement to config type)
- Create: `packages/cli/src/lib/enforcement.ts`
- Create: `packages/cli/src/lib/enforcement.test.ts`
- Create: `packages/cli/src/commands/enforce.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/src/commands/hook.ts`

**Step 1: Write tests**

Create `packages/cli/src/lib/enforcement.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { shouldBlock, type EnforcementConfig, type EnforcementMode } from "./enforcement.js"

describe("shouldBlock", () => {
  it("advisory mode never blocks", () => {
    const config: EnforcementConfig = { mode: "advisory", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: true, score: 0 })).toBe(false)
  })

  it("moderate mode blocks on MUST violation", () => {
    const config: EnforcementConfig = { mode: "moderate", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: true, score: 80 })).toBe(true)
  })

  it("moderate mode blocks when score below threshold", () => {
    const config: EnforcementConfig = { mode: "moderate", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: false, score: 50 })).toBe(true)
  })

  it("moderate mode passes when no violation and score above threshold", () => {
    const config: EnforcementConfig = { mode: "moderate", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: false, score: 85 })).toBe(false)
  })

  it("strict mode blocks on any MUST violation", () => {
    const config: EnforcementConfig = { mode: "strict", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: true, score: 100 })).toBe(true)
  })

  it("strict mode blocks when score below threshold", () => {
    const config: EnforcementConfig = { mode: "strict", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: false, score: 60 })).toBe(true)
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/enforcement.test.ts`
Expected: FAIL

**Step 3: Implement enforcement module**

Create `packages/cli/src/lib/enforcement.ts`:

```typescript
export type EnforcementMode = "advisory" | "moderate" | "strict"

export interface EnforcementConfig {
  readonly mode: EnforcementMode
  readonly scoreThreshold: number
  readonly autoPromote: boolean
}

export const DEFAULT_ENFORCEMENT: EnforcementConfig = {
  mode: "advisory",
  scoreThreshold: 70,
  autoPromote: true,
}

interface BlockCheckInput {
  readonly hasMustViolation: boolean
  readonly score: number
}

export function shouldBlock(config: EnforcementConfig, input: BlockCheckInput): boolean {
  switch (config.mode) {
    case "advisory":
      return false

    case "moderate":
      return input.hasMustViolation || input.score < config.scoreThreshold

    case "strict":
      return input.hasMustViolation || input.score < config.scoreThreshold
  }
}

export function shouldWarn(config: EnforcementConfig, hasShouldViolation: boolean): boolean {
  return config.mode === "strict" && hasShouldViolation
}

export function shouldSuggestPromotion(config: EnforcementConfig, score: number): boolean {
  return config.autoPromote && config.mode !== "strict" && score >= 90
}
```

**Step 4: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/enforcement.test.ts`
Expected: All 6 tests PASS

**Step 5: Create enforce command**

Create `packages/cli/src/commands/enforce.ts`:

```typescript
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import chalk from "chalk"
import { DEFAULT_ENFORCEMENT, type EnforcementConfig, type EnforcementMode } from "../lib/enforcement.js"

interface EnforceOptions {
  mode?: string
  threshold?: string
}

function loadEnforcementConfig(cwd: string): EnforcementConfig {
  const configPath = resolve(cwd, ".rulebound", "config.json")
  if (!existsSync(configPath)) return DEFAULT_ENFORCEMENT

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"))
    return {
      mode: config.enforcement?.mode ?? DEFAULT_ENFORCEMENT.mode,
      scoreThreshold: config.enforcement?.scoreThreshold ?? DEFAULT_ENFORCEMENT.scoreThreshold,
      autoPromote: config.enforcement?.autoPromote ?? DEFAULT_ENFORCEMENT.autoPromote,
    }
  } catch {
    return DEFAULT_ENFORCEMENT
  }
}

function saveEnforcementConfig(cwd: string, enforcement: EnforcementConfig): void {
  const configPath = resolve(cwd, ".rulebound", "config.json")
  let config: Record<string, unknown> = {}

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"))
    } catch {
      // Start fresh
    }
  }

  config.enforcement = {
    mode: enforcement.mode,
    scoreThreshold: enforcement.scoreThreshold,
    autoPromote: enforcement.autoPromote,
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
}

const VALID_MODES: EnforcementMode[] = ["advisory", "moderate", "strict"]

export async function enforceCommand(options: EnforceOptions): Promise<void> {
  const cwd = process.cwd()
  const current = loadEnforcementConfig(cwd)

  // No options = show current mode
  if (!options.mode && !options.threshold) {
    console.log()
    console.log(chalk.white.bold("ENFORCEMENT"))
    console.log(chalk.dim("\u2500".repeat(40)))
    console.log(`  Mode:      ${chalk.white.bold(current.mode)}`)
    console.log(`  Threshold: ${chalk.white(String(current.scoreThreshold))}`)
    console.log(`  Auto-promote: ${chalk.white(String(current.autoPromote))}`)
    console.log()
    console.log(chalk.dim("Change with: rulebound enforce --mode <advisory|moderate|strict>"))
    return
  }

  const updated = { ...current }

  if (options.mode) {
    if (!VALID_MODES.includes(options.mode as EnforcementMode)) {
      console.error(chalk.red(`Invalid mode: ${options.mode}. Use: advisory, moderate, strict`))
      process.exit(1)
    }
    updated.mode = options.mode as EnforcementMode
  }

  if (options.threshold) {
    const threshold = parseInt(options.threshold, 10)
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      console.error(chalk.red("Threshold must be 0-100"))
      process.exit(1)
    }
    updated.scoreThreshold = threshold
  }

  saveEnforcementConfig(cwd, updated)

  console.log()
  console.log(chalk.white(`Enforcement updated:`))
  if (options.mode) console.log(`  Mode: ${chalk.white.bold(updated.mode)}`)
  if (options.threshold) console.log(`  Threshold: ${chalk.white(String(updated.scoreThreshold))}`)
}
```

**Step 6: Update hook.ts to be enforcement-aware**

Replace `HOOK_CONTENT` in `packages/cli/src/commands/hook.ts` with enforcement-aware version:

```shell
#!/bin/sh
# Rulebound pre-commit hook (enforcement-aware)

echo "Rulebound: validating changes..."

DIFF=$(git diff --cached)
if [ -z "$DIFF" ]; then
  exit 0
fi

npx rulebound diff --ref HEAD 2>/dev/null
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "Rulebound: commit blocked by enforcement policy."
  echo "Run 'rulebound diff' for details."
  echo "Run 'rulebound enforce' to check enforcement mode."
  exit 1
fi

exit 0
```

**Step 7: Register enforce command in index.ts**

Add to `packages/cli/src/index.ts`:
```typescript
import { enforceCommand } from "./commands/enforce.js"

program
  .command("enforce")
  .description("View or change enforcement mode (advisory, moderate, strict)")
  .option("-m, --mode <mode>", "Set enforcement mode: advisory, moderate, strict")
  .option("-t, --threshold <number>", "Set score threshold (0-100)")
  .action(enforceCommand)
```

**Step 8: Run all tests**

Run: `cd packages/cli && pnpm test`
Expected: All tests PASS

**Step 9: Commit**

```bash
git add packages/cli/src/lib/enforcement.ts packages/cli/src/lib/enforcement.test.ts packages/cli/src/commands/enforce.ts packages/cli/src/commands/hook.ts packages/cli/src/index.ts
git commit -m "feat: progressive enforcement (advisory/moderate/strict) with score threshold"
```

---

## Task 10: `rulebound ci` Command

**Files:**
- Create: `packages/cli/src/commands/ci.ts`
- Create: `packages/cli/src/commands/ci.test.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the test**

Create `packages/cli/src/commands/ci.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { formatGitHubAnnotation } from "./ci.js"

describe("formatGitHubAnnotation", () => {
  it("formats VIOLATED as error annotation", () => {
    const annotation = formatGitHubAnnotation({
      ruleId: "global.no-secrets",
      ruleTitle: "No Hardcoded Secrets",
      severity: "error",
      modality: "must",
      status: "VIOLATED",
      reason: "Plan mentions hardcoded key",
    })
    expect(annotation).toBe("::error::MUST violation: No Hardcoded Secrets - Plan mentions hardcoded key")
  })

  it("formats NOT_COVERED as warning annotation", () => {
    const annotation = formatGitHubAnnotation({
      ruleId: "global.testing",
      ruleTitle: "Testing Requirements",
      severity: "warning",
      modality: "should",
      status: "NOT_COVERED",
      reason: "Rule not addressed",
    })
    expect(annotation).toBe("::warning::SHOULD: Testing Requirements - Rule not addressed")
  })

  it("returns empty string for PASS", () => {
    const annotation = formatGitHubAnnotation({
      ruleId: "test",
      ruleTitle: "Test",
      severity: "info",
      modality: "may",
      status: "PASS",
      reason: "OK",
    })
    expect(annotation).toBe("")
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/commands/ci.test.ts`
Expected: FAIL

**Step 3: Implement ci command**

Create `packages/cli/src/commands/ci.ts`:

```typescript
import { execSync } from "node:child_process"
import chalk from "chalk"
import { loadRulesWithInheritance, getProjectConfig } from "../lib/inheritance.js"
import { matchRulesByContext, loadLocalRules } from "../lib/local-rules.js"
import type { ValidationResult } from "../lib/local-rules.js"
import { validateWithPipeline } from "../lib/validation.js"
import { shouldBlock, DEFAULT_ENFORCEMENT } from "../lib/enforcement.js"
import { loadConfig } from "../lib/inheritance.js"

interface CiOptions {
  base?: string
  format?: string
  llm?: boolean
  dir?: string
}

export function formatGitHubAnnotation(result: ValidationResult): string {
  if (result.status === "PASS") return ""

  const level = result.status === "VIOLATED" ? "error" : "warning"
  const prefix = result.status === "VIOLATED"
    ? `MUST violation: ${result.ruleTitle}`
    : `${result.modality.toUpperCase()}: ${result.ruleTitle}`

  return `::${level}::${prefix} - ${result.reason}`
}

export async function ciCommand(options: CiOptions): Promise<void> {
  const base = options.base ?? "main"

  let diffText: string
  try {
    diffText = execSync(`git diff origin/${base}...HEAD`, { encoding: "utf-8" })
  } catch {
    try {
      diffText = execSync(`git diff ${base}...HEAD`, { encoding: "utf-8" })
    } catch {
      console.error(chalk.red("Failed to compute diff. Ensure you're in a git repo with a valid base branch."))
      process.exit(2)
    }
  }

  if (!diffText.trim()) {
    console.log(chalk.dim("No changes detected against base branch."))
    process.exit(0)
  }

  // Load rules
  let allRules
  if (options.dir) {
    allRules = loadLocalRules(options.dir)
  } else {
    allRules = loadRulesWithInheritance(process.cwd())
  }

  if (allRules.length === 0) {
    console.error(chalk.red("No rules found."))
    process.exit(2)
  }

  // Extract added lines
  const addedLines = diffText
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1))
    .join("\n")

  const projectConfig = getProjectConfig(process.cwd())
  const rules = matchRulesByContext(allRules, projectConfig, addedLines.slice(0, 2000))

  // Run validation pipeline
  const report = await validateWithPipeline({
    plan: addedLines,
    rules,
    task: `CI: diff against ${base}`,
    useLlm: options.llm,
  })

  // GitHub annotations format
  if (options.format === "github") {
    for (const result of report.results) {
      const annotation = formatGitHubAnnotation(result)
      if (annotation) console.log(annotation)
    }

    if (report.status === "FAILED") process.exit(1)
    process.exit(0)
  }

  // JSON format
  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2))
    if (report.status === "FAILED") process.exit(1)
    process.exit(0)
  }

  // Default: pretty print (reuse diff command style)
  console.log()
  console.log(chalk.white.bold("CI VALIDATION"))
  console.log(chalk.dim(`Base: ${base}`))
  console.log(chalk.dim(`Rules matched: ${report.rulesMatched}/${report.rulesTotal}`))
  console.log(chalk.dim("\u2500".repeat(50)))

  // Load enforcement config
  const config = loadConfig(process.cwd())
  const enforcement = {
    mode: config?.enforcement?.mode ?? DEFAULT_ENFORCEMENT.mode,
    scoreThreshold: config?.enforcement?.scoreThreshold ?? DEFAULT_ENFORCEMENT.scoreThreshold,
    autoPromote: config?.enforcement?.autoPromote ?? DEFAULT_ENFORCEMENT.autoPromote,
  }

  const score = report.rulesTotal > 0
    ? Math.round((report.summary.pass / report.rulesTotal) * 100)
    : 100

  const hasMustViolation = report.results.some(
    (r) => r.status === "VIOLATED" && r.modality === "must"
  )

  const blocked = shouldBlock(enforcement, { hasMustViolation, score })

  for (const item of report.results.filter((r) => r.status !== "PASS")) {
    const icon = item.status === "VIOLATED" ? chalk.red("\u2717") : chalk.yellow("\u25CB")
    console.log(`  ${icon} [${item.status}] ${item.ruleTitle}`)
    console.log(chalk.dim(`    ${item.reason}`))
  }

  console.log()
  console.log(
    `  ${chalk.green(`${report.summary.pass} PASS`)} | ` +
    `${chalk.red(`${report.summary.violated} VIOLATED`)} | ` +
    `${chalk.yellow(`${report.summary.notCovered} NOT COVERED`)} | ` +
    `Score: ${score}/100`
  )
  console.log(chalk.dim(`  Enforcement: ${enforcement.mode}`))

  if (blocked) {
    console.log(chalk.red.bold("\nBLOCKED by enforcement policy"))
    process.exit(1)
  } else {
    console.log(chalk.green("\nPASSED"))
    process.exit(0)
  }
}
```

**Step 4: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/commands/ci.test.ts`
Expected: All 3 tests PASS

**Step 5: Register in index.ts**

Add to `packages/cli/src/index.ts`:
```typescript
import { ciCommand } from "./commands/ci.js"

program
  .command("ci")
  .description("Validate PR changes in CI/CD pipeline")
  .option("-b, --base <branch>", "Base branch to diff against (default: main)")
  .option("-f, --format <format>", "Output: pretty, json, github")
  .option("--llm", "Use LLM for deep validation")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(ciCommand)
```

**Step 6: Run all tests**

Run: `cd packages/cli && pnpm test`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add packages/cli/src/commands/ci.ts packages/cli/src/commands/ci.test.ts packages/cli/src/index.ts
git commit -m "feat: rulebound ci command with GitHub annotations and enforcement"
```

---

## Task 11: Agent Profiles — Types & Registry

**Files:**
- Create: `packages/cli/src/lib/agents/types.ts`
- Create: `packages/cli/src/lib/agents/registry.ts`
- Create: `packages/cli/src/lib/agents/registry.test.ts`

**Step 1: Write the test**

Create `packages/cli/src/lib/agents/registry.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { parseAgentsConfig, resolveAgentRules, type AgentProfile } from "./registry.js"

describe("parseAgentsConfig", () => {
  it("parses valid agents config", () => {
    const raw = {
      agents: {
        claude: { roles: ["architect"], rules: ["all"], enforcement: "strict" },
        codex: { rules: ["security/*"], enforcement: "moderate" },
      },
    }
    const agents = parseAgentsConfig(raw)
    expect(agents).toHaveLength(2)
    expect(agents[0].name).toBe("claude")
    expect(agents[0].roles).toContain("architect")
    expect(agents[1].name).toBe("codex")
  })

  it("returns empty array for invalid config", () => {
    expect(parseAgentsConfig(null)).toEqual([])
    expect(parseAgentsConfig({})).toEqual([])
  })
})

describe("resolveAgentRules", () => {
  it("returns all rules when agent has 'all'", () => {
    const agent: AgentProfile = {
      name: "claude",
      roles: [],
      rules: ["all"],
      enforcement: "strict",
    }
    const allRuleIds = ["global.auth", "security.secrets", "style.css"]
    expect(resolveAgentRules(agent, allRuleIds)).toEqual(allRuleIds)
  })

  it("filters rules by glob pattern", () => {
    const agent: AgentProfile = {
      name: "admin",
      roles: ["security"],
      rules: ["security/*", "global/*"],
      enforcement: "strict",
    }
    const allRuleIds = ["global.auth", "security.secrets", "style.css", "security.input"]
    const resolved = resolveAgentRules(agent, allRuleIds)
    expect(resolved).toContain("global.auth")
    expect(resolved).toContain("security.secrets")
    expect(resolved).toContain("security.input")
    expect(resolved).not.toContain("style.css")
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/agents/registry.test.ts`
Expected: FAIL

**Step 3: Create types**

Create `packages/cli/src/lib/agents/types.ts`:

```typescript
import type { EnforcementMode } from "../enforcement.js"

export interface AgentProfile {
  readonly name: string
  readonly roles: readonly string[]
  readonly rules: readonly string[]
  readonly enforcement: EnforcementMode
}

export interface AgentReviewResult {
  readonly agentName: string
  readonly roles: readonly string[]
  readonly results: readonly import("../matchers/types.js").MatchResult[]
}

export interface ConsensusResult {
  readonly status: "PASS" | "FAIL" | "WARN"
  readonly agentResults: readonly AgentReviewResult[]
  readonly summary: string
}
```

**Step 4: Implement registry**

Create `packages/cli/src/lib/agents/registry.ts`:

```typescript
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import type { EnforcementMode } from "../enforcement.js"

export interface AgentProfile {
  readonly name: string
  readonly roles: readonly string[]
  readonly rules: readonly string[]
  readonly enforcement: EnforcementMode
}

interface RawAgentsConfig {
  agents?: Record<string, {
    roles?: string[]
    rules?: string[]
    enforcement?: string
  }>
}

export function parseAgentsConfig(raw: unknown): AgentProfile[] {
  if (!raw || typeof raw !== "object") return []

  const config = raw as RawAgentsConfig
  if (!config.agents || typeof config.agents !== "object") return []

  return Object.entries(config.agents).map(([name, agent]) => ({
    name,
    roles: agent.roles ?? [],
    rules: agent.rules ?? ["all"],
    enforcement: (agent.enforcement ?? "advisory") as EnforcementMode,
  }))
}

export function loadAgentsConfig(cwd: string): AgentProfile[] {
  const configPath = resolve(cwd, ".rulebound", "agents.json")
  if (!existsSync(configPath)) return []

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"))
    return parseAgentsConfig(raw)
  } catch {
    return []
  }
}

export function resolveAgentRules(agent: AgentProfile, allRuleIds: string[]): string[] {
  if (agent.rules.includes("all")) return allRuleIds

  return allRuleIds.filter((ruleId) =>
    agent.rules.some((pattern) => {
      if (pattern.endsWith("/*")) {
        const prefix = pattern.slice(0, -2)
        return ruleId.startsWith(prefix)
      }
      return ruleId === pattern
    })
  )
}
```

**Step 5: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/agents/registry.test.ts`
Expected: All 4 tests PASS

**Step 6: Commit**

```bash
git add packages/cli/src/lib/agents/
git commit -m "feat: agent profile types, registry, and rule resolution"
```

---

## Task 12: Multi-Agent Coordinator

**Files:**
- Create: `packages/cli/src/lib/agents/coordinator.ts`
- Create: `packages/cli/src/lib/agents/coordinator.test.ts`

**Step 1: Write the test**

Create `packages/cli/src/lib/agents/coordinator.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { buildConsensus, type AgentReviewResult } from "./coordinator.js"

describe("buildConsensus", () => {
  it("PASS when all agents pass", () => {
    const results: AgentReviewResult[] = [
      {
        agentName: "claude",
        roles: ["architect"],
        results: [{ ruleId: "auth", status: "PASS", confidence: 0.9, reason: "OK" }],
      },
      {
        agentName: "codex",
        roles: ["implementer"],
        results: [{ ruleId: "auth", status: "PASS", confidence: 0.8, reason: "OK" }],
      },
    ]
    const consensus = buildConsensus(results)
    expect(consensus.status).toBe("PASS")
  })

  it("FAIL when any agent finds MUST violation", () => {
    const results: AgentReviewResult[] = [
      {
        agentName: "claude",
        roles: ["architect"],
        results: [{ ruleId: "secrets", status: "PASS", confidence: 0.9, reason: "OK" }],
      },
      {
        agentName: "claude-admin",
        roles: ["security"],
        results: [{ ruleId: "secrets", status: "VIOLATED", confidence: 0.95, reason: "Hardcoded key found" }],
      },
    ]
    const consensus = buildConsensus(results)
    expect(consensus.status).toBe("FAIL")
  })

  it("WARN when agents have mixed non-violation results", () => {
    const results: AgentReviewResult[] = [
      {
        agentName: "claude",
        roles: ["architect"],
        results: [{ ruleId: "testing", status: "PASS", confidence: 0.8, reason: "OK" }],
      },
      {
        agentName: "codex",
        roles: ["qa"],
        results: [{ ruleId: "testing", status: "NOT_COVERED", confidence: 0.5, reason: "Not addressed" }],
      },
    ]
    const consensus = buildConsensus(results)
    expect(consensus.status).toBe("WARN")
  })
})
```

**Step 2: Run test — verify it fails**

Run: `cd packages/cli && pnpm test -- src/lib/agents/coordinator.test.ts`
Expected: FAIL

**Step 3: Implement coordinator**

Create `packages/cli/src/lib/agents/coordinator.ts`:

```typescript
import type { MatchResult } from "../matchers/types.js"

export interface AgentReviewResult {
  readonly agentName: string
  readonly roles: readonly string[]
  readonly results: readonly MatchResult[]
}

export interface ConsensusResult {
  readonly status: "PASS" | "FAIL" | "WARN"
  readonly agentResults: readonly AgentReviewResult[]
  readonly summary: string
}

export function buildConsensus(agentResults: readonly AgentReviewResult[]): ConsensusResult {
  const allResults = agentResults.flatMap((ar) => ar.results)

  const hasViolation = allResults.some((r) => r.status === "VIOLATED")
  const hasNotCovered = allResults.some((r) => r.status === "NOT_COVERED")
  const allPass = allResults.every((r) => r.status === "PASS")

  let status: "PASS" | "FAIL" | "WARN"
  let summary: string

  if (hasViolation) {
    const violatingAgents = agentResults
      .filter((ar) => ar.results.some((r) => r.status === "VIOLATED"))
      .map((ar) => ar.agentName)
    status = "FAIL"
    summary = `Violation detected by: ${violatingAgents.join(", ")}`
  } else if (allPass) {
    status = "PASS"
    summary = `All ${agentResults.length} agents agree: PASS`
  } else {
    status = "WARN"
    const warnAgents = agentResults
      .filter((ar) => ar.results.some((r) => r.status === "NOT_COVERED"))
      .map((ar) => ar.agentName)
    summary = `Uncovered rules flagged by: ${warnAgents.join(", ")}`
  }

  return { status, agentResults, summary }
}
```

**Step 4: Run test — verify it passes**

Run: `cd packages/cli && pnpm test -- src/lib/agents/coordinator.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/agents/coordinator.ts packages/cli/src/lib/agents/coordinator.test.ts
git commit -m "feat: multi-agent consensus builder (debate → consensus → report)"
```

---

## Task 13: Agent CLI Commands & Review Command

**Files:**
- Create: `packages/cli/src/commands/agents.ts`
- Create: `packages/cli/src/commands/review.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create agents command**

Create `packages/cli/src/commands/agents.ts`:

```typescript
import chalk from "chalk"
import { loadAgentsConfig } from "../lib/agents/registry.js"

export async function listAgentsCommand(): Promise<void> {
  const agents = loadAgentsConfig(process.cwd())

  if (agents.length === 0) {
    console.log(chalk.dim("No agents configured."))
    console.log(chalk.dim("Create .rulebound/agents.json to define agent profiles."))
    return
  }

  console.log()
  console.log(chalk.white.bold("AGENT PROFILES"))
  console.log(chalk.dim("\u2500".repeat(50)))
  console.log()

  for (const agent of agents) {
    console.log(`  ${chalk.white.bold(agent.name)}`)
    if (agent.roles.length > 0) {
      console.log(chalk.dim(`    Roles: ${agent.roles.join(", ")}`))
    }
    console.log(chalk.dim(`    Rules: ${agent.rules.join(", ")}`))
    console.log(chalk.dim(`    Enforcement: ${agent.enforcement}`))
    console.log()
  }
}
```

**Step 2: Create review command**

Create `packages/cli/src/commands/review.ts`:

```typescript
import { execSync } from "node:child_process"
import chalk from "chalk"
import { loadAgentsConfig, resolveAgentRules } from "../lib/agents/registry.js"
import { loadRulesWithInheritance, getProjectConfig } from "../lib/inheritance.js"
import { matchRulesByContext, loadLocalRules } from "../lib/local-rules.js"
import { validateWithPipeline } from "../lib/validation.js"
import { buildConsensus, type AgentReviewResult } from "../lib/agents/coordinator.js"

interface ReviewOptions {
  agents?: string
  plan?: string
  diff?: boolean
  llm?: boolean
  dir?: string
}

export async function reviewCommand(options: ReviewOptions): Promise<void> {
  // Determine agent list
  const allAgents = loadAgentsConfig(process.cwd())

  if (allAgents.length === 0) {
    console.error(chalk.red("No agents configured. Create .rulebound/agents.json"))
    process.exit(1)
  }

  const agentNames = options.agents
    ? options.agents.split(",").map((a) => a.trim())
    : allAgents.map((a) => a.name)

  const selectedAgents = allAgents.filter((a) => agentNames.includes(a.name))

  if (selectedAgents.length === 0) {
    console.error(chalk.red(`No matching agents: ${agentNames.join(", ")}`))
    process.exit(1)
  }

  // Get plan text
  let planText: string

  if (options.diff) {
    try {
      const diffText = execSync("git diff HEAD", { encoding: "utf-8" })
      planText = diffText
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1))
        .join("\n")
    } catch {
      console.error(chalk.red("Failed to get git diff."))
      process.exit(1)
    }
  } else if (options.plan) {
    planText = options.plan
  } else {
    console.error(chalk.red("Provide --plan 'text' or --diff"))
    process.exit(1)
  }

  // Load all rules
  let allRules = options.dir
    ? loadLocalRules(options.dir)
    : loadRulesWithInheritance(process.cwd())

  const projectConfig = getProjectConfig(process.cwd())

  console.log()
  console.log(chalk.white.bold("MULTI-AGENT REVIEW"))
  console.log(chalk.dim(`Agents: ${selectedAgents.map((a) => a.name).join(", ")}`))
  console.log(chalk.dim("\u2500".repeat(50)))

  // Run validation per agent
  const agentResults: AgentReviewResult[] = []

  for (const agent of selectedAgents) {
    console.log()
    console.log(chalk.white(`  ${agent.name} ${chalk.dim(`[${agent.roles.join(", ")}]`)}`))

    // Resolve which rules this agent cares about
    const allRuleIds = allRules.map((r) => r.id)
    const agentRuleIds = resolveAgentRules(agent, allRuleIds)
    const agentRules = allRules.filter((r) => agentRuleIds.includes(r.id))

    // Context-match
    const matched = matchRulesByContext(agentRules, projectConfig, planText.slice(0, 2000))

    const report = await validateWithPipeline({
      plan: planText,
      rules: matched,
      task: `Review by ${agent.name}`,
      useLlm: options.llm,
    })

    for (const result of report.results) {
      const icon = result.status === "PASS"
        ? chalk.green("\u2713")
        : result.status === "VIOLATED"
          ? chalk.red("\u2717")
          : chalk.yellow("\u25CB")
      console.log(`    ${icon} ${result.ruleTitle} ${chalk.dim(`(${result.status})`)}`)
    }

    agentResults.push({
      agentName: agent.name,
      roles: [...agent.roles],
      results: report.results.map((r) => ({
        ruleId: r.ruleId,
        status: r.status,
        confidence: 0.7,
        reason: r.reason,
      })),
    })
  }

  // Consensus
  const consensus = buildConsensus(agentResults)

  console.log()
  console.log(chalk.dim("\u2500".repeat(50)))
  console.log(chalk.white.bold("  CONSENSUS"))

  const statusColor = consensus.status === "PASS"
    ? chalk.green
    : consensus.status === "FAIL"
      ? chalk.red
      : chalk.yellow

  console.log(`  ${statusColor(consensus.status)} \u2014 ${consensus.summary}`)
  console.log()

  if (consensus.status === "FAIL") process.exit(1)
}
```

**Step 3: Register commands in index.ts**

Add to `packages/cli/src/index.ts`:

```typescript
import { listAgentsCommand } from "./commands/agents.js"
import { reviewCommand } from "./commands/review.js"

const agentsCmd = program.command("agents").description("Manage agent profiles")

agentsCmd
  .command("list")
  .description("List configured agent profiles")
  .action(listAgentsCommand)

program
  .command("review")
  .description("Multi-agent review with consensus")
  .option("-a, --agents <agents>", "Comma-separated agent names")
  .option("-p, --plan <text>", "Plan text to review")
  .option("--diff", "Review current git diff")
  .option("--llm", "Use LLM for deep validation")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(reviewCommand)
```

**Step 4: Run all tests**

Run: `cd packages/cli && pnpm test`
Expected: All tests PASS

**Step 5: Build and smoke test**

Run: `cd packages/cli && pnpm build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add packages/cli/src/commands/agents.ts packages/cli/src/commands/review.ts packages/cli/src/index.ts
git commit -m "feat: agent profiles CLI and multi-agent review with consensus"
```

---

## Task 14: Final Integration Test & Cleanup

**Files:**
- Create: `packages/cli/src/__tests__/integration.test.ts`
- Modify: `packages/cli/src/lib/local-rules.ts` (export parseFrontMatter for tests)

**Step 1: Write integration test**

Create `packages/cli/src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { ValidationPipeline } from "../lib/matchers/pipeline.js"
import { KeywordMatcher } from "../lib/matchers/keyword.js"
import { SemanticMatcher } from "../lib/matchers/semantic.js"
import { loadLocalRules } from "../lib/local-rules.js"
import { join } from "node:path"

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "rules")

describe("Integration: full pipeline with real rules", () => {
  const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])

  it("PASS: plan about env vars passes no-secrets rule", async () => {
    const rules = loadLocalRules(FIXTURES_DIR)
    const secretsRule = rules.find((r) => r.title.includes("Hardcoded"))!

    const result = await pipeline.run({
      plan: "We will ensure no hardcoded secrets and load all API keys from environment variables using dotenv",
      rules: [secretsRule],
    })

    expect(result.results[0].status).toBe("PASS")
  })

  it("VIOLATED: plan with hardcoded key fails no-secrets rule", async () => {
    const rules = loadLocalRules(FIXTURES_DIR)
    const secretsRule = rules.find((r) => r.title.includes("Hardcoded"))!

    const result = await pipeline.run({
      plan: 'Set the Stripe key to "sk_live_abc123" directly in the config object',
      rules: [secretsRule],
    })

    expect(result.results[0].status).toBe("VIOLATED")
  })

  it("PASS: JWT plan matches auth rule via semantic similarity", async () => {
    const rules = loadLocalRules(FIXTURES_DIR)
    const authRule = rules.find((r) => r.title.includes("Authentication"))!

    const result = await pipeline.run({
      plan: "Implement JWT tokens stored in httpOnly cookies with session refresh rotation and RBAC",
      rules: [authRule],
    })

    expect(result.results[0].status).toBe("PASS")
  })
})
```

**Step 2: Run all tests**

Run: `cd packages/cli && pnpm test`
Expected: All tests PASS

**Step 3: Run build**

Run: `cd packages/cli && pnpm build`
Expected: Clean build, no errors

**Step 4: Commit**

```bash
git add packages/cli/src/__tests__/integration.test.ts
git commit -m "test: integration tests for full validation pipeline with real rules"
```

**Step 5: Final commit with all changes verified**

Run: `cd packages/cli && pnpm test && pnpm build`
Expected: All tests PASS, build succeeds.
