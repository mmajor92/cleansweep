// How long the game stays fresh. Three simulated years are generated ONCE, with the rule that stops a question being asked again and
// without it, and the long-run behaviour is checked. (One year is noisy: one changed value can move a few objects across a line.)
import test from "node:test";
import assert from "node:assert/strict";
import { generateSeries, objectsOf, pairsOf } from "../src/engine.js";
import { entities } from "./helpers.mjs";

const DAYS = 365;
const on = generateSeries(1, DAYS * 3, entities);
const off = generateSeries(1, DAYS * 3, entities, 45, { pairMemory: false });

// first day a question came back, the share of questions that were repeats in each year, and how long ago they were last asked
const history = (series) => {
  const last = new Map();
  const repeats = [0, 0, 0];
  const asked = [0, 0, 0];
  const ages = [[], [], []];
  let first = null;
  series.forEach((p, i) => {
    const y = Math.floor(i / DAYS);
    const keys = pairsOf(p);
    for (const k of keys) {
      asked[y]++;
      if (last.has(k)) (repeats[y]++, ages[y].push(i - last.get(k)), (first ??= i + 1));
    }
    keys.forEach((k) => last.set(k, i));
  });
  const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : Infinity);
  return { first, share: repeats.map((r, y) => r / asked[y]), median: median([...ages[1], ...ages[2]]) };
};
const a = history(on);
const b = history(off);

test("a puzzle builds on every one of three years of days, with and without the rule", () => {
  assert.equal(on.filter((p) => !p).length, 0);
  assert.equal(off.filter((p) => !p).length, 0);
});

test("no question is asked again for the best part of a year", () => {
  assert.ok(a.first === null || a.first >= 300, `the first repeat came on day ${a.first}`);
  assert.ok(a.share[0] <= 0.02, `${Math.round(a.share[0] * 100)}% of the first year's questions were repeats`);
});

test("the rule is what makes the difference: without it questions repeat within weeks, and far more of them in year two", () => {
  assert.ok(b.first < 60, `without the rule the first repeat came on day ${b.first}`);
  assert.ok(a.share[1] < b.share[1] * 0.6, `year two: ${Math.round(a.share[1] * 100)}% with the rule, ${Math.round(b.share[1] * 100)}% without`);
});

test("when a question does come back, it is one asked a long time ago", () => {
  assert.ok(a.median >= 300, `repeats in years two and three were last asked ${a.median} days earlier (median)`);
  assert.ok(a.median >= b.median * 1.5, `${a.median} days with the rule, ${b.median} without`);
});

test("averaged over three simulated years, few everyday objects are almost never seen (under 2 days a year)", () => {
  const everyday = entities.filter((e) => e.fame >= 2 && e.object === e.id); // objects, counted once however many numbers they hold
  let rare = 0;
  for (let y = 0; y < 3; y++) {
    const days = {};
    on.slice(y * DAYS, (y + 1) * DAYS).forEach((p) => objectsOf(p).forEach((id) => (days[id] = (days[id] || 0) + 1)));
    rare += everyday.filter((e) => (days[e.id] || 0) < 2).length;
  }
  const share = rare / (3 * everyday.length);
  assert.ok(share < 0.12, `${Math.round(share * 100)}% of everyday objects were almost never seen`);
});
