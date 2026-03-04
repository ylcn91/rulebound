import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "deployment/self-hosted",
  title: "Self-Hosted Deployment",
  description: "Deploy the Rulebound Server and Gateway on your own infrastructure using Docker or bare Node.js.",
  content: `## Self-Hosted Deployment

Rulebound can be self-hosted on your own infrastructure. This guide covers deploying the server and gateway components.

### Components

| Component | Port | Purpose |
|-----------|------|---------|
| **Server** | 3001 | REST API, rule management, compliance |
| **Gateway** | 4000 | HTTP proxy for LLM API interception |
| **PostgreSQL** | 5432 | Database for rules, audit logs, compliance |

### Prerequisites

- Node.js 20+
- PostgreSQL 17
- pnpm (recommended) or npm

### Quick Deploy

#### 1. Set Up PostgreSQL

\`\`\`bash
# Create the database
createdb rulebound

# Set the connection string
export DATABASE_URL=postgresql://user:password@localhost:5432/rulebound
\`\`\`

#### 2. Run Database Migrations

\`\`\`bash
pnpm add @rulebound/server
npx drizzle-kit push
\`\`\`

#### 3. Start the Server

\`\`\`bash
PORT=3001 DATABASE_URL=postgresql://... npx rulebound-server
\`\`\`

#### 4. Start the Gateway

\`\`\`bash
GATEWAY_PORT=4000 \\
RULEBOUND_SERVER_URL=http://localhost:3001 \\
RULEBOUND_API_KEY=rb_your_token \\
npx rulebound-gateway
\`\`\`

### Docker Deployment

#### docker-compose.yml

\`\`\`yaml
version: "3.9"

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: rulebound
      POSTGRES_USER: rulebound
      POSTGRES_PASSWORD: your_secure_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  server:
    image: node:20-alpine
    working_dir: /app
    command: npx rulebound-server
    environment:
      PORT: "3001"
      DATABASE_URL: postgresql://rulebound:your_secure_password@postgres:5432/rulebound
    ports:
      - "3001:3001"
    depends_on:
      - postgres

  gateway:
    image: node:20-alpine
    working_dir: /app
    command: npx rulebound-gateway
    environment:
      GATEWAY_PORT: "4000"
      RULEBOUND_SERVER_URL: http://server:3001
      RULEBOUND_API_KEY: rb_your_token
      RULEBOUND_ENFORCEMENT: advisory
    ports:
      - "4000:4000"
    depends_on:
      - server

volumes:
  pgdata:
\`\`\`

\`\`\`bash
docker compose up -d
\`\`\`

### Production Checklist

- [ ] PostgreSQL with SSL enabled
- [ ] Database backups configured
- [ ] API tokens created for gateway and CI
- [ ] HTTPS/TLS termination (nginx, Caddy, or cloud LB)
- [ ] Health check monitoring on \`/health\` endpoints
- [ ] Log aggregation for server and gateway
- [ ] Webhook endpoints configured for alerts
- [ ] Resource limits set for containers

### Reverse Proxy (nginx)

\`\`\`nginx
upstream rulebound_server {
  server 127.0.0.1:3001;
}

upstream rulebound_gateway {
  server 127.0.0.1:4000;
}

server {
  listen 443 ssl;
  server_name rules.example.com;

  location / {
    proxy_pass http://rulebound_server;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}

server {
  listen 443 ssl;
  server_name gateway.example.com;

  location / {
    proxy_pass http://rulebound_gateway;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;  # Required for SSE streaming
  }
}
\`\`\`

> For the gateway, disable proxy buffering to support SSE streaming responses.

### Scaling

- **Server** — Stateless, can run multiple instances behind a load balancer
- **Gateway** — Stateless (rule cache is per-instance), can run multiple instances
- **Database** — Single PostgreSQL instance is sufficient for most deployments; use read replicas for high query volume

### Health Checks

Both the server and gateway expose health check endpoints:

\`\`\`bash
# Server
curl http://localhost:3001/health

# Gateway
curl http://localhost:4000/health
\`\`\`

Use these endpoints for load balancer health checks and uptime monitoring.
`,
}

export default doc
