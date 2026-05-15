// Minimal in-memory fixture for the Rulebound backend. Returns canonical
// shapes the dashboard expects (see packages/server/src/api/* and the unit
// tests under apps/web/__tests__). Plain node:http so the fixture has no
// extra dependencies and can run via `node e2e/fixtures/start-stack.mjs`.
//
// CRUD operations write to in-memory maps so the same suite can create a
// rule, list it, and delete it without coordinating with Postgres. The
// fixture is **not** a substitute for the real server; the server
// integration suite at packages/server/src/__tests__/integration/** is the
// binding correctness signal for the backend.

import { createServer } from "node:http"
import { randomUUID } from "node:crypto"

const NOW = () => new Date().toISOString()

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  })
  res.end(body)
}

function unauthorized(res) {
  jsonResponse(res, 401, { error: "Authentication required" })
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"))
  } catch {
    return null
  }
}

function makeRule(input = {}) {
  return {
    id: input.id ?? randomUUID(),
    orgId: "org-e2e",
    title: input.title ?? "Sample rule",
    content: input.content ?? "Do the thing.",
    category: input.category ?? "general",
    severity: input.severity ?? "warning",
    modality: input.modality ?? "should",
    tags: input.tags ?? [],
    stack: input.stack ?? [],
    scope: input.scope ?? [],
    changeTypes: input.changeTypes ?? [],
    team: input.team ?? [],
    ruleSetId: input.ruleSetId ?? "default",
    isActive: input.isActive ?? true,
    version: input.version ?? 1,
    createdAt: NOW(),
    updatedAt: NOW(),
  }
}

function makeProject(input = {}) {
  return {
    id: input.id ?? randomUUID(),
    orgId: "org-e2e",
    name: input.name ?? "Sample project",
    slug: input.slug ?? "sample",
    description: input.description ?? null,
    repoUrl: input.repoUrl ?? null,
    stack: input.stack ?? [],
    ruleSetIds: input.ruleSetIds ?? [],
    createdAt: NOW(),
    updatedAt: NOW(),
  }
}

function makeWebhook(input = {}) {
  return {
    id: input.id ?? randomUUID(),
    orgId: "org-e2e",
    url: input.url ?? "https://example.com/hook",
    events: input.events ?? ["validation.violation"],
    description: input.description ?? null,
    isActive: true,
    createdAt: NOW(),
    updatedAt: NOW(),
  }
}

function makeAuditEntry(input = {}) {
  return {
    id: input.id ?? randomUUID(),
    orgId: "org-e2e",
    userId: input.userId ?? null,
    actor: input.actor ?? "svc_e2e",
    action: input.action ?? "validation.pass",
    status: input.status ?? "PASSED",
    ruleId: input.ruleId ?? null,
    projectId: input.projectId ?? null,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? NOW(),
  }
}

function defaultState() {
  const sampleRule = makeRule({
    id: "rule-001",
    title: "Prefer server components",
    content: "Default to React Server Components in Next.js routes.",
    severity: "error",
    modality: "must",
  })
  const sampleProject = makeProject({
    id: "project-001",
    name: "rulebound-web",
    slug: "rulebound-web",
  })
  return {
    rules: new Map([[sampleRule.id, sampleRule]]),
    projects: new Map([[sampleProject.id, sampleProject]]),
    webhooks: new Map(),
    audit: [
      makeAuditEntry({
        action: "validation.violation",
        ruleId: sampleRule.id,
        projectId: sampleProject.id,
      }),
      makeAuditEntry({ action: "validation.pass", projectId: sampleProject.id }),
      makeAuditEntry({ action: "validation.pass", projectId: sampleProject.id }),
    ],
    tokens: [
      {
        id: "token-001",
        orgId: "org-e2e",
        userId: "user-e2e",
        name: "default",
        tokenPrefix: "svc_e2e_t",
        scopes: ["audit:read", "rules:read", "validate:run"],
        expiresAt: null,
        createdAt: NOW(),
        lastUsedAt: NOW(),
      },
    ],
  }
}

export function startFixtureServer({ port = 3101, expectedToken } = {}) {
  const state = defaultState()

  const requireAuth = (req, res) => {
    const header = req.headers.authorization ?? ""
    if (!header.startsWith("Bearer ") || header.slice(7) !== expectedToken) {
      unauthorized(res)
      return false
    }
    return true
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)
    const method = req.method ?? "GET"

    if (url.pathname === "/health") {
      jsonResponse(res, 200, { status: "ok", version: "0.1.0-e2e" })
      return
    }

    if (!requireAuth(req, res)) return

    // ----- rules -----
    if (url.pathname === "/v1/rules" && method === "GET") {
      jsonResponse(res, 200, {
        data: Array.from(state.rules.values()),
        total: state.rules.size,
      })
      return
    }
    if (url.pathname === "/v1/rules" && method === "POST") {
      const body = await readJson(req)
      if (!body) return jsonResponse(res, 400, { error: "Invalid JSON" })
      const rule = makeRule(body)
      state.rules.set(rule.id, rule)
      jsonResponse(res, 201, { data: rule })
      return
    }
    {
      const match = url.pathname.match(/^\/v1\/rules\/([^/]+)$/)
      if (match) {
        const id = match[1]
        if (method === "GET") {
          const rule = state.rules.get(id)
          if (!rule) return jsonResponse(res, 404, { error: "Not found" })
          return jsonResponse(res, 200, { data: rule })
        }
        if (method === "DELETE") {
          state.rules.delete(id)
          return jsonResponse(res, 200, { ok: true })
        }
      }
    }

    // ----- projects -----
    if (url.pathname === "/v1/projects" && method === "GET") {
      jsonResponse(res, 200, {
        data: Array.from(state.projects.values()),
        total: state.projects.size,
      })
      return
    }
    if (url.pathname === "/v1/projects" && method === "POST") {
      const body = await readJson(req)
      if (!body) return jsonResponse(res, 400, { error: "Invalid JSON" })
      const project = makeProject(body)
      state.projects.set(project.id, project)
      jsonResponse(res, 201, { data: project })
      return
    }
    {
      const match = url.pathname.match(/^\/v1\/projects\/([^/]+)$/)
      if (match) {
        const id = match[1]
        if (method === "DELETE") {
          state.projects.delete(id)
          return jsonResponse(res, 200, { ok: true })
        }
      }
    }

    // ----- webhooks -----
    if (url.pathname === "/v1/webhooks" && method === "GET") {
      jsonResponse(res, 200, {
        data: Array.from(state.webhooks.values()),
        total: state.webhooks.size,
      })
      return
    }
    if (url.pathname === "/v1/webhooks" && method === "POST") {
      const body = await readJson(req)
      if (!body) return jsonResponse(res, 400, { error: "Invalid JSON" })
      // Reject obvious SSRF targets — mirrors server behaviour
      try {
        const target = new URL(String(body.url ?? ""))
        if (
          /^(127\.|10\.|169\.254\.|192\.168\.)/.test(target.hostname) ||
          target.hostname === "localhost"
        ) {
          return jsonResponse(res, 400, { error: "Unsafe webhook URL" })
        }
      } catch {
        return jsonResponse(res, 400, { error: "Invalid URL" })
      }
      const hook = makeWebhook(body)
      state.webhooks.set(hook.id, hook)
      jsonResponse(res, 201, { data: hook })
      return
    }
    {
      const match = url.pathname.match(/^\/v1\/webhooks\/([^/]+)$/)
      if (match) {
        const id = match[1]
        if (method === "DELETE") {
          state.webhooks.delete(id)
          return jsonResponse(res, 200, { ok: true })
        }
      }
    }

    // ----- audit -----
    if (url.pathname === "/v1/audit" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? state.audit.length)
      jsonResponse(res, 200, {
        data: state.audit.slice(0, limit),
        total: state.audit.length,
      })
      return
    }
    if (url.pathname === "/v1/audit/export" && method === "GET") {
      const rows = ["id,actor,action,createdAt"]
      for (const entry of state.audit) {
        rows.push(
          `${entry.id},${entry.actor},${entry.action},${entry.createdAt}`,
        )
      }
      const body = rows.join("\n") + "\n"
      res.writeHead(200, {
        "content-type": "text/csv",
        "content-disposition": "attachment; filename=audit.csv",
        "content-length": Buffer.byteLength(body),
      })
      res.end(body)
      return
    }

    // ----- tokens -----
    if (url.pathname === "/v1/tokens" && method === "GET") {
      jsonResponse(res, 200, { data: state.tokens })
      return
    }

    // ----- analytics + compliance -----
    if (url.pathname === "/v1/analytics/top-violations" && method === "GET") {
      jsonResponse(res, 200, {
        data: [
          { ruleId: "rule-001", count: 4 },
          { ruleId: "rule-001", count: 1 },
        ],
      })
      return
    }
    if (
      url.pathname === "/v1/analytics/category-breakdown" &&
      method === "GET"
    ) {
      jsonResponse(res, 200, {
        data: [
          { action: "validation.pass", count: 2 },
          { action: "validation.violation", count: 1 },
        ],
      })
      return
    }
    if (url.pathname === "/v1/analytics/source-stats" && method === "GET") {
      jsonResponse(res, 200, {
        data: [
          { source: "cli", count: 2 },
          { source: "mcp", count: 1 },
        ],
      })
      return
    }
    {
      const match = url.pathname.match(/^\/v1\/compliance\/([^/]+)$/)
      if (match && method === "GET") {
        return jsonResponse(res, 200, {
          data: {
            projectId: match[1],
            currentScore: 87,
            trend: [
              { date: "2026-05-01", score: 82 },
              { date: "2026-05-08", score: 84 },
              { date: "2026-05-15", score: 87 },
            ],
          },
        })
      }
    }

    // Default: 404
    jsonResponse(res, 404, { error: "Not found", path: url.pathname })
  })

  return new Promise((resolveStart) => {
    server.listen(port, "127.0.0.1", () => {
      resolveStart({
        close: () => new Promise((r) => server.close(() => r())),
        port,
        state,
      })
    })
  })
}
