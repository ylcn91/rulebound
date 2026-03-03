import { createHmac } from "node:crypto"

export interface GitHubPushEvent {
  ref: string
  commits: Array<{
    id: string
    message: string
    added: string[]
    modified: string[]
    removed: string[]
  }>
  repository: {
    full_name: string
    html_url: string
  }
}

export interface GitHubPREvent {
  action: string
  pull_request: {
    number: number
    title: string
    body: string | null
    head: { ref: string; sha: string }
    base: { ref: string }
  }
  repository: {
    full_name: string
    html_url: string
  }
}

export type InboundEvent =
  | { provider: "github"; type: "push"; payload: GitHubPushEvent }
  | { provider: "github"; type: "pull_request"; payload: GitHubPREvent }
  | { provider: "gitlab"; type: string; payload: Record<string, unknown> }
  | { provider: "generic"; type: string; payload: Record<string, unknown> }

export function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

export function parseGitHubEvent(eventType: string, payload: Record<string, unknown>): InboundEvent | null {
  if (eventType === "push") {
    return { provider: "github", type: "push", payload: payload as unknown as GitHubPushEvent }
  }
  if (eventType === "pull_request") {
    return { provider: "github", type: "pull_request", payload: payload as unknown as GitHubPREvent }
  }
  return null
}
