import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Chat/agent calls go to the Rust agent server
      "/__dev/api/execute": {
        target: "http://localhost:9145",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/execute", "/execute"),
      },
      "/__dev/api/chat": {
        target: "http://localhost:9145",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/chat", "/chat"),
      },
      "/__dev/api/thoughts": {
        target: "http://localhost:9145",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/thoughts", "/thoughts"),
      },
      "/__dev/api/agents": {
        target: "http://localhost:9145",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/agents", "/agents"),
      },
      "/__dev/api/history": {
        target: "http://localhost:9145",
        changeOrigin: true,
        rewrite: (path: string) => path.replace("/__dev/api/history", "/history"),
      },
      // All other dev admin API calls go to the framework backend
      "/__dev/api": {
        target: "http://localhost:7200",
        changeOrigin: true,
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
