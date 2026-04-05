import { copyFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../dist/tina4-dev-admin.js");

const targets = [
  "../tina4-python/tina4_python/public/js/tina4-dev-admin.js",
  "../tina4-php/src/public/js/tina4-dev-admin.js",
  "../tina4-ruby/lib/tina4/public/js/tina4-dev-admin.js",
  "../tina4-nodejs/packages/core/public/js/tina4-dev-admin.js",
];

if (!existsSync(src)) {
  console.error("Build first: npm run build");
  process.exit(1);
}

for (const target of targets) {
  const dest = resolve(__dirname, target);
  try {
    copyFileSync(src, dest);
    console.log(`Deployed → ${target}`);
  } catch (e) {
    console.warn(`Skip ${target}: ${e.message}`);
  }
}
