// Line Up: which five things are on which day, how hard it is, and the frozen file.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mulberry32 } from "../src/engine.js";
import { buildPool } from "../lineup/data.js";
import { LU_LAUNCH, tierFor } from "../lineup/logic.js";
import { BOARD_SIZE, extendPuzzles, inOrder, lineupRng, minGap, pickPuzzle } from "../lineup/schedule.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const facts = read("../data/facts.json"), file = read("../data/lineup-days.json");
const pool = buildPool(facts.entities);
const byKey = Object.fromEntries(pool.map((p) => [p.key, p]));
const items = (d) => d.ids.map((id) => byKey[id + ":" + d.cat]);
const days = extendPuzzles([], pool, 240);

test("the random number generator copied from the main game still agrees with it", () => {
  const a = lineupRng(777), b = mulberry32(777);
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
});

test("the days are worked out the same way every time, and carrying on never changes the days already decided", () => {
  assert.deepEqual(extendPuzzles([], pool, 60), days.slice(0, 60));
  const carried = extendPuzzles(days.slice(0, 25), pool, 70);
  assert.deepEqual(carried.slice(0, 25), days.slice(0, 25));
  assert.deepEqual(carried.slice(0, 60), days.slice(0, 60), "carrying on gives the same days as building straight through");
  assert.deepEqual(pickPuzzle(days.slice(0, 10), pool, 10), days[10]);
});

test("every day is six different things with a clear order: no ties, rounded figures kept well apart", () => {
  days.forEach((d, i) => {
    const it = items(d);
    assert.equal(it.length, BOARD_SIZE); assert.ok(it.every(Boolean), `day ${i + 1}`);
    assert.equal(new Set(it.map((x) => x.family)).size, BOARD_SIZE, `day ${i + 1} repeats a thing`);
    const s = inOrder(it);
    for (let k = 1; k < BOARD_SIZE; k++) {
      const rough = s[k].approx || s[k - 1].approx;
      if (d.cat === "date") assert.ok(s[k].value - s[k - 1].value >= (rough ? 100 : 1), `day ${i + 1}: two years too close`);
      else assert.ok(s[k].value / s[k - 1].value >= (rough ? 1.35 : 1.01), `day ${i + 1}: two values too close`);
    }
    assert.equal(d.gap, Number(minGap(it, d.cat).toFixed(2)), `day ${i + 1} gap`);
  });
});

test("the board never starts with more than one thing already in the right place", () => {
  days.forEach((d, i) => { const s = inOrder(items(d)).map((x) => x.id); assert.ok(d.ids.filter((id, k) => id === s[k]).length <= 1, `day ${i + 1}`); });
});

test("the kind of puzzle changes from day to day, and every kind comes up", () => {
  days.forEach((d, i) => { if (i) assert.notEqual(d.cat, days[i - 1].cat, `day ${i + 1}`); });
  assert.deepEqual([...new Set(days.map((d) => d.cat))].sort(), ["date", "length", "speed", "weight"]);
});

test("at least two of the six are well known, and a thing is rarely reused within 25 days", () => {
  days.forEach((d, i) => assert.ok(items(d).filter((x) => x.fame >= 3).length >= 2, `day ${i + 1}`));
  const reused = days.reduce((n, d, i) => n + d.ids.filter((id) => days.slice(Math.max(0, i - 25), i).some((e) => e.ids.includes(id))).length, 0);
  assert.ok(reused / (days.length * BOARD_SIZE) < 0.3, `${reused} places reused a thing from the last 25 days`);
});

test("difficulty is random from day to day, not tied to the weekday: Hard and Easy days both turn up, in every weekday slot, and Hard is not rare", () => {
  const tiers = days.map((d) => tierFor(d.cat, d.gap));
  const share = (t) => tiers.filter((x) => x === t).length / tiers.length;
  assert.ok(share("hard") > 0.2 && share("hard") < 0.45, "hard share " + share("hard"));
  assert.ok(share("easy") > 0.2 && share("easy") < 0.45, "easy share " + share("easy"));
  assert.ok(share("medium") > 0.25, "medium share " + share("medium"));
  for (let w = 0; w < 7; w++) {
    const slot = tiers.filter((_, i) => i % 7 === w);
    assert.ok(slot.includes("hard") && slot.includes("easy"), `weekday slot ${w} has only some kinds of day: ${[...new Set(slot)]}`);
  }
});

test("data/lineup-days.json: a real launch date, days that match the facts, and a few weeks of them ahead", () => {
  assert.match(file.launchDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(file.days.length >= 28);
  file.days.forEach((d, i) => {
    const it = items(d);
    assert.ok(it.every(Boolean), `day ${i + 1} has a thing that is no longer usable`);
    assert.equal(new Set(it.map((x) => x.value)).size, BOARD_SIZE, `day ${i + 1} has a tie`);
    assert.equal(d.gap, Number(minGap(it, d.cat).toFixed(2)), `day ${i + 1}: the stored closeness no longer matches`);
  });
});

test("two things from the same family (a tower and its bell, say) never share a board, even when the pool is tiny", () => {
  const mk = (id, family, value) => ({ key: id + ":weight", id, family, cat: "weight", value, approx: false, fame: 3, text: id });
  const tiny = [mk("a1", "a", 1), mk("a2", "a", 2), mk("b", "b", 4), mk("c", "c", 8), mk("d", "d", 16), mk("e", "e", 32), mk("f", "f", 64)];
  for (let k = 0; k < 40; k++) {
    const day = pickPuzzle([], tiny, k);
    const fams = day.ids.map((id) => tiny.find((x) => x.id === id).family);
    assert.equal(new Set(fams).size, BOARD_SIZE, `day ${k + 1}: ${day.ids.join(", ")}`);
  }
});

test("a board never repeats an earlier one: not in a year of days, and not even from a pool with barely enough things", () => {
  const key = (d) => d.cat + "|" + d.ids.slice().sort().join(",");
  const year = extendPuzzles([], pool, 365);
  assert.equal(new Set(year.map(key)).size, 365, "a board repeated within a simulated year");
  const mk = (id, family, value) => ({ key: id + ":weight", id, family, cat: "weight", value, approx: false, fame: 3, text: id });
  const small = [1, 2, 4, 8, 16, 32, 64, 128, 256].map((v, i) => mk("t" + i, "t" + i, v)); // nine things: 84 possible boards of six, so many days can be told apart
  const days = extendPuzzles([], small, 40);
  assert.equal(new Set(days.map(key)).size, 40, "a repeated board, even with a tiny pool");
});

test("the launch date in the data file and the default in the code are the same day, so puzzle numbers cannot disagree", () => {
  assert.equal(Date.parse(file.launchDate + "T00:00:00Z"), LU_LAUNCH);
});
