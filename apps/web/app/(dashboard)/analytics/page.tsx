import { BarChart3, TrendingUp, AlertTriangle, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api"

interface TopViolation {
  ruleId: string | null
  count: number
}

interface CategoryEntry {
  action: string
  count: number
}

interface SourceEntry {
  status: string
  count: number
}

interface TrendEntry {
  score: number
  violatedCount: number
  date: string
}

async function getTopViolations(): Promise<TopViolation[]> {
  try {
    const res = await apiFetch("/v1/analytics/top-violations?limit=10")
    return res?.data ?? []
  } catch {
    return []
  }
}

async function getCategoryBreakdown(): Promise<CategoryEntry[]> {
  try {
    const res = await apiFetch("/v1/analytics/category-breakdown")
    return res?.data ?? []
  } catch {
    return []
  }
}

async function getSourceStats(): Promise<SourceEntry[]> {
  try {
    const res = await apiFetch("/v1/analytics/source-stats")
    return res?.data ?? []
  } catch {
    return []
  }
}

export default async function AnalyticsPage() {
  const [topViolations, categories, sources] = await Promise.all([
    getTopViolations(),
    getCategoryBreakdown(),
    getSourceStats(),
  ])

  const totalViolations = topViolations.reduce((sum, v) => sum + v.count, 0)
  const totalEvents = sources.reduce((sum, s) => sum + s.count, 0)
  const passedEvents = sources.find((s) => s.status === "PASSED")?.count ?? 0
  const passRate = totalEvents > 0 ? Math.round((passedEvents / totalEvents) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-xl font-semibold text-(--color-text-primary)">
          Analytics
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Validation insights and violation trends
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-(--color-text-primary)" />
              <div>
                <p className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                  Total Events
                </p>
                <p className="text-2xl font-bold text-(--color-text-primary)">
                  {totalEvents}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-(--color-text-primary)" />
              <div>
                <p className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                  Total Violations
                </p>
                <p className="text-2xl font-bold text-(--color-text-primary)">
                  {totalViolations}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-(--color-text-primary)" />
              <div>
                <p className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                  Pass Rate
                </p>
                <p className="text-2xl font-bold text-(--color-text-primary)">
                  {passRate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-(--color-text-primary)" />
              <div>
                <p className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                  Categories
                </p>
                <p className="text-2xl font-bold text-(--color-text-primary)">
                  {categories.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Violated Rules */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest mb-4">
              Top Violated Rules
            </h2>
            {topViolations.length === 0 ? (
              <p className="text-sm text-(--color-text-secondary)">No violations recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {topViolations.map((v, i) => {
                  const maxCount = topViolations[0]?.count ?? 1
                  const width = Math.max((v.count / maxCount) * 100, 4)
                  return (
                    <div key={v.ruleId ?? i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-(--color-text-primary) font-mono truncate mr-2">
                          {v.ruleId ?? "unknown"}
                        </span>
                        <span className="text-(--color-text-secondary) tabular-nums shrink-0">
                          {v.count}
                        </span>
                      </div>
                      <div className="h-2 bg-(--color-border) rounded-full overflow-hidden">
                        <div
                          className="h-full bg-(--color-primary) rounded-full transition-all duration-300"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest mb-4">
              Violations by Category
            </h2>
            {categories.length === 0 ? (
              <p className="text-sm text-(--color-text-secondary)">No data available.</p>
            ) : (
              <div className="space-y-3">
                {categories.map((cat) => {
                  const total = categories.reduce((s, c) => s + c.count, 0)
                  const pct = total > 0 ? Math.round((cat.count / total) * 100) : 0
                  return (
                    <div key={cat.action} className="flex items-center justify-between">
                      <span className="text-sm text-(--color-text-primary) font-mono">
                        {cat.action}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-(--color-text-secondary) tabular-nums">
                          {cat.count}
                        </span>
                        <span className="text-xs text-(--color-muted) tabular-nums w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest mb-4">
            Validation Results
          </h2>
          {sources.length === 0 ? (
            <p className="text-sm text-(--color-text-secondary)">No events recorded yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {sources.map((s) => (
                <div
                  key={s.status}
                  className="border border-(--color-border) rounded-md p-4 text-center"
                >
                  <p className="text-2xl font-bold text-(--color-text-primary) tabular-nums">
                    {s.count}
                  </p>
                  <p className="text-xs text-(--color-text-secondary) font-mono uppercase mt-1">
                    {s.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
