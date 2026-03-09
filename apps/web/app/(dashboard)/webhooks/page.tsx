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
        subheading="Configure outbound webhook endpoints for real-time notifications"
        title={description.title}
        description={description.description}
      />
    );
  }
}
