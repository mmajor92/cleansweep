import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES, CATEGORY_KEYS, RULES, buildEntities, correctPick, gapOk, gapRatio, generate, generateDaily, generateSeries,
  countdownText, nextPuzzleTime, normalizePuzzle, puzzleNumber, questionsOf, seedForPuzzle, shareText, startCategoryFor, streaks, validatePuzzle, yearsAgo,
} from "../src/engine.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { entities, warmEntities } from "./helpers.mjs";

// Warm-ups are off in the game, so the tests of the warm-up machinery switch them on for the length of the test, on a pool that has reserved facts.
const withWarmUps = (fn) => {
  const keep = RULES.warmChance;
  RULES.warmChance = 0.5;
  try {
    return fn();
  } finally {
    RULES.warmChance = keep;
  }
};

const root = join(fileURLToPath(import.meta.url), "..", "..");
const allItems = (p) => [p.legs[0].anchor, ...questionsOf(p).map((x) => x.item)];

// Several tests look at the share card without its web address, which is added on the last line.
const withoutUrl = (fn) => {
  const before = RULES.shareUrl;
  RULES.shareUrl = "";
  try {
    return fn();
  } finally {
    RULES.shareUrl = before;
  }
};

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

test("a puzzle only uses facts with an allowed status, and the allowed statuses are exactly the four we have agreed", () => {
  assert.deepEqual(RULES.allowedStatuses, ["verified", "definitional", "wikidata", "unchecked"], "adding a status is a deliberate decision");
  for (let n = 1; n <= 100; n++) {
    const p = generate(seedForPuzzle(n), entities);
    for (const it of p.legs.flatMap((l) => [l.anchor, ...l.items])) {
      assert.ok(RULES.allowedStatuses.includes(it.status), `${it.label} has the status "${it.status}"`);
    }
  }
});

test("bridges link the stretches: the same object ends one and starts the next, in a different category", () => {
  for (let n = 1; n <= 60; n++) {
    const p = generate(seedForPuzzle(n), entities);
    assert.equal(p.legs.reduce((t, l) => t + l.items.length, 0), RULES.chainLength);
    assert.equal(p.bridges.length, p.legs.length - 1);
    p.legs.slice(1).forEach((leg, i) => {
      const before = p.legs[i];
      assert.equal(before.items[before.items.length - 1].ent, leg.anchor.ent, `puzzle ${n}: stretch ${i + 2} does not start where the last one ended`);
      assert.equal(p.bridges[i], leg.anchor.ent);
      assert.notEqual(before.cat, leg.cat);
    });
  }
});

test("a puzzle can have one to four switches, and a run of days uses them all", () => {
  const counts = new Set();
  for (const p of generateSeries(1, 200, entities)) {
    assert.ok(p.bridges.length >= 1 && p.bridges.length <= RULES.bridgeChances.length, `puzzle ${p.num}: ${p.bridges.length} switches`);
    counts.add(p.bridges.length);
  }
  assert.deepEqual([...counts].sort(), [1, 2, 3, 4]);
});

test("pacing: the day after a busy day (three or more switches) has at most two", () => {
  const series = generateSeries(1, 250, entities);
  let busy = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1].bridges.length >= RULES.busyDay) {
      busy++;
      assert.ok(series[i].bridges.length < RULES.busyDay, `puzzle ${series[i].num} follows a busy day and is busy itself`);
    }
  }
  assert.ok(busy > 10, "the test should have met some busy days");
});

test("you can ask for an exact number of switches and a starting category", () => {
  for (const bridges of [1, 2, 3]) {
    const p = generate(seedForPuzzle(5), entities, { bridges, startCat: "weight" });
    assert.equal(p.bridges.length, bridges);
    assert.equal(p.legs[0].cat, "weight");
    assert.deepEqual(validatePuzzle(p), []);
  }
});

test("no category takes more than 5 of the 7 questions, and the answers are never lopsided", () => {
  for (const p of generateSeries(1, 200, entities)) {
    const qs = questionsOf(p);
    const per = {};
    qs.forEach((x) => (per[x.cat] = (per[x.cat] || 0) + 1));
    assert.ok(Math.max(...Object.values(per)) <= RULES.maxPerCategory, `puzzle ${p.num}`);
    const ups = qs.filter((x) => x.item.value > x.prev.value).length;
    assert.ok(ups >= RULES.minUps && ups <= RULES.maxUps, `puzzle ${p.num}: ${ups} higher answers`);
  }
});

test("answers never run more than 4 in a row, and a stretch of 3 or more has a higher and a lower answer", () => {
  for (const p of generateSeries(1, 200, entities)) {
    const dirs = questionsOf(p).map((x) => x.item.value > x.prev.value);
    let run = 1;
    for (let i = 1; i < dirs.length; i++) {
      run = dirs[i] === dirs[i - 1] ? run + 1 : 1;
      assert.ok(run <= RULES.maxRun, `puzzle ${p.num}: ${run} in a row`);
    }
    for (const leg of p.legs) {
      if (leg.items.length < RULES.stretchBothWays) continue;
      let prev = leg.anchor;
      const d = leg.items.map((it) => { const up = it.value > prev.value; prev = it; return up; });
      assert.ok(d.includes(true) && d.includes(false), `puzzle ${p.num}: a stretch of ${leg.items.length} all went one way`);
    }
  }
});

test("validatePuzzle rejects a run of one-way answers, a stretch that only goes one way, and two stretches in the same category", () => {
  const base = generateSeries(1, 60, entities).find((p) => p.legs.some((l) => l.items.length >= 3));
  assert.ok(base);
  const li = base.legs.findIndex((l) => l.items.length >= 3);
  const oneWay = structuredClone(base);
  let prev = oneWay.legs[li].anchor;
  for (const it of oneWay.legs[li].items) { it.value = prev.value * 1.5; prev = it; }
  assert.ok(validatePuzzle(oneWay).some((m) => m.includes("all one direction")));
  const same = structuredClone(generateSeries(1, 60, entities).find((p) => p.legs.length >= 2));
  same.legs[1].cat = same.legs[0].cat;
  assert.ok(validatePuzzle(same).some((m) => m.includes("same category")));
});

test("startCategoryFor uses every category once in each block of 5 days", () => {
  for (const start of [1, 6, 11, 96]) {
    const seen = new Set();
    for (let d = start; d < start + 5; d++) seen.add(startCategoryFor(d));
    assert.equal(seen.size, CATEGORY_KEYS.length);
  }
});

test("a run of daily puzzles covers every switch between categories and stays valid", () => {
  const series = generateSeries(1, 200, entities);
  assert.equal(series.filter((p) => !p).length, 0);
  for (const p of series) assert.deepEqual(validatePuzzle(p), []);
  const switches = new Set(series.flatMap((p) => p.legs.slice(1).map((l, i) => `${p.legs[i].cat}>${l.cat}`)));
  assert.equal(switches.size, 20, `only ${switches.size} of the 20 possible switches appeared`);
  for (const p of series) assert.equal(p.legs[0].cat, startCategoryFor(p.num));
});

test("generateDaily matches generateSeries", () => {
  assert.deepEqual(generateDaily(10, entities), generateSeries(10, 1, entities)[0]);
});

test("validatePuzzle catches a broken puzzle", () => {
  const p = generate(seedForPuzzle(3), entities);
  const broken = structuredClone(p);
  broken.legs[0].items[0].value = broken.legs[0].anchor.value; // a tie
  assert.ok(validatePuzzle(broken).length > 0);
});

test("a puzzle published before v3 (two halves, one hinge) is converted, still valid, and has one bridge", () => {
  const old = JSON.parse(readFileSync(join(root, "puzzles", "1.json"), "utf8"));
  assert.ok(old.seg1 && old.hinge, "puzzle 1 is meant to be a two-half puzzle");
  const p = normalizePuzzle(old);
  assert.equal(p.legs.length, 2);
  assert.deepEqual(p.bridges, [old.hinge.id]);
  assert.deepEqual(validatePuzzle(old), []);
  const qs = questionsOf(old);
  assert.equal(qs.length, 7);
  assert.equal(qs.filter((x) => x.bridge).length, 1);
  assert.equal(qs.filter((x) => x.start).length, 2);
  assert.equal(normalizePuzzle(p), p, "a new puzzle passes through unchanged");
});

test("questionsOf lists the 7 questions with what each starts from, and marks the starts and the bridges", () => {
  const p = generate(seedForPuzzle(11), entities, { bridges: 2 });
  const qs = questionsOf(p);
  assert.equal(qs.length, 7);
  assert.deepEqual(qs.map((x) => x.q), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(qs[0].prev, p.legs[0].anchor);
  assert.equal(qs.filter((x) => x.start).length, 3);
  assert.equal(qs.filter((x) => x.bridge).length, 2);
  for (const x of qs.filter((x) => x.bridge)) {
    assert.equal(x.nextAnchor.ent, x.item.ent, "the next stretch starts from the same object");
    assert.ok(qs[x.q + 1].start && qs[x.q + 1].prev === x.nextAnchor);
  }
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
  const text = withoutUrl(() => shareText(p, [true, true, false, true, true, true, true], 5));
  assert.match(text, /^Clean Sweep #5\n/);
  assert.match(text, /Longest Sweep: 4 \| Cleaned: 6\/7$/);
  assert.equal((text.match(/\u{1F9F9}/gu) || []).length, 6); // six brooms
  assert.equal((text.match(/\u{1F4A8}/gu) || []).length, 1); // one puff of dust
  assert.match(text.split("\n")[1], /^(?:\u{1F9F9}|\u{1F4A8}){7}$/u); // exactly seven emojis, one per question, nothing else
  assert.match(shareText(p, [true, true, true, true, true, false, true], null), /\(practice\)/);
});

test("a perfect run gets the sparkle header", () => {
  const p = generate(seedForPuzzle(5), entities);
  const text = withoutUrl(() => shareText(p, [true, true, true, true, true, true, true], 14));
  assert.match(text, /^\u2728 Clean Sweep #14 \u2728\n/);
  assert.match(text, /Longest Sweep: 7 \| Cleaned: 7\/7$/);
  assert.ok(!/\u{1F4A8}/u.test(text));
  assert.equal(text.split("\n")[1], "\u{1F9F9}".repeat(7));
});

test("the share card has no web address until one is set, then ends with it", () => {
  const p = generate(seedForPuzzle(5), entities);
  const results = [true, false, true, true, true, true, true];
  assert.ok(!/http|www\.|\.com/.test(withoutUrl(() => shareText(p, results, 3))));
  const before = RULES.shareUrl;
  RULES.shareUrl = "cleansweep.example";
  try {
    assert.ok(shareText(p, results, 3).endsWith("\ncleansweep.example"));
  } finally {
    RULES.shareUrl = before;
  }
});

test("the share card ends with the TinyURL by default", () => {
  const p = generate(seedForPuzzle(5), entities);
  assert.equal(RULES.shareUrl, "cleansweepdaily.fyi");
  assert.ok(shareText(p, [true, false, true, true, true, true, true], 3).endsWith("\ncleansweepdaily.fyi"));
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

test("a bridge carries its hint into both of its stretches", () => {
  let checked = 0;
  for (let n = 1; n <= 60; n++) {
    const p = generate(seedForPuzzle(n), entities);
    p.legs.slice(1).forEach((leg) => {
      const e = entities.find((x) => x.id === leg.anchor.ent);
      assert.equal(leg.anchor.hint, e.hint, `puzzle ${n}: bridge ${leg.anchor.ent}`);
      if (e.hint) checked++;
    });
  }
  assert.ok(checked > 10, "most bridges should have a hint");
});

test("a new puzzle: no step more than 3x, a bridge up to 3x, later steps tighter; a published puzzle is judged by the loosest limits ever used", () => {
  assert.equal(gapOk("length", 100, 300, 1, 1, true), true); // 3x as a bridge
  assert.equal(gapOk("length", 100, 305, 1, 1, true), false); // over 3x is too far for a new puzzle
  assert.equal(gapOk("length", 100, 300, 1, 1, false), false); // 3x in the second slot of a stretch (limit 2.5x)
  assert.equal(gapOk("length", 100, 290, 0, 1, false), true); // the first step may be nearly 3x
  assert.equal(gapOk("length", 100, 390, 0, 1, false), false); // but not 3.9x any more
  // puzzles that were published under the old limits must stay valid
  assert.equal(gapOk("length", 100, 305, 1, 1, true, true), true); // a bridge up to 3.1x
  assert.equal(gapOk("length", 100, 390, 0, 1, false, true), true); // a first step up to 4x
  assert.equal(gapOk("length", 100, 450, 0, 1, false, true), false); // and no further
});

test("warm-ups are off: no fact is reserved, no new puzzle opens with one, and no ordinary question is more than 3 times apart", () => {
  assert.equal(RULES.warmChance, 0);
  assert.deepEqual(entities.filter((e) => Object.values(e.facts).some((f) => f.warmup)).map((e) => e.id), [], "a fact is still reserved");
  for (const p of generateSeries(1, 150, entities)) {
    assert.equal(p.warmUp, false, `puzzle ${p.num} opens with a warm-up`);
    for (const q of questionsOf(p)) {
      if (q.item.closer) continue; // a "closer in time" question has two distances instead of a gap (tests/closer.test.mjs)
      const r = gapRatio(q.cat, q.prev.value, q.item.value);
      assert.ok(r <= 3 * (p.slack || 1) + 1e-9, `puzzle ${p.num}: ${q.prev.label} to ${q.item.label} is ${r.toFixed(2)}x apart`);
    }
  }
});

test("familiarity: well-known objects are picked more often than moderately known ones", () => {
  const fameOf = Object.fromEntries(entities.map((e) => [e.id, e.fame]));
  const count = { 3: 0, 2: 0, 1: 0 };
  for (const p of generateSeries(1, 200, entities)) {
    for (const it of allItems(p)) count[fameOf[it.ent]]++;
  }
  const per = (f) => count[f] / entities.filter((e) => e.fame === f && e.object === e.id).length; // objects, counted once however many numbers they hold
  assert.ok(per(3) > per(2) * 1.05, "rating 3 objects should be used more per object than rating 2");
  const share1 = count[1] / (count[1] + count[2] + count[3]);
  assert.ok(share1 < 0.12, `enthusiast objects should stay under 12% of questions, got ${Math.round(share1 * 100)}%`);
});

test("a deep cut is at most one per puzzle, never question 1 or 2, never a bridge", () => {
  let deep = 0;
  const positions = new Set();
  const series = generateSeries(1, 200, entities);
  for (const p of series) {
    assert.deepEqual(validatePuzzle(p), []);
    const qs = questionsOf(p);
    const idx = qs.filter((x) => x.item.fame === 1).map((x) => x.q);
    assert.ok(idx.length <= 1, `puzzle ${p.num}: more than one deep cut`);
    assert.ok(idx.every((i) => i >= 2), `puzzle ${p.num}: deep cut in the first two questions`);
    assert.ok(idx.every((i) => !qs[i].bridge), `puzzle ${p.num}: a bridge is a deep cut`);
    assert.notEqual(p.legs[0].anchor.fame, 1, "an obscure starting point");
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
    const item = allItems(p).find((it) => it.fame === 1);
    const id = item ? item.ent : null;
    if (id) assert.ok(!seen.slice(-RULES.spiceCooldown).includes(id), `deep cut ${id} repeated too soon`);
    seen.push(id);
  }
});

test("validatePuzzle rejects a misplaced or doubled deep cut", () => {
  const base = generate(seedForPuzzle(3), entities, { bridges: 2 });
  const early = JSON.parse(JSON.stringify(base));
  early.legs[0].items[0].fame = 1;
  assert.ok(validatePuzzle(early).some((m) => m.includes("deep cut too early")));
  const start = JSON.parse(JSON.stringify(base));
  start.legs[0].anchor.fame = 1;
  assert.ok(validatePuzzle(start).some((m) => m.includes("starting point")));
  const bridge = JSON.parse(JSON.stringify(base));
  bridge.legs[0].items[bridge.legs[0].items.length - 1].fame = 1;
  assert.ok(validatePuzzle(bridge).some((m) => m.includes("the bridge is an obscure object")));
  const two = JSON.parse(JSON.stringify(base));
  const spots = questionsOf(two).filter((x) => x.q >= RULES.deepCutFrom - 1 && !x.bridge).slice(0, 2); // two ordinary questions after the second
  assert.equal(spots.length, 2);
  spots.forEach((x) => (x.item.fame = 1)); // questionsOf returns the puzzle's own items, so this marks them in the copy
  assert.ok(validatePuzzle(two).some((m) => m.includes("more than one deep cut")));
});

test("a warm-up starts from a reserved fact, with an easy first question", () => {
  let warm = 0;
  const series = withWarmUps(() => generateSeries(1, 200, warmEntities));
  for (const p of series) {
    assert.deepEqual(validatePuzzle(p), []);
    assert.equal(p.legs[0].anchor.warmup, p.warmUp);
    if (p.warmUp) {
      warm++;
      const first = p.legs[0].items[0];
      assert.ok(gapRatio(p.legs[0].cat, p.legs[0].anchor.value, first.value) >= RULES.warmMinGap, `puzzle ${p.num}: warm-up gap too small`);
      assert.ok(p.legs[0].anchor.fame >= 2, "an obscure warm-up start");
    }
    assert.ok(questionsOf(p).every((x) => !x.item.warmup), `puzzle ${p.num}: a reserved fact was asked as an ordinary question`);
  }
  const rate = warm / series.length;
  assert.ok(rate > 0.15 && rate < 0.6, `warm-ups on ${Math.round(rate * 100)}% of days`);
});

test("a warm-up fact is never reused inside its cooldown", () => {
  const seen = [];
  for (const p of withWarmUps(() => generateSeries(1, 250, warmEntities))) {
    const id = p.warmUp ? p.legs[0].anchor.ent : null;
    if (id) assert.ok(!seen.slice(-RULES.warmCooldown).includes(id), `warm-up ${id} repeated too soon`);
    seen.push(id);
  }
});

test("validatePuzzle checks the warm-up rules", () => {
  const base = withWarmUps(() => generateSeries(1, 60, warmEntities)).find((p) => p.warmUp);
  assert.ok(base, "need a warm-up puzzle to test");
  const noFlag = JSON.parse(JSON.stringify(base));
  noFlag.warmUp = false;
  assert.ok(validatePuzzle(noFlag).length > 0, "a reserved start without the warm-up flag is invalid");
  const close = JSON.parse(JSON.stringify(base));
  close.legs[0].items[0].value = close.legs[0].anchor.value * 1.5;
  assert.ok(validatePuzzle(close).some((m) => m.includes("warm-up gap")));
});

test("no bridge is reused inside the cooldown, famous or not", () => {
  const series = generateSeries(1, 250, entities);
  const days = [];
  for (const p of series) {
    const recent = new Set(days.slice(-RULES.hingeCooldown).flat());
    for (const id of p.bridges) assert.ok(!recent.has(id), `puzzle ${p.num}: bridge ${id} repeated too soon`);
    days.push(p.bridges);
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

test("the countdown counts real time to the next puzzle, rounded up to the minute", () => {
  assert.equal(countdownText(new Date("2026-10-16T18:00:00Z")), "6h");
  assert.equal(countdownText(new Date("2026-10-16T17:47:50Z")), "6h 13m"); // 6h 12m 10s left rounds up
  assert.equal(countdownText(new Date("2026-10-16T12:30:15Z")), "11h 30m");
  assert.equal(countdownText(new Date("2026-10-16T23:20:00Z")), "40m");
  assert.equal(countdownText(new Date("2026-10-16T23:59:30Z")), "1m");
  assert.equal(countdownText(new Date("2026-10-16T00:00:00Z")), "24h"); // the moment a puzzle arrives, the next is a day away
});

test("the countdown does not depend on the time zone or on UK clocks changing", () => {
  // The same instant gives the same answer wherever the phone is, because it counts real time to 00:00 UTC.
  const now = new Date("2026-10-24T22:00:00Z"); // the night before UK clocks go back
  assert.equal(countdownText(now), "2h");
  assert.equal(countdownText(new Date("2026-10-25T22:00:00Z")), "2h");
});
