"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Clock, Plus, Send, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  WebhookDeliveryRecord,
  WebhookEndpointRecord,
} from "@/lib/dashboard-data";
import { splitCommaList } from "@/lib/rules";

export type WebhookEndpoint = WebhookEndpointRecord;
export type WebhookDelivery = WebhookDeliveryRecord;

interface WebhooksClientProps {
  endpoints: WebhookEndpoint[];
  deliveries: WebhookDelivery[];
}

function readErrorMessage(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Request failed.";
}

function DeliveryStatusIcon({ status }: { status: string }) {
  if (status === "delivered")
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === "failed")
    return <XCircle className="h-4 w-4 text-(--color-accent)" />;
  return <Clock className="h-4 w-4 text-(--color-muted)" />;
}

export function WebhooksClient({ endpoints, deliveries }: WebhooksClientProps) {
  const [isPending, startTransition] = useTransition();
  const [endpointList, setEndpointList] = useState(endpoints);
  const [deliveryList, setDeliveryList] = useState(deliveries);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState("violation.detected");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setUrl("");
    setSecret("");
    setEvents("violation.detected");
    setDescription("");
    setShowForm(false);
    setError(null);
  }

  function handleCreate() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/webhooks/endpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            secret: secret.trim(),
            description: description.trim() || undefined,
            events: splitCommaList(events),
          }),
        });

        if (!response.ok) {
          throw new Error(
            readErrorMessage(await response.json().catch(() => null)),
          );
        }

        const payload = (await response.json()) as { data: WebhookEndpoint };
        setEndpointList((current) => [payload.data, ...current]);
        resetForm();
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Failed to create endpoint.",
        );
      }
    });
  }

  function handleDelete(endpoint: WebhookEndpoint) {
    const confirmed = window.confirm(
      `Delete "${endpoint.description ?? endpoint.url}"?`,
    );
    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/webhooks/endpoints/${endpoint.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(
            readErrorMessage(await response.json().catch(() => null)),
          );
        }

        setEndpointList((current) =>
          current.filter((item) => item.id !== endpoint.id),
        );
        setDeliveryList((current) =>
          current.filter((item) => item.endpointId !== endpoint.id),
        );
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete endpoint.",
        );
      }
    });
  }

  function handleTest(endpoint: WebhookEndpoint) {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/webhooks/endpoints/${endpoint.id}/test`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(
            readErrorMessage(await response.json().catch(() => null)),
          );
        }

        const deliveriesResponse = await fetch(
          `/api/webhooks/deliveries?endpoint_id=${endpoint.id}`,
        );
        if (deliveriesResponse.ok) {
          const payload = (await deliveriesResponse.json()) as {
            data: WebhookDelivery[];
          };
          setDeliveryList((current) => {
            const remaining = current.filter(
              (item) => item.endpointId !== endpoint.id,
            );
            return [...payload.data, ...remaining];
          });
        }
      } catch (testError) {
        setError(
          testError instanceof Error
            ? testError.message
            : "Failed to test endpoint.",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Webhooks
          </h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Configure outbound webhook endpoints for real-time notifications
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => setShowForm((current) => !current)}
        >
          <Plus className="h-4 w-4" />
          Add Endpoint
        </Button>
      </div>

      {error ? (
        <div className="border border-(--color-accent)/30 bg-(--color-accent)/5 p-3 text-sm text-(--color-accent)">
          {error}
        </div>
      ) : null}

      {showForm ? (
        <Card className="border-2">
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  URL
                </label>
                <Input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://hooks.example.com/rulebound"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Secret
                </label>
                <Input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="supersecretvalue16"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Events
                </label>
                <Input
                  value={events}
                  onChange={(event) => setEvents(event.target.value)}
                  placeholder="violation.detected, rule.updated"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Slack bridge"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleCreate}
                disabled={isPending || !url.trim() || !secret.trim()}
              >
                {isPending ? "Saving..." : "Save Endpoint"}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {endpointList.map((endpoint) => (
          <Card key={endpoint.id} className="border-2">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-mono text-sm font-bold text-(--color-text-primary)">
                      {endpoint.description ?? endpoint.url}
                    </p>
                    <Badge variant={endpoint.isActive ? "default" : "accent"}>
                      {endpoint.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="truncate font-mono text-xs text-(--color-muted)">
                    {endpoint.url}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {endpoint.events.map((event) => (
                      <Badge key={event} variant="outline">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handleTest(endpoint)}
                  >
                    <Send className="h-3 w-3" />
                    Test
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="gap-1"
                    onClick={() => handleDelete(endpoint)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
          Recent Deliveries
        </h2>
        <div className="overflow-hidden border-2 border-(--color-border)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-(--color-border) bg-(--color-surface)">
                <th className="w-8 px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)" />
                <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Endpoint
                </th>
                <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) sm:table-cell">
                  Event
                </th>
                <th className="hidden px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) md:table-cell">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {deliveryList.map((delivery) => (
                <tr
                  key={delivery.id}
                  className="border-b border-(--color-border) last:border-b-0 transition-colors duration-150 hover:bg-(--color-grid)"
                >
                  <td className="px-4 py-3">
                    <DeliveryStatusIcon status={delivery.status} />
                  </td>
                  <td className="px-4 py-3 font-medium text-(--color-text-primary)">
                    {delivery.endpointId}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="font-mono text-xs text-(--color-text-secondary)">
                      {delivery.event}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-center md:table-cell">
                    <span className="font-mono text-xs">
                      {delivery.responseCode ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-(--color-muted)">
                    {new Date(delivery.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
