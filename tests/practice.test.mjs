import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE, generatePractice, normalizePuzzle, questionsOf, validatePuzzle } from "../src/engine.js";
import { entities } from "./helpers.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");

test("there are exactly two fixed practice puzzles", () => {
  assert.equal(PRACTICE.length, 2);
});

test("the practice puzzles are valid and each teaches one badge", () => {
  const [a, b] = [1, 2].map((n) => generatePractice(n, entities));
  assert.ok(a && b);
  assert.deepEqual(validatePuzzle(a), []);
  assert.deepEqual(validatePuzzle(b), []);
  assert.ok(a.warmUp && !a.deepCut, "practice 1 opens with a Warm-up and has no Deep cut");
  assert.ok(b.deepCut && !b.warmUp, "practice 2 has a Deep cut and no Warm-up");
  assert.notEqual(a.legs.map((l) => l.cat).join(">"), b.legs.map((l) => l.cat).join(">"), "the two practice puzzles should cover different categories");
  assert.equal(a.bridges.length, 1, "practice 1 has one switch of category");
  assert.equal(b.bridges.length, 2, "practice 2 has two");
});

// The two practice seeds were found by searching the pool as it stood at launch, so adding facts later can change what a
// REGENERATION picks. What players see is the FROZEN files, which never change, so "friendly" is checked on those.
test("the frozen practice puzzles are friendly: everything is nearly universally known, apart from the one Deep cut", async () => {
  for (const [n, deep] of [[1, false], [2, true]]) {
    let p = JSON.parse(await readFile(join(root, "puzzles", `practice-${n}.json`), "utf8"));
    p = normalizePuzzle(p);
    const items = p.legs.flatMap((l) => [l.anchor, ...l.items]);
    assert.equal(items.filter((it) => it.fame === 1).length, deep ? 1 : 0, `practice-${n}.json: Deep cut objects`);
    assert.ok(items.every((it) => it.fame === 3 || it.fame === 1), `practice-${n}.json: every other object is one that nearly everyone knows`);
    assert.equal(!!p.warmUp, !deep, `practice-${n}.json: Warm-up badge`);
    assert.equal(!!p.deepCut, deep, `practice-${n}.json: Deep cut badge`);
  }
});

test("the practice puzzles do not depend on the date", () => {
  const first = JSON.stringify(generatePractice(1, entities));
  const realNow = Date.now;
  Date.now = () => realNow() + 90 * 86400000;
  try {
    assert.equal(JSON.stringify(generatePractice(1, entities)), first);
  } finally {
    Date.now = realNow;
  }
});

test("the frozen practice files exist and are valid", async () => {
  for (const n of [1, 2]) {
    const p = JSON.parse(await readFile(join(root, "puzzles", `practice-${n}.json`), "utf8"));
    assert.deepEqual(validatePuzzle(p), [], `practice-${n}.json`);
    assert.equal(p.practice, n);
  }
});

test("there is no practice puzzle 3", () => {
  assert.equal(generatePractice(3, entities), null);
  assert.equal(generatePractice(0, entities), null);
});
