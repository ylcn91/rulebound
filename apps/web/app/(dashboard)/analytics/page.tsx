import { Activity, AlertTriangle, BarChart3, TrendingUp } from "lucide-react";
import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { describeApiError } from "@/lib/api";
import { fetchAnalyticsPageData } from "@/lib/dashboard-data";

export default async function AnalyticsPage() {
  try {
    const data = await fetchAnalyticsPageData();
    const totalViolations = data.topViolations.reduce(
      (sum, entry) => sum + entry.count,
      0,
    );
    const totalEvents = data.sources.reduce(
      (sum, entry) => sum + entry.count,
      0,
    );
    const passedEvents =
      data.sources.find((entry) => entry.status === "PASSED")?.count ?? 0;
    const passRate =
      totalEvents > 0 ? Math.round((passedEvents / totalEvents) * 100) : 0;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Validation insights and violation trends
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-(--color-text-primary)" />
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Total Events
                  </p>
                  <p className="text-2xl font-bold text-(--color-text-primary)">
                    {totalEvents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-(--color-text-primary)" />
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Total Violations
                  </p>
                  <p className="text-2xl font-bold text-(--color-text-primary)">
                    {totalViolations}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-(--color-text-primary)" />
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Pass Rate
                  </p>
                  <p className="text-2xl font-bold text-(--color-text-primary)">
                    {passRate}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-(--color-text-primary)" />
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Categories
                  </p>
                  <p className="text-2xl font-bold text-(--color-text-primary)">
                    {data.categories.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                Top Violated Rules
              </h2>
              {data.topViolations.length > 0 ? (
                <div className="space-y-3">
                  {data.topViolations.map((entry) => {
                    const maxCount = data.topViolations[0]?.count ?? 1;
                    const width = Math.max((entry.count / maxCount) * 100, 4);

                    return (
                      <div key={`${entry.ruleId ?? "unknown"}-${entry.count}`}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="truncate pr-3 text-(--color-text-primary)">
                            {entry.ruleTitle}
                          </span>
                          <span className="tabular-nums text-(--color-text-secondary)">
                            {entry.count}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-(--color-border)">
                          <div
                            className="h-full rounded-full bg-(--color-text-primary) transition-all duration-200"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-(--color-text-secondary)">
                  No violations recorded yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                Violations by Action
              </h2>
              {data.categories.length > 0 ? (
                <div className="space-y-3">
                  {data.categories.map((category) => {
                    const total = data.categories.reduce(
                      (sum, entry) => sum + entry.count,
                      0,
                    );
                    const percent =
                      total > 0
                        ? Math.round((category.count / total) * 100)
                        : 0;

                    return (
                      <div
                        key={category.action}
                        className="flex items-center justify-between"
                      >
                        <span className="font-mono text-sm text-(--color-text-primary)">
                          {category.action}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-sm text-(--color-text-secondary)">
                            {category.count}
                          </span>
                          <span className="w-10 text-right text-xs tabular-nums text-(--color-muted)">
                            {percent}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-(--color-text-secondary)">
                  No data available.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
              Validation Results
            </h2>
            {data.sources.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-4">
                {data.sources.map((source) => (
                  <div
                    key={source.status}
                    className="border border-(--color-border) p-4 text-center"
                  >
                    <p className="text-2xl font-bold tabular-nums text-(--color-text-primary)">
                      {source.count}
                    </p>
                    <p className="mt-1 font-mono text-xs uppercase text-(--color-text-secondary)">
                      {source.status}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-(--color-text-secondary)">
                No events recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    const description = describeApiError(error);

    return (
      <BackendErrorState
        heading="Analytics"
        subheading="Validation insights and violation trends"
        title={description.title}
        description={description.description}
      />
    );
  }
}
