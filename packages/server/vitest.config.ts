import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@rulebound/engine": resolve(__dirname, "../engine/src/index.ts"),
    },
  },
  test: {
    globals: true,
    // Integration tests live under src/__tests__/integration/** and require
    // Docker (testcontainers boots Postgres). They are opted into via the
    // dedicated vitest.integration.config.ts so the default unit run never
    // accidentally pulls in a real DB.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "src/__tests__/integration/**",
    ],
    coverage: {
      provider: "v8",
      thresholds: { lines: 80 },
    },
  },
})
