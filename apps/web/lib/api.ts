import { NextRequest, NextResponse } from "next/server";

const API_URL_ENV = "RULEBOUND_API_URL";
const API_TOKEN_ENV = "RULEBOUND_API_TOKEN";

type ApiConfig = {
  baseUrl: string;
  token: string;
};

type ApiErrorDetails = {
  missingEnv?: string[];
  [key: string]: unknown;
};

type ApiFetchOptions = RequestInit & {
  responseType?: "json" | "text";
};

export class RuleboundApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetails | null;

  constructor(
    message: string,
    status: number,
    code: string,
    details: ApiErrorDetails | null = null,
  ) {
    super(message);
    this.name = "RuleboundApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getApiConfig(): ApiConfig {
  const baseUrl = process.env[API_URL_ENV]?.trim();
  const token = process.env[API_TOKEN_ENV]?.trim();

  const missingEnv = [API_URL_ENV, API_TOKEN_ENV].filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });

  if (missingEnv.length > 0 || !baseUrl || !token) {
    throw new RuleboundApiError(
      "Rulebound API configuration is missing.",
      503,
      "CONFIG_MISSING",
      { missingEnv },
    );
  }

  return { baseUrl, token };
}

function parseErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = "error" in payload ? payload.error : null;
  return typeof error === "string" && error.length > 0 ? error : null;
}

async function parseErrorResponse(response: Response): Promise<{
  message: string;
  details: ApiErrorDetails | null;
}> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response
      .json()
      .catch(() => null)) as ApiErrorDetails | null;
    return {
      message:
        parseErrorMessage(payload) ??
        `Rulebound API request failed with ${response.status}.`,
      details: payload,
    };
  }

  const text = await response.text().catch(() => "");
  return {
    message: text || `Rulebound API request failed with ${response.status}.`,
    details: text ? { raw: text } : null,
  };
}

function shouldSendBody(method: string): boolean {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function buildRequestHeaders(
  token: string,
  headersInit?: HeadersInit,
  body?: BodyInit | null,
  responseType: "json" | "text" = "json",
): Headers {
  const headers = new Headers(headersInit);

  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  if (!headers.has("accept")) {
    headers.set("accept", responseType === "json" ? "application/json" : "*/*");
  }

  if (
    body !== undefined &&
    body !== null &&
    !headers.has("content-type") &&
    responseType === "json"
  ) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

export function normalizeApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/v1" || normalized.startsWith("/v1/")
    ? normalized
    : `/v1${normalized}`;
}

export function resolveProxyPath(segments: string[]): string {
  const safeSegments = segments.filter(Boolean);

  if (safeSegments[0] === "cli" && safeSegments[1] === "validate") {
    return "/validate";
  }

  if (safeSegments[0] === "cli" && safeSegments[1] === "find-rules") {
    return "/rules";
  }

  return `/${safeSegments.join("/")}`;
}

export function isRuleboundApiError(
  error: unknown,
): error is RuleboundApiError {
  return error instanceof RuleboundApiError;
}

export function describeApiError(error: unknown): {
  title: string;
  description: string;
} {
  if (isRuleboundApiError(error)) {
    if (error.code === "CONFIG_MISSING") {
      const missingEnv = error.details?.missingEnv;
      const joined =
        Array.isArray(missingEnv) && missingEnv.length > 0
          ? missingEnv.join(", ")
          : `${API_URL_ENV}, ${API_TOKEN_ENV}`;

      return {
        title: "Backend Configuration Missing",
        description: `Set ${joined} on the web server before using the dashboard.`,
      };
    }

    if (error.status === 401 || error.status === 403) {
      return {
        title: "Backend Authorization Failed",
        description:
          "RULEBOUND_API_TOKEN was rejected by the backend. Check that the service token is present and still valid.",
      };
    }

    return {
      title: "Rulebound API Request Failed",
      description: error.message,
    };
  }

  return {
    title: "Unexpected Error",
    description:
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while contacting the Rulebound API.",
  };
}

function buildApiUrl(path: string, search = ""): URL {
  const { baseUrl } = getApiConfig();
  const url = new URL(
    normalizeApiPath(path),
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  );

  if (search) {
    url.search = search.startsWith("?") ? search.slice(1) : search;
  }

  return url;
}

export function buildRuleboundApiUrl(path: string, search = ""): string {
  return buildApiUrl(path, search).toString();
}

export function buildRuleboundApiHeaders(
  requestHeaders?: HeadersInit,
): Headers {
  const { token } = getApiConfig();
  const forwardedHeaders = new Headers();
  const sourceHeaders = new Headers(requestHeaders);
  const accept = sourceHeaders.get("accept");
  const contentType = sourceHeaders.get("content-type");

  if (accept) {
    forwardedHeaders.set("accept", accept);
  }

  if (contentType) {
    forwardedHeaders.set("content-type", contentType);
  }

  return buildRequestHeaders(token, forwardedHeaders, undefined, "text");
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token } = getApiConfig();
  const {
    responseType = "json",
    headers: headersInit,
    body,
    ...requestInit
  } = options;
  const headers = buildRequestHeaders(token, headersInit, body, responseType);

  const response = await fetch(buildApiUrl(path), {
    ...requestInit,
    body,
    cache: requestInit.cache ?? "no-store",
    headers,
  });

  if (!response.ok) {
    const { message, details } = await parseErrorResponse(response);
    throw new RuleboundApiError(
      message,
      response.status,
      "REQUEST_FAILED",
      details,
    );
  }

  if (responseType === "text") {
    return (await response.text()) as T;
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export function apiFetchText(
  path: string,
  options: Omit<ApiFetchOptions, "responseType"> = {},
) {
  return apiFetch<string>(path, { ...options, responseType: "text" });
}

function serializeApiError(error: unknown) {
  const description = describeApiError(error);

  if (isRuleboundApiError(error)) {
    return {
      error: description.description,
      code: error.code,
      missingEnv: error.details?.missingEnv,
    };
  }

  return {
    error: description.description,
    code: "UNKNOWN_ERROR",
  };
}

function responseHeadersFromUpstream(headers: Headers): Headers {
  const forwarded = new Headers();

  for (const name of [
    "content-type",
    "content-disposition",
    "cache-control",
    "location",
  ]) {
    const value = headers.get(name);
    if (value) {
      forwarded.set(name, value);
    }
  }

  return forwarded;
}

export async function proxyRequest(
  request: NextRequest,
  path: string,
): Promise<NextResponse> {
  try {
    const { token } = getApiConfig();
    const body = shouldSendBody(request.method)
      ? await request.text()
      : undefined;
    const forwardedHeaders = new Headers();
    const accept = request.headers.get("accept");
    const contentType = request.headers.get("content-type");

    if (accept) {
      forwardedHeaders.set("accept", accept);
    }

    if (contentType) {
      forwardedHeaders.set("content-type", contentType);
    }

    const headers = buildRequestHeaders(token, forwardedHeaders, body, "text");

    const upstream = await fetch(buildApiUrl(path, request.nextUrl.search), {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeadersFromUpstream(upstream.headers),
    });
  } catch (error) {
    const status = isRuleboundApiError(error) ? error.status : 500;
    return NextResponse.json(serializeApiError(error), { status });
  }
}
