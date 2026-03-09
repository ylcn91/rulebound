import path from "node:path";

export default {
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    exclude: ["__tests__/css-variables.test.ts"],
  },
};
