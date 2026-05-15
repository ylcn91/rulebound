import Link from "next/link";
import { AlertTriangle } from "lucide-react";

const READINESS_DOC_HREF = "/docs/deployment/self-hosted";
const READINESS_DOC_LABEL = "self-hosted preview docs";

/**
 * Subtle, persistent banner that calls out the self-hosted preview status of
 * this dashboard. Mounted in the dashboard layout so every authenticated page
 * carries the same signal. The link points at the operator-facing readiness
 * doc that lives under `docs/dashboard-readiness.md`.
 *
 * Design rules:
 * - Lucide icon only (no emoji per CLAUDE.md).
 * - Mono uppercase label matching the rest of the dashboard.
 * - Subtle palette: dashed border + (--color-grid) bg so the banner does not
 *   compete with primary surface content.
 */
export function PreviewBanner() {
  return (
    <div
      role="status"
      aria-label="Self-hosted preview"
      data-preview="true"
      className="flex items-center gap-3 border-b border-dashed border-(--color-border) bg-(--color-grid) px-6 py-2 text-(--color-text-secondary)"
    >
      <AlertTriangle
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-(--color-text-primary)"
      />
      <p className="font-mono text-xs uppercase tracking-widest">
        Self-hosted preview · not Rulebound SaaS
      </p>
      <Link
        href={READINESS_DOC_HREF}
        className="ml-auto font-mono text-xs uppercase tracking-widest text-(--color-text-primary) underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {READINESS_DOC_LABEL}
      </Link>
    </div>
  );
}

export const __testing = {
  READINESS_DOC_HREF,
  READINESS_DOC_LABEL,
};
