import { defineConfig } from "vitest/config";
import path from "node:path";

/** API integration tests: need `supabase start` and `pnpm dev` running. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "node", include: ["tests/api/**/*.test.ts"], testTimeout: 60_000, fileParallelism: false },
});
