import Link from "next/link"
import { Plus, Search, BookOpen, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api"

interface Rule {
  id: string
  title: string
  category: string
  severity: string
  modality: string
  tags: string[] | null
  updatedAt: string
  ruleSetId: string
  content: string
  stack: string[] | null
  isActive: boolean
  version: number
  createdAt: string
}

interface RulesResponse {
  data: Rule[]
  total: number
}

export default async function RulesPage() {
  let rules: Rule[] | null = null
  try {
    const response = await apiFetch<RulesResponse>("/rules")
    rules = response.data
  } catch {
    // Fall through to error UI below
  }

  if (!rules) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
              Rules
            </h1>
            <p className="text-sm text-(--color-text-secondary) mt-1">
              Manage enforcement rules for your AI coding agents
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Rules
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            Manage enforcement rules for your AI coding agents
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/rules/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Rule
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-muted)" />
        <Input placeholder="Search rules..." className="pl-9" />
      </div>

      {/* Table */}
      <div className="border-2 border-(--color-border) overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-(--color-border) bg-(--color-surface)">
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                Title
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden md:table-cell">
                Category
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden sm:table-cell">
                Modality
              </th>
              <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden lg:table-cell">
                Tags
              </th>
              <th className="text-right px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden sm:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr
                key={rule.id}
                className="border-b border-(--color-border) last:border-b-0 hover:bg-(--color-grid) transition-colors duration-150"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/rules/${rule.id}`}
                    className="font-medium text-(--color-text-primary) hover:underline cursor-pointer"
                  >
                    {rule.title}
                  </Link>
                  {rule.severity === "error" && (
                    <span className="ml-2 font-mono text-xs font-bold text-(--color-accent)">
                      ERR
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="font-mono text-xs uppercase tracking-wider text-(--color-muted)">
                    {rule.category}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`stamp text-xs ${rule.modality === "must" ? "text-(--color-text-primary)" : "text-(--color-muted)"}`}>
                    {rule.modality}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex gap-1.5 flex-wrap">
                    {(rule.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-xs text-(--color-muted)"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-(--color-text-secondary) hidden sm:table-cell font-mono text-xs">
                  {rule.updatedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {rules.length === 0 && (
        <div className="border-2 border-dashed border-(--color-border) p-12 text-center">
          <BookOpen className="h-8 w-8 text-(--color-muted) mx-auto mb-3" />
          <p className="text-(--color-text-secondary) text-sm">
            No rules yet. Import your first rule set.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/import">Import Rules</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
