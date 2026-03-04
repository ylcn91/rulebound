import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "deployment/docker",
  title: "Docker Deployment",
  description: "Running Rulebound with Docker — container images, Docker Compose, and orchestration.",
  content: `## Docker Deployment

Rulebound components can be deployed as Docker containers for consistent, reproducible deployments.

### Container Architecture

\`\`\`
                    Load Balancer
                    /           \\
            Server:3001     Gateway:4000
                    \\           /
                    PostgreSQL:5432
\`\`\`

### Dockerfile (Server)

\`\`\`dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \\
  CMD wget -q --spider http://localhost:3001/health || exit 1

CMD ["node", "packages/server/dist/index.js"]
\`\`\`

### Dockerfile (Gateway)

\`\`\`dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV GATEWAY_PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \\
  CMD wget -q --spider http://localhost:4000/health || exit 1

CMD ["node", "packages/gateway/dist/index.js"]
\`\`\`

### Docker Compose

\`\`\`yaml
version: "3.9"

services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: rulebound
      POSTGRES_USER: rulebound
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rulebound"]
      interval: 10s
      timeout: 5s
      retries: 5

  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    restart: unless-stopped
    environment:
      PORT: "3001"
      DATABASE_URL: postgresql://rulebound:\${POSTGRES_PASSWORD}@postgres:5432/rulebound
      NODE_ENV: production
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy

  gateway:
    build:
      context: .
      dockerfile: Dockerfile.gateway
    restart: unless-stopped
    environment:
      GATEWAY_PORT: "4000"
      RULEBOUND_SERVER_URL: http://server:3001
      RULEBOUND_API_KEY: \${RULEBOUND_API_KEY}
      RULEBOUND_ENFORCEMENT: \${RULEBOUND_ENFORCEMENT:-advisory}
      RULEBOUND_STACK: \${RULEBOUND_STACK:-}
      NODE_ENV: production
    ports:
      - "4000:4000"
    depends_on:
      - server

volumes:
  pgdata:
\`\`\`

### Environment File

Create a \`.env\` file for Docker Compose:

\`\`\`bash
POSTGRES_PASSWORD=your_secure_database_password
RULEBOUND_API_KEY=rb_your_api_token
RULEBOUND_ENFORCEMENT=advisory
RULEBOUND_STACK=typescript,react
\`\`\`

### Running

\`\`\`bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f server gateway

# Stop all services
docker compose down

# Reset database
docker compose down -v
\`\`\`

### Resource Limits

Set resource limits in your compose file for production:

\`\`\`yaml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M

  gateway:
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
        reservations:
          cpus: "0.1"
          memory: 64M
\`\`\`

### Kubernetes

For Kubernetes deployments, create Deployments and Services for each component:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rulebound-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rulebound-server
  template:
    metadata:
      labels:
        app: rulebound-server
    spec:
      containers:
        - name: server
          image: your-registry/rulebound-server:latest
          ports:
            - containerPort: 3001
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: rulebound-secrets
                  key: database-url
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
\`\`\`

> Both server and gateway are stateless and can be horizontally scaled behind a load balancer.
`,
}

export default doc
