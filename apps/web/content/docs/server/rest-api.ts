import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "server/rest-api",
  title: "REST API Reference",
  description: "Complete REST API reference for the Rulebound Server — rules, validation, audit, compliance, sync, and tokens.",
  content: `## REST API Reference

All API endpoints are prefixed with \`/v1/\` and return JSON responses.

### Rules API

#### List Rules

\`\`\`
GET /v1/rules
\`\`\`

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| \`category\` | Filter by category |
| \`tag\` | Filter by tag |
| \`stack\` | Filter by stack |
| \`q\` | Search title and content |
| \`limit\` | Max results (default: 100) |
| \`offset\` | Pagination offset (default: 0) |

**Response:**

\`\`\`json
{
  "data": [
    {
      "id": "uuid",
      "title": "No eval()",
      "content": "Never use eval() in production code...",
      "category": "security",
      "severity": "error",
      "modality": "must",
      "tags": ["security"],
      "stack": ["typescript"],
      "isActive": true,
      "version": 1
    }
  ],
  "total": 1
}
\`\`\`

#### Get Rule

\`\`\`
GET /v1/rules/:id
\`\`\`

#### Create Rule

\`\`\`
POST /v1/rules
\`\`\`

**Body:**

\`\`\`json
{
  "title": "No eval()",
  "content": "Never use eval() in production code.",
  "category": "security",
  "severity": "error",
  "modality": "must",
  "tags": ["security", "injection"],
  "stack": ["typescript", "javascript"]
}
\`\`\`

Required fields: \`title\`, \`content\`, \`category\`

#### Update Rule

\`\`\`
PUT /v1/rules/:id
\`\`\`

Updates create a version snapshot automatically. Include \`changeNote\` to describe the change.

#### Delete Rule

\`\`\`
DELETE /v1/rules/:id
\`\`\`

---

### Validate API

#### Validate Code or Plan

\`\`\`
POST /v1/validate
\`\`\`

**Body:**

\`\`\`json
{
  "plan": "Implementation plan or code to validate",
  "language": "typescript",
  "task": "Implement user authentication",
  "useLlm": false
}
\`\`\`

| Field | Required | Description |
|-------|----------|-------------|
| \`plan\` or \`code\` | Yes (one of) | Text to validate |
| \`language\` | No | Filter rules by language |
| \`task\` | No | Task context |
| \`useLlm\` | No | Enable LLM-based validation |

**Response:**

\`\`\`json
{
  "task": "Implement user authentication",
  "rulesMatched": 5,
  "rulesTotal": 12,
  "results": [
    {
      "ruleId": "uuid",
      "ruleTitle": "No eval()",
      "severity": "error",
      "modality": "must",
      "status": "VIOLATED",
      "reason": "eval() call detected",
      "suggestedFix": "Use JSON.parse() instead"
    }
  ],
  "summary": { "pass": 4, "violated": 1, "notCovered": 7 },
  "status": "FAILED"
}
\`\`\`

---

### Audit API

#### List Audit Entries

\`\`\`
GET /v1/audit
\`\`\`

| Parameter | Description |
|-----------|-------------|
| \`org_id\` | Filter by organization |
| \`project_id\` | Filter by project |
| \`action\` | Filter by action type |
| \`since\` | ISO date filter (after) |
| \`until\` | ISO date filter (before) |
| \`limit\` | Max results (default: 50) |

#### Create Audit Entry

\`\`\`
POST /v1/audit
\`\`\`

---

### Compliance API

#### Get Compliance Trend

\`\`\`
GET /v1/compliance/:projectId
\`\`\`

Returns current score and trend over time.

| Parameter | Description |
|-----------|-------------|
| \`since\` | ISO date filter |
| \`limit\` | Max snapshots (default: 30) |

#### Create Compliance Snapshot

\`\`\`
POST /v1/compliance/:projectId/snapshot
\`\`\`

**Body:**

\`\`\`json
{
  "score": 85,
  "passCount": 17,
  "violatedCount": 2,
  "notCoveredCount": 1
}
\`\`\`

---

### Sync API

#### Get Rules for Sync

\`\`\`
GET /v1/sync
\`\`\`

Used by gateways and agents to fetch current rules.

| Parameter | Description |
|-----------|-------------|
| \`stack\` | Comma-separated stack filter |
| \`since\` | Only rules updated after this date |

Returns rules with a \`versionHash\` for change detection.

#### Acknowledge Sync

\`\`\`
POST /v1/sync/ack
\`\`\`

**Body:**

\`\`\`json
{
  "projectId": "uuid",
  "ruleVersionHash": "abc123"
}
\`\`\`

---

### Tokens API

#### List Tokens

\`\`\`
GET /v1/tokens?org_id=uuid
\`\`\`

#### Create Token

\`\`\`
POST /v1/tokens
\`\`\`

**Body:**

\`\`\`json
{
  "orgId": "uuid",
  "userId": "uuid",
  "name": "CI Pipeline Token",
  "scopes": ["read", "validate"],
  "expiresAt": "2026-12-31T00:00:00Z"
}
\`\`\`

> The full token value is only returned once at creation time. Store it securely.

#### Delete Token

\`\`\`
DELETE /v1/tokens/:id
\`\`\`
`,
}

export default doc
