import { AlertTriangle, CheckCircle, Clock, Download } from "lucide-react";
import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeApiError } from "@/lib/api";
import { fetchAuditEntries, fetchProjectsList } from "@/lib/dashboard-data";

function getFirstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function buildQuery(params: Record<string, string>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEntryDetail(metadata: Record<string, unknown> | null): string {
  if (!metadata) {
    return "-";
  }

  return (
    (typeof metadata.reason === "string" && metadata.reason) ||
    (typeof metadata.changeNote === "string" && metadata.changeNote) ||
    (typeof metadata.message === "string" && metadata.message) ||
    "-"
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "VIOLATED") {
    return <AlertTriangle className="h-4 w-4 text-(--color-accent)" />;
  }

  if (status === "PASSED") {
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  }

  return <Clock className="h-4 w-4 text-(--color-muted)" />;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const action = getFirstValue(params.action);
  const projectId = getFirstValue(params.project_id);
  const since = getFirstValue(params.since);
  const until = getFirstValue(params.until);

  try {
    const [entries, projects] = await Promise.all([
      fetchAuditEntries({
        action: action || undefined,
        projectId: projectId || undefined,
        since: since || undefined,
        until: until || undefined,
        limit: 200,
      }),
      fetchProjectsList(),
    ]);

    const projectNameById = new Map(
      projects.map((project) => [project.id, project.name]),
    );
    const exportHref = `/api/audit/export${buildQuery({
      action,
      project_id: projectId,
      since,
      until,
    })}`;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
              Audit Log
            </h1>
            <p className="mt-1 text-sm text-(--color-text-secondary)">
              Track validation events, rule changes, and backend enforcement
              actions
            </p>
          </div>

          <Button asChild size="sm" variant="outline" className="gap-2">
            <a href={exportHref}>
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </Button>
        </div>

        <form
          className="grid gap-3 xl:grid-cols-[220px_220px_1fr_1fr_auto]"
          method="GET"
        >
          <select
            name="action"
            defaultValue={action}
            className="flex h-10 w-full cursor-pointer border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
          >
            <option value="">All actions</option>
            <option value="validation.violation">validation.violation</option>
            <option value="validation.pass">validation.pass</option>
            <option value="rule.updated">rule.updated</option>
            <option value="sync.completed">sync.completed</option>
          </select>

          <select
            name="project_id"
            defaultValue={projectId}
            className="flex h-10 w-full cursor-pointer border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <Input type="date" name="since" defaultValue={since} />
          <Input type="date" name="until" defaultValue={until} />

          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>

        <div className="overflow-hidden border-2 border-(--color-border)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-(--color-border) bg-(--color-surface)">
                <th className="w-8 px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)" />
                <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Event
                </th>
                <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) md:table-cell">
                  Rule
                </th>
                <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) sm:table-cell">
                  Project
                </th>
                <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) lg:table-cell">
                  Detail
                </th>
                <th className="px-4 py-3 text-right font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-(--color-border) transition-colors duration-150 last:border-b-0 hover:bg-(--color-grid)"
                >
                  <td className="px-4 py-3">
                    <StatusIcon status={entry.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-(--color-text-primary)">
                      {entry.action}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-(--color-text-primary) md:table-cell">
                    {entry.ruleId ?? "-"}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {entry.projectId ? (
                      <Badge variant="outline">
                        {projectNameById.get(entry.projectId) ??
                          entry.projectId}
                      </Badge>
                    ) : (
                      <span className="text-(--color-muted)">-</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="block max-w-[320px] truncate text-xs text-(--color-text-secondary)">
                      {getEntryDetail(entry.metadata)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-(--color-muted)">
                    {formatTime(entry.createdAt)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-(--color-text-secondary)"
                  >
                    No audit entries matched the selected filters.
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
        heading="Audit Log"
        subheading="Track validation events, rule changes, and backend enforcement actions"
        title={description.title}
        description={description.description}
      />
    );
  }
}
