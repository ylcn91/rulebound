import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { homedir } from "node:os"

export interface ValidationEvent {
  readonly timestamp: string
  readonly rulesTotal: number
  readonly violated: readonly string[]
  readonly passed: readonly string[]
  readonly notCovered: readonly string[]
  readonly score: number
  readonly task?: string
  readonly source: "cli" | "mcp" | "gateway" | "lsp"
  readonly project?: string
}

export interface TelemetryStore {
  readonly version: number
  readonly events: ValidationEvent[]
}

const STORE_VERSION = 1
const MAX_EVENTS = 10_000

function getGlobalStatsPath(): string {
  return join(homedir(), ".rulebound", "stats.json")
}

function getProjectStatsPath(cwd: string): string {
  return join(cwd, ".rulebound", "stats.json")
}

function loadStore(path: string): TelemetryStore {
  if (!existsSync(path)) return { version: STORE_VERSION, events: [] }
  try {
    const raw = readFileSync(path, "utf-8")
    const parsed = JSON.parse(raw) as TelemetryStore
    return { version: parsed.version ?? STORE_VERSION, events: parsed.events ?? [] }
  } catch {
    return { version: STORE_VERSION, events: [] }
  }
}

function saveStore(path: string, store: TelemetryStore): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(store, null, 2))
}

export function recordValidationEvent(
  event: ValidationEvent,
  cwd?: string
): void {
  const globalPath = getGlobalStatsPath()
  const globalStore = loadStore(globalPath)
  globalStore.events.push(event)

  if (globalStore.events.length > MAX_EVENTS) {
    globalStore.events.splice(0, globalStore.events.length - MAX_EVENTS)
  }
  saveStore(globalPath, globalStore)

  if (cwd) {
    const projectPath = getProjectStatsPath(cwd)
    const projectStore = loadStore(projectPath)
    projectStore.events.push(event)
    if (projectStore.events.length > MAX_EVENTS) {
      projectStore.events.splice(0, projectStore.events.length - MAX_EVENTS)
    }
    saveStore(projectPath, projectStore)
  }
}

export interface StatsReport {
  readonly totalValidations: number
  readonly topViolatedRules: readonly { ruleId: string; count: number }[]
  readonly categoryBreakdown: ReadonlyMap<string, number>
  readonly trendByDay: readonly { date: string; score: number; violations: number }[]
  readonly averageScore: number
  readonly sourceBreakdown: ReadonlyMap<string, number>
}

function getEventsForPeriod(events: readonly ValidationEvent[], days: number): readonly ValidationEvent[] {
  const since = new Date()
  since.setDate(since.getDate() - days)
  return events.filter((e) => new Date(e.timestamp) >= since)
}

export function computeStats(events: readonly ValidationEvent[], days = 30): StatsReport {
  const recent = getEventsForPeriod(events, days)

  const violationCounts = new Map<string, number>()
  for (const event of recent) {
    for (const ruleId of event.violated) {
      violationCounts.set(ruleId, (violationCounts.get(ruleId) ?? 0) + 1)
    }
  }

  const topViolatedRules = [...violationCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ruleId, count]) => ({ ruleId, count }))

  const categoryMap = new Map<string, number>()
  for (const event of recent) {
    for (const ruleId of event.violated) {
      const category = ruleId.split(".")[0] ?? "unknown"
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1)
    }
  }

  const dayMap = new Map<string, { scores: number[]; violations: number }>()
  for (const event of recent) {
    const date = event.timestamp.split("T")[0]
    const entry = dayMap.get(date) ?? { scores: [], violations: 0 }
    entry.scores.push(event.score)
    entry.violations += event.violated.length
    dayMap.set(date, entry)
  }

  const trendByDay = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, { scores, violations }]) => ({
      date,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      violations,
    }))

  const totalScore = recent.reduce((sum, e) => sum + e.score, 0)
  const averageScore = recent.length > 0 ? Math.round(totalScore / recent.length) : 0

  const sourceMap = new Map<string, number>()
  for (const event of recent) {
    sourceMap.set(event.source, (sourceMap.get(event.source) ?? 0) + 1)
  }

  return {
    totalValidations: recent.length,
    topViolatedRules,
    categoryBreakdown: categoryMap,
    trendByDay,
    averageScore,
    sourceBreakdown: sourceMap,
  }
}

export function loadGlobalEvents(): readonly ValidationEvent[] {
  return loadStore(getGlobalStatsPath()).events
}

export function loadProjectEvents(cwd: string): readonly ValidationEvent[] {
  return loadStore(getProjectStatsPath(cwd)).events
}
