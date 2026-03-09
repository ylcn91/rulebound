import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Clock,
  Shield,
  TrendingUp,
} from "lucide-react";
import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { describeApiError } from "@/lib/api";
import { fetchDashboardOverview } from "@/lib/dashboard-data";

function ScoreRing({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? "var(--color-text-primary)"
      : score >= 60
        ? "#d97706"
        : "var(--color-accent)";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute font-mono text-2xl font-bold text-(--color-text-primary)">
        {score}
      </span>
    </div>
  );
}

export default async function DashboardOverviewPage() {
  try {
    const data = await fetchDashboardOverview();

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Organization-wide compliance overview
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-(--color-text-primary)" />
                <div>
                  <p className="font-mono text-2xl font-bold text-(--color-text-primary)">
                    {data.overallScore}
                  </p>
                  <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                    Compliance Score
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-(--color-text-primary)" />
                <div>
                  <p className="font-mono text-2xl font-bold text-(--color-text-primary)">
                    {data.totalRules}
                  </p>
                  <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                    Rules
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-(--color-accent)" />
                <div>
                  <p className="font-mono text-2xl font-bold text-(--color-text-primary)">
                    {data.violations24h}
                  </p>
                  <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                    Violations (24h)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-mono text-2xl font-bold text-(--color-text-primary)">
                    {data.passRate}
                  </p>
                  <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                    Pass Rate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                    Org Score
                  </p>
                  <p className="mt-2 text-sm text-(--color-text-secondary)">
                    Average across projects with backend compliance snapshots.
                  </p>
                </div>
                <ScoreRing score={data.overallScore} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="pt-6">
              <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                Project Compliance
              </h2>
              {data.projectsCompliance.length > 0 ? (
                <div className="space-y-3">
                  {data.projectsCompliance.map((project) => (
                    <div
                      key={project.projectId}
                      className="flex items-center justify-between gap-3 border-b border-(--color-border) pb-3 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-(--color-text-primary)">
                          {project.name}
                        </p>
                        <p className="text-xs text-(--color-text-secondary)">
                          {project.violations} violations in latest snapshot
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-(--color-text-primary)">
                          {project.score}
                        </p>
                        <p className="font-mono text-xs text-(--color-muted)">
                          {project.trend}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-(--color-text-secondary)">
                  No compliance snapshots available yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-(--color-text-primary)" />
                <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Top Violations
                </h2>
              </div>
              {data.topViolations.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {data.topViolations.map((entry) => (
                    <div
                      key={`${entry.ruleId ?? "unknown"}-${entry.count}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <p className="truncate text-sm text-(--color-text-primary)">
                        {entry.ruleTitle}
                      </p>
                      <Badge variant="outline">{entry.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-(--color-text-secondary)">
                  No analytics events recorded yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-(--color-text-primary)" />
                <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Recent Events
                </h2>
              </div>
              {data.recentEvents.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {data.recentEvents.map((event, index) => (
                    <div
                      key={`${event.action}-${event.time}-${index}`}
                      className="border-b border-(--color-border) pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                          {event.action}
                        </p>
                        <span className="font-mono text-xs text-(--color-muted)">
                          {event.time}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-(--color-text-primary)">
                        {event.rule ?? "No rule linked"}
                      </p>
                      <p className="text-xs text-(--color-text-secondary)">
                        {event.project ?? "No project linked"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-(--color-text-secondary)">
                  No audit activity available yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    const description = describeApiError(error);

    return (
      <BackendErrorState
        heading="Dashboard"
        subheading="Organization-wide compliance overview"
        title={description.title}
        description={description.description}
      />
    );
  }
}
