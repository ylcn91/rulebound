export interface DataResponse<T> {
  data: T
}

export interface ListResponse<T> extends DataResponse<T[]> {
  total?: number
}

export interface DeleteResult {
  deleted: boolean
}

export interface Rule {
  id: string
  ruleSetId: string
  title: string
  content: string
  category: string
  severity: string
  modality: string
  tags: string[]
  stack: string[]
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export interface RuleCreateInput {
  title: string
  content: string
  category: string
  severity?: string
  modality?: string
  tags?: string[]
  stack?: string[]
  ruleSetId?: string
}

export interface RuleUpdateInput {
  title?: string
  content?: string
  category?: string
  severity?: string
  modality?: string
  tags?: string[]
  stack?: string[]
  isActive?: boolean
  changeNote?: string
}

export interface RuleListOptions {
  stack?: string
  category?: string
  tag?: string
  q?: string
  limit?: number
  offset?: number
}

export interface Project {
  id: string
  orgId: string
  name: string
  slug: string
  repoUrl: string | null
  stack: string[]
  createdAt: string
  updatedAt: string
}

export interface ProjectCreateInput {
  name: string
  slug: string
  repoUrl?: string | null
  stack?: string[]
}

export interface ProjectUpdateInput {
  name?: string
  slug?: string
  repoUrl?: string | null
  stack?: string[]
}

export interface ValidationRequest {
  code?: string
  plan?: string
  language?: string
  project?: string
  task?: string
  useLlm?: boolean
}

export interface ValidationResult {
  ruleId: string
  ruleTitle: string
  severity: string
  modality: string
  status: "PASS" | "VIOLATED" | "NOT_COVERED"
  reason: string
  suggestedFix?: string
}

export interface ValidationSummary {
  pass: number
  violated: number
  notCovered: number
}

export interface ValidationReport {
  task: string
  rulesMatched: number
  rulesTotal: number
  results: ValidationResult[]
  summary: ValidationSummary
  status: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED"
}

export interface AuditEntry {
  id: string
  orgId: string
  projectId?: string | null
  userId?: string | null
  action: string
  ruleId?: string | null
  status: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface AuditCreateInput {
  orgId: string
  projectId?: string
  userId?: string
  action: string
  ruleId?: string
  status: string
  metadata?: Record<string, unknown>
}

export interface AuditListOptions {
  orgId?: string
  projectId?: string
  action?: string
  since?: string
  until?: string
  limit?: number
  offset?: number
}

export interface ComplianceTrend {
  score: number
  passCount: number
  violatedCount: number
  notCoveredCount: number
  date: string
}

export interface ComplianceData {
  projectId: string
  currentScore: number | null
  trend: ComplianceTrend[]
}

export interface ComplianceSnapshot {
  id: string
  projectId: string
  score: number
  passCount: number
  violatedCount: number
  notCoveredCount: number
  snapshotAt: string
}

export interface ComplianceSnapshotInput {
  score: number
  passCount?: number
  violatedCount?: number
  notCoveredCount?: number
}

export interface SyncRule extends Rule {
  updatedAt: string
}

export interface SyncMeta {
  total: number
  versionHash: string
  syncedAt: string
}

export interface SyncResponse {
  data: SyncRule[]
  meta: SyncMeta
}

export interface SyncOptions {
  project?: string
  stack?: string
  since?: string
}

export interface SyncAckInput {
  projectId: string
  ruleVersionHash: string
}

export interface SyncAckResult {
  synced: boolean
}

export interface ApiToken {
  id: string
  orgId: string
  userId: string
  name: string
  tokenPrefix: string
  scopes: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface TokenCreateInput {
  orgId: string
  userId: string
  name: string
  scopes?: string[]
  expiresAt?: string
}

export interface CreatedApiToken {
  id: string
  name: string
  token: string
  prefix: string
  scopes: string[]
  expiresAt: string | null
  createdAt: string
}

export interface TopViolation {
  ruleId: string | null
  count: number
}

export interface AnalyticsReadOptions {
  projectId?: string
  since?: string
  limit?: number
}

export interface AnalyticsTrend {
  projectId: string
  interval: string
  trend: ComplianceTrend[]
}

export interface AnalyticsCategoryBreakdown {
  action: string
  count: number
}

export interface AnalyticsSourceStat {
  status: string
  count: number
}

export interface WebhookEndpoint {
  id: string
  orgId: string
  url: string
  events: string[]
  isActive: boolean
  description: string | null
  createdAt: string
  updatedAt: string
  secret?: string
  secretPrefix?: string
}

export interface WebhookEndpointCreateInput {
  orgId: string
  url: string
  secret: string
  events: string[]
  description?: string
}

export interface WebhookEndpointUpdateInput {
  url?: string
  secret?: string
  events?: string[]
  description?: string
  isActive?: boolean
}

export interface WebhookDelivery {
  id: string
  endpointId: string
  event: string
  payload?: Record<string, unknown>
  status: string
  responseCode: number | null
  responseBody?: string | null
  attempts: number
  nextRetryAt?: string | null
  createdAt: string
}

export interface DeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
}

export interface WebhookEndpointListOptions {
  orgId?: string
}

export interface WebhookDeliveryListOptions {
  endpointId?: string
  limit?: number
}

export class RuleboundError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: string
  ) {
    super(message)
    this.name = "RuleboundError"
  }
}

export interface RuleboundClientOptions {
  apiKey: string
  serverUrl?: string
  timeout?: number
}

type QueryValue = string | number | boolean | null | undefined

export class RuleboundClient {
  private readonly serverUrl: string
  private readonly apiKey: string
  private readonly timeout: number

  constructor(options: RuleboundClientOptions) {
    this.serverUrl = (options.serverUrl ?? "http://localhost:3001").replace(/\/$/, "")
    this.apiKey = options.apiKey
    this.timeout = options.timeout ?? 30_000
  }

  async validate(request: ValidationRequest): Promise<ValidationReport> {
    return this.requestJson<ValidationReport>("POST", "/v1/validate", { body: request })
  }

  async listRules(options?: RuleListOptions): Promise<ListResponse<Rule>> {
    return this.requestJson<ListResponse<Rule>>("GET", "/v1/rules", { query: this.mapRuleListOptions(options) })
  }

  async getRules(options?: RuleListOptions): Promise<Rule[]> {
    return (await this.listRules(options)).data
  }

  async getRule(ruleId: string): Promise<Rule> {
    const response = await this.requestJson<DataResponse<Rule>>("GET", `/v1/rules/${encodeURIComponent(ruleId)}`)
    return response.data
  }

  async createRule(input: RuleCreateInput): Promise<Rule> {
    const response = await this.requestJson<DataResponse<Rule>>("POST", "/v1/rules", { body: input })
    return response.data
  }

  async updateRule(ruleId: string, input: RuleUpdateInput): Promise<Rule> {
    const response = await this.requestJson<DataResponse<Rule>>("PUT", `/v1/rules/${encodeURIComponent(ruleId)}`, { body: input })
    return response.data
  }

  async deleteRule(ruleId: string): Promise<DeleteResult> {
    const response = await this.requestJson<DataResponse<DeleteResult>>("DELETE", `/v1/rules/${encodeURIComponent(ruleId)}`)
    return response.data
  }

  async listProjects(): Promise<ListResponse<Project>> {
    return this.requestJson<ListResponse<Project>>("GET", "/v1/projects")
  }

  async getProject(projectId: string): Promise<Project> {
    const response = await this.requestJson<DataResponse<Project>>("GET", `/v1/projects/${encodeURIComponent(projectId)}`)
    return response.data
  }

  async createProject(input: ProjectCreateInput): Promise<Project> {
    const response = await this.requestJson<DataResponse<Project>>("POST", "/v1/projects", { body: input })
    return response.data
  }

  async updateProject(projectId: string, input: ProjectUpdateInput): Promise<Project> {
    const response = await this.requestJson<DataResponse<Project>>("PUT", `/v1/projects/${encodeURIComponent(projectId)}`, { body: input })
    return response.data
  }

  async deleteProject(projectId: string): Promise<DeleteResult> {
    const response = await this.requestJson<DataResponse<DeleteResult>>("DELETE", `/v1/projects/${encodeURIComponent(projectId)}`)
    return response.data
  }

  async listAudit(options?: AuditListOptions): Promise<ListResponse<AuditEntry>> {
    return this.requestJson<ListResponse<AuditEntry>>("GET", "/v1/audit", { query: this.mapAuditListOptions(options) })
  }

  async getAudit(options?: AuditListOptions): Promise<AuditEntry[]> {
    return (await this.listAudit(options)).data
  }

  async createAudit(input: AuditCreateInput): Promise<AuditEntry> {
    const response = await this.requestJson<DataResponse<AuditEntry>>("POST", "/v1/audit", { body: input })
    return response.data
  }

  async exportAudit(options?: AuditListOptions): Promise<string> {
    return this.requestText("GET", "/v1/audit/export", { query: this.mapAuditListOptions(options) })
  }

  async getCompliance(projectId: string, options?: { since?: string; limit?: number }): Promise<ComplianceData> {
    const response = await this.requestJson<DataResponse<ComplianceData>>(
      "GET",
      `/v1/compliance/${encodeURIComponent(projectId)}`,
      { query: options }
    )
    return response.data
  }

  async createComplianceSnapshot(projectId: string, input: ComplianceSnapshotInput): Promise<ComplianceSnapshot> {
    const response = await this.requestJson<DataResponse<ComplianceSnapshot>>(
      "POST",
      `/v1/compliance/${encodeURIComponent(projectId)}/snapshot`,
      { body: input }
    )
    return response.data
  }

  async syncRules(options?: SyncOptions): Promise<SyncResponse> {
    return this.requestJson<SyncResponse>("GET", "/v1/sync", {
      query: {
        project: options?.project,
        stack: options?.stack,
        since: options?.since,
      },
    })
  }

  async ackSync(input: SyncAckInput): Promise<SyncAckResult> {
    const response = await this.requestJson<DataResponse<SyncAckResult>>("POST", "/v1/sync/ack", { body: input })
    return response.data
  }

  async listTokens(options?: { orgId?: string }): Promise<ApiToken[]> {
    const response = await this.requestJson<DataResponse<ApiToken[]>>("GET", "/v1/tokens", {
      query: { org_id: options?.orgId },
    })
    return response.data
  }

  async createToken(input: TokenCreateInput): Promise<CreatedApiToken> {
    const response = await this.requestJson<DataResponse<CreatedApiToken>>("POST", "/v1/tokens", { body: input })
    return response.data
  }

  async deleteToken(tokenId: string): Promise<DeleteResult> {
    const response = await this.requestJson<DataResponse<DeleteResult>>("DELETE", `/v1/tokens/${encodeURIComponent(tokenId)}`)
    return response.data
  }

  async getTopViolations(options?: AnalyticsReadOptions): Promise<TopViolation[]> {
    const response = await this.requestJson<DataResponse<TopViolation[]>>("GET", "/v1/analytics/top-violations", {
      query: this.mapAnalyticsReadOptions(options),
    })
    return response.data
  }

  async getAnalyticsTrend(projectId: string, options?: { interval?: string; limit?: number }): Promise<AnalyticsTrend> {
    const response = await this.requestJson<DataResponse<AnalyticsTrend>>("GET", "/v1/analytics/trend", {
      query: {
        project_id: projectId,
        interval: options?.interval,
        limit: options?.limit,
      },
    })
    return response.data
  }

  async getCategoryBreakdown(options?: AnalyticsReadOptions): Promise<AnalyticsCategoryBreakdown[]> {
    const response = await this.requestJson<DataResponse<AnalyticsCategoryBreakdown[]>>(
      "GET",
      "/v1/analytics/category-breakdown",
      { query: this.mapAnalyticsReadOptions(options) }
    )
    return response.data
  }

  async getSourceStats(options?: AnalyticsReadOptions): Promise<AnalyticsSourceStat[]> {
    const response = await this.requestJson<DataResponse<AnalyticsSourceStat[]>>("GET", "/v1/analytics/source-stats", {
      query: this.mapAnalyticsReadOptions(options),
    })
    return response.data
  }

  async listWebhookEndpoints(options?: WebhookEndpointListOptions): Promise<WebhookEndpoint[]> {
    const response = await this.requestJson<DataResponse<WebhookEndpoint[]>>("GET", "/v1/webhooks/endpoints", {
      query: { org_id: options?.orgId },
    })
    return response.data
  }

  async getWebhookEndpoint(endpointId: string): Promise<WebhookEndpoint> {
    const response = await this.requestJson<DataResponse<WebhookEndpoint>>("GET", `/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`)
    return response.data
  }

  async createWebhookEndpoint(input: WebhookEndpointCreateInput): Promise<WebhookEndpoint> {
    const response = await this.requestJson<DataResponse<WebhookEndpoint>>("POST", "/v1/webhooks/endpoints", { body: input })
    return response.data
  }

  async updateWebhookEndpoint(endpointId: string, input: WebhookEndpointUpdateInput): Promise<WebhookEndpoint> {
    const response = await this.requestJson<DataResponse<WebhookEndpoint>>(
      "PUT",
      `/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`,
      { body: input }
    )
    return response.data
  }

  async deleteWebhookEndpoint(endpointId: string): Promise<DeleteResult> {
    const response = await this.requestJson<DataResponse<DeleteResult>>("DELETE", `/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`)
    return response.data
  }

  async testWebhookEndpoint(endpointId: string): Promise<DeliveryResult> {
    const response = await this.requestJson<DataResponse<DeliveryResult>>(
      "POST",
      `/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}/test`
    )
    return response.data
  }

  async listWebhookDeliveries(options?: WebhookDeliveryListOptions): Promise<WebhookDelivery[]> {
    const response = await this.requestJson<DataResponse<WebhookDelivery[]>>("GET", "/v1/webhooks/deliveries", {
      query: {
        endpoint_id: options?.endpointId,
        limit: options?.limit,
      },
    })
    return response.data
  }

  private async requestJson<T>(
    method: string,
    path: string,
    options?: { body?: unknown; query?: Record<string, QueryValue> }
  ): Promise<T> {
    const response = await this.request(method, path, options)
    return response.json() as Promise<T>
  }

  private async requestText(
    method: string,
    path: string,
    options?: { body?: unknown; query?: Record<string, QueryValue> }
  ): Promise<string> {
    const response = await this.request(method, path, options)
    return response.text()
  }

  private async request(
    method: string,
    path: string,
    options?: { body?: unknown; query?: Record<string, QueryValue> }
  ): Promise<Response> {
    const response = await fetch(`${this.serverUrl}${path}${buildQuery(options?.query)}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "rulebound-js/0.1.0",
      },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new RuleboundError(`API error ${response.status}`, response.status, text)
    }

    return response
  }

  private mapRuleListOptions(options?: RuleListOptions): Record<string, QueryValue> | undefined {
    if (!options) return undefined
    return {
      stack: options.stack,
      category: options.category,
      tag: options.tag,
      q: options.q,
      limit: options.limit,
      offset: options.offset,
    }
  }

  private mapAuditListOptions(options?: AuditListOptions): Record<string, QueryValue> | undefined {
    if (!options) return undefined
    return {
      org_id: options.orgId,
      project_id: options.projectId,
      action: options.action,
      since: options.since,
      until: options.until,
      limit: options.limit,
      offset: options.offset,
    }
  }

  private mapAnalyticsReadOptions(options?: AnalyticsReadOptions): Record<string, QueryValue> | undefined {
    if (!options) return undefined
    return {
      project_id: options.projectId,
      since: options.since,
      limit: options.limit,
    }
  }
}

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return ""
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ""
}

export function isViolated(report: ValidationReport): boolean {
  return report.status === "FAILED"
}

export function getViolations(report: ValidationReport): ValidationResult[] {
  return report.results.filter((result) => result.status === "VIOLATED")
}
