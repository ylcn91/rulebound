const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  if (!host) return false;

  const expected = new Set<string>([`https://${host}`, `http://${host}`]);

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

function isSingleSlashRelativePath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !CONTROL_CHARACTERS.test(value)
  );
}

export function getSafeDashboardRedirectPath(value: string): string {
  const fallback = "/dashboard";

  if (!isSingleSlashRelativePath(value)) {
    return fallback;
  }

  let decoded = value;
  for (let i = 0; i < 3; i += 1) {
    if (ENCODED_PATH_SEPARATOR.test(decoded)) {
      return fallback;
    }

    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        break;
      }
      decoded = nextDecoded;
    } catch {
      return fallback;
    }

    if (!isSingleSlashRelativePath(decoded)) {
      return fallback;
    }
  }

  if (ENCODED_PATH_SEPARATOR.test(decoded) || !isSingleSlashRelativePath(decoded)) {
    return fallback;
  }

  return value;
}
