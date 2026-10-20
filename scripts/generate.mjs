// Freeze upcoming puzzles into puzzles/<number>.json so later fact edits never change a published day.
// Usage: node scripts/generate.mjs --from 1 --days 30 [--force]
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULES, avoidAfter, buildEntities, generate, maxBridgesAfter, normalizePuzzle, objectsOf, seedForPuzzle, startCategoryFor, validatePuzzle, puzzleNumber } from "../src/engine.js";

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

// Rebuild the bridge, deep-cut and warm-up history from the puzzles that are already published.
// Puzzles published before v3 have two halves and one hinge: normalizePuzzle turns them into the same shape as new ones.
const recent = []; // one array of bridge ids per day
const recentSpice = [];
const recentWarm = [];
const recentObjects = []; // one set of object ids per day, so no object appears two days running
const deepEnt = (p) => {
  const it = p.legs.flatMap((l) => l.items).find((x) => x.fame === 1);
  return it ? it.ent : null;
};
const warmEnt = (p) => (p.warmUp ? p.legs[0].anchor.ent : null);
const readPublished = async (n) => normalizePuzzle(JSON.parse(await readFile(join(dir, `${n}.json`), "utf8")));
for (let n = Math.max(1, from - Math.max(30, RULES.freshDays)); n < from; n++) {
  if (!existing.has(n)) {
    recentObjects.push(new Set());
    continue;
  }
  const p = await readPublished(n);
  recent.push(p.bridges);
  recentSpice.push(deepEnt(p));
  recentWarm.push(warmEnt(p));
  recentObjects.push(objectsOf(p));
}

let written = 0;
for (let n = from; n < from + days; n++) {
  if (existing.has(n) && !force) {
    const p = await readPublished(n);
    recent.push(p.bridges);
    recentSpice.push(deepEnt(p));
    recentWarm.push(warmEnt(p));
    recentObjects.push(objectsOf(p));
    continue;
  }
  const p = generate(seedForPuzzle(n), entities, {
    history: recent,
    startCat: startCategoryFor(n),
    maxBridges: maxBridgesAfter(recent[recent.length - 1]),
    avoid: avoidAfter(recentObjects),
    seen: recentObjects,
    spiceHistory: recentSpice,
    warmHistory: recentWarm,
  });
  if (!p) throw new Error(`puzzle ${n}: no valid chain found`);
  const problems = validatePuzzle(p);
  if (problems.length) throw new Error(`puzzle ${n}: ${problems.join("; ")}`);
  p.num = n;
  recent.push(p.bridges);
  recentSpice.push(deepEnt(p));
  recentWarm.push(warmEnt(p));
  recentObjects.push(objectsOf(p));
  await writeFile(join(dir, `${n}.json`), JSON.stringify(p, null, 2) + "\n");
  written++;
}
console.log(`Wrote ${written} puzzle file(s) for puzzles ${from} to ${from + days - 1}. Review them, then commit.`);
