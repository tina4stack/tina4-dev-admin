/**
 * Second Vite build for the customer-facing feedback widget.
 *
 * Separate from the dev-admin SPA build (~1MB; loads the editor,
 * file tree, etc) because this bundle ships to END USERS of every
 * Tina4 app that has TINA4_FEEDBACK_WHITELIST set. Has to stay
 * tiny — target ≤8KB minified — and must NOT pull anything from
 * the dev-admin codebase (CodeMirror, etc).
 *
 * Built into dist/tina4-feedback-widget.js. The Python framework
 * copies it to tina4_python/public/__feedback/widget.js, which is
 * served by _api_feedback_widget_js to whitelisted page loads.
 *
 * Build:  npm run build  (chains both configs via package.json scripts)
 * Or:     npx vite build --config vite.feedback.config.ts
 */
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/feedback/widget.ts"),
      name: "Tina4FeedbackWidget",
      fileName: () => "tina4-feedback-widget.js",
      formats: ["iife"],
    },
    outDir: "dist",
    emptyOutDir: false, // keep tina4-dev-admin.js from the first build
    minify: true,
    target: "es2020",
  },
});
