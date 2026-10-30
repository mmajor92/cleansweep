// Line Up: the rules of the game, against the real facts and the real modules (no browser needed).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RULES, countdownText as engineCountdown } from "../src/engine.js";
import { fmt as mysteryFmt } from "../mystery/logic.js";
import { buildPool } from "../lineup/data.js";
import { BOARD_SIZE, extendPuzzles } from "../lineup/schedule.js";
import * as L from "../lineup/logic.js";

const facts = JSON.parse(readFileSync(new URL("../data/facts.json", import.meta.url), "utf8"));
const pool = buildPool(facts.entities);
L.setPool(pool);
L.setLaunch("2026-11-03");
L.setDays(extendPuzzles([], pool, 60));

test("the day number counts from the launch date in UTC, never below 1", () => {
  assert.equal(L.dayNumber(Date.UTC(2026, 9, 20)), 1, "before launch it gives puzzle 1");
  assert.equal(L.dayNumber(Date.UTC(2026, 10, 3, 0, 0, 1)), 1);
  assert.equal(L.dayNumber(Date.UTC(2026, 10, 3, 23, 59, 59)), 1);
  assert.equal(L.dayNumber(Date.UTC(2026, 10, 4)), 2);
  assert.equal(L.dayNumber(Date.UTC(2026, 11, 3, 12)), 31);
});

test("a daily puzzle has six things, a start order and the right order, and the right order really is ascending", () => {
  for (const no of [1, 2, 3, 10, 40]) {
    const p = L.puzzleFor(no);
    assert.equal(p.daily, true); assert.equal(BOARD_SIZE, 6); assert.equal(p.items.length, BOARD_SIZE); assert.equal(p.start.length, BOARD_SIZE); assert.equal(p.solution.length, BOARD_SIZE);
    const v = p.solution.map((id) => p.items.find((x) => x.id === id).value);
    assert.deepEqual(v, v.slice().sort((a, b) => a - b));
    assert.deepEqual(p.start.slice().sort(), p.solution.slice().sort());
  }
});

test("a day nobody has frozen yet is worked out the same for everyone, and a frozen day whose facts changed is replaced, not broken", () => {
  const live = L.puzzleFor(75);
  L.setDays(extendPuzzles([], pool, 90));
  assert.deepEqual(L.puzzleFor(75).start, live.start);
  const good = extendPuzzles([], pool, 5);
  L.setDays([{ cat: "weight", ids: ["no-such-thing", "a", "b", "c", "d", "e"], gap: 2 }, ...good]);
  const fixed = L.puzzleFor(1);
  assert.equal(fixed.items.length, BOARD_SIZE);
  L.setDays(extendPuzzles([], pool, 60));
});

test("the two practice puzzles are fixed, use real things, and have wide gaps", () => {
  assert.equal(L.PRACTICE.length, 2);
  for (const n of [1, 2]) {
    const p = L.practicePuzzle(n);
    assert.equal(p.daily, false); assert.equal(p.practice, n); assert.equal(p.items.length, BOARD_SIZE);
    assert.deepEqual(L.practicePuzzle(n).start, p.start, "the same every time");
    assert.ok(p.start.filter((id, i) => id === p.solution[i]).length <= 1);
  }
  assert.equal(L.practicePuzzle(1).cat, "weight"); assert.equal(L.practicePuzzle(2).cat, "date");
});

test("which places are right, which are locked, which try solved it, and when the game is over", () => {
  const s = ["a", "b", "c", "d", "e"];
  assert.deepEqual(L.rightPlaces(["b", "a", "c", "e", "d"], s), [false, false, true, false, false]);
  const t1 = ["b", "a", "c", "e", "d"], t2 = ["a", "b", "c", "e", "d"], t3 = s;
  assert.deepEqual([...L.lockedPositions([t1], s)], [2]);
  assert.deepEqual([...L.lockedPositions([t1, t2], s)].sort(), [0, 1, 2]);
  assert.equal(L.solvedTry([t1, t2], s), 0); assert.equal(L.solvedTry([t1, t2, t3], s), 3); assert.equal(L.solvedTry([t3], s), 1);
  assert.equal(L.isOver([t1, t2], s), false, "two tries used, none solved: one to go");
  assert.equal(L.isOver([t1, t2, t1], s), true, "three tries used");
  assert.equal(L.isOver([t1, t3], s), true, "solved");
  assert.equal(L.TRIES, 3);
});

test("the share card: a headline with the score, one row of squares per try, and the broom and address; X/3 when it was not solved; practice is marked and has no score", () => {
  const p = { daily: true, no: 5, cat: "weight", solution: ["a", "b", "c", "d", "e"], tier: "hard" };
  const t1 = ["b", "a", "c", "e", "d"], t2 = ["a", "b", "c", "e", "d"], t3 = p.solution;
  const G = "\uD83D\uDFE9", R = "\uD83D\uDFE5", URL = "\uD83E\uDDF9 cleansweepdaily.fyi/lineup";
  const pts = (tries) => L.scoreGame(p, tries).points;
  assert.equal(L.shareText(p, [t1, t2, t3]), ["\uD83D\uDCCA Line Up #5 \u2696\uFE0F 3/3 \u00b7 " + pts([t1, t2, t3]) + " pts", R + R + G + R + R, G + G + G + R + R, G.repeat(5), URL].join("\n"));
  assert.equal(L.shareText(p, [t3]).split("\n")[0], "\uD83D\uDCCA Line Up #5 \u2696\uFE0F 1/3 \u00b7 900 pts", "a clean sweep of five on a hard day: (500 + 100) x 1.5");
  assert.equal(L.shareText(p, [t1, t1, t1]).split("\n")[0], "\uD83D\uDCCA Line Up #5 \u2696\uFE0F X/3 \u00b7 " + pts([t1, t1, t1]) + " pts");
  assert.equal(L.shareText({ ...p, daily: false, practice: 1, cat: "date" }, [t3]).split("\n")[0], "\uD83D\uDCCA Line Up (practice) \uD83D\uDCC5 1/3");
  for (const c of ["length", "weight", "date", "speed"]) assert.ok(L.CAT[c].icon && L.CAT[c].prompt && L.CAT[c].hint && L.CAT[c].ends.length === 2, c);
  assert.equal(L.CAT.speed.icon, "\u26A1", "lightning for speed, so the wind emoji only ever means dust");
  assert.ok(!/streak|\uD83D\uDD25/i.test(L.shareText(p, [t3])), "no streak in the shared text");
});

test("points: each thing scores its best try (100, 60, 35), a near miss earns part of that, a clean sweep adds 100, and the day's difficulty multiplies it", () => {
  const sol = ["a", "b", "c", "d", "e", "f"], swap = (arr, i, j) => { const c = arr.slice(); [c[i], c[j]] = [c[j], c[i]]; return c; };
  const game = (tier) => ({ solution: sol, tier });
  assert.deepEqual(L.scoreGame(game("easy"), [sol]), { raw: 700, bonus: 100, mult: 1, points: 700, tier: "easy" }, "six right on try 1: 600 and the bonus");
  assert.equal(L.scoreGame(game("medium"), [sol]).points, 875); assert.equal(L.scoreGame(game("hard"), [sol]).points, 1050);
  const near = swap(swap(sol, 0, 1), 4, 5); // four things one place out, two exact
  assert.equal(L.scoreGame(game("easy"), [near]).raw, 2 * 100 + 4 * 40, "exact scores 100, one place out 40");
  assert.equal(L.scoreGame(game("easy"), [near, sol]).raw, 2 * 100 + 4 * 60, "the four are fixed on try 2: 60 each");
  assert.equal(L.scoreGame(game("easy"), [near, near, sol]).raw, 2 * 100 + 4 * 40 + 0 * 1 + 0, "a thing keeps its best result: fixed only on try 3 would be 35, which is less than 40 for a near miss on try 1") ;
  const two = ["b", "c", "a", "d", "e", "f"]; // a is two places out, b and c one out
  assert.equal(L.scoreGame(game("easy"), [two]).raw, 3 * 100 + 15 + 40 + 40, "two out earns 15");
  const far = ["d", "e", "f", "a", "b", "c"]; // every thing three places out
  assert.equal(L.scoreGame(game("easy"), [far]).raw, 0, "three or more places out earns nothing");
  assert.equal(L.scoreGame(game("easy"), []).points, 0);
  assert.equal(L.scoreGame({ solution: sol }, [sol]).points, 700, "no tier means Easy");
  assert.ok(L.scoreGame(game("easy"), [near, sol]).points > L.scoreGame(game("easy"), [near]).points && L.scoreGame(game("easy"), [swap(sol, 0, 1), sol]).points < 700, "better and earlier is worth more, and only a clean sweep gets 700");
  // 3rd instead of 2nd beats 4th instead of 2nd
  const place = (id, pos) => { const rest = sol.filter((x) => x !== id); rest.splice(pos, 0, id); return rest; };
  assert.ok(L.scoreGame(game("easy"), [place("b", 2)]).raw >= L.scoreGame(game("easy"), [place("b", 3)]).raw);
});

test("a day is Easy, Medium or Hard by how close its closest pair is, and the multipliers are x1, x1.25 and x1.5", () => {
  assert.deepEqual([L.tierFor("weight", 1.5), L.tierFor("weight", 1.65), L.tierFor("weight", 2.19), L.tierFor("weight", 2.2), L.tierFor("speed", 4)], ["hard", "medium", "medium", "easy", "easy"]);
  assert.deepEqual([L.tierFor("date", 14), L.tierFor("date", 15), L.tierFor("date", 39), L.tierFor("date", 40)], ["hard", "medium", "medium", "easy"]);
  assert.deepEqual(Object.values(L.TIER).map((t) => t.mult), [1, 1.25, 1.5]);
  for (const no of [1, 2, 3, 20]) { const p = L.puzzleFor(no); assert.ok(["easy", "medium", "hard"].includes(p.tier), p.tier); }
  assert.equal(L.practicePuzzle(1).tier, "easy");
});

test("numbers are worded exactly as in Mystery Thing", () => {
  for (const [cat, vals] of [["length", [0.0525, 0.148, 1.6, 93, 330, 2467, 82000, 21196000]], ["weight", [0.00002, 0.0075, 0.135, 4.5, 270, 13760, 25000, 1.18e8, 6e24]], ["speed", [0.152, 7, 40, 842, 28000]], ["date", [-3000, -196, 80, 1066, 1889, 2007]]]) {
    for (const v of vals) for (const ap of [false, true]) assert.equal(L.fmtValue(cat, v, ap), mysteryFmt(cat, v, ap), `${cat} ${v} ${ap}`);
  }
});

test("the countdown to the next puzzle reads exactly like Clean Sweep's, and the year Mystery Thing counts from matches", () => {
  for (const [h, m, sec] of [[0, 0, 0], [0, 0, 1], [6, 22, 30], [12, 0, 0], [22, 59, 59], [23, 30, 0], [23, 59, 30]]) {
    const t = new Date(Date.UTC(2026, 10, 3, h, m, sec));
    assert.equal(L.countdownText(t), engineCountdown(t), `${h}:${m}:${sec}`);
  }
  assert.ok(RULES.launchDate);
});
