import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  test: {
    // Loads .env automatically via `setupFiles` so DB tests can hit DATABASE_URL.
    setupFiles: ["./tests/setup.ts"],
    // Server tests touch a real DB; running them serially avoids cross-test interference.
    fileParallelism: false,
    // Match *.test.ts anywhere in the repo (server/, shared/, tests/).
    include: ["**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "client/**"],
  },
});
