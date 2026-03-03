import { Shield, AlertTriangle, CheckCircle, TrendingUp, Clock, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api"
import { db } from "@/lib/db"
import { projects } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

interface RulesResponse {
  data: Array<{ id: string }>
  total: number
}

interface AuditEntry {
  id: string
  action: string
  status: string
  ruleId: string | null
  projectId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface AuditResponse {
  data: AuditEntry[]
  total: number
}

interface ComplianceTrend {
  score: number
  passCount: number
  violatedCount: number
  notCoveredCount: number
  date: string
}

interface ComplianceResponse {
  data: {
    projectId: string
    currentScore: number | null
    trend: ComplianceTrend[]
  }
}

interface ProjectCompliance {
  name: string
  score: number
  trend: string
  violations: number
}

interface TopViolation {
  rule: string
  count: number
  severity: string
}

interface RecentEvent {
  action: string
  rule: string | null
  project: string | null
  time: string
}

interface DashboardData {
  overallScore: number
  totalRules: number
  activeProjects: number
  violations24h: number
  passRate: string
  projectsCompliance: ProjectCompliance[]
  topViolations: TopViolation[]
  recentEvents: RecentEvent[]
}

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin} min ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [rulesRes, auditRes, allProjects] = await Promise.all([
    apiFetch<RulesResponse>("/rules"),
    apiFetch<AuditResponse>("/audit?limit=50"),
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(desc(projects.updatedAt)),
  ])

  const totalRules = rulesRes.total
  const activeProjects = allProjects.length

  // Fetch compliance per project
  const complianceResults = await Promise.allSettled(
    allProjects.map((proj) =>
      apiFetch<ComplianceResponse>(`/compliance/${proj.id}`).then((res) => ({
        name: proj.name,
        ...res.data,
      }))
    )
  )

  const projectsCompliance: ProjectCompliance[] = complianceResults
    .filter((r): r is PromiseFulfilledResult<{ name: string; projectId: string; currentScore: number | null; trend: ComplianceTrend[] }> =>
      r.status === "fulfilled" && r.value.currentScore !== null
    )
    .map((r) => {
      const { name, currentScore, trend } = r.value
      const previousScore = trend[1]?.score ?? currentScore ?? 0
      const diff = (currentScore ?? 0) - previousScore
      const latestTrend = trend[0]

      return {
        name,
        score: currentScore ?? 0,
        trend: diff >= 0 ? `+${diff}` : `${diff}`,
        violations: latestTrend?.violatedCount ?? 0,
      }
    })

  // Calculate overall score
  const overallScore = projectsCompliance.length > 0
    ? Math.round(projectsCompliance.reduce((sum, p) => sum + p.score, 0) / projectsCompliance.length)
    : 0

  // Count violations in last 24h from audit entries
  const violations24h = auditRes.data.filter(
    (e) => e.status === "VIOLATED"
  ).length

  // Calculate pass rate from audit entries that are validation results
  const validationEntries = auditRes.data.filter(
    (e) => e.action === "validation.violation" || e.action === "validation.pass"
  )
  const passCount = validationEntries.filter((e) => e.action === "validation.pass").length
  const passRate = validationEntries.length > 0
    ? `${Math.round((passCount / validationEntries.length) * 100)}%`
    : "N/A"

  // Aggregate top violations by rule
  const violationCounts: Record<string, { count: number; ruleId: string }> = {}
  for (const entry of auditRes.data) {
    if (entry.status === "VIOLATED" && entry.ruleId) {
      const key = entry.ruleId
      const existing = violationCounts[key]
      if (existing) {
        violationCounts[key] = { ...existing, count: existing.count + 1 }
      } else {
        violationCounts[key] = { count: 1, ruleId: entry.ruleId }
      }
    }
  }

  const topViolations: TopViolation[] = Object.entries(violationCounts)
    .map(([ruleId, data]) => ({
      rule: ruleId,
      count: data.count,
      severity: "error",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Recent events
  const recentEvents: RecentEvent[] = auditRes.data.slice(0, 10).map((e) => {
    const projectName = allProjects.find((p) => p.id === e.projectId)?.name ?? null
    return {
      action: e.action,
      rule: e.ruleId,
      project: projectName,
      time: formatRelativeTime(e.createdAt),
    }
  })

  return {
    overallScore,
    totalRules,
    activeProjects,
    violations24h,
    passRate,
    projectsCompliance,
    topViolations,
    recentEvents,
  }
}

function ScoreRing({ score }: { score: number }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? "var(--color-text-primary)" : score >= 60 ? "#d97706" : "var(--color-accent)"

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="8"
        />
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute font-mono text-2xl font-bold text-(--color-text-primary)">
        {score}
      </span>
    </div>
  )
}

export default async function DashboardOverview() {
  let data: DashboardData | null = null
  try {
    data = await fetchDashboardData()
  } catch {
    // Fall through to error UI below
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Dashboard
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            Organization-wide compliance overview
          </p>
        </div>
        <Card className="border-2 border-dashed">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-8 w-8 text-(--color-muted) mx-auto mb-3" />
            <p className="text-sm text-(--color-text-secondary)">Could not load data. Is the API server running?</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
          Dashboard
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Organization-wide compliance overview
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-(--color-text-primary)" />
              <div>
                <p className="font-mono text-2xl font-bold text-(--color-text-primary)">{data.overallScore}</p>
                <p className="font-mono text-xs text-(--color-muted) uppercase tracking-widest">Compliance Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-(--color-text-primary)" />
              <div>
                <p className="font-mono text-2xl font-bold text-(--color-text-primary)">{data.totalRules}</p>
                <p className="font-mono text-xs text-(--color-muted) uppercase tracking-widest">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-(--color-accent)" />
              <div>
                <p className="font-mono text-2xl font-bold text-(--color-accent)">{data.violations24h}</p>
                <p className="font-mono text-xs text-(--color-muted) uppercase tracking-widest">Violations (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-(--color-text-primary)" />
              <div>
                <p className="font-mono text-2xl font-bold text-(--color-text-primary)">{data.passRate}</p>
                <p className="font-mono text-xs text-(--color-muted) uppercase tracking-widest">Pass Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Compliance score ring + project list */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest mb-4">
              Project Compliance
            </h2>
            <div className="flex items-center gap-6 mb-6">
              <ScoreRing score={data.overallScore} />
              <div className="space-y-1">
                <p className="text-sm text-(--color-text-secondary)">Organization average</p>
                <p className="font-mono text-xs text-(--color-muted)">{data.activeProjects} active projects</p>
              </div>
            </div>
            <div className="space-y-3">
              {data.projectsCompliance.map((p) => (
                <div key={p.name} className="flex items-center justify-between py-2 border-t border-(--color-border)">
                  <div>
                    <p className="font-mono text-sm font-medium text-(--color-text-primary)">{p.name}</p>
                    <p className="font-mono text-xs text-(--color-muted)">{p.violations} violations</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs ${p.trend.startsWith("+") ? "text-green-600" : "text-(--color-accent)"}`}>
                      {p.trend}
                    </span>
                    <span className="font-mono text-lg font-bold text-(--color-text-primary)">{p.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top violated rules */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest mb-4">
              Most Violated Rules
            </h2>
            <div className="space-y-3">
              {data.topViolations.map((v, i) => (
                <div key={v.rule} className="flex items-center justify-between py-2 border-t border-(--color-border)">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-(--color-muted) w-4">{i + 1}.</span>
                    <div>
                      <p className="text-sm font-medium text-(--color-text-primary)">{v.rule}</p>
                      <Badge variant={v.severity === "error" ? "accent" : "default"} className="mt-0.5">
                        {v.severity}
                      </Badge>
                    </div>
                  </div>
                  <span className="font-mono text-lg font-bold text-(--color-accent)">{v.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest mb-4">
            Recent Activity
          </h2>
          <div className="space-y-0">
            {data.recentEvents.map((e, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-t border-(--color-border)">
                <Clock className="h-4 w-4 text-(--color-muted) shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-(--color-text-primary)">
                    <span className="font-mono font-medium">{e.action}</span>
                    {e.rule && <span className="text-(--color-text-secondary)"> on {e.rule}</span>}
                    {e.project && <span className="text-(--color-muted)"> in {e.project}</span>}
                  </p>
                </div>
                <span className="font-mono text-xs text-(--color-muted) shrink-0">{e.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
