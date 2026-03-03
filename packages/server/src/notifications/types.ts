export interface NotificationPayload {
  event: string
  title: string
  message: string
  severity?: "error" | "warning" | "info"
  project?: string
  rule?: string
  score?: number
  url?: string
  metadata?: Record<string, unknown>
}

export interface NotificationResult {
  success: boolean
  provider: string
  error?: string
}

export interface NotificationProvider {
  readonly name: string
  send(payload: NotificationPayload): Promise<NotificationResult>
}
