"use client"

import { Plus, Trash2, Send, CheckCircle, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const WEBHOOK_EVENTS = [
  "violation.detected",
  "compliance.score_changed",
  "rule.created",
  "rule.updated",
  "rule.deleted",
  "sync.completed",
]

const MOCK_ENDPOINTS = [
  {
    id: "1",
    url: "https://example.com/webhooks/slack-endpoint",
    events: ["violation.detected", "compliance.score_changed"],
    isActive: true,
    description: "Slack #engineering-alerts",
    createdAt: "2026-02-15",
  },
  {
    id: "2",
    url: "https://example.com/webhooks/pagerduty-endpoint",
    events: ["violation.detected"],
    isActive: true,
    description: "PagerDuty on-call",
    createdAt: "2026-02-20",
  },
  {
    id: "3",
    url: "https://api.company.com/webhooks/rulebound",
    events: ["violation.detected", "rule.updated", "sync.completed"],
    isActive: false,
    description: "Internal audit system",
    createdAt: "2026-01-10",
  },
]

const MOCK_DELIVERIES = [
  { id: "1", endpointDesc: "Slack", event: "violation.detected", status: "delivered", responseCode: 200, createdAt: "2026-03-03T14:22:00Z" },
  { id: "2", endpointDesc: "PagerDuty", event: "violation.detected", status: "delivered", responseCode: 202, createdAt: "2026-03-03T14:22:00Z" },
  { id: "3", endpointDesc: "Slack", event: "compliance.score_changed", status: "failed", responseCode: 500, createdAt: "2026-03-03T12:00:00Z" },
  { id: "4", endpointDesc: "Internal", event: "sync.completed", status: "delivered", responseCode: 200, createdAt: "2026-03-02T08:00:00Z" },
]

function DeliveryStatusIcon({ status }: { status: string }) {
  if (status === "delivered") return <CheckCircle className="h-4 w-4 text-green-600" />
  if (status === "failed") return <XCircle className="h-4 w-4 text-(--color-accent)" />
  return <Clock className="h-4 w-4 text-(--color-muted)" />
}

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Webhooks
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            Configure outbound webhook endpoints for real-time notifications
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Endpoint
        </Button>
      </div>

      {/* Endpoints */}
      <div className="space-y-4">
        {MOCK_ENDPOINTS.map((endpoint) => (
          <Card key={endpoint.id} className="border-2">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-bold text-(--color-text-primary) truncate">
                      {endpoint.description}
                    </p>
                    <Badge variant={endpoint.isActive ? "default" : "accent"}>
                      {endpoint.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-(--color-muted) truncate">{endpoint.url}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {endpoint.events.map((event) => (
                      <span key={event} className="font-mono text-xs text-(--color-text-secondary) bg-(--color-grid) px-2 py-0.5">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1">
                    <Send className="h-3 w-3" />
                    Test
                  </Button>
                  <Button size="sm" variant="danger" className="gap-1">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent deliveries */}
      <div>
        <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest mb-4">
          Recent Deliveries
        </h2>
        <div className="border-2 border-(--color-border) overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest w-8" />
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                  Endpoint
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden sm:table-cell">
                  Event
                </th>
                <th className="text-center px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest hidden md:table-cell">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DELIVERIES.map((d) => (
                <tr key={d.id} className="border-b border-(--color-border) last:border-b-0 hover:bg-(--color-grid) transition-colors duration-150">
                  <td className="px-4 py-3">
                    <DeliveryStatusIcon status={d.status} />
                  </td>
                  <td className="px-4 py-3 font-medium text-(--color-text-primary)">{d.endpointDesc}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="font-mono text-xs text-(--color-text-secondary)">{d.event}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="font-mono text-xs">{d.responseCode}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-(--color-muted)">
                    {new Date(d.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
