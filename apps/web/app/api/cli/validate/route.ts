import { proxyToRulebound } from "@/lib/server-proxy";

export async function POST(request: Request) {
  return proxyToRulebound(request, "/validate");
}
