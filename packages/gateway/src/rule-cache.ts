import type { Rule } from "@rulebound/engine"
import type { GatewayConfig } from "./config.js"

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
  return []
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
  } catch {
    return []
  }
}
