import { defineConfig } from "vite";
import { resolve } from "path";

// Target a specific tina4 backend when running `npm run dev`. The
// defaults match the Python stack (`tina4 serve` in tina4-fresh-python)
// but any framework works:
//   PHP:    TINA4_BACKEND=http://localhost:7145 TINA4_AGENT=http://localhost:9145 npm run dev
//   Python: TINA4_BACKEND=http://localhost:7202 TINA4_AGENT=http://localhost:9202 npm run dev
//   Ruby:   TINA4_BACKEND=http://localhost:7147 TINA4_AGENT=http://localhost:9147 npm run dev
//   Node:   TINA4_BACKEND=http://localhost:7148 TINA4_AGENT=http://localhost:9148 npm run dev
//
// Rule of thumb (matches `tina4 serve` CLI convention): agent port =
// framework port + 2000.
const backend = process.env.TINA4_BACKEND || "http://localhost:7202";
const agent   = process.env.TINA4_AGENT   || "http://localhost:9202";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Chat/agent calls go to the Rust agent server
      "/__dev/api/execute": {
        target: agent,
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/execute", "/execute"),
      },
      "/__dev/api/chat": {
        target: agent,
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/chat", "/chat"),
      },
      "/__dev/api/thoughts": {
        target: agent,
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/thoughts", "/thoughts"),
      },
      "/__dev/api/agents": {
        target: agent,
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/agents", "/agents"),
      },
      "/__dev/api/history": {
        target: agent,
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/history", "/history"),
      },
      // Supervisor session lifecycle — git worktree + branch management.
      "/__dev/api/supervise": {
        target: agent,
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/supervise", "/supervise"),
      },
      // All other dev admin API calls go to the framework backend
      "/__dev/api": {
        target: backend,
        changeOrigin: true,
      },
      // Live-reload WebSocket — framework owns it at /__dev_reload
      "/__dev_reload": {
        target: backend,
        ws: true,
        changeOrigin: true,
      },
      // ── Five-model stack on andrevanzuydam.com (41.71.84.173) ─────
      //   /ai      → 11437 Qwen2.5-Coder-14B @ 45K YaRN (chat + FIM)
      //   /vision  → 11434 Qwen2.5-VL-7B       (image understanding)
      //   /embed   → 11435 nomic-embed-text    (semantic retrieval)
      //   /image   → 11436 SDXL Turbo          (diffusion)
      //   /rag     → 11438 tina4-rag           (framework docs)
      // Proxied so the browser stays same-origin (no CORS friction)
      // and so swapping the backing host is a one-line change here.
      "/ai": {
        target: "http://41.71.84.173:11437",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/ai/, ""),
      },
      "/vision": {
        target: "http://41.71.84.173:11434",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/vision/, ""),
      },
      "/embed": {
        target: "http://41.71.84.173:11435",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/embed/, ""),
      },
      "/image": {
        target: "http://41.71.84.173:11436",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/image/, ""),
      },
      "/rag": {
        target: "http://41.71.84.173:11438",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rag/, ""),
      },
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/app.ts"),
      name: "Tina4DevAdmin",
      fileName: () => "tina4-dev-admin.js",
      formats: ["iife"],
    },
    outDir: "dist",
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
