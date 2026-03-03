import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const MOCK_COMPLIANCE_DATA = [
  {
    project: "auth-service",
    currentScore: 92,
    previousScore: 89,
    passCount: 23,
    violatedCount: 1,
    notCoveredCount: 3,
    history: [85, 87, 88, 89, 91, 92],
  },
  {
    project: "api-gateway",
    currentScore: 76,
    previousScore: 78,
    passCount: 18,
    violatedCount: 4,
    notCoveredCount: 5,
    history: [80, 79, 78, 77, 76, 76],
  },
  {
    project: "frontend-app",
    currentScore: 88,
    previousScore: 83,
    passCount: 21,
    violatedCount: 2,
    notCoveredCount: 4,
    history: [78, 80, 82, 83, 85, 88],
  },
]

function TrendIcon({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous
  if (diff > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
  if (diff < 0) return <TrendingDown className="h-4 w-4 text-(--color-accent)" />
  return <Minus className="h-4 w-4 text-(--color-muted)" />
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 120
  const height = 32

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(" ")

  return (
    <svg width={width} height={height} className="text-(--color-text-primary)">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
    </svg>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-(--color-text-primary)" : score >= 60 ? "bg-amber-500" : "bg-(--color-accent)"
  return (
    <div className="w-full h-2 bg-(--color-border) rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
    </div>
  )
}

export default function CompliancePage() {
  const avgScore = Math.round(
    MOCK_COMPLIANCE_DATA.reduce((sum, p) => sum + p.currentScore, 0) / MOCK_COMPLIANCE_DATA.length
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
          Compliance
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Track compliance scores and trends across all projects
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-2">
          <CardContent className="pt-5 pb-5 text-center">
            <p className="font-mono text-3xl font-bold text-(--color-text-primary)">{avgScore}</p>
            <p className="font-mono text-xs text-(--color-muted) uppercase tracking-widest mt-1">Org Average</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-5 pb-5 text-center">
            <p className="font-mono text-3xl font-bold text-green-600">
              {MOCK_COMPLIANCE_DATA.filter((p) => p.currentScore >= 80).length}
            </p>
            <p className="font-mono text-xs text-(--color-muted) uppercase tracking-widest mt-1">Passing (&gt;80)</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-5 pb-5 text-center">
            <p className="font-mono text-3xl font-bold text-(--color-accent)">
              {MOCK_COMPLIANCE_DATA.reduce((sum, p) => sum + p.violatedCount, 0)}
            </p>
            <p className="font-mono text-xs text-(--color-muted) uppercase tracking-widest mt-1">Total Violations</p>
          </CardContent>
        </Card>
      </div>

      {/* Project compliance table */}
      <div className="border-2 border-(--color-border) overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-(--color-border) bg-(--color-surface)">
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                Project
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                Score
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden md:table-cell">
                Trend
              </th>
              <th className="text-center px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden sm:table-cell">
                Pass
              </th>
              <th className="text-center px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden sm:table-cell">
                Violated
              </th>
              <th className="text-center px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden lg:table-cell">
                Not Covered
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest w-36 hidden md:table-cell">
                Progress
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_COMPLIANCE_DATA.map((p) => (
              <tr key={p.project} className="border-b border-(--color-border) last:border-b-0 hover:bg-(--color-grid) transition-colors duration-150">
                <td className="px-4 py-4">
                  <span className="font-mono font-medium text-(--color-text-primary)">{p.project}</span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-(--color-text-primary)">{p.currentScore}</span>
                    <TrendIcon current={p.currentScore} previous={p.previousScore} />
                    <span className={`font-mono text-xs ${
                      p.currentScore > p.previousScore ? "text-green-600" : p.currentScore < p.previousScore ? "text-(--color-accent)" : "text-(--color-muted)"
                    }`}>
                      {p.currentScore > p.previousScore ? "+" : ""}{p.currentScore - p.previousScore}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <Sparkline data={p.history} />
                </td>
                <td className="px-4 py-4 text-center hidden sm:table-cell">
                  <span className="font-mono text-green-600">{p.passCount}</span>
                </td>
                <td className="px-4 py-4 text-center hidden sm:table-cell">
                  <span className="font-mono text-(--color-accent)">{p.violatedCount}</span>
                </td>
                <td className="px-4 py-4 text-center hidden lg:table-cell">
                  <span className="font-mono text-(--color-muted)">{p.notCoveredCount}</span>
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <ScoreBar score={p.currentScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
