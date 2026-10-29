import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname, "src"),
  // `server-only` throws outside the React Server Components bundler condition.
  "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "json-summary"],
      include: ["src/server/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/server/seed.ts", "**/*.d.ts"],
      thresholds: {
        // Critical business logic is held to a higher bar than the aggregate.
        "src/lib/pricing.ts": { lines: 95, functions: 95, branches: 90 },
        "src/server/domain/**": { lines: 95, functions: 95 },
        "src/server/services/orders.ts": { lines: 75 },
        "src/server/payments/apply.ts": { lines: 75 },
        "src/server/services/inventory.ts": { lines: 80 },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/server/**/*.test.ts"],
          globalSetup: ["tests/support/mongo-global-setup.ts"],
          setupFiles: ["tests/support/integration-setup.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          pool: "forks",
          fileParallelism: true,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/ui/setup.ts"],
          globals: true,
        },
      },
    ],
  },
});
