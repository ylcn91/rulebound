import { apiFetch } from "./api";

export interface RuleRecord {
  id: string;
  title: string;
  content: string;
  category: string;
  severity: string;
  modality: string;
  tags: string[] | null;
  stack: string[] | null;
  ruleSetId: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  repoUrl: string | null;
  stack: string[] | null;
  ruleSetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  orgId: string;
  projectId: string | null;
  userId: string | null;
  action: string;
  ruleId: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiTokenRecord {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  scopes: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface GeneratedApiToken {
  id: string;
  name: string;
  token: string;
  prefix: string;
  scopes: string[] | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface WebhookEndpointRecord {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  isActive: boolean;
  description: string | null;
  secretPrefix?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  responseCode: number | null;
  responseBody?: string | null;
  createdAt: string;
}

export interface ComplianceTrend {
  score: number;
  passCount: number;
  violatedCount: number;
  notCoveredCount: number;
  date: string;
}

export interface ComplianceData {
  projectId: string;
  currentScore: number | null;
  trend: ComplianceTrend[];
}

export interface ProjectComplianceRow {
  projectId: string;
  project: string;
  currentScore: number;
  previousScore: number;
  passCount: number;
  violatedCount: number;
  notCoveredCount: number;
  history: number[];
}

export interface DashboardProjectCompliance {
  projectId: string;
  name: string;
  score: number;
  trend: string;
  violations: number;
}

export interface DashboardViolation {
  ruleId: string | null;
  ruleTitle: string;
  count: number;
}

export interface DashboardRecentEvent {
  action: string;
  rule: string | null;
  project: string | null;
  time: string;
}

export interface DashboardOverview {
  overallScore: number;
  totalRules: number;
  activeProjects: number;
  violations24h: number;
  passRate: string;
  projectsCompliance: DashboardProjectCompliance[];
  topViolations: DashboardViolation[];
  recentEvents: DashboardRecentEvent[];
}

export interface AnalyticsTopViolation {
  ruleId: string | null;
  count: number;
  ruleTitle: string;
}

export interface AnalyticsCategoryEntry {
  action: string;
  count: number;
}

export interface AnalyticsSourceEntry {
  status: string;
  count: number;
}

export interface AnalyticsPageData {
  topViolations: AnalyticsTopViolation[];
  categories: AnalyticsCategoryEntry[];
  sources: AnalyticsSourceEntry[];
}

type ListResponse<T> = {
  data: T[];
  total: number;
};

type DetailResponse<T> = {
  data: T;
};

function buildQuery(
  params: Record<string, string | number | undefined | null>,
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - then) / 60000));

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export async function fetchRulesList(
  params: {
    q?: string;
    category?: string;
    limit?: number;
  } = {},
): Promise<ListResponse<RuleRecord>> {
  const query = buildQuery({
    q: params.q,
    category: params.category,
    limit: params.limit ?? 200,
  });

  return apiFetch<ListResponse<RuleRecord>>(`/rules${query}`);
}

export async function fetchRuleDetail(id: string): Promise<RuleRecord> {
  const response = await apiFetch<DetailResponse<RuleRecord>>(`/rules/${id}`);
  return response.data;
}

export async function fetchProjectsList(): Promise<ProjectRecord[]> {
  const response = await apiFetch<ListResponse<ProjectRecord>>("/projects");
  return response.data;
}

export async function fetchAuditEntries(
  params: {
    projectId?: string;
    action?: string;
    since?: string;
    until?: string;
    limit?: number;
  } = {},
): Promise<AuditEntry[]> {
  const query = buildQuery({
    project_id: params.projectId,
    action: params.action,
    since: params.since,
    until: params.until,
    limit: params.limit ?? 100,
  });

  const response = await apiFetch<ListResponse<AuditEntry>>(`/audit${query}`);
  return response.data;
}

export async function fetchTokensList(): Promise<ApiTokenRecord[]> {
  const response = await apiFetch<{ data: ApiTokenRecord[] }>("/tokens");
  return response.data;
}

export async function fetchWebhookData(): Promise<{
  endpoints: WebhookEndpointRecord[];
  deliveries: WebhookDeliveryRecord[];
}> {
  const [endpoints, deliveries] = await Promise.all([
    apiFetch<{ data: WebhookEndpointRecord[] }>("/webhooks/endpoints"),
    apiFetch<{ data: WebhookDeliveryRecord[] }>("/webhooks/deliveries"),
  ]);

  return {
    endpoints: endpoints.data,
    deliveries: deliveries.data,
  };
}

export async function fetchCompliance(
  projectId: string,
): Promise<ComplianceData> {
  const response = await apiFetch<DetailResponse<ComplianceData>>(
    `/compliance/${projectId}`,
  );
  return response.data;
}

export async function fetchComplianceRows(
  projects: ProjectRecord[],
): Promise<{
  rows: ProjectComplianceRow[];
  failedProjectIds: string[];
}> {

  const rows = await Promise.allSettled(
    projects.map(async (project) => {
      const compliance = await fetchCompliance(project.id);
      if (compliance.currentScore === null && compliance.trend.length === 0) {
        return null;
      }

      const latest = compliance.trend[0];
      const previous = compliance.trend[1];

      return {
        projectId: project.id,
        project: project.name,
        currentScore: compliance.currentScore ?? 0,
        previousScore: previous?.score ?? compliance.currentScore ?? 0,
        passCount: latest?.passCount ?? 0,
        violatedCount: latest?.violatedCount ?? 0,
        notCoveredCount: latest?.notCoveredCount ?? 0,
        history: compliance.trend.map((entry) => entry.score).reverse(),
      } satisfies ProjectComplianceRow;
    }),
  );

  const failedProjectIds = rows
    .filter((result) => result.status === "rejected")
    .map((_, index) => projects[index]?.id)
    .filter((id): id is string => Boolean(id));

  return {
    rows: rows
      .filter(
        (result): result is PromiseFulfilledResult<ProjectComplianceRow | null> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value)
      .filter((row): row is ProjectComplianceRow => row !== null),
    failedProjectIds,
  };
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [rulesResponse, auditEntries, projects, topViolationsResponse] =
    await Promise.all([
      fetchRulesList(),
      fetchAuditEntries({ limit: 200 }),
      fetchProjectsList(),
      apiFetch<{ data: Array<{ ruleId: string | null; count: number }> }>(
        "/analytics/top-violations?limit=5",
      ),
    ]);

  const rules = rulesResponse.data;
  const ruleTitleById = new Map(rules.map((rule) => [rule.id, rule.title]));
  const projectNameById = new Map(
    projects.map((project) => [project.id, project.name]),
  );

  const complianceResult = await fetchComplianceRows(projects);
  const complianceRows = complianceResult.rows;
  const overallScore =
    complianceRows.length > 0
      ? Math.round(
          complianceRows.reduce(
            (sum, project) => sum + project.currentScore,
            0,
          ) / complianceRows.length,
        )
      : 0;

  const validationEntries = auditEntries.filter((entry) =>
    ["PASSED", "VIOLATED"].includes(entry.status),
  );
  const passedEntries = validationEntries.filter(
    (entry) => entry.status === "PASSED",
  ).length;
  const passRate =
    validationEntries.length > 0
      ? `${Math.round((passedEntries / validationEntries.length) * 100)}%`
      : "N/A";

  const violations24h = auditEntries.filter(
    (entry) =>
      entry.status === "VIOLATED" &&
      new Date(entry.createdAt).getTime() >= new Date(since24h).getTime(),
  ).length;

  return {
    overallScore,
    totalRules: rulesResponse.total,
    activeProjects: projects.length - complianceResult.failedProjectIds.length,
    violations24h,
    passRate,
    projectsCompliance: complianceRows.map((project) => {
      const diff = project.currentScore - project.previousScore;

      return {
        projectId: project.projectId,
        name: project.project,
        score: project.currentScore,
        trend: diff > 0 ? `+${diff}` : `${diff}`,
        violations: project.violatedCount,
      };
    }),
    topViolations: topViolationsResponse.data.map((entry) => ({
      ruleId: entry.ruleId,
      ruleTitle: entry.ruleId
        ? (ruleTitleById.get(entry.ruleId) ?? entry.ruleId)
        : "Unknown rule",
      count: entry.count,
    })),
    recentEvents: auditEntries.slice(0, 10).map((entry) => ({
      action: entry.action,
      rule: entry.ruleId
        ? (ruleTitleById.get(entry.ruleId) ?? entry.ruleId)
        : null,
      project: entry.projectId
        ? (projectNameById.get(entry.projectId) ?? entry.projectId)
        : null,
      time: formatRelativeTime(entry.createdAt),
    })),
  };
}

export async function fetchAnalyticsPageData(): Promise<AnalyticsPageData> {
  const [topViolations, categories, sources, rulesResponse] = await Promise.all(
    [
      apiFetch<{ data: Array<{ ruleId: string | null; count: number }> }>(
        "/analytics/top-violations?limit=10",
      ),
      apiFetch<{ data: AnalyticsCategoryEntry[] }>(
        "/analytics/category-breakdown",
      ),
      apiFetch<{ data: AnalyticsSourceEntry[] }>("/analytics/source-stats"),
      fetchRulesList({ limit: 200 }),
    ],
  );

  const ruleTitleById = new Map(
    rulesResponse.data.map((rule) => [rule.id, rule.title]),
  );

  return {
    topViolations: topViolations.data.map((entry) => ({
      ...entry,
      ruleTitle: entry.ruleId
        ? (ruleTitleById.get(entry.ruleId) ?? entry.ruleId)
        : "Unknown rule",
    })),
    categories: categories.data,
    sources: sources.data,
  };
}
