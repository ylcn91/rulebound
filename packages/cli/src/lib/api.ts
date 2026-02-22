import type {
  Rule,
  FindRulesParams,
  ValidateResponse,
  ApiResponse,
} from "@rulebound/shared"
import { getServerUrl, getToken } from "./config.js"

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  const token = getToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  return headers
}

function buildUrl(path: string, params?: Record<string, string>): string {
  const base = getServerUrl()
  const url = new URL(path, base)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value)
      }
    }
  }

  return url.toString()
}

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(),
  })

  if (!response.ok) {
    const body = await response.text()
    return {
      success: false,
      error: `HTTP ${response.status}: ${body}`,
    }
  }

  const data = await response.json()
  return { success: true, data: data as T }
}

export async function findRules(
  params: FindRulesParams
): Promise<ApiResponse<Rule[]>> {
  const queryParams: Record<string, string> = {}

  if (params.title) queryParams.title = params.title
  if (params.category) queryParams.category = params.category
  if (params.tags) queryParams.tags = params.tags

  const url = buildUrl("/api/cli/find-rules", queryParams)
  return request<Rule[]>(url)
}

export async function validatePlan(
  plan: string
): Promise<ApiResponse<ValidateResponse>> {
  const url = buildUrl("/api/cli/validate")
  return request<ValidateResponse>(url, {
    method: "POST",
    body: JSON.stringify({ plan }),
  })
}

export async function listRules(): Promise<ApiResponse<Rule[]>> {
  const url = buildUrl("/api/cli/find-rules")
  return request<Rule[]>(url)
}

export async function getRule(id: string): Promise<ApiResponse<Rule>> {
  const url = buildUrl(`/api/rules/${id}`)
  return request<Rule>(url)
}
