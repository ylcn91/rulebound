import { proxyToRulebound } from "@/lib/server-proxy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyToRulebound(request, `/projects${url.search}`);
}

export async function POST(request: Request) {
  return proxyToRulebound(request, "/projects");
}
