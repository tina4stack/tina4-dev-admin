import { defineConfig } from "vitest/config";

// The dev-admin SPA drives the real DOM, so tests run in happy-dom and assert
// against real elements — no mocks of our own functions.
export default defineConfig({
  test: {
    environment: "happy-dom",
    environmentOptions: {happyDOM: {settings: {disableJavaScriptEvaluation: true}}},
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
