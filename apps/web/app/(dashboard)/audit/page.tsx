import { Search, Filter, Download, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api"

interface AuditEntry {
  id: string
  action: string
  status: string
  ruleId: string | null
  projectId: string | null
  userId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  orgId: string
}

interface AuditResponse {
  data: AuditEntry[]
  total: number
}

function StatusIcon({ status }: { status: string }) {
  if (status === "VIOLATED") return <AlertTriangle className="h-4 w-4 text-(--color-accent)" />
  if (status === "PASS") return <CheckCircle className="h-4 w-4 text-green-600" />
  return <Clock className="h-4 w-4 text-(--color-muted)" />
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function getEntryDetail(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "-"
  return (metadata.reason as string) ?? (metadata.changeNote as string) ?? "-"
}

export default async function AuditPage() {
  let entries: AuditEntry[] | null = null
  try {
    const response = await apiFetch<AuditResponse>("/audit")
    entries = response.data
  } catch {
    // Fall through to error UI below
  }

  if (!entries) {
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
            {entries.map((entry) => (
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
                  {entry.ruleId ? (
                    <span className="text-(--color-text-primary)">{entry.ruleId}</span>
                  ) : (
                    <span className="text-(--color-muted)">-</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {entry.projectId ? (
                    <Badge variant="default">{entry.projectId}</Badge>
                  ) : (
                    <span className="text-(--color-muted)">-</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-(--color-text-secondary) truncate block max-w-[300px]">
                    {getEntryDetail(entry.metadata)}
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
