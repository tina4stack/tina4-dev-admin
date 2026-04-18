import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Chat/agent calls go to the Rust agent server
      "/__dev/api/execute": {
        target: "http://localhost:9200",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/execute", "/execute"),
      },
      "/__dev/api/chat": {
        target: "http://localhost:9200",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/chat", "/chat"),
      },
      "/__dev/api/thoughts": {
        target: "http://localhost:9200",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/thoughts", "/thoughts"),
      },
      "/__dev/api/agents": {
        target: "http://localhost:9200",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/agents", "/agents"),
      },
      "/__dev/api/history": {
        target: "http://localhost:9200",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/history", "/history"),
      },
      // Supervisor session lifecycle — git worktree + branch management.
      // create/diff/commit/cancel/sessions all live on the Rust side;
      // the prefix strips to /supervise/* before the rewrite lands.
      "/__dev/api/supervise": {
        target: "http://localhost:9200",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/supervise", "/supervise"),
      },
      // All other dev admin API calls go to the framework backend
      "/__dev/api": {
        target: "http://localhost:7200",
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
