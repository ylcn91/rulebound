import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getDashboardPasscode } from "@/lib/dashboard-auth";

interface PageProps {
  searchParams?: Promise<{ error?: string; next?: string }>;
}

function getMessage(error?: string, configured = true) {
  if (!configured) {
    return "Set RULEBOUND_DASHBOARD_PASSCODE on the web server to enable dashboard access control.";
  }

  if (error === "invalid") {
    return "The provided passcode was invalid.";
  }

  return "Enter the dashboard passcode to access the admin surface.";
}

export default async function AccessPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const configured = Boolean(getDashboardPasscode());
  const message = getMessage(params.error, configured);

  return (
    <div className="min-h-screen bg-(--color-background) flex items-center justify-center px-6">
      <Card className="w-full max-w-md border-2">
        <CardContent className="pt-8 space-y-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
              Dashboard Access
            </p>
            <h1 className="mt-2 font-mono text-2xl font-bold text-(--color-text-primary)">
              Rulebound
            </h1>
            <p className="mt-3 text-sm text-(--color-text-secondary)">
              {message}
            </p>
          </div>

          {configured ? (
            <form action="/api/dashboard-auth/session" method="post" className="space-y-4">
              <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
              <div className="space-y-1.5">
                <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Passcode
                </label>
                <Input type="password" name="passcode" placeholder="Enter passcode" required />
              </div>
              <Button type="submit">Unlock Dashboard</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
