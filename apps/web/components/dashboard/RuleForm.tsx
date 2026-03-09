"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RuleRecord } from "@/lib/dashboard-data";
import {
  RULE_CATEGORY_OPTIONS,
  RULE_MODALITY_OPTIONS,
  RULE_SEVERITY_OPTIONS,
  formatRuleLabel,
  getRuleCategoryDraft,
  joinCommaList,
  splitCommaList,
} from "@/lib/rules";

interface RuleFormProps {
  mode: "create" | "edit";
  rule?: RuleRecord;
}

function readErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Request failed.";
  }

  if ("error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  return "Request failed.";
}

function QualityMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
          {label}
        </span>
        <span className="font-mono text-xs font-bold text-(--color-text-primary)">
          {value}/5
        </span>
      </div>
      <div className="h-1.5 overflow-hidden bg-(--color-grid)">
        <div
          className="h-full bg-(--color-text-primary) transition-all duration-200"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function RuleForm({ mode, rule }: RuleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(rule?.title ?? "");
  const [content, setContent] = useState(rule?.content ?? "");
  const [severity, setSeverity] = useState(rule?.severity ?? "warning");
  const [modality, setModality] = useState(rule?.modality ?? "should");
  const [tags, setTags] = useState(joinCommaList(rule?.tags));
  const [stack, setStack] = useState(joinCommaList(rule?.stack));
  const [changeNote, setChangeNote] = useState("");
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const categoryDraft = useMemo(
    () => getRuleCategoryDraft(rule?.category ?? RULE_CATEGORY_OPTIONS[0]),
    [rule?.category],
  );
  const [selectedCategory, setSelectedCategory] = useState(
    categoryDraft.selectedCategory,
  );
  const [customCategory, setCustomCategory] = useState(
    categoryDraft.customCategory,
  );

  const resolvedCategory =
    selectedCategory === "__custom__"
      ? customCategory.trim()
      : selectedCategory;

  const quality = useMemo(() => {
    const bulletCount = content
      .split("\n")
      .filter((line) => line.trim().startsWith("- ")).length;

    const atomicity =
      bulletCount > 0 && bulletCount <= 3 ? 4 : content.trim() ? 2 : 0;
    const completeness =
      (title.trim().length > 10 ? 1 : 0) +
      (content.includes("- ") ? 1 : 0) +
      (content.trim().length > 50 ? 1 : 0) +
      (resolvedCategory.length > 0 ? 1 : 0) +
      (stack.trim().length > 0 ? 1 : 0);

    const clarity =
      (title.trim().length > 0 && !title.includes("etc") ? 1 : 0) +
      (/(must|should|never|always)/i.test(content) ? 2 : 0) +
      (content.trim().length > 20 && content.trim().length < 500 ? 2 : 0);

    return {
      atomicity: Math.min(5, atomicity),
      completeness: Math.min(5, completeness),
      clarity: Math.min(5, clarity),
    };
  }, [content, resolvedCategory, stack, title]);

  const pageTitle = mode === "create" ? "Create Rule" : "Edit Rule";
  const pageDescription =
    mode === "create"
      ? "Define a new enforcement rule for your AI coding agents"
      : "Update rule text, severity, modality, and rollout state.";

  const submitLabel = mode === "create" ? "Create Rule" : "Save Changes";

  async function submitRule() {
    const payload = {
      title: title.trim(),
      content: content.trim(),
      category: resolvedCategory,
      severity,
      modality,
      tags: splitCommaList(tags),
      stack: splitCommaList(stack),
      ...(mode === "edit"
        ? {
            isActive,
            changeNote: changeNote.trim() || undefined,
          }
        : {}),
    };

    const endpoint =
      mode === "create" ? "/api/rules" : `/api/rules/${rule?.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = readErrorMessage(await response.json().catch(() => null));
      throw new Error(message);
    }

    const result = (await response.json().catch(() => null)) as {
      data?: RuleRecord;
    } | null;

    if (mode === "create" && result?.data?.id) {
      router.push(`/rules/${result.data.id}`);
      return;
    }

    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!resolvedCategory) {
      setError("Select a category or enter a custom category.");
      return;
    }

    startTransition(async () => {
      try {
        await submitRule();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to save rule.",
        );
      }
    });
  }

  function handleDelete() {
    if (!rule) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${rule.title}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rules/${rule.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const message = readErrorMessage(
            await response.json().catch(() => null),
          );
          throw new Error(message);
        }

        router.push("/rules");
        router.refresh();
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete rule.",
        );
      }
    });
  }

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href="/rules"
        className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-(--color-text-secondary) transition-colors duration-150 hover:text-(--color-text-primary)"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Rules
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
            {pageTitle}
          </h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            {pageDescription}
          </p>
        </div>

        {rule ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant={rule.isActive ? "default" : "accent"}>
              {rule.isActive ? "ACTIVE" : "INACTIVE"}
            </Badge>
            <Badge variant="outline">v{rule.version}</Badge>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 border border-(--color-accent)/30 bg-(--color-accent)/5 p-3 text-sm text-(--color-accent)">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="border-2">
          <CardContent className="pt-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="rule-title"
                  className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                >
                  Title
                </label>
                <Input
                  id="rule-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="No hardcoded secrets in application code"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="rule-content"
                  className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                >
                  Rule Definition
                </label>
                <textarea
                  id="rule-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={`- Never commit plaintext credentials
- Load secrets from environment or vault providers`}
                  rows={8}
                  required
                  className="flex min-h-48 w-full resize-y border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) placeholder:text-(--color-muted) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="rule-category"
                    className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                  >
                    Category
                  </label>
                  <select
                    id="rule-category"
                    value={selectedCategory}
                    onChange={(event) =>
                      setSelectedCategory(event.target.value)
                    }
                    className="flex h-10 w-full cursor-pointer border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                  >
                    {RULE_CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {formatRuleLabel(category)}
                      </option>
                    ))}
                    <option value="__custom__">Custom Category</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="rule-severity"
                    className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                  >
                    Severity
                  </label>
                  <select
                    id="rule-severity"
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value)}
                    className="flex h-10 w-full cursor-pointer border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                  >
                    {RULE_SEVERITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatRuleLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="rule-modality"
                    className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                  >
                    Modality
                  </label>
                  <select
                    id="rule-modality"
                    value={modality}
                    onChange={(event) => setModality(event.target.value)}
                    className="flex h-10 w-full cursor-pointer border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                  >
                    {RULE_MODALITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCategory === "__custom__" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="rule-custom-category"
                    className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                  >
                    Custom Category
                  </label>
                  <Input
                    id="rule-custom-category"
                    value={customCategory}
                    onChange={(event) => setCustomCategory(event.target.value)}
                    placeholder="accessibility"
                    required
                  />
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="rule-tags"
                    className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                  >
                    Tags
                  </label>
                  <Input
                    id="rule-tags"
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="auth, secrets, vault"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="rule-stack"
                    className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                  >
                    Stack Filters
                  </label>
                  <Input
                    id="rule-stack"
                    value={stack}
                    onChange={(event) => setStack(event.target.value)}
                    placeholder="typescript, nextjs"
                  />
                </div>
              </div>

              {mode === "edit" ? (
                <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <label className="flex cursor-pointer items-center gap-3 border-2 border-(--color-border) px-3 py-2 font-mono text-sm text-(--color-text-primary)">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(event) => setIsActive(event.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-[var(--color-text-primary)]"
                    />
                    Active
                  </label>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="rule-change-note"
                      className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)"
                    >
                      Change Note
                    </label>
                    <Input
                      id="rule-change-note"
                      value={changeNote}
                      onChange={(event) => setChangeNote(event.target.value)}
                      placeholder="Clarify the vault provider requirement."
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : submitLabel}
                </Button>
                <Button asChild type="button" variant="ghost">
                  <Link href="/rules">Cancel</Link>
                </Button>
                {rule ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={isPending}
                    className="gap-2"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-2">
            <CardContent className="pt-6 space-y-5">
              <div>
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-(--color-text-primary)">
                  Rule Quality
                </h2>
                <div className="mt-4 space-y-4">
                  <QualityMeter label="Atomicity" value={quality.atomicity} />
                  <QualityMeter
                    label="Completeness"
                    value={quality.completeness}
                  />
                  <QualityMeter label="Clarity" value={quality.clarity} />
                </div>
              </div>

              <div className="divider-dots" />

              <div className="space-y-2">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-(--color-muted)">
                  Backend Contract Notes
                </h3>
                <div className="space-y-2 text-xs text-(--color-text-secondary)">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-(--color-muted)" />
                    <p>
                      Categories follow the recommended backend taxonomy, but
                      custom values are allowed when you need them.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-(--color-muted)" />
                    <p>
                      Modality is stored explicitly and sent on both create and
                      edit.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-(--color-muted)" />
                    <p>
                      Tags and stack filters are comma-separated and persisted
                      as arrays.
                    </p>
                  </div>
                </div>
              </div>

              <div className="divider-dots" />

              <div className="space-y-2">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-(--color-muted)">
                  Severity Guide
                </h3>
                <div className="space-y-2 text-xs text-(--color-text-secondary)">
                  {RULE_SEVERITY_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          option === "error" &&
                            "border-(--color-accent) text-(--color-accent)",
                        )}
                      >
                        {option.toUpperCase()}
                      </Badge>
                      <span>{formatRuleLabel(option)} level enforcement.</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
