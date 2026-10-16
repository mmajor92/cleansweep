// Freeze the two fixed practice puzzles into puzzles/practice-1.json and puzzles/practice-2.json.
// They are the same for everyone, forever. Run this once. After launch, do not replace them unless you mean to.
// Usage: node scripts/make-practice.mjs [--force]
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE, buildEntities, generatePractice, validatePuzzle } from "../src/engine.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const force = process.argv.includes("--force");
const entities = buildEntities(JSON.parse(await readFile(join(root, "data/facts.json"), "utf8")));
const dir = join(root, "puzzles");
await mkdir(dir, { recursive: true });

for (let n = 1; n <= PRACTICE.length; n++) {
  const file = join(dir, `practice-${n}.json`);
  const exists = await access(file).then(() => true, () => false);
  if (exists && !force) {
    console.log(`practice-${n}.json already exists. Use --force to replace it.`);
    continue;
  }
  const p = generatePractice(n, entities);
  if (!p) throw new Error(`practice ${n}: no valid puzzle for this seed`);
  const problems = validatePuzzle(p);
  if (problems.length) throw new Error(`practice ${n}: ${problems.join("; ")}`);
  if (n === 1 && !(p.warmUp && !p.deepCut)) throw new Error("practice 1 should open with a Warm-up and have no Deep cut");
  if (n === 2 && !(p.deepCut && !p.warmUp)) throw new Error("practice 2 should have a Deep cut and no Warm-up");
  await writeFile(file, JSON.stringify(p, null, 2) + "\n");
  console.log(`Wrote puzzles/practice-${n}.json`);
}
