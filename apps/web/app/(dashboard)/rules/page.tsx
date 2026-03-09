import Link from "next/link";
import { BookOpen, Plus, Search } from "lucide-react";
import { BackendErrorState } from "@/components/dashboard/BackendErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchRulesList } from "@/lib/dashboard-data";
import { describeApiError } from "@/lib/api";
import { RULE_CATEGORY_OPTIONS, formatRuleLabel } from "@/lib/rules";

function getFirstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = getFirstValue(params.q);
  const category = getFirstValue(params.category);

  try {
    const response = await fetchRulesList({
      q: q || undefined,
      category: category || undefined,
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
              Rules
            </h1>
            <p className="mt-1 text-sm text-(--color-text-secondary)">
              Manage backend-authored enforcement rules for your AI coding
              agents
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/rules/new" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Rule
            </Link>
          </Button>
        </div>

        <form
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
          method="GET"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-muted)" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search rules..."
              className="pl-9"
            />
          </div>

          <select
            name="category"
            defaultValue={category}
            className="flex h-10 w-full cursor-pointer border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
          >
            <option value="">All Categories</option>
            {RULE_CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatRuleLabel(option)}
              </option>
            ))}
          </select>

          <Button type="submit" variant="outline">
            Apply Filters
          </Button>
        </form>

        {response.data.length > 0 ? (
          <div className="overflow-hidden border-2 border-(--color-border)">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-(--color-border) bg-(--color-surface)">
                  <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Title
                  </th>
                  <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) md:table-cell">
                    Category
                  </th>
                  <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) sm:table-cell">
                    Modality
                  </th>
                  <th className="hidden px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) lg:table-cell">
                    Tags
                  </th>
                  <th className="hidden px-4 py-3 text-right font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted) sm:table-cell">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {response.data.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-(--color-border) transition-colors duration-150 last:border-b-0 hover:bg-(--color-grid)"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/rules/${rule.id}`}
                        className="font-medium text-(--color-text-primary) underline-offset-4 hover:underline"
                      >
                        {rule.title}
                      </Link>
                      <span className="ml-2 font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                        v{rule.version}
                      </span>
                      {rule.severity === "error" ? (
                        <span className="ml-2 font-mono text-xs font-bold text-(--color-accent)">
                          ERR
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <Badge variant="outline">{rule.category}</Badge>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="stamp text-xs">{rule.modality}</span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {(rule.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-xs text-(--color-muted)"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono text-xs text-(--color-text-secondary) sm:table-cell">
                      {formatDate(rule.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border-2 border-dashed border-(--color-border) p-12 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-(--color-muted)" />
            <p className="text-sm text-(--color-text-secondary)">
              No rules matched this view. Create a rule or loosen the filters.
            </p>
          </div>
        )}
      </div>
    );
  } catch (error) {
    const description = describeApiError(error);

    return (
      <BackendErrorState
        heading="Rules"
        subheading="Manage backend-authored enforcement rules for your AI coding agents"
        title={description.title}
        description={description.description}
      />
    );
  }
}
