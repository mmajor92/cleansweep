import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES, CATEGORY_KEYS, RULES, buildEntities, correctPick, gapOk, gapRatio, generate, generateDaily, generateSeries,
  nextPuzzleTime, pairForDay, puzzleNumber, seedForPuzzle, shareText, streaks, validatePuzzle, yearsAgo,
} from "../src/engine.js";
import { entities } from "./helpers.mjs";

test("yearsAgo has no year zero", () => {
  assert.equal(yearsAgo(2026), 0);
  assert.equal(yearsAgo(1), 2025);
  assert.equal(yearsAgo(-1), 2026);
  assert.equal(yearsAgo(-30), 2055);
});

test("gapRatio is symmetric and at least 1", () => {
  assert.equal(gapRatio("length", 10, 20), 2);
  assert.equal(gapRatio("length", 20, 10), 2);
  assert.ok(gapRatio("date", 1900, 1950) >= 1);
});

test("gapOk enforces minimum and maximum gaps", () => {
  assert.equal(gapOk("length", 100, 105, 0), false); // too close
  assert.equal(gapOk("length", 100, 200, 0), true);
  assert.equal(gapOk("length", 100, 1000, 0), false); // too far
  assert.equal(gapOk("length", 100, 300, 3), false); // late slots are tighter
  assert.equal(gapOk("date", 1969, 1971, 0), false); // under 5 years apart
});

test("buildEntities drops unverified facts", () => {
  const raw = { entities: [{ id: "x", name: "X", facts: {
    length: { phrase: "p", label: "l", value: 1, status: "unverified", source: "s" },
    weight: { phrase: "p", label: "l", value: 1, status: "verified", source: "s" },
  } }] };
  const out = buildEntities(raw);
  assert.deepEqual(Object.keys(out[0].facts), ["weight"]);
});

test("generate is deterministic for a seed", () => {
  const a = generate(12345, entities);
  const b = generate(12345, entities);
  assert.deepEqual(a, b);
});

test("200 puzzles all satisfy every rule", () => {
  for (let n = 1; n <= 200; n++) {
    const p = generate(seedForPuzzle(n), entities);
    assert.ok(p, `puzzle ${n} was not generated`);
    assert.deepEqual(validatePuzzle(p), [], `puzzle ${n}`);
  }
});

test("a puzzle never uses an unverified fact", () => {
  for (let n = 1; n <= 100; n++) {
    const p = generate(seedForPuzzle(n), entities);
    for (const it of [p.seg1.anchor, ...p.seg1.items, p.seg2.anchor, ...p.seg2.items]) {
      assert.ok(["verified", "definitional"].includes(it.status));
    }
  }
});

test("the hinge links the two halves", () => {
  const p = generate(seedForPuzzle(7), entities);
  assert.equal(p.seg1.items[p.n1 - 1].ent, p.hinge.id);
  assert.equal(p.seg2.anchor.ent, p.hinge.id);
  assert.notEqual(p.c1, p.c2);
  assert.equal(p.n1 + p.n2, RULES.chainLength);
});

test("pairForDay covers all 20 pairs in every block of 20 days", () => {
  for (const start of [1, 21, 41]) {
    const seen = new Set();
    for (let d = start; d < start + 20; d++) seen.add(pairForDay(d).join(">"));
    assert.equal(seen.size, 20);
  }
});

test("a year of daily puzzles covers every category pair and stays valid", () => {
  const series = generateSeries(1, 120, entities);
  assert.equal(series.filter((p) => !p).length, 0);
  for (const p of series) assert.deepEqual(validatePuzzle(p), []);
  const pairs = new Set(series.map((p) => `${p.c1}>${p.c2}`));
  assert.equal(pairs.size, 20);
});

test("generateDaily matches generateSeries", () => {
  assert.deepEqual(generateDaily(10, entities), generateSeries(10, 1, entities)[0]);
});

test("validatePuzzle catches a broken puzzle", () => {
  const p = generate(seedForPuzzle(3), entities);
  const broken = structuredClone(p);
  broken.seg1.items[0].value = broken.seg1.anchor.value; // a tie
  assert.ok(validatePuzzle(broken).length > 0);
});

test("correctPick and streaks", () => {
  assert.equal(correctPick({ value: 5 }, { value: 3 }), "up");
  assert.equal(correctPick({ value: 1 }, { value: 3 }), "down");
  assert.deepEqual(streaks([true, true, false, true, true, true, false]), { longest: 3, correct: 5 });
  assert.deepEqual(streaks([]), { longest: 0, correct: 0 });
});

test("puzzleNumber changes at midnight UTC, whatever the local time zone", () => {
  assert.equal(puzzleNumber(new Date(Date.UTC(2026, 9, 16, 0, 0))), 1);
  assert.equal(puzzleNumber(new Date(Date.UTC(2026, 9, 16, 23, 59))), 1);
  assert.equal(puzzleNumber(new Date(Date.UTC(2026, 9, 17, 0, 1))), 2);
  assert.equal(puzzleNumber(new Date(Date.UTC(2026, 10, 15, 12, 0))), 31);
  assert.equal(puzzleNumber(new Date(Date.UTC(2020, 0, 1))), 1); // never below 1
});

test("everyone gets the same number at the same instant", () => {
  // 23:30 UTC on the 15th is already the 16th in Sydney and still the 15th in Los Angeles.
  const instant = new Date("2026-10-16T23:30:00Z");
  assert.equal(puzzleNumber(instant), 1);
  assert.equal(puzzleNumber(new Date(instant.getTime() + 31 * 60000)), 2);
});

test("nextPuzzleTime is the next 00:00 UTC", () => {
  assert.equal(nextPuzzleTime(new Date("2026-10-15T23:00:00Z")).toISOString(), "2026-10-16T00:00:00.000Z");
  assert.equal(nextPuzzleTime(new Date("2026-10-15T00:00:00Z")).toISOString(), "2026-10-16T00:00:00.000Z");
  assert.equal(nextPuzzleTime(new Date("2026-12-31T12:00:00Z")).toISOString(), "2027-01-01T00:00:00.000Z");
});

test("shareText has the grid and totals", () => {
  const p = generate(seedForPuzzle(5), entities);
  const text = shareText(p, [true, true, false, true, true, true, true], 5);
  assert.match(text, /^Clean Sweep #5\n/);
  assert.match(text, /Longest Sweep: 4 \| Cleaned: 6\/7$/);
  assert.equal((text.match(/\u{1F9F9}/gu) || []).length, 6); // six brooms
  assert.equal((text.match(/\u{1F4A8}/gu) || []).length, 1); // one puff of dust
  assert.match(text.split("\n")[1], /^(?:\u{1F9F9}|\u{1F4A8}){7}$/u); // exactly seven emojis, one per question, nothing else
  assert.match(shareText(p, [true, true, true, true, true, false, true], null), /\(practice\)/);
});

test("a perfect run gets the sparkle header", () => {
  const p = generate(seedForPuzzle(5), entities);
  const text = shareText(p, [true, true, true, true, true, true, true], 14);
  assert.match(text, /^\u2728 Clean Sweep #14 \u2728\n/);
  assert.match(text, /Longest Sweep: 7 \| Cleaned: 7\/7$/);
  assert.ok(!/\u{1F4A8}/u.test(text));
  assert.equal(text.split("\n")[1], "\u{1F9F9}".repeat(7));
});

test("the share card has no web address until one is set, then ends with it", () => {
  const p = generate(seedForPuzzle(5), entities);
  const results = [true, false, true, true, true, true, true];
  assert.ok(!/http|www\./.test(shareText(p, results, 3)));
  const before = RULES.shareUrl;
  RULES.shareUrl = "cleansweep.example";
  try {
    assert.ok(shareText(p, results, 3).endsWith("\ncleansweep.example"));
  } finally {
    RULES.shareUrl = before;
  }
});

test("no category icon clashes with the broom or the dust puff", () => {
  for (const k of CATEGORY_KEYS) {
    assert.ok(!CATEGORIES[k].icon.includes("\u{1F9F9}") && !CATEGORIES[k].icon.includes("\u{1F4A8}"), k);
  }
  assert.equal(new Set(CATEGORY_KEYS.map((k) => CATEGORIES[k].icon)).size, 5);
});

test("category keys are the five expected ones", () => {
  assert.deepEqual(CATEGORY_KEYS.sort(), ["count", "date", "length", "speed", "weight"]);
});

test("clue and hint reach the puzzle items and the hinge", () => {
  const raw = { entities: [{ id: "x", name: "X", hint: "a thing", clue: "some clue", facts: {
    length: { phrase: "the length of X", label: "X length", value: 10, status: "verified", source: "s" },
    weight: { phrase: "the weight of X", label: "X weight", value: 10, status: "verified", source: "s" },
  } }] };
  const [ent] = buildEntities(raw);
  assert.equal(ent.hint, "a thing");
  assert.equal(ent.clue, "some clue");
});

test("hinge records its hint", () => {
  let checked = 0;
  for (let n = 1; n <= 60; n++) {
    const p = generate(seedForPuzzle(n), entities);
    const e = entities.find((x) => x.id === p.hinge.id);
    assert.equal(p.hinge.hint, e.hint, `puzzle ${n}: hinge ${p.hinge.id}`);
    if (e.hint) checked++;
  }
  assert.ok(checked > 10, "most hinges should have a hint");
});

test("the hinge may be up to 3.1x from its neighbour, other slots may not", () => {
  assert.equal(gapOk("length", 100, 305, 1, 1, true), true); // 3.05x as a hinge
  assert.equal(gapOk("length", 100, 305, 1, 1, false), false); // 3.05x in an ordinary slot
  assert.equal(gapOk("length", 100, 320, 1, 1, true), false); // over 3.1x is still too far
});

test("familiarity: well-known objects are picked more often than moderately known ones", () => {
  const fameOf = Object.fromEntries(entities.map((e) => [e.id, e.fame]));
  const count = { 3: 0, 2: 0, 1: 0 };
  for (const p of generateSeries(1, 200, entities)) {
    for (const it of [p.seg1.anchor, ...p.seg1.items, ...p.seg2.items]) count[fameOf[it.ent]]++;
  }
  const per = (f) => count[f] / entities.filter((e) => e.fame === f).length;
  assert.ok(per(3) > per(2) * 1.05, "rating 3 objects should be used more per object than rating 2");
  const share1 = count[1] / (count[1] + count[2] + count[3]);
  assert.ok(share1 < 0.12, `enthusiast objects should stay under 12% of questions, got ${Math.round(share1 * 100)}%`);
});

test("a deep cut is at most one per puzzle, never question 1 or 2, never the hinge", () => {
  let deep = 0;
  const positions = new Set();
  const series = generateSeries(1, 200, entities);
  for (const p of series) {
    assert.deepEqual(validatePuzzle(p), []);
    const asked = [...p.seg1.items, ...p.seg2.items];
    const idx = asked.map((it, i) => (it.fame === 1 ? i : -1)).filter((i) => i >= 0);
    assert.ok(idx.length <= 1, `puzzle ${p.num}: more than one deep cut`);
    assert.ok(idx.every((i) => i >= 2), `puzzle ${p.num}: deep cut in the first two questions`);
    assert.ok(idx.every((i) => i !== p.n1 - 1), `puzzle ${p.num}: the hinge is a deep cut`);
    assert.notEqual(p.seg1.anchor.fame, 1, "an obscure starting point");
    assert.equal(p.deepCut, idx.length === 1);
    assert.equal(p.deepCutAt, idx.length ? idx[0] : -1);
    if (p.deepCut) { deep++; positions.add(p.deepCutAt + 1); }
  }
  const rate = deep / series.length;
  assert.ok(rate > 0.2 && rate < 0.7, `deep cuts on ${Math.round(rate * 100)}% of days`);
  assert.ok(positions.size >= 3, `deep cuts should land in several positions, got ${[...positions].sort().join(", ")}`);
});

test("some days have no deep cut at all", () => {
  const series = generateSeries(1, 100, entities);
  assert.ok(series.filter((p) => !p.deepCut).length > 20);
});

test("a deep cut is never repeated inside its cooldown", () => {
  const seen = [];
  for (const p of generateSeries(1, 250, entities)) {
    const item = [...p.seg1.items, ...p.seg2.items].find((it) => it.fame === 1);
    const id = item ? item.ent : null;
    if (id) assert.ok(!seen.slice(-RULES.spiceCooldown).includes(id), `deep cut ${id} repeated too soon`);
    seen.push(id);
  }
});

test("validatePuzzle rejects a misplaced or doubled deep cut", () => {
  const base = generate(seedForPuzzle(3), entities);
  const early = JSON.parse(JSON.stringify(base));
  early.seg1.items[0].fame = 1;
  assert.ok(validatePuzzle(early).some((m) => m.includes("deep cut too early")));
  const start = JSON.parse(JSON.stringify(base));
  start.seg1.anchor.fame = 1;
  assert.ok(validatePuzzle(start).some((m) => m.includes("starting point")));
  const hinge = JSON.parse(JSON.stringify(base));
  hinge.seg1.items[hinge.n1 - 1].fame = 1;
  assert.ok(validatePuzzle(hinge).some((m) => m.includes("hinge is an obscure object")));
  const two = JSON.parse(JSON.stringify(base));
  two.seg2.items[two.seg2.items.length - 1].fame = 1;
  two.seg2.items[two.seg2.items.length - 2].fame = 1;
  assert.ok(validatePuzzle(two).some((m) => m.includes("more than one deep cut")));
});

test("a warm-up starts from a reserved fact, with an easy first question", () => {
  let warm = 0;
  const series = generateSeries(1, 200, entities);
  for (const p of series) {
    assert.deepEqual(validatePuzzle(p), []);
    assert.equal(p.seg1.anchor.warmup, p.warmUp);
    if (p.warmUp) {
      warm++;
      const first = p.seg1.items[0];
      assert.ok(gapRatio(p.c1, p.seg1.anchor.value, first.value) >= RULES.warmMinGap, `puzzle ${p.num}: warm-up gap too small`);
      assert.ok(p.seg1.anchor.fame >= 2, "an obscure warm-up start");
    }
    const asked = [...p.seg1.items, ...p.seg2.items];
    assert.ok(asked.every((it) => !it.warmup), `puzzle ${p.num}: a reserved fact was asked as an ordinary question`);
  }
  const rate = warm / series.length;
  assert.ok(rate > 0.15 && rate < 0.6, `warm-ups on ${Math.round(rate * 100)}% of days`);
});

test("a warm-up fact is never reused inside its cooldown", () => {
  const seen = [];
  for (const p of generateSeries(1, 250, entities)) {
    const id = p.warmUp ? p.seg1.anchor.ent : null;
    if (id) assert.ok(!seen.slice(-RULES.warmCooldown).includes(id), `warm-up ${id} repeated too soon`);
    seen.push(id);
  }
});

test("validatePuzzle checks the warm-up rules", () => {
  const base = generateSeries(1, 60, entities).find((p) => p.warmUp);
  assert.ok(base, "need a warm-up puzzle to test");
  const noFlag = JSON.parse(JSON.stringify(base));
  noFlag.warmUp = false;
  assert.ok(validatePuzzle(noFlag).length > 0, "a reserved start without the warm-up flag is invalid");
  const close = JSON.parse(JSON.stringify(base));
  close.seg1.items[0].value = close.seg1.anchor.value * 1.5;
  assert.ok(validatePuzzle(close).some((m) => m.includes("warm-up gap")));
});

test("no hinge is reused inside the cooldown, famous or not", () => {
  const series = generateSeries(1, 250, entities);
  const seen = [];
  for (const p of series) {
    assert.ok(!seen.slice(-RULES.hingeCooldown).includes(p.hinge.id), `hinge ${p.hinge.id} repeated too soon`);
    seen.push(p.hinge.id);
  }
});

test("entities carry their familiarity rating, defaulting to 2", () => {
  const built = buildEntities({ entities: [
    { id: "a", name: "A", fame: 3, facts: { length: { value: 1, status: "verified", phrase: "the length of A", label: "A" } } },
    { id: "b", name: "B", facts: { length: { value: 2, status: "verified", phrase: "the length of B", label: "B" } } },
  ] });
  assert.equal(built[0].fame, 3);
  assert.equal(built[1].fame, 2);
});
