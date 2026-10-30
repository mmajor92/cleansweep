// Builds two self-contained pages, each with its CSS, JavaScript and facts inlined:
//   dist/index.html          Clean Sweep
//   dist/mystery/index.html  Mystery Thing
//   dist/lineup/index.html   Line Up
// (The real site does not use these: it serves the source files as they are. These are for trying the game from one file, and for the tests.)
// Usage: node scripts/build.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const read = (p) => readFile(join(root, p), "utf8");

// Concatenate modules in dependency order, dropping import/export syntax.
// Rule for contributors: top-level names must be unique across the files of one page. This script checks it.
// (Clean Sweep already repeats a couple of plain functions between files, which is harmless; strictFunctions turns the check on for them too.)
async function bundle(order, strictFunctions = false) {
  let code = "";
  const seen = new Map();
  for (const file of order) {
    let src = await read(file);
    src = src.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");
    src = src.replace(/^export\s+(async\s+function|function|const|let|class)/gm, "$1");
    if (/^\s*export\s*\{/m.test(src)) throw new Error(`${file}: use "export function/const", not export lists`);
    for (const m of src.matchAll(/^(async\s+function|function|const|let|class)\s+([A-Za-z0-9_$]+)/gm)) {
      const isFn = /function/.test(m[1]);
      m[1] = m[2];
      if (seen.has(m[1]) && (strictFunctions || !isFn)) throw new Error(`"${m[1]}" is declared at the top level of both ${seen.get(m[1])} and ${file}: rename one`);
      seen.set(m[1], file);
    }
    code += `\n// ---- ${file} ----\n${src}\n`;
  }
  return code;
}

// The single-file page cannot load font files from a folder, so the fonts are embedded in it. The real site loads them from src/fonts.
async function inlineFonts(css) {
  for (const m of [...css.matchAll(/url\("((?:\.\.\/)?src\/fonts\/([^"]+\.woff))"\)/g)]) {
    const data = (await readFile(join(root, "src/fonts", m[2]))).toString("base64");
    css = css.replace(m[0], `url("data:font/woff;base64,${data}")`);
  }
  return css;
}

const facts = JSON.parse(await read("data/facts.json"));
await mkdir(join(root, "dist/mystery"), { recursive: true });
await mkdir(join(root, "dist/lineup"), { recursive: true });

// ---- Clean Sweep ----
{
  const code = await bundle(["src/format.js", "src/engine.js", "src/score.js", "src/store.js", "src/version.js", "src/site.js", "src/games.js", "src/ruler.js", "src/transition.js", "src/ui.js", "src/main.js"]);
  const css = await inlineFonts(await read("styles.css"));
  let html = await read("index.html");
  html = html
    .replace(/<link rel="preload"[^>]*fonts\/[^>]*>\n?/g, "")
    .replace(/<link rel="stylesheet" href="styles.css">/, `<style>\n${css}\n</style>`)
    .replace(/<script type="module" src="src\/main.js"><\/script>/, `<script>\nglobalThis.__CLEANSWEEP_FACTS__ = ${JSON.stringify(facts)};\n(function () {\n${code}\n})();\n</script>`);
  await writeFile(join(root, "dist/index.html"), html);
  console.log(`Built dist/index.html (${Math.round(html.length / 1024)} KB)`);
}

// ---- Mystery Thing ----
{
  const days = JSON.parse(await read("data/mystery-days.json"));
  const code = await bundle(["src/version.js", "src/site.js", "src/games.js", "mystery/schedule.js", "mystery/data.js", "mystery/logic.js", "mystery/ui.js", "mystery/main.js"], true);
  const css = await inlineFonts(await read("mystery/styles.css"));
  let html = await read("mystery/index.html");
  html = html
    .replace(/<link rel="preload"[^>]*fonts\/[^>]*>\n?/g, "")
    .replace(/<link rel="stylesheet" href="styles.css">/, `<style>\n${css}\n</style>`)
    .replace(/<script type="module" src="main.js"><\/script>/, `<script>\nglobalThis.__CLEANSWEEP_FACTS__ = ${JSON.stringify(facts)};\nglobalThis.__MYSTERY_DAYS__ = ${JSON.stringify(days)};\n(function () {\n${code}\n})();\n</script>`);
  await writeFile(join(root, "dist/mystery/index.html"), html);
  console.log(`Built dist/mystery/index.html (${Math.round(html.length / 1024)} KB)`);
}

// ---- Line Up ----
{
  const days = JSON.parse(await read("data/lineup-days.json"));
  const code = await bundle(["src/version.js", "src/site.js", "src/games.js", "lineup/data.js", "lineup/schedule.js", "lineup/logic.js", "lineup/ui.js", "lineup/main.js"], true);
  const css = await inlineFonts(await read("lineup/styles.css"));
  let html = await read("lineup/index.html");
  html = html
    .replace(/<link rel="preload"[^>]*fonts\/[^>]*>\n?/g, "")
    .replace(/<link rel="stylesheet" href="styles.css">/, `<style>\n${css}\n</style>`)
    .replace(/<script type="module" src="main.js"><\/script>/, `<script>\nglobalThis.__CLEANSWEEP_FACTS__ = ${JSON.stringify(facts)};\nglobalThis.__LINEUP_DAYS__ = ${JSON.stringify(days)};\n(function () {\n${code}\n})();\n</script>`);
  await writeFile(join(root, "dist/lineup/index.html"), html);
  console.log(`Built dist/lineup/index.html (${Math.round(html.length / 1024)} KB)`);
}
