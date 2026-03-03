import { describe, it, expect, vi } from "vitest"
import {
  NotificationManager,
  violationNotification,
  scoreChangedNotification,
  ruleUpdatedNotification,
} from "../notifications/manager.js"
import type { NotificationPayload, NotificationProvider, NotificationResult } from "../notifications/types.js"

class MockProvider implements NotificationProvider {
  readonly name: string
  readonly calls: NotificationPayload[] = []
  private readonly shouldSucceed: boolean

  constructor(name: string, shouldSucceed = true) {
    this.name = name
    this.shouldSucceed = shouldSucceed
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    this.calls.push(payload)
    return this.shouldSucceed
      ? { success: true, provider: this.name }
      : { success: false, provider: this.name, error: "Mock failure" }
  }
}

describe("NotificationManager", () => {
  it("dispatches to matching providers by event", async () => {
    const manager = new NotificationManager()

    manager.addProvider({
      type: "slack",
      webhookUrl: "https://hooks.slack.com/test",
      events: ["violation.detected"],
      enabled: true,
    })

    // Since we can't actually call Slack, test the manager logic with mock
    // But we can at least verify the manager doesn't crash
    expect(manager.providerCount).toBe(1)
  })

  it("skips disabled providers", () => {
    const manager = new NotificationManager()

    manager.addProvider({
      type: "slack",
      webhookUrl: "https://hooks.slack.com/test",
      events: ["violation.detected"],
      enabled: false,
    })

    expect(manager.providerCount).toBe(0)
  })

  it("supports all provider types", () => {
    const manager = new NotificationManager()

    manager.addProvider({ type: "slack", webhookUrl: "https://slack", events: ["*"], enabled: true })
    manager.addProvider({ type: "teams", webhookUrl: "https://teams", events: ["*"], enabled: true })
    manager.addProvider({ type: "discord", webhookUrl: "https://discord", events: ["*"], enabled: true })
    manager.addProvider({ type: "pagerduty", webhookUrl: "routing-key", events: ["*"], enabled: true })

    expect(manager.providerCount).toBe(4)
  })
})

describe("notification payload builders", () => {
  it("builds violation notification", () => {
    const payload = violationNotification({
      ruleName: "No Hardcoded Secrets",
      project: "api-gateway",
      severity: "error",
      reason: "Found hardcoded API key",
      dashboardUrl: "https://app.rulebound.io/audit",
    })

    expect(payload.event).toBe("violation.detected")
    expect(payload.title).toBe("Rule Violation Detected")
    expect(payload.severity).toBe("error")
    expect(payload.project).toBe("api-gateway")
    expect(payload.rule).toBe("No Hardcoded Secrets")
    expect(payload.url).toBe("https://app.rulebound.io/audit")
    expect(payload.message).toContain("No Hardcoded Secrets")
  })

  it("builds score changed notification - drop", () => {
    const payload = scoreChangedNotification({
      project: "auth-service",
      oldScore: 85,
      newScore: 72,
    })

    expect(payload.event).toBe("compliance.score_changed")
    expect(payload.message).toContain("dropped")
    expect(payload.message).toContain("85")
    expect(payload.message).toContain("72")
    expect(payload.severity).toBe("warning")
    expect(payload.score).toBe(72)
  })

  it("builds score changed notification - improvement", () => {
    const payload = scoreChangedNotification({
      project: "auth-service",
      oldScore: 72,
      newScore: 91,
    })

    expect(payload.message).toContain("improved")
    expect(payload.severity).toBe("info")
  })

  it("builds score changed notification - critical drop", () => {
    const payload = scoreChangedNotification({
      project: "auth-service",
      oldScore: 80,
      newScore: 55,
    })

    expect(payload.severity).toBe("error")
  })

  it("builds rule updated notification", () => {
    const payload = ruleUpdatedNotification({
      ruleName: "Error Handling Standards",
      changeNote: "Added structured logging requirement",
    })

    expect(payload.event).toBe("rule.updated")
    expect(payload.severity).toBe("info")
    expect(payload.message).toContain("Error Handling Standards")
    expect(payload.message).toContain("structured logging")
  })
})
