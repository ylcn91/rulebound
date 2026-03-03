export interface Rule {
  id: string
  title: string
  content: string
  category: string
  severity: string
  modality: string
  tags: string[]
  stack: string[]
  version: number
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

export interface SyncMeta {
  total: number
  versionHash: string
  syncedAt: string
}

export interface SyncResponse {
  data: Rule[]
  meta: SyncMeta
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

export class RuleboundClient {
  private readonly serverUrl: string
  private readonly apiKey: string
  private readonly timeout: number

  constructor(options: RuleboundClientOptions) {
    this.serverUrl = (options.serverUrl ?? "http://localhost:3001").replace(/\/$/, "")
    this.apiKey = options.apiKey
    this.timeout = options.timeout ?? 30_000
  }

  async validate(options: {
    code?: string
    plan?: string
    language?: string
    project?: string
    task?: string
  }): Promise<ValidationReport> {
    return this.post<ValidationReport>("/v1/validate", options)
  }

  async getRules(options?: {
    stack?: string
    category?: string
    tag?: string
  }): Promise<Rule[]> {
    const params = new URLSearchParams()
    if (options?.stack) params.set("stack", options.stack)
    if (options?.category) params.set("category", options.category)
    if (options?.tag) params.set("tag", options.tag)
    const query = params.toString()
    const resp = await this.get<{ data: Rule[] }>(`/v1/rules${query ? `?${query}` : ""}`)
    return resp.data
  }

  async syncRules(options?: {
    project?: string
    stack?: string
    since?: string
  }): Promise<SyncResponse> {
    const params = new URLSearchParams()
    if (options?.project) params.set("project", options.project)
    if (options?.stack) params.set("stack", options.stack)
    if (options?.since) params.set("since", options.since)
    const query = params.toString()
    return this.get<SyncResponse>(`/v1/sync${query ? `?${query}` : ""}`)
  }

  async getCompliance(projectId: string): Promise<ComplianceData> {
    const resp = await this.get<{ data: ComplianceData }>(`/v1/compliance/${projectId}`)
    return resp.data
  }

  async getAudit(options?: {
    orgId?: string
    projectId?: string
    action?: string
    limit?: number
  }): Promise<unknown[]> {
    const params = new URLSearchParams()
    if (options?.orgId) params.set("org_id", options.orgId)
    if (options?.projectId) params.set("project_id", options.projectId)
    if (options?.action) params.set("action", options.action)
    if (options?.limit) params.set("limit", String(options.limit))
    const query = params.toString()
    const resp = await this.get<{ data: unknown[] }>(`/v1/audit${query ? `?${query}` : ""}`)
    return resp.data
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const resp = await fetch(`${this.serverUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "rulebound-js/0.1.0",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new RuleboundError(`API error ${resp.status}`, resp.status, text)
    }

    return resp.json() as Promise<T>
  }

  private async get<T>(path: string): Promise<T> {
    const resp = await fetch(`${this.serverUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "rulebound-js/0.1.0",
      },
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new RuleboundError(`API error ${resp.status}`, resp.status, text)
    }

    return resp.json() as Promise<T>
  }
}

// Convenience helpers
export function isViolated(report: ValidationReport): boolean {
  return report.status === "FAILED"
}

export function getViolations(report: ValidationReport): ValidationResult[] {
  return report.results.filter((r) => r.status === "VIOLATED")
}
