import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "server/authentication",
  title: "Authentication",
  description: "API token authentication for the Rulebound Server — token creation, usage, scopes, and security.",
  content: `## Authentication

The Rulebound Server uses Bearer token authentication. API tokens are SHA-256 hashed and stored in PostgreSQL. Tokens support scopes and optional expiration.

### Token Format

Tokens are prefixed with \`rb_\` followed by 64 hex characters:

\`\`\`
rb_a1b2c3d4e5f6...
\`\`\`

### Creating a Token

\`\`\`bash
curl -X POST http://localhost:3001/v1/tokens \\
  -H "Content-Type: application/json" \\
  -d '{
    "orgId": "org-uuid",
    "userId": "user-uuid",
    "name": "CI Pipeline Token",
    "scopes": ["read", "validate"],
    "expiresAt": "2026-12-31T00:00:00Z"
  }'
\`\`\`

**Response:**

\`\`\`json
{
  "data": {
    "id": "token-uuid",
    "name": "CI Pipeline Token",
    "token": "rb_a1b2c3d4...",
    "prefix": "rb_a1b2c3",
    "scopes": ["read", "validate"],
    "expiresAt": "2026-12-31T00:00:00.000Z",
    "createdAt": "2026-03-04T00:00:00.000Z"
  }
}
\`\`\`

> The full \`token\` value is only returned once. Store it securely in a secrets manager or environment variable.

### Using a Token

Include the token in the \`Authorization\` header:

\`\`\`bash
curl -H "Authorization: Bearer rb_your_token_here" \\
  http://localhost:3001/v1/rules
\`\`\`

### Token Scopes

| Scope | Grants |
|-------|--------|
| \`read\` | Read rules, audit logs, compliance data |
| \`validate\` | Submit validation requests |
| \`write\` | Create and update rules |
| \`admin\` | Manage tokens, webhooks, organization settings |

### Token Lifecycle

- **Creation** — Token is generated with 32 random bytes, SHA-256 hashed for storage
- **Usage** — On each request, the token is hashed and matched against stored hashes
- **Last Used** — The \`lastUsedAt\` timestamp is updated on each authenticated request
- **Expiration** — If \`expiresAt\` is set and the date has passed, the token is rejected
- **Revocation** — Delete the token via \`DELETE /v1/tokens/:id\`

### Authentication Middleware

The server provides two middleware functions:

| Middleware | Behavior |
|-----------|----------|
| \`authMiddleware\` | Requires a valid token, returns 401 if missing/invalid |
| \`optionalAuth\` | Processes token if present, continues without auth if absent |

All \`/v1/*\` endpoints use \`optionalAuth\` by default. You can apply \`authMiddleware\` to specific routes for stricter enforcement.

### Security

- Tokens are never stored in plain text — only the SHA-256 hash is persisted
- The \`tokenPrefix\` field (first 10 characters) is stored for display/identification
- Token validation uses constant-time comparison
- Failed authentication attempts return generic error messages to prevent enumeration

### Configuring for the Gateway

Set the gateway's API key to authenticate with the server:

\`\`\`bash
RULEBOUND_SERVER_URL=http://localhost:3001
RULEBOUND_API_KEY=rb_your_token_here
\`\`\`

The gateway uses this token when fetching rules via the Sync API.
`,
}

export default doc
