import { proxyToRulebound } from "@/lib/server-proxy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyToRulebound(request, `/webhooks/deliveries${url.search}`);
}
