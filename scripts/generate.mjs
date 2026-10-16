// Freeze upcoming puzzles into puzzles/<number>.json so later fact edits never change a published day.
// Usage: node scripts/generate.mjs --from 1 --days 30 [--force]
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEntities, generate, pairForDay, seedForPuzzle, validatePuzzle, puzzleNumber } from "../src/engine.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const from = Number(arg("--from", puzzleNumber()));
const days = Number(arg("--days", 30));
const force = args.includes("--force");

const raw = JSON.parse(await readFile(join(root, "data/facts.json"), "utf8"));
const entities = buildEntities(raw);
const dir = join(root, "puzzles");
await mkdir(dir, { recursive: true });
const existing = new Set((await readdir(dir)).filter((f) => /^\d+\.json$/.test(f)).map((f) => Number(f.replace(".json", ""))));

// Rebuild the hinge, deep-cut and warm-up history from the puzzles that are already published.
const recent = [];
const recentSpice = [];
const recentWarm = [];
const deepEnt = (p) => {
  const it = [...p.seg1.items, ...p.seg2.items].find((x) => x.fame === 1);
  return it ? it.ent : null;
};
const warmEnt = (p) => (p.warmUp ? p.seg1.anchor.ent : null);
for (let n = Math.max(1, from - 30); n < from; n++) {
  if (!existing.has(n)) continue;
  const p = JSON.parse(await readFile(join(dir, `${n}.json`), "utf8"));
  recent.push(p.hinge.id);
  recentSpice.push(deepEnt(p));
  recentWarm.push(warmEnt(p));
}

let written = 0;
for (let n = from; n < from + days; n++) {
  if (existing.has(n) && !force) {
    const p = JSON.parse(await readFile(join(dir, `${n}.json`), "utf8"));
    recent.push(p.hinge.id);
    recentSpice.push(deepEnt(p));
    recentWarm.push(warmEnt(p));
    continue;
  }
  const p = generate(seedForPuzzle(n), entities, { history: recent, pair: pairForDay(n), spiceHistory: recentSpice, warmHistory: recentWarm });
  if (!p) throw new Error(`puzzle ${n}: no valid chain found`);
  const problems = validatePuzzle(p);
  if (problems.length) throw new Error(`puzzle ${n}: ${problems.join("; ")}`);
  p.num = n;
  recent.push(p.hinge.id);
  recentSpice.push(deepEnt(p));
  recentWarm.push(warmEnt(p));
  await writeFile(join(dir, `${n}.json`), JSON.stringify(p, null, 2) + "\n");
  written++;
}
console.log(`Wrote ${written} puzzle file(s) for puzzles ${from} to ${from + days - 1}. Review them, then commit.`);
