import { AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { WebhooksClient } from "@/components/dashboard/WebhooksClient"
import type { WebhookEndpoint, WebhookDelivery } from "@/components/dashboard/WebhooksClient"

interface EndpointsResponse {
  data: WebhookEndpoint[]
}

interface DeliveriesResponse {
  data: WebhookDelivery[]
}

interface WebhookData {
  endpoints: WebhookEndpoint[]
  deliveries: WebhookDelivery[]
}

async function fetchWebhookData(): Promise<WebhookData> {
  const [endpointsRes, deliveriesRes] = await Promise.all([
    apiFetch<EndpointsResponse>("/webhooks/endpoints"),
    apiFetch<DeliveriesResponse>("/webhooks/deliveries"),
  ])

  return {
    endpoints: endpointsRes.data,
    deliveries: deliveriesRes.data,
  }
}

export default async function WebhooksPage() {
  let data: WebhookData | null = null
  try {
    data = await fetchWebhookData()
  } catch {
    // Fall through to error UI below
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Webhooks
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            Configure outbound webhook endpoints for real-time notifications
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
    <WebhooksClient
      endpoints={data.endpoints}
      deliveries={data.deliveries}
    />
  )
}
