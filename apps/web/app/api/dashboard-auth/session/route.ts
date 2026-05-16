import { NextRequest, NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, getDashboardPasscode } from "@/lib/dashboard-auth";
import { getSafeDashboardRedirectPath, isSameOriginRequest } from "@/lib/request-security";

const isProduction = process.env.NODE_ENV === "production";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const form = await request.formData();
  const submitted = String(form.get("passcode") ?? "");
  const nextPath = String(form.get("next") ?? "/dashboard");
  const passcode = getDashboardPasscode();

  if (!passcode) {
    return NextResponse.redirect(new URL("/access?error=missing-config", request.url));
  }

  if (submitted !== passcode) {
    return NextResponse.redirect(new URL("/access?error=invalid", request.url));
  }

  const safeNext = getSafeDashboardRedirectPath(nextPath);
  const response = NextResponse.redirect(new URL(safeNext, request.url));
  response.cookies.set({
    name: DASHBOARD_SESSION_COOKIE,
    value: passcode,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DASHBOARD_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 0,
  });
  return response;
}
