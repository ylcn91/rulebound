import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAnalyticsPageData,
  fetchDashboardOverview,
} from "@/lib/dashboard-data";

const ORIGINAL_API_URL = process.env.RULEBOUND_API_URL;
const ORIGINAL_API_TOKEN = process.env.RULEBOUND_API_TOKEN;

function restoreEnv() {
  if (ORIGINAL_API_URL === undefined) {
    delete process.env.RULEBOUND_API_URL;
  } else {
    process.env.RULEBOUND_API_URL = ORIGINAL_API_URL;
  }

  if (ORIGINAL_API_TOKEN === undefined) {
    delete process.env.RULEBOUND_API_TOKEN;
  } else {
    process.env.RULEBOUND_API_TOKEN = ORIGINAL_API_TOKEN;
  }
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("dashboard data loaders", () => {
  beforeEach(() => {
    process.env.RULEBOUND_API_URL = "https://rulebound.test";
    process.env.RULEBOUND_API_TOKEN = "svc_test_token";
  });

  afterEach(() => {
    restoreEnv();
    vi.unstubAllGlobals();
  });

  it("maps rule titles, project names, and pass rate in dashboard overview", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "https://rulebound.test/v1/rules?limit=200") {
        return jsonResponse({
          data: [
            {
              id: "rule-1",
              title: "No plaintext secrets",
              content: "Use environment variables",
              category: "security",
              severity: "error",
              modality: "must",
              tags: ["security"],
              stack: ["typescript"],
              ruleSetId: "rs-1",
              isActive: true,
              version: 3,
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-05T10:00:00.000Z",
            },
          ],
          total: 1,
        });
      }

      if (url === "https://rulebound.test/v1/audit?limit=200") {
        return jsonResponse({
          data: [
            {
              id: "audit-1",
              orgId: "org-1",
              projectId: "project-1",
              userId: "user-1",
              action: "validation.violation",
              ruleId: "rule-1",
              status: "VIOLATED",
              metadata: { reason: "Hardcoded secret detected" },
              createdAt: new Date().toISOString(),
            },
            {
              id: "audit-2",
              orgId: "org-1",
              projectId: "project-1",
              userId: "user-1",
              action: "validation.pass",
              ruleId: "rule-1",
              status: "PASSED",
              metadata: null,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 2,
        });
      }

      if (url === "https://rulebound.test/v1/projects") {
        return jsonResponse({
          data: [
            {
              id: "project-1",
              orgId: "org-1",
              name: "Web App",
              slug: "web-app",
              repoUrl: "https://github.com/rulebound/web",
              stack: ["typescript", "nextjs"],
              ruleSetIds: ["rs-1"],
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-05T10:00:00.000Z",
            },
          ],
          total: 1,
        });
      }

      if (
        url === "https://rulebound.test/v1/analytics/top-violations?limit=5"
      ) {
        return jsonResponse({
          data: [{ ruleId: "rule-1", count: 4 }],
        });
      }

      if (url === "https://rulebound.test/v1/compliance/project-1") {
        return jsonResponse({
          data: {
            projectId: "project-1",
            currentScore: 88,
            trend: [
              {
                score: 88,
                passCount: 7,
                violatedCount: 1,
                notCoveredCount: 0,
                date: "2026-03-08T10:00:00.000Z",
              },
              {
                score: 84,
                passCount: 6,
                violatedCount: 2,
                notCoveredCount: 0,
                date: "2026-03-07T10:00:00.000Z",
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const overview = await fetchDashboardOverview();

    expect(overview.totalRules).toBe(1);
    expect(overview.activeProjects).toBe(1);
    expect(overview.passRate).toBe("50%");
    expect(overview.projectsCompliance[0]?.name).toBe("Web App");
    expect(overview.topViolations[0]?.ruleTitle).toBe("No plaintext secrets");
    expect(overview.recentEvents[0]?.project).toBe("Web App");
    expect(overview.recentEvents[0]?.rule).toBe("No plaintext secrets");
  });

  it("resolves rule titles in analytics summaries", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (
        url === "https://rulebound.test/v1/analytics/top-violations?limit=10"
      ) {
        return jsonResponse({
          data: [{ ruleId: "rule-2", count: 6 }],
        });
      }

      if (url === "https://rulebound.test/v1/analytics/category-breakdown") {
        return jsonResponse({
          data: [{ action: "validation.violation", count: 6 }],
        });
      }

      if (url === "https://rulebound.test/v1/analytics/source-stats") {
        return jsonResponse({
          data: [
            { status: "PASSED", count: 8 },
            { status: "VIOLATED", count: 6 },
          ],
        });
      }

      if (url === "https://rulebound.test/v1/rules?limit=200") {
        return jsonResponse({
          data: [
            {
              id: "rule-2",
              title: "Prefer server actions",
              content: "Use server actions when mutations stay inside Next.js",
              category: "architecture",
              severity: "warning",
              modality: "should",
              tags: ["nextjs"],
              stack: ["nextjs"],
              ruleSetId: "rs-2",
              isActive: true,
              version: 2,
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-05T10:00:00.000Z",
            },
          ],
          total: 1,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const analytics = await fetchAnalyticsPageData();

    expect(analytics.topViolations[0]?.ruleTitle).toBe("Prefer server actions");
    expect(analytics.categories[0]?.action).toBe("validation.violation");
    expect(analytics.sources[0]?.status).toBe("PASSED");
  });
});
