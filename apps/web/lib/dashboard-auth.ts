import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const DASHBOARD_SESSION_COOKIE = "rulebound_dashboard_session";
const DASHBOARD_PASSCODE_ENV = "RULEBOUND_DASHBOARD_PASSCODE";

export function getDashboardPasscode(): string | null {
  const value = process.env[DASHBOARD_PASSCODE_ENV]?.trim();
  return value && value.length > 0 ? value : null;
}

export function isDashboardSessionValue(value: string | null | undefined): boolean {
  const passcode = getDashboardPasscode();
  return Boolean(passcode && value && value === passcode);
}

export async function requireDashboardAccess(): Promise<void> {
  const passcode = getDashboardPasscode();
  if (!passcode) {
    redirect("/access?error=missing-config");
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
  if (!isDashboardSessionValue(value)) {
    redirect("/access");
  }
}

export function assertDashboardSession(cookieHeader: string | null | undefined): {
  ok: boolean;
  reason?: "missing-config" | "unauthorized";
} {
  const passcode = getDashboardPasscode();
  if (!passcode) {
    return { ok: false, reason: "missing-config" };
  }

  const cookiesMap = new Map<string, string>();
  for (const rawPart of (cookieHeader ?? "").split(";")) {
    const [name, ...rest] = rawPart.trim().split("=");
    if (!name) continue;
    cookiesMap.set(name, decodeURIComponent(rest.join("=")));
  }

  const session = cookiesMap.get(DASHBOARD_SESSION_COOKIE);
  if (!isDashboardSessionValue(session)) {
    return { ok: false, reason: "unauthorized" };
  }

  return { ok: true };
}
