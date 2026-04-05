import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
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
