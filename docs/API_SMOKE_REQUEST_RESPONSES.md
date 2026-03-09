# API Smoke Request / Response Log

Date: 2026-03-09  
Environment: local smoke environment  
Base URL: `http://localhost:3001`  
Auth header used in examples: `Authorization: Bearer <SMOKE_TOKEN>`

This file records representative HTTP requests and responses captured during the live API smoke run.
Sensitive values such as bearer tokens are redacted.

## 1. Health Check

**Request**

```http
GET /health
```

**Response**

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

## 2. Auth Enforcement

**Request**

```http
GET /v1/rules
```

**Response**

Status: `401`

```json
{
  "error": "Missing Authorization header"
}
```

## 3. Rules List

**Request**

```http
GET /v1/rules
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": [
    {
      "id": "5b6b838a-9e31-4bba-bbeb-5c99a7eb7fe0",
      "ruleSetId": "33333333-3333-3333-3333-333333333333",
      "title": "Never hardcode secrets ever",
      "content": "Never hardcode API keys, secrets, passwords, or tokens in source code. Use environment variables.",
      "category": "security",
      "severity": "error",
      "modality": "must",
      "tags": ["secrets", "api-key"],
      "stack": ["typescript"],
      "isActive": true,
      "version": 1,
      "createdAt": "2026-03-09T01:06:08.820Z",
      "updatedAt": "2026-03-09T01:06:08.820Z"
    },
    {
      "id": "4aca5de1-783f-4b4f-a401-55ca3275ea5b",
      "ruleSetId": "33333333-3333-3333-3333-333333333333",
      "title": "No console logs in app code",
      "content": "Do not leave console.log statements in shipped code.",
      "category": "style",
      "severity": "warning",
      "modality": "should",
      "tags": ["console", "logging"],
      "stack": ["typescript"],
      "isActive": true,
      "version": 1,
      "createdAt": "2026-03-09T01:04:21.679Z",
      "updatedAt": "2026-03-09T01:04:21.679Z"
    }
  ],
  "total": 5
}
```

## 4. Projects List

**Request**

```http
GET /v1/projects
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": [
    {
      "id": "ad228f87-2482-47af-a9ef-56232e5c7916",
      "orgId": "22222222-2222-2222-2222-222222222222",
      "name": "UI E2E Project",
      "slug": "ui-e2e-project",
      "repoUrl": "https://github.com/example/ui-e2e-project",
      "stack": ["typescript", "nextjs"],
      "createdAt": "2026-03-09T01:10:26.958Z",
      "updatedAt": "2026-03-09T01:10:26.958Z",
      "ruleSetIds": []
    },
    {
      "id": "44444444-4444-4444-4444-444444444444",
      "orgId": "22222222-2222-2222-2222-222222222222",
      "name": "Smoke Project",
      "slug": "smoke-project",
      "repoUrl": "https://github.com/example/smoke-project",
      "stack": ["typescript", "nextjs", "postgres"],
      "createdAt": "2026-03-09T00:58:57.042Z",
      "updatedAt": "2026-03-09T00:58:57.042Z",
      "ruleSetIds": ["33333333-3333-3333-3333-333333333333"]
    }
  ],
  "total": 2
}
```

## 5. Validate by Project Slug

**Request**

```http
POST /v1/validate
Authorization: Bearer <SMOKE_TOKEN>
Content-Type: application/json
```

```json
{
  "project": "smoke-project",
  "plan": "Set the API key to \"sk_live_abc123\" in the config file"
}
```

**Response**

Status: `200`

```json
{
  "task": "Set the API key to \"sk_live_abc123\" in the config file",
  "rulesMatched": 2,
  "rulesTotal": 5,
  "results": [
    {
      "ruleId": "55555555-5555-5555-5555-555555555551",
      "ruleTitle": "No Hardcoded Secrets",
      "severity": "error",
      "modality": "must",
      "status": "VIOLATED",
      "reason": "Plan violates prohibition: \"literal secret value in plan\"",
      "suggestedFix": "Review rule \"No Hardcoded Secrets\" and adjust plan accordingly"
    },
    {
      "ruleId": "55555555-5555-5555-5555-555555555552",
      "ruleTitle": "Server Components by Default",
      "severity": "warning",
      "modality": "should",
      "status": "NOT_COVERED",
      "reason": "Semantic similarity 0.000 below threshold"
    },
    {
      "ruleId": "55555555-5555-5555-5555-555555555553",
      "ruleTitle": "Testing Required",
      "severity": "warning",
      "modality": "should",
      "status": "NOT_COVERED",
      "reason": "Semantic similarity 0.000 below threshold"
    },
    {
      "ruleId": "4aca5de1-783f-4b4f-a401-55ca3275ea5b",
      "ruleTitle": "No console logs in app code",
      "severity": "warning",
      "modality": "should",
      "status": "NOT_COVERED",
      "reason": "Semantic similarity 0.000 below threshold"
    },
    {
      "ruleId": "5b6b838a-9e31-4bba-bbeb-5c99a7eb7fe0",
      "ruleTitle": "Never hardcode secrets ever",
      "severity": "error",
      "modality": "must",
      "status": "VIOLATED",
      "reason": "Plan violates prohibition: \"literal secret value in plan\"",
      "suggestedFix": "Review rule \"Never hardcode secrets ever\" and adjust plan accordingly"
    }
  ],
  "summary": {
    "pass": 0,
    "violated": 2,
    "notCovered": 3
  },
  "status": "FAILED"
}
```

## 6. Compliance Read

**Request**

```http
GET /v1/compliance/smoke-project
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": {
    "projectId": "44444444-4444-4444-4444-444444444444",
    "currentScore": null,
    "trend": []
  }
}
```

## 7. Analytics: Top Violations

**Request**

```http
GET /v1/analytics/top-violations?limit=5
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": [
    {
      "ruleId": "55555555-5555-5555-5555-555555555551",
      "count": 2
    },
    {
      "ruleId": "5b6b838a-9e31-4bba-bbeb-5c99a7eb7fe0",
      "count": 2
    }
  ]
}
```

## 8. Audit List

**Request**

```http
GET /v1/audit?limit=3
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": [
    {
      "id": "f4cac896-4d15-453c-ada4-3f634b415216",
      "orgId": "22222222-2222-2222-2222-222222222222",
      "projectId": null,
      "userId": "11111111-1111-1111-1111-111111111111",
      "action": "rule.deleted",
      "ruleId": null,
      "status": "success",
      "metadata": {
        "title": "API Smoke Secret Rule",
        "ruleId": "3c05cd30-3681-418d-a546-10331e441b8a"
      },
      "createdAt": "2026-03-09T01:24:20.299Z"
    },
    {
      "id": "25407bf7-1d64-42ad-a9bb-0a98ce689e0c",
      "orgId": "22222222-2222-2222-2222-222222222222",
      "projectId": null,
      "userId": "11111111-1111-1111-1111-111111111111",
      "action": "api.smoke",
      "ruleId": null,
      "status": "success",
      "metadata": {
        "note": "manual api smoke"
      },
      "createdAt": "2026-03-09T01:24:20.270Z"
    },
    {
      "id": "12ff26d9-89c4-4dbc-9561-0cd7bbf7a900",
      "orgId": "22222222-2222-2222-2222-222222222222",
      "projectId": null,
      "userId": "11111111-1111-1111-1111-111111111111",
      "action": "sync.completed",
      "ruleId": null,
      "status": "success",
      "metadata": {
        "project": "api-smoke-project",
        "ruleVersionHash": "e886ac6830ae001d"
      },
      "createdAt": "2026-03-09T01:24:20.260Z"
    }
  ],
  "total": 3
}
```

## 9. Audit Export

**Request**

```http
GET /v1/audit/export
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```csv
id,orgId,projectId,userId,action,ruleId,status,metadata,createdAt
"8d80c867-0cde-41fc-8f93-f147ec28b0e5","22222222-2222-2222-2222-222222222222",,"11111111-1111-1111-1111-111111111111","rule.deleted",,"success","{""title"":""UI Smoke Rule"",""ruleId"":""9b7f1d55-3bfb-4538-8654-27b373786344""}","2026-03-09T01:09:13.989Z"
"e726df97-62cf-445e-be60-5727eb1c913f","22222222-2222-2222-2222-222222222222",,"11111111-1111-1111-1111-111111111111","rule.updated",,"success","{""title"":""UI Smoke Rule"",""version"":2,""changeNote"":""smoke edit""}","2026-03-09T01:08:55.618Z"
```

## 10. Webhook Endpoint Create

**Request**

```http
POST /v1/webhooks/endpoints
Authorization: Bearer <SMOKE_TOKEN>
Content-Type: application/json
```

```json
{
  "url": "http://127.0.0.1:8788/api-smoke",
  "secret": "<REDACTED_SECRET>",
  "events": ["violation.detected", "rule.updated"],
  "description": "API Smoke Receiver"
}
```

**Response**

Status: `201`

```json
{
  "data": {
    "id": "74818731-08ab-4039-b375-cb7fe588de48",
    "orgId": "22222222-2222-2222-2222-222222222222",
    "url": "http://127.0.0.1:8788/api-smoke",
    "secretHash": "supersec...",
    "events": ["violation.detected", "rule.updated"],
    "isActive": true,
    "description": "API Smoke Receiver",
    "createdAt": "2026-03-09T01:24:20.273Z",
    "updatedAt": "2026-03-09T01:24:20.273Z",
    "secret": "<REDACTED_SECRET>"
  }
}
```

## 11. Webhook Test Delivery

**Request**

```http
POST /v1/webhooks/endpoints/74818731-08ab-4039-b375-cb7fe588de48/test
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": {
    "success": true,
    "statusCode": 200
  }
}
```

### Captured receiver payload

```text
PATH=/api-smoke
HEADERS={'host': '127.0.0.1:8788', 'Content-Type': 'application/json', 'X-Rulebound-Signature': 'sha256=...', 'X-Rulebound-Event': 'violation.detected', 'X-Rulebound-Delivery': '...', 'User-Agent': 'Rulebound-Webhook/1.0'}
BODY={"event":"violation.detected","timestamp":"2026-03-08T22:12:48.501Z","data":{"test":true,"message":"This is a test webhook delivery from Rulebound"}}
```

## 12. Webhook Deliveries

**Request**

```http
GET /v1/webhooks/deliveries?endpoint_id=74818731-08ab-4039-b375-cb7fe588de48
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": [
    {
      "id": "f5f85756-7b1f-4b4d-bdb8-6f5f8d85cf53",
      "endpointId": "74818731-08ab-4039-b375-cb7fe588de48",
      "event": "test",
      "status": "delivered",
      "responseCode": 200,
      "responseBody": null,
      "attempts": 1,
      "nextRetryAt": null,
      "createdAt": "2026-03-09T01:24:20.282Z"
    }
  ]
}
```

## 13. Webhook Delete

**Request**

```http
DELETE /v1/webhooks/endpoints/74818731-08ab-4039-b375-cb7fe588de48
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": {
    "deleted": true
  }
}
```

## 14. Sync Read / Ack

**Request**

```http
GET /v1/sync?project=api-smoke-project&stack=typescript
Authorization: Bearer <SMOKE_TOKEN>
```

**Response**

Status: `200`

```json
{
  "data": [
    {
      "id": "55555555-5555-5555-5555-555555555551",
      "title": "No Hardcoded Secrets",
      "content": "Use environment variables for secrets.",
      "category": "security",
      "severity": "error",
      "modality": "must",
      "tags": ["secrets", "env"],
      "stack": ["typescript"],
      "version": 1,
      "updatedAt": "2026-03-09T00:58:57.045Z"
    }
  ],
  "meta": {
    "total": 1,
    "versionHash": "e886ac6830ae001d",
    "syncedAt": "2026-03-09T01:24:20.256Z"
  }
}
```

**Ack Request**

```http
POST /v1/sync/ack
Authorization: Bearer <SMOKE_TOKEN>
Content-Type: application/json
```

```json
{
  "projectId": "431e4c19-c70e-4db3-9eae-53dee0f94c03",
  "ruleVersionHash": "e886ac6830ae001d"
}
```

**Ack Response**

```json
{
  "data": {
    "synced": true
  }
}
```

## 15. Inbound Generic Webhook

**Request**

```http
POST /v1/webhooks/in
Content-Type: application/json
```

```json
{
  "action": "generic-smoke"
}
```

**Response**

Status: `200`

```json
{
  "received": true
}
```

## Notes

- Request examples use a redacted bearer token placeholder.
- Timestamps and UUIDs are from one local smoke run and will differ on future runs.
- The local environment required schema alignment for older `webhook_endpoints` columns before webhook API calls could succeed.
