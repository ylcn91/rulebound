import { proxyToRulebound } from "@/lib/server-proxy";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRulebound(request, `/tokens/${id}`);
}
