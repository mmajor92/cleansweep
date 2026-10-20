// The same question is not asked again until the others have been used. A question is two objects compared in one category,
// whichever way round. The rule only prefers and refuses: it is lifted step by step, so a puzzle always builds.
import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { CATEGORY_KEYS, generate, generateSeries, pairKey, pairsOf, questionsOf, seedForPuzzle, validatePuzzle } from "../src/engine.js";
import { entities } from "./helpers.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const fact = (ent, cat, value) => ({ ent, cat, value });

test("a question's key does not depend on which object comes first, and tells different facts apart", () => {
  const a = fact("eiffel", "count", 1665);
  const b = fact("bigben", "count", 334);
  assert.equal(pairKey(a, b), pairKey(b, a), "either way round is the same question");
  assert.notEqual(pairKey(a, b), pairKey(a, fact("bigben", "count", 335)), "a different value is a different fact");
  assert.notEqual(pairKey(a, b), pairKey(fact("eiffel", "count", 2500000), b), "an object's other number is a different question");
  assert.notEqual(pairKey(fact("x", "weight", 5), fact("y", "weight", 6)), pairKey(fact("x", "length", 5), fact("y", "length", 6)), "and so is another category");
});

test("every published puzzle, in either shape, lists one key per question", () => {
  const files = readdirSync(join(root, "puzzles")).filter((f) => /^\d+\.json$/.test(f));
  assert.ok(files.length >= 24);
  for (const f of files) {
    const p = JSON.parse(readFileSync(join(root, "puzzles", f), "utf8"));
    const keys = pairsOf(p);
    assert.equal(keys.length, questionsOf(p).length, f);
    assert.equal(new Set(keys).size, keys.length, `${f}: a question twice in one puzzle`);
    assert.ok(keys.every((k) => k.includes("~")), f);
  }
});

const repeatsIn = (series) => {
  const seen = new Set();
  let repeats = 0;
  let first = null;
  series.forEach((p, i) => {
    const keys = pairsOf(p);
    for (const k of keys) if (seen.has(k)) (repeats++, (first ??= i + 1));
    keys.forEach((k) => seen.add(k));
  });
  return { repeats, first };
};

test("with the rule no question comes back for months; without it questions repeat within weeks", () => {
  const on = repeatsIn(generateSeries(1, 250, entities));
  const off = repeatsIn(generateSeries(1, 250, entities, 45, { pairMemory: false }));
  assert.equal(on.repeats, 0, `a question was asked again on day ${on.first}`);
  assert.ok(off.repeats > 10 && off.first < 60, `without the rule: ${off.repeats} repeats, the first on day ${off.first}`);
});

test("a puzzle always still builds, even if every possible question has already been asked", () => {
  const keyOf = (e, c) => `${e.object || e.id}|${c}|${e.facts[c].value}`;
  const everything = [];
  for (const c of CATEGORY_KEYS) {
    const list = entities.filter((e) => e.facts[c]);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) everything.push([keyOf(list[i], c), keyOf(list[j], c)].sort().join("~"));
  }
  assert.ok(everything.length > 10000);
  for (let n = 1; n <= 8; n++) {
    const p = generate(seedForPuzzle(n), entities, { pairs: [everything] });
    assert.ok(p, `seed ${n}: no puzzle`);
    assert.deepEqual(validatePuzzle(p), [], `seed ${n}`);
  }
});

test("the freezing script reads every saved puzzle, so new puzzles do not repeat a published question", () => {
  const dir = mkdtempSync(join(tmpdir(), "cleansweep-"));
  try {
    for (const f of ["src", "scripts", "data", "puzzles", "package.json"]) cpSync(join(root, f), join(dir, f), { recursive: true });
    const last = Math.max(...readdirSync(join(dir, "puzzles")).filter((f) => /^\d+\.json$/.test(f)).map((f) => parseInt(f)));
    execFileSync("node", ["scripts/generate.mjs", "--from", String(last + 1), "--days", "300"], { cwd: dir, stdio: "pipe" });
    const seen = new Set();
    let repeats = 0;
    for (let n = 1; n <= last + 300; n++) {
      const keys = pairsOf(JSON.parse(readFileSync(join(dir, "puzzles", `${n}.json`), "utf8")));
      if (n > last) for (const k of keys) if (seen.has(k)) repeats++;
      keys.forEach((k) => seen.add(k));
    }
    assert.equal(repeats, 0, `${repeats} questions in the new puzzles were already asked`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
