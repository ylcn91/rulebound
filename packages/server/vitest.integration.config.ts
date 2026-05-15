import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

// Integration suite — requires Docker. Boots Postgres 17 via testcontainers
// in `test-utils/pg-setup.ts`, applies migrations, then runs the suites under
// `src/__tests__/integration/**`. Opt in with `pnpm test:integration`.
export default defineConfig({
  resolve: {
    alias: {
      "@rulebound/engine": resolve(__dirname, "../engine/src/index.ts"),
    },
  },
  test: {
    globals: true,
    include: ["src/__tests__/integration/**/*.test.ts"],
    globalSetup: ["./test-utils/pg-setup.ts"],
    hookTimeout: 120_000,
    testTimeout: 60_000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
})
