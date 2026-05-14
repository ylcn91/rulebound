import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { WebhooksClient } from "@/components/dashboard/WebhooksClient";
import { describeApiError } from "@/lib/api";
import { fetchWebhookData } from "@/lib/dashboard-data";

export default async function WebhooksPage() {
  try {
    const data = await fetchWebhookData();

    return (
      <WebhooksClient endpoints={data.endpoints} deliveries={data.deliveries} />
    );
  } catch (error) {
    const description = describeApiError(error);

    return (
      <BackendErrorState
        heading="Webhooks"
        subheading="Self-hosted preview — configure outbound webhook endpoints for deterministic run notifications"
        title={description.title}
        description={description.description}
      />
    );
  }
}
