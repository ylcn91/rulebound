import { NextResponse } from "next/server";
import {
  buildRuleboundApiHeaders,
  buildRuleboundApiUrl,
  describeApiError,
  isRuleboundApiError,
} from "./api";
import { assertDashboardSession } from "./dashboard-auth";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function passthroughHeaders(headers: Headers): Headers {
  const forwarded = new Headers();
  const contentType = headers.get("content-type");
  const contentDisposition = headers.get("content-disposition");

  if (contentType) forwarded.set("content-type", contentType);
  if (contentDisposition)
    forwarded.set("content-disposition", contentDisposition);

  return forwarded;
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  if (!host) return false;

  const expected = new Set<string>([
    `https://${host}`,
    `http://${host}`,
  ]);

  if (origin && expected.has(origin)) return true;
  if (!origin && referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (expected.has(refererOrigin)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function proxyToRulebound(
  request: Request,
  path: string,
): Promise<NextResponse> {
  const method = request.method.toUpperCase();

  if (MUTATING_METHODS.has(method) && !isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  }

  const session = assertDashboardSession(request.headers.get("cookie"));
  if (!session.ok) {
    return NextResponse.json(
      {
        error:
          session.reason === "missing-config"
            ? "Dashboard passcode is not configured."
            : "Dashboard authorization required.",
      },
      { status: session.reason === "missing-config" ? 503 : 401 },
    );
  }

  try {
    const body =
      method === "GET" || method === "HEAD" ? undefined : await request.text();

    const response = await fetch(buildRuleboundApiUrl(path), {
      method,
      headers: buildRuleboundApiHeaders(request.headers),
      body,
      cache: "no-store",
      redirect: "manual",
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: passthroughHeaders(response.headers),
    });
  } catch (error) {
    const description = describeApiError(error);

    return NextResponse.json(
      {
        error: description.description,
        code: isRuleboundApiError(error) ? error.code : "PROXY_REQUEST_FAILED",
        missingEnv: isRuleboundApiError(error)
          ? error.details?.missingEnv
          : undefined,
      },
      { status: isRuleboundApiError(error) ? error.status : 500 },
    );
  }
}
