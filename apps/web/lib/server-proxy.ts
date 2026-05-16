import { NextResponse } from "next/server";
import {
  buildRuleboundApiHeaders,
  buildRuleboundApiUrl,
  describeApiError,
  isRuleboundApiError,
} from "./api";
import { assertDashboardSession } from "./dashboard-auth";
import { isSameOriginRequest } from "./request-security";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /^authorization$/i,
  /^auth$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /token$/i,
  /^token/i,
  /apikey$/i,
  /api[-_]?key$/i,
  /secret$/i,
  /^secret/i,
  /password$/i,
  /passphrase$/i,
  /key$/i,
  /^key$/,
];
const SENSITIVE_TEXT_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${REDACTED}`],
  [
    /\b((?:authorization|auth|cookie|set-cookie|x-api-key|api[-_]?key|apikey|token|secret|password|passphrase)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}]+)/gi,
    `$1${REDACTED}`,
  ],
];

function passthroughHeaders(headers: Headers): Headers {
  const forwarded = new Headers();
  const contentType = headers.get("content-type");
  const contentDisposition = headers.get("content-disposition");

  if (contentType) forwarded.set("content-type", contentType);
  if (contentDisposition)
    forwarded.set("content-disposition", contentDisposition);

  return forwarded;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactSensitive<T>(value: T): T {
  return redact(value, 0) as T;
}

function redact(value: unknown, depth: number): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

function redactSensitiveText(value: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (safeValue, [pattern, replacement]) =>
      safeValue.replace(pattern, replacement),
    value,
  );
}

async function responseBody(response: Response): Promise<BodyInit | null> {
  if (!response.body) return null;
  if (response.status < 400) return response.body;

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return redactSensitiveText(JSON.stringify(redactSensitive(JSON.parse(text))));
    } catch {
      return redactSensitiveText(text);
    }
  }

  return redactSensitiveText(text);
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

    return new NextResponse(await responseBody(response), {
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
