import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Alias workspace deps to their TypeScript source so CLI tests do not require
// a prior `pnpm --filter @rulebound/engine build`. Production builds and the
// published bin still use the dist artifacts via package exports.
const engineSrc = fileURLToPath(new URL("../engine/src/index.ts", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@rulebound/engine": engineSrc,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      thresholds: { lines: 80 },
    },
  },
})
