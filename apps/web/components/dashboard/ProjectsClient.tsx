"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ProjectRecord } from "@/lib/dashboard-data";
import { formatRuleLabel, splitCommaList } from "@/lib/rules";

interface ProjectsClientProps {
  projects: ProjectRecord[];
}

interface ProjectDraft {
  name: string;
  slug: string;
  repoUrl: string;
  stack: string;
}

const EMPTY_DRAFT: ProjectDraft = {
  name: "",
  slug: "",
  repoUrl: "",
  stack: "",
};

function readErrorMessage(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Request failed.";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function projectToDraft(project: ProjectRecord): ProjectDraft {
  return {
    name: project.name,
    slug: project.slug,
    repoUrl: project.repoUrl ?? "",
    stack: (project.stack ?? []).join(", "),
  };
}

export function ProjectsClient({ projects }: ProjectsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLabel = editingId ? "Save Project" : "Create Project";
  const formTitle = editingId ? "Edit Project" : "New Project";
  const stackPreview = useMemo(
    () => splitCommaList(draft.stack),
    [draft.stack],
  );

  function updateDraft<K extends keyof ProjectDraft>(
    key: K,
    value: ProjectDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function openCreateForm() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function openEditForm(project: ProjectRecord) {
    setDraft(projectToDraft(project));
    setEditingId(project.id);
    setShowForm(true);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const endpoint = editingId
          ? `/api/projects/${editingId}`
          : "/api/projects";
        const method = editingId ? "PUT" : "POST";
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: draft.name.trim(),
            slug: draft.slug.trim() || undefined,
            repoUrl: draft.repoUrl.trim() || undefined,
            stack: splitCommaList(draft.stack),
          }),
        });

        if (!response.ok) {
          throw new Error(
            readErrorMessage(await response.json().catch(() => null)),
          );
        }

        resetForm();
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to save project.",
        );
      }
    });
  }

  function handleDelete(project: ProjectRecord) {
    const confirmed = window.confirm(
      `Delete "${project.name}"? This removes its sync state and snapshots.`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(
            readErrorMessage(await response.json().catch(() => null)),
          );
        }

        if (editingId === project.id) {
          resetForm();
        }

        router.refresh();
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete project.",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            Projects
          </h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Repositories connected to your rule sets
          </p>
        </div>

        <Button size="sm" className="gap-2" onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {showForm ? (
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="mb-4">
              <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                {formTitle}
              </p>
              <p className="mt-1 text-sm text-(--color-text-secondary)">
                Projects are managed through the backend `/v1/projects`
                contract.
              </p>
            </div>

            {error ? (
              <div className="mb-4 border border-(--color-accent)/30 bg-(--color-accent)/5 p-3 text-sm text-(--color-accent)">
                {error}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Name
                  </label>
                  <Input
                    value={draft.name}
                    onChange={(event) =>
                      updateDraft("name", event.target.value)
                    }
                    placeholder="Rulebound Web"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Slug
                  </label>
                  <Input
                    value={draft.slug}
                    onChange={(event) =>
                      updateDraft("slug", event.target.value)
                    }
                    placeholder="rulebound-web"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Repository URL
                  </label>
                  <Input
                    type="url"
                    value={draft.repoUrl}
                    onChange={(event) =>
                      updateDraft("repoUrl", event.target.value)
                    }
                    placeholder="https://github.com/org/repo"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Stack Filters
                  </label>
                  <Input
                    value={draft.stack}
                    onChange={(event) =>
                      updateDraft("stack", event.target.value)
                    }
                    placeholder="typescript, nextjs"
                  />
                </div>
              </div>

              {stackPreview.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stackPreview.map((item) => (
                    <Badge key={item} variant="outline">
                      {formatRuleLabel(item)}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : submitLabel}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="border-2 transition-colors duration-150 hover:border-(--color-text-primary)/30"
            >
              <CardContent className="pt-5 pb-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 shrink-0 text-(--color-text-primary)" />
                    <div>
                      <h2 className="font-mono text-sm font-bold text-(--color-text-primary)">
                        {project.name}
                      </h2>
                      <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                        {project.slug}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      onClick={() => openEditForm(project)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="px-2 text-(--color-accent) hover:bg-(--color-accent)/10 hover:text-(--color-accent)"
                      onClick={() => handleDelete(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {project.repoUrl ? (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-(--color-muted) transition-colors duration-150 hover:text-(--color-text-primary)"
                  >
                    {project.repoUrl.replace("https://github.com/", "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs text-(--color-muted)">
                    No repository linked
                  </span>
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {project.ruleSetIds.length} rule set
                    {project.ruleSetIds.length === 1 ? "" : "s"}
                  </Badge>
                  {(project.stack ?? []).map((item) => (
                    <Badge key={item} variant="outline">
                      {formatRuleLabel(item)}
                    </Badge>
                  ))}
                </div>

                <p className="text-xs text-(--color-muted)">
                  Updated {formatDate(project.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-(--color-border) p-12 text-center">
          <FolderKanban className="mx-auto mb-3 h-8 w-8 text-(--color-muted)" />
          <p className="text-sm text-(--color-text-secondary)">
            No projects yet. Create the first project from the backend-backed
            form above.
          </p>
        </div>
      )}
    </div>
  );
}
