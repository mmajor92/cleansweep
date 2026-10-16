import test from "node:test";
import assert from "node:assert/strict";
import { SCORING, difficulty, questionDeep, questionRatios, scoreRun, streakMultiplier, tierFor } from "../src/score.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULES, gapRatio, generate, generateSeries, questionsOf, seedForPuzzle, shareText } from "../src/engine.js";
import { completeDay, emptyState } from "../src/store.js";
import { entities } from "./helpers.mjs";

const EASY = [4, 4, 4, 4, 4, 4, 4]; // every gap at the widest allowed, so difficulty is exactly 1.0
const R = true;
const W = false;

test("tiers: close call 2x, medium 1.5x, easy 1x", () => {
  assert.equal(tierFor(1.13).key, "close");
  assert.equal(tierFor(1.49).key, "close");
  assert.equal(tierFor(1.5).key, "medium");
  assert.equal(tierFor(2.19).key, "medium");
  assert.equal(tierFor(2.2).key, "easy");
  assert.equal(tierFor(4).key, "easy");
  assert.equal(tierFor(50).key, "easy");
  assert.deepEqual([1.2, 1.8, 3].map(difficulty), [2, 1.5, 1]);
});

test("the tiers are fairly balanced on real puzzles", () => {
  const counts = { close: 0, medium: 0, easy: 0 };
  for (let n = 1; n <= 120; n++) {
    for (const r of questionRatios(generate(seedForPuzzle(n), entities))) counts[tierFor(r).key]++;
  }
  const total = counts.close + counts.medium + counts.easy;
  for (const k of Object.keys(counts)) assert.ok(counts[k] / total > 0.2, `${k} is under 20% of questions`);
});

test("streak multiplier grows 10% per right answer in a row", () => {
  assert.equal(streakMultiplier(1), 1);
  assert.ok(Math.abs(streakMultiplier(7) - 1.6) < 1e-9);
  assert.equal(streakMultiplier(0), 1);
});

test("seven in a row is the maximum", () => {
  const s = scoreRun(EASY, [R, R, R, R, R, R, R]);
  assert.equal(s.total, 910);
  assert.equal(s.max, 910);
  assert.equal(s.pct, 100);
});

test("miss the first, then six in a row, is a different and lower score", () => {
  const s = scoreRun(EASY, [W, R, R, R, R, R, R]);
  assert.equal(s.total, 750); // 100 + 110 + 120 + 130 + 140 + 150
  assert.equal(s.pct, 82);
});

test("three right, two wrong, then the rest right is another score again", () => {
  const s = scoreRun(EASY, [R, R, R, W, W, R, R]);
  assert.equal(s.total, 540);
  assert.equal(s.pct, 59);
});

test("all wrong scores zero", () => {
  assert.equal(scoreRun(EASY, [W, W, W, W, W, W, W]).total, 0);
});

test("order matters: the same number right scores differently", () => {
  const together = scoreRun(EASY, [R, R, R, R, R, W, W]).total; // 5 in a row
  const split = scoreRun(EASY, [R, R, R, W, W, R, R]).total; // 3 then 2
  assert.equal(together, 600);
  assert.equal(split, 540);
  assert.ok(together > split);
});

test("one early slip still beats a friend who had a bad second half", () => {
  const slip = scoreRun(EASY, [W, R, R, R, R, R, R]).total; // 6 right
  const friend = scoreRun(EASY, [R, R, R, R, W, W, W]).total; // 4 right
  assert.ok(slip > friend);
});

test("a close call is worth double an easy one, a medium 1.5x", () => {
  const easy = scoreRun(EASY, [R, R, R, R, R, R, R]).total;
  const close = scoreRun([1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2], [R, R, R, R, R, R, R]).total;
  assert.equal(close, easy * 2);
  const medium = scoreRun([1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8], [R, R, R, R, R, R, R]).total;
  assert.ok(Math.abs(medium - easy * 1.5) <= 4); // rounding only
});

test("a partial run counts only what has been answered, and the maximum stays fixed", () => {
  const part = scoreRun(EASY, [R, R]);
  assert.equal(part.total, 210);
  assert.equal(part.max, 910);
});

test("the breakdown explains each answer", () => {
  const s = scoreRun(EASY, [R, R, W]);
  assert.deepEqual(s.detail.slice(0, 3).map((d) => d.points), [100, 110, 0]);
  assert.equal(s.detail[2].correct, false);
  assert.equal(s.detail[2].multiplier, 1);
});

test("real puzzles have seven ratios inside the allowed range", () => {
  for (let n = 1; n <= 100; n++) {
    const p = generate(seedForPuzzle(n), entities);
    const r = questionRatios(p);
    assert.equal(r.length, 7);
    r.forEach((x, i) => {
      if (i === 0 && p.warmUp) assert.ok(x >= RULES.warmMinGap, `puzzle ${n}: warm-up gap ${x}`);
      else assert.ok(x >= 1.12 - 1e-9 && x <= 4 * 3 + 1e-9, `puzzle ${n}: ${x}`); // dates may be as close as 1.12x
    });
  }
});

test("share text carries the score", () => {
  const p = generate(seedForPuzzle(5), entities);
  const s = scoreRun(questionRatios(p), [R, R, W, R, R, R, R]);
  const text = shareText(p, [R, R, W, R, R, R, R], 5, s);
  assert.ok(text.includes(`Score: ${s.pct}% (${s.total.toLocaleString("en-GB")} pts)`));
  assert.match(text, /Longest Sweep: 4 \| Cleaned: 6\/7(\n|$)/);
});

test("the store remembers the best score", () => {
  const state = emptyState();
  completeDay(state, 1, [R, R, R, R, R, R, R], { total: 900, max: 1000, pct: 90 });
  completeDay(state, 2, [R, W, R, R, R, R, R], { total: 500, max: 1000, pct: 50 });
  assert.equal(state.stats.bestScore, 900);
  assert.equal(state.stats.bestPct, 90);
  assert.equal(state.days[2].score.total, 500);
});

test("a deep cut is worth 1.5x, and the maximum includes it", () => {
  const deep = [false, false, false, false, false, false, true];
  const plain = scoreRun(EASY, [R, R, R, R, R, R, R]);
  const withDeep = scoreRun(EASY, [R, R, R, R, R, R, R], deep);
  assert.equal(withDeep.detail[6].points, Math.round(100 * 1 * 1.5 * 1.6)); // 240 instead of 160
  assert.equal(withDeep.total, plain.total + 80);
  assert.equal(withDeep.max, plain.max + 80);
  assert.equal(withDeep.pct, 100);
  assert.equal(withDeep.detail[6].deep, true);
});

test("missing a deep cut costs nothing extra, it just scores zero", () => {
  const deep = [false, false, false, false, false, false, true];
  const s = scoreRun(EASY, [R, R, R, R, R, R, W], deep);
  assert.equal(s.detail[6].points, 0);
  assert.equal(s.total, 750); // six right in a row: 100+110+120+130+140+150, then nothing
});

test("questionDeep flags only enthusiast objects, never the first two questions", () => {
  for (let n = 1; n <= 60; n++) {
    const p = generate(seedForPuzzle(n), entities);
    const flags = questionDeep(p);
    assert.equal(flags.length, 7);
    assert.equal(flags[0], false);
    assert.equal(flags[1], false);
    assert.ok(flags.filter(Boolean).length <= 1);
    assert.equal(flags.some(Boolean), p.deepCut);
  }
});

test("the gap ratios and deep-cut flags follow the 7 questions of a mixed puzzle, and of a puzzle published before v3", () => {
  const mixed = generateSeries(1, 60, entities).find((p) => p.deepCut && p.bridges.length >= 2);
  assert.ok(mixed, "need a puzzle with a deep cut and two or more switches");
  const old = JSON.parse(readFileSync(join(fileURLToPath(import.meta.url), "..", "..", "puzzles", "1.json"), "utf8"));
  for (const p of [mixed, old]) {
    const qs = questionsOf(p);
    const ratios = questionRatios(p);
    assert.equal(ratios.length, 7);
    ratios.forEach((r, i) => assert.equal(r, gapRatio(qs[i].cat, qs[i].prev.value, qs[i].item.value), `question ${i + 1}`));
    assert.ok(ratios.every((r) => r >= 1.1), "every gap is at least the minimum");
    assert.deepEqual(questionDeep(p), qs.map((x) => x.item.fame === 1));
  }
  assert.equal(questionDeep(mixed).findIndex(Boolean), mixed.deepCutAt, "the deep cut is flagged on the right question");
});
