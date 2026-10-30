import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["games/**/*.test.ts", "lib/**/*.test.ts", "tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["games/**/logic.ts", "games/**/generator.ts", "games/**/solver.ts", "lib/rewards/**", "lib/rating/**", "lib/streaks/**", "lib/leagues/**"],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 },
    },
  },
});
