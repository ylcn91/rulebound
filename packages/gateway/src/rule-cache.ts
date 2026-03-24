import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import type { Rule } from "@rulebound/engine"
import type { GatewayConfig } from "./config.js"
import { logger } from "./logger.js"

interface CacheEntry {
  rules: Rule[]
  fetchedAt: number
}

const CACHE_TTL_MS = 60_000

let cache: CacheEntry | null = null

export async function getCachedRules(config: GatewayConfig): Promise<Rule[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rules
  }

  const rules = await fetchRules(config)
  cache = { rules, fetchedAt: Date.now() }
  return rules
}

export function invalidateCache(): void {
  cache = null
}

async function fetchRules(config: GatewayConfig): Promise<Rule[]> {
  if (config.ruleboundServerUrl) {
    return fetchFromServer(config)
  }
  // Fallback: load local rules from .rulebound/rules/
  return loadLocalRulesForGateway(config)
}

function loadLocalRulesForGateway(config: GatewayConfig): Rule[] {
  const cwd = process.cwd()
  const rulesDir = [
    join(cwd, ".rulebound", "rules"),
    join(cwd, "rules"),
  ].find((dir) => existsSync(dir) && statSync(dir).isDirectory())

  if (!rulesDir) return []

  const files = collectMarkdownFiles(rulesDir)
  const rules: Rule[] = []

  for (const file of files) {
    const raw = readFileSync(file, "utf-8")
    const { meta, body } = parseFrontMatter(raw)
    const relPath = relative(rulesDir, file)
    const id = relPath.replace(/\.md$/, "").replace(/[/\\]/g, ".")

    // Filter by stack if configured
    const ruleStack = meta.stack ?? []
    if (config.stack?.length && ruleStack.length > 0) {
      const hasMatch = ruleStack.some((s) =>
        config.stack!.some((cs) => cs.toLowerCase() === s.toLowerCase())
      )
      if (!hasMatch) continue
    }

    rules.push({
      id,
      title: meta.title ?? id,
      content: body,
      category: meta.category ?? "general",
      severity: meta.severity ?? "warning",
      modality: meta.modality ?? "should",
      tags: meta.tags ?? [],
      stack: ruleStack,
      scope: [],
      changeTypes: [],
      team: [],
      filePath: relPath,
    })
  }

  if (rules.length > 0) {
    logger.info(`Loaded ${rules.length} local rules from ${rulesDir}`)
  }

  return rules
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = []
  function walk(current: string) {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith(".md")) files.push(full)
    }
  }
  walk(dir)
  return files
}

interface FrontMatter {
  title?: string
  category?: string
  severity?: string
  modality?: string
  tags?: string[]
  stack?: string[]
}

function parseFrontMatter(raw: string): { meta: FrontMatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }

  const meta: FrontMatter = {}
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.+)$/)
    if (!kv) continue
    const [, key, value] = kv
    if (key === "tags" || key === "stack") {
      const bracketMatch = value.match(/\[([^\]]*)\]/)
      const items = bracketMatch
        ? bracketMatch[1].split(",").map((t) => t.trim()).filter(Boolean)
        : value.split(",").map((t) => t.trim()).filter(Boolean)
      ;(meta as Record<string, string[]>)[key] = items
    } else {
      (meta as Record<string, string>)[key] = value.replace(/^["']|["']$/g, "")
    }
  }

  return { meta, body: match[2].trim() }
}

async function fetchFromServer(config: GatewayConfig): Promise<Rule[]> {
  const url = new URL("/v1/sync", config.ruleboundServerUrl)
  if (config.stack?.length) url.searchParams.set("stack", config.stack.join(","))
  if (config.project) url.searchParams.set("project", config.project)

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (config.ruleboundApiKey) {
    headers["Authorization"] = `Bearer ${config.ruleboundApiKey}`
  }

  try {
    const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(5000) })
    if (!response.ok) return []

    const body = await response.json() as { data: Array<Record<string, unknown>> }

    return body.data.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      content: String(r.content),
      category: String(r.category ?? "general"),
      severity: String(r.severity ?? "warning"),
      modality: String(r.modality ?? "should"),
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      stack: Array.isArray(r.stack) ? r.stack.map(String) : [],
      scope: [],
      changeTypes: [],
      team: [],
      filePath: "",
    }))
  } catch (error) {
    logger.error("Failed to fetch rules from server", {
      url: url.toString(),
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}
