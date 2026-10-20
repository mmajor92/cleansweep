// The same object never appears on two days running, so the same question never comes two days in a row.
import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { RULES, avoidAfter, generate, generateSeries, normalizePuzzle, objectsOf, questionsOf, seedForPuzzle, validatePuzzle } from "../src/engine.js";
import { entities } from "./helpers.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const shared = (a, b) => [...a].filter((x) => b.has(x));
const saved = (dir, n) => normalizePuzzle(JSON.parse(readFileSync(join(dir, "puzzles", `${n}.json`), "utf8")));

test("no object appears on two days running, over a whole year, so no question repeats either", () => {
  const series = generateSeries(1, 365, entities);
  for (let i = 1; i < series.length; i++) {
    assert.deepEqual(shared(objectsOf(series[i]), objectsOf(series[i - 1])), [], `puzzles ${series[i - 1].num} and ${series[i].num}`);
    const earlier = new Set(questionsOf(series[i - 1]).map((x) => `${x.cat}:${x.prev.ent}>${x.item.ent}`));
    assert.ok(!questionsOf(series[i]).some((x) => earlier.has(`${x.cat}:${x.prev.ent}>${x.item.ent}`)), `puzzles ${series[i - 1].num} and ${series[i].num} share a question`);
  }
});

test("objectsOf lists the starting object, every question and every bridge, for new puzzles and older two-half ones", () => {
  const p = generate(seedForPuzzle(9), entities, { bridges: 2 });
  const asked = questionsOf(p).map((x) => x.item.ent);
  assert.deepEqual([...objectsOf(p)].sort(), [...new Set([p.legs[0].anchor.ent, ...asked])].sort());
  assert.ok(p.bridges.every((id) => objectsOf(p).has(id)));
  const old = JSON.parse(readFileSync(join(root, "puzzles", "1.json"), "utf8"));
  assert.equal(objectsOf(old).size, 8, "one start, seven questions, the bridge being one of them");
});

test("avoid keeps the listed objects out of a puzzle", () => {
  const base = generate(seedForPuzzle(7), entities);
  const other = generate(seedForPuzzle(7), entities, { avoid: [...objectsOf(base)] });
  assert.deepEqual(validatePuzzle(other), []);
  assert.deepEqual(shared(objectsOf(base), objectsOf(other)), []);
});

test("if the list to avoid is impossible, a puzzle is still built as a last resort rather than none", () => {
  const p = generate(seedForPuzzle(12), entities, { avoid: entities.map((e) => e.id) });
  assert.ok(p, "a puzzle must always be built");
  assert.deepEqual(validatePuzzle(p), []);
});

test("avoidAfter takes the objects of the last noRepeatDays days, and the rule can be stretched", () => {
  const days = [new Set(["a"]), new Set(["b"]), new Set(["c"])];
  assert.deepEqual(avoidAfter(days), ["c"], "one day by default");
  const was = RULES.noRepeatDays;
  RULES.noRepeatDays = 2;
  try {
    assert.deepEqual(avoidAfter(days).sort(), ["b", "c"]);
  } finally {
    RULES.noRepeatDays = was;
  }
  assert.deepEqual(avoidAfter([]), []);
});

test("saved puzzles from the first one under the rule never repeat an object from the day before", () => {
  const nums = readdirSync(join(root, "puzzles")).filter((f) => /^\d+\.json$/.test(f)).map((f) => parseInt(f)).sort((a, b) => a - b);
  let checked = 0;
  for (const n of nums) {
    if (n < RULES.noRepeatFrom || !nums.includes(n - 1)) continue;
    assert.deepEqual(shared(objectsOf(saved(root, n)), objectsOf(saved(root, n - 1))), [], `puzzles ${n - 1} and ${n}`);
    checked++;
  }
  assert.ok(checked >= 15, `only ${checked} saved pairs were checked`);
});

test("the freezing script reads yesterday's saved puzzle, so the next batch does not repeat it either", () => {
  const dir = mkdtempSync(join(tmpdir(), "cleansweep-"));
  try {
    for (const f of ["src", "scripts", "data", "puzzles", "package.json"]) cpSync(join(root, f), join(dir, f), { recursive: true });
    const last = Math.max(...readdirSync(join(dir, "puzzles")).filter((f) => /^\d+\.json$/.test(f)).map((f) => parseInt(f)));
    execFileSync("node", ["scripts/generate.mjs", "--from", String(last + 1), "--days", "6"], { cwd: dir, stdio: "pipe" });
    for (let n = last + 1; n <= last + 6; n++) {
      assert.deepEqual(shared(objectsOf(saved(dir, n)), objectsOf(saved(dir, n - 1))), [], `puzzles ${n - 1} and ${n}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
