import { copyFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Copy the built bundle into every framework's public assets so
// `tina4 serve` picks up the fresh UI on next start. Each framework
// serves the same JS — the file tree API + MCP shim + session proxy
// handle the per-language details.
//
// Vite's `minify: true` (see vite.config.ts) produces a single
// minified IIFE; we deploy it to BOTH `.js` and `.min.js` filenames
// so route handlers that hard-code the `.min.js` path (e.g. the PHP
// DevAdmin loader) keep working alongside dev paths that reference
// `.js`. No separate minify step needed.

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../dist/tina4-dev-admin.js");

const targets = [
  "../../tina4-python/tina4_python/public/js/tina4-dev-admin.js",
  "../../tina4-php/src/public/js/tina4-dev-admin.js",
  "../../tina4-ruby/lib/tina4/public/js/tina4-dev-admin.js",
  "../../tina4-nodejs/packages/core/public/js/tina4-dev-admin.js",
];

if (!existsSync(src)) {
  console.error("Build first: npm run build");
  process.exit(1);
}

let ok = 0;
for (const target of targets) {
  const jsDest = resolve(__dirname, target);
  const minDest = jsDest.replace(/\.js$/, ".min.js");
  try {
    copyFileSync(src, jsDest);
    copyFileSync(src, minDest);
    console.log(`Deployed → ${target} (+ .min.js)`);
    ok++;
  } catch (e) {
    console.warn(`Skip ${target}: ${e.message}`);
  }
}

console.log(`\n${ok}/${targets.length} frameworks updated.`);
