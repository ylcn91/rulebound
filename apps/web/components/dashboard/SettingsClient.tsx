"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Key, Plus, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ApiTokenRecord, GeneratedApiToken } from "@/lib/dashboard-data";

interface SettingsClientProps {
  tokens: ApiTokenRecord[];
}

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

function formatDateTime(value: string | null): string {
  if (!value) {
    return "never";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SettingsClient({ tokens }: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("read, validate");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] =
    useState<GeneratedApiToken | null>(null);

  function resetForm() {
    setName("");
    setScopes("read, validate");
    setExpiresAt("");
    setShowCreateForm(false);
    setError(null);
  }

  function handleCreateToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            scopes: scopes
              .split(",")
              .map((scope) => scope.trim())
              .filter(Boolean),
            expiresAt: expiresAt || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(
            readErrorMessage(await response.json().catch(() => null)),
          );
        }

        const payload = (await response.json()) as { data: GeneratedApiToken };
        setGeneratedToken(payload.data);
        resetForm();
        router.refresh();
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Failed to generate token.",
        );
      }
    });
  }

  function handleRevoke(token: ApiTokenRecord) {
    const confirmed = window.confirm(
      `Revoke "${token.name}"? Existing CLI sessions will stop working.`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tokens/${token.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(
            readErrorMessage(await response.json().catch(() => null)),
          );
        }

        if (generatedToken?.id === token.id) {
          setGeneratedToken(null);
        }

        router.refresh();
      } catch (revokeError) {
        setError(
          revokeError instanceof Error
            ? revokeError.message
            : "Failed to revoke token.",
        );
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
          Settings
        </h1>
        <p className="mt-1 text-sm text-(--color-text-secondary)">
          Configure CLI access against the backend token contract
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
          CLI Setup
        </h2>
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="terminal overflow-hidden">
              <div className="terminal-header">
                <span className="terminal-dot bg-[#ff5f57]" />
                <span className="terminal-dot bg-[#febc2e]" />
                <span className="terminal-dot bg-[#28c840]" />
                <span className="ml-2 text-xs text-[#5c6773]">setup</span>
              </div>
              <pre className="p-4 text-xs leading-relaxed text-[#e6e1cf]">
                {`$ npm install -g @rulebound/cli
$ rulebound init
$ rulebound find-rules --task "your task"`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
            API Tokens
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setError(null);
            }}
          >
            <Plus className="h-4 w-4" />
            Generate Token
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 border border-(--color-accent)/30 bg-(--color-accent)/5 p-3 text-sm text-(--color-accent)">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {generatedToken ? (
          <Card className="border-2 border-(--color-text-primary)">
            <CardContent className="pt-6 space-y-3">
              <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
                Token Created
              </p>
              <p className="text-sm text-(--color-text-secondary)">
                Copy this token now. The backend returns the plaintext value
                only once.
              </p>
              <div className="border border-(--color-border) bg-(--color-grid) p-3 font-mono text-xs text-(--color-text-primary)">
                {generatedToken.token}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {showCreateForm ? (
          <Card className="border-2">
            <CardContent className="pt-6">
              <form className="space-y-4" onSubmit={handleCreateToken}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                      Name
                    </label>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="CLI access token"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                      Expires At
                    </label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(event) => setExpiresAt(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold uppercase tracking-widest text-(--color-muted)">
                    Scopes
                  </label>
                  <Input
                    value={scopes}
                    onChange={(event) => setScopes(event.target.value)}
                    placeholder="read, validate"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Generating..." : "Create Token"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {tokens.length > 0 ? (
          <Card className="border-2">
            <div className="divide-y divide-(--color-border)">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <Key className="mt-0.5 h-4 w-4 shrink-0 text-(--color-muted)" />
                    <div>
                      <p className="font-mono text-sm font-medium text-(--color-text-primary)">
                        {token.name}
                      </p>
                      <p className="font-mono text-xs text-(--color-muted)">
                        {token.tokenPrefix} • created{" "}
                        {formatDateTime(token.createdAt)} • last used{" "}
                        {formatDateTime(token.lastUsedAt)}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="danger"
                    className="gap-2"
                    onClick={() => handleRevoke(token)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="pt-6 text-center">
              <Terminal className="mx-auto mb-3 h-8 w-8 text-(--color-muted)" />
              <p className="text-sm text-(--color-text-secondary)">
                No API tokens yet. Generate one to connect the CLI to your
                backend workspace.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
