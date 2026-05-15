import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/db/migrate.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  external: ["@rulebound/engine"],
})
