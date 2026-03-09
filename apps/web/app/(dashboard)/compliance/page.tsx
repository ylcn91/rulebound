import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { describeApiError } from "@/lib/api";
import { fetchComplianceRows, fetchProjectsList } from "@/lib/dashboard-data";

function TrendIcon({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const diff = current - previous;

  if (diff > 0) {
    return <TrendingUp className="h-4 w-4 text-green-600" />;
  }

  if (diff < 0) {
    return <TrendingDown className="h-4 w-4 text-(--color-accent)" />;
  }

  return <Minus className="h-4 w-4 text-(--color-muted)" />;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return null;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 32;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="text-(--color-text-primary)">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-(--color-text-primary)"
      : score >= 60
        ? "bg-amber-500"
        : "bg-(--color-accent)";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-(--color-border)">
      <div
        className={`h-full ${color} rounded-full transition-all duration-200`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export default async function CompliancePage() {
  try {
    const projects = await fetchProjectsList();
    const { rows, failedProjectIds } = await fetchComplianceRows(projects);
    const averageScore =
      rows.length > 0
        ? Math.round(
            rows.reduce((sum, row) => sum + row.currentScore, 0) / rows.length,
          )
        : 0;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Compliance
          </h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Track compliance scores and trends across all projects
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-2">
            <CardContent className="pt-5 pb-5 text-center">
              <p className="font-mono text-3xl font-bold text-(--color-text-primary)">
                {averageScore}
              </p>
              <p className="mt-1 font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                Org Average
              </p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="pt-5 pb-5 text-center">
              <p className="font-mono text-3xl font-bold text-green-600">
                {rows.filter((row) => row.currentScore >= 80).length}
              </p>
              <p className="mt-1 font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                Passing
              </p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="pt-5 pb-5 text-center">
              <p className="font-mono text-3xl font-bold text-(--color-accent)">
                {rows.reduce((sum, row) => sum + row.violatedCount, 0)}
              </p>
              <p className="mt-1 font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                Violations
              </p>
            </CardContent>
          </Card>
        </div>

        {failedProjectIds.length > 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="pt-5 pb-5 text-sm text-(--color-text-secondary)">
              {failedProjectIds.length} project compliance fetch(es) failed and
              were excluded from aggregate scoring.
            </CardContent>
          </Card>
        ) : null}

        <div className="overflow-hidden border-2 border-(--color-border)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-(--color-border) bg-(--color-surface)">
                <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Project
                </th>
                <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Score
                </th>
                <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) md:table-cell">
                  Trend
                </th>
                <th className="hidden px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) sm:table-cell">
                  Pass
                </th>
                <th className="hidden px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) sm:table-cell">
                  Violated
                </th>
                <th className="hidden px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) lg:table-cell">
                  Not Covered
                </th>
                <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) md:table-cell">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.projectId}
                  className="border-b border-(--color-border) transition-colors duration-150 last:border-b-0 hover:bg-(--color-grid)"
                >
                  <td className="px-4 py-4">
                    <span className="font-mono font-medium text-(--color-text-primary)">
                      {row.project}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-(--color-text-primary)">
                        {row.currentScore}
                      </span>
                      <TrendIcon
                        current={row.currentScore}
                        previous={row.previousScore}
                      />
                      <span className="font-mono text-xs text-(--color-muted)">
                        {row.currentScore - row.previousScore > 0 ? "+" : ""}
                        {row.currentScore - row.previousScore}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-4 md:table-cell">
                    <Sparkline data={row.history} />
                  </td>
                  <td className="hidden px-4 py-4 text-center font-mono text-green-600 sm:table-cell">
                    {row.passCount}
                  </td>
                  <td className="hidden px-4 py-4 text-center font-mono text-(--color-accent) sm:table-cell">
                    {row.violatedCount}
                  </td>
                  <td className="hidden px-4 py-4 text-center font-mono text-(--color-muted) lg:table-cell">
                    {row.notCoveredCount}
                  </td>
                  <td className="hidden px-4 py-4 md:table-cell">
                    <ScoreBar score={row.currentScore} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-(--color-text-secondary)"
                  >
                    No compliance snapshots available yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  } catch (error) {
    const description = describeApiError(error);

    return (
      <BackendErrorState
        heading="Compliance"
        subheading="Track compliance scores and trends across all projects"
        title={description.title}
        description={description.description}
      />
    );
  }
}
