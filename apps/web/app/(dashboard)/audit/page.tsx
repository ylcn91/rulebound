import { Search, Filter, Download, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const MOCK_AUDIT_ENTRIES = [
  {
    id: "1",
    action: "validation.violation",
    status: "VIOLATED",
    ruleName: "No Hardcoded Secrets",
    projectName: "api-gateway",
    userName: "dev@company.com",
    metadata: { reason: "Found hardcoded API key in config" },
    createdAt: "2026-03-03T14:22:00Z",
  },
  {
    id: "2",
    action: "validation.pass",
    status: "PASS",
    ruleName: "Error Handling Standards",
    projectName: "auth-service",
    userName: "dev@company.com",
    metadata: { reason: "All error handling rules satisfied" },
    createdAt: "2026-03-03T14:15:00Z",
  },
  {
    id: "3",
    action: "rule.updated",
    status: "INFO",
    ruleName: "Constructor Injection",
    projectName: null,
    userName: "admin@company.com",
    metadata: { changeNote: "Updated to require final fields" },
    createdAt: "2026-03-03T13:45:00Z",
  },
  {
    id: "4",
    action: "sync.completed",
    status: "INFO",
    ruleName: null,
    projectName: "frontend-app",
    userName: null,
    metadata: { rulesCount: 15 },
    createdAt: "2026-03-03T12:00:00Z",
  },
  {
    id: "5",
    action: "validation.violation",
    status: "VIOLATED",
    ruleName: "Test Coverage 80%",
    projectName: "api-gateway",
    userName: "dev2@company.com",
    metadata: { reason: "Coverage at 62%, below threshold" },
    createdAt: "2026-03-03T11:30:00Z",
  },
  {
    id: "6",
    action: "webhook.delivered",
    status: "INFO",
    ruleName: null,
    projectName: "api-gateway",
    userName: null,
    metadata: { endpoint: "https://hooks.slack.com/..." },
    createdAt: "2026-03-03T11:30:00Z",
  },
]

function StatusIcon({ status }: { status: string }) {
  if (status === "VIOLATED") return <AlertTriangle className="h-4 w-4 text-(--color-accent)" />
  if (status === "PASS") return <CheckCircle className="h-4 w-4 text-green-600" />
  return <Clock className="h-4 w-4 text-(--color-muted)" />
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Audit Log
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            Track all validation events, rule changes, and enforcement actions
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-muted)" />
          <Input placeholder="Search events..." className="pl-9" />
        </div>
        <select className="flex h-10 border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) cursor-pointer">
          <option value="">All actions</option>
          <option value="validation.violation">Violations</option>
          <option value="validation.pass">Passes</option>
          <option value="rule.updated">Rule updates</option>
          <option value="sync.completed">Syncs</option>
        </select>
        <select className="flex h-10 border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) cursor-pointer">
          <option value="">All projects</option>
          <option value="api-gateway">api-gateway</option>
          <option value="auth-service">auth-service</option>
          <option value="frontend-app">frontend-app</option>
        </select>
      </div>

      {/* Table */}
      <div className="border-2 border-(--color-border) overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-(--color-border) bg-(--color-surface)">
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest w-8" />
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                Event
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden md:table-cell">
                Rule
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden sm:table-cell">
                Project
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden lg:table-cell">
                Detail
              </th>
              <th className="text-right px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_AUDIT_ENTRIES.map((entry) => (
              <tr key={entry.id} className="border-b border-(--color-border) last:border-b-0 hover:bg-(--color-grid) transition-colors duration-150">
                <td className="px-4 py-3">
                  <StatusIcon status={entry.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-medium text-(--color-text-primary)">
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {entry.ruleName ? (
                    <span className="text-(--color-text-primary)">{entry.ruleName}</span>
                  ) : (
                    <span className="text-(--color-muted)">-</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {entry.projectName ? (
                    <Badge variant="default">{entry.projectName}</Badge>
                  ) : (
                    <span className="text-(--color-muted)">-</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-(--color-text-secondary) truncate block max-w-[300px]">
                    {entry.metadata?.reason ?? entry.metadata?.changeNote ?? "-"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-xs text-(--color-muted)">{formatTime(entry.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
