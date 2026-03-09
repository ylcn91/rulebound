import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, getDashboardPasscode } from "@/lib/dashboard-auth";

const protectedPrefixes = [
  "/dashboard",
  "/rules",
  "/projects",
  "/audit",
  "/compliance",
  "/analytics",
  "/settings",
  "/webhooks",
  "/import",
  "/api/rules",
  "/api/projects",
  "/api/tokens",
  "/api/webhooks",
  "/api/audit",
  "/api/cli",
];

function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const passcode = getDashboardPasscode();
  if (!passcode) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Dashboard passcode is not configured." }, { status: 503 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/access";
    url.searchParams.set("error", "missing-config");
    return NextResponse.redirect(url);
  }

  const session = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
  if (session === passcode) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Dashboard authorization required." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/rules/:path*",
    "/projects/:path*",
    "/audit/:path*",
    "/compliance/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/webhooks/:path*",
    "/import/:path*",
    "/api/rules/:path*",
    "/api/projects/:path*",
    "/api/tokens/:path*",
    "/api/webhooks/:path*",
    "/api/audit/:path*",
    "/api/cli/:path*",
  ],
};
