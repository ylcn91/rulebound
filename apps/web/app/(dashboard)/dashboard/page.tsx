import { Shield, AlertTriangle, CheckCircle, TrendingUp, Clock, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const MOCK_STATS = {
  overallScore: 82,
  totalRules: 27,
  activeProjects: 3,
  violations24h: 7,
  passRate: "78%",
}

const MOCK_PROJECTS_COMPLIANCE = [
  { name: "auth-service", score: 92, trend: "+3", violations: 1 },
  { name: "api-gateway", score: 76, trend: "-2", violations: 4 },
  { name: "frontend-app", score: 88, trend: "+5", violations: 2 },
]

const MOCK_TOP_VIOLATIONS = [
  { rule: "No Hardcoded Secrets", count: 12, severity: "error" },
  { rule: "Constructor Injection", count: 8, severity: "warning" },
  { rule: "Error Handling Standards", count: 6, severity: "warning" },
  { rule: "Test Coverage 80%", count: 5, severity: "error" },
  { rule: "Input Sanitization", count: 3, severity: "warning" },
]

const MOCK_RECENT_EVENTS = [
  { action: "violation.detected", rule: "No Hardcoded Secrets", project: "api-gateway", time: "2 min ago" },
  { action: "sync.completed", rule: null, project: "auth-service", time: "15 min ago" },
  { action: "rule.updated", rule: "Error Handling Standards", project: null, time: "1 hour ago" },
  { action: "violation.detected", rule: "Constructor Injection", project: "api-gateway", time: "2 hours ago" },
]

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

export default function DashboardOverview() {
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
                <p className="font-mono text-2xl font-bold text-(--color-text-primary)">{MOCK_STATS.overallScore}</p>
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
                <p className="font-mono text-2xl font-bold text-(--color-text-primary)">{MOCK_STATS.totalRules}</p>
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
                <p className="font-mono text-2xl font-bold text-(--color-accent)">{MOCK_STATS.violations24h}</p>
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
                <p className="font-mono text-2xl font-bold text-(--color-text-primary)">{MOCK_STATS.passRate}</p>
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
              <ScoreRing score={MOCK_STATS.overallScore} />
              <div className="space-y-1">
                <p className="text-sm text-(--color-text-secondary)">Organization average</p>
                <p className="font-mono text-xs text-(--color-muted)">{MOCK_STATS.activeProjects} active projects</p>
              </div>
            </div>
            <div className="space-y-3">
              {MOCK_PROJECTS_COMPLIANCE.map((p) => (
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
              {MOCK_TOP_VIOLATIONS.map((v, i) => (
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
            {MOCK_RECENT_EVENTS.map((e, i) => (
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
