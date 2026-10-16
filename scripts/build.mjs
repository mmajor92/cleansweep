// Builds dist/index.html: one self-contained file with CSS, JavaScript and facts inlined.
// Usage: node scripts/build.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const read = (p) => readFile(join(root, p), "utf8");

// Concatenate modules in dependency order, dropping import/export syntax.
// Rule for contributors: top-level names must be unique across src/*.js.
const order = ["src/format.js", "src/engine.js", "src/score.js", "src/store.js", "src/version.js", "src/site.js", "src/ui.js", "src/main.js"];
let code = "";
for (const file of order) {
  let src = await read(file);
  src = src.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)/gm, "$1");
  if (/^\s*export\s*\{/m.test(src)) throw new Error(`${file}: use "export function/const", not export lists`);
  code += `\n// ---- ${file} ----\n${src}\n`;
}

const facts = JSON.parse(await read("data/facts.json"));
const css = await read("styles.css");
let html = await read("index.html");
html = html
  .replace(/<link rel="stylesheet" href="styles.css">/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="src\/main.js"><\/script>/, `<script>\nglobalThis.__CLEANSWEEP_FACTS__ = ${JSON.stringify(facts)};\n(function () {\n${code}\n})();\n</script>`);

await mkdir(join(root, "dist"), { recursive: true });
await writeFile(join(root, "dist/index.html"), html);
console.log(`Built dist/index.html (${Math.round(html.length / 1024)} KB)`);
