import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewBanner, __testing } from "@/components/dashboard/PreviewBanner";

describe("PreviewBanner", () => {
  it("renders the self-hosted preview disclaimer with Lucide icon", () => {
    const html = renderToStaticMarkup(<PreviewBanner />);

    expect(html).toContain("Self-hosted preview");
    expect(html).toContain("not Rulebound SaaS");
    // Lucide renders an <svg> with the AlertTriangle path; no emoji allowed
    // per CLAUDE.md design rules.
    expect(html).toMatch(/<svg[^>]*lucide-(alert-triangle|triangle-alert)/);
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it("links to the in-app self-hosted preview docs", () => {
    const html = renderToStaticMarkup(<PreviewBanner />);

    expect(__testing.READINESS_DOC_HREF).toBe("/docs/deployment/self-hosted");
    expect(html).toContain(`href="${__testing.READINESS_DOC_HREF}"`);
    expect(html).toContain(__testing.READINESS_DOC_LABEL);
  });

  it("carries accessibility hooks for a status banner", () => {
    const html = renderToStaticMarkup(<PreviewBanner />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Self-hosted preview"');
    expect(html).toContain('data-preview="true"');
  });
});
