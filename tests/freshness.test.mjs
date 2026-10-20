// Objects that appeared recently are picked less, so the whole pool gets used instead of the same few objects coming round again and again.
import test from "node:test";
import assert from "node:assert/strict";
import { RULES, freshness, generate, generateSeries, objectsOf, questionsOf, seedForPuzzle } from "../src/engine.js";
import { entities } from "./helpers.mjs";

test("freshness is 1 for an object not seen for a while, and drops to the floor for one seen yesterday", () => {
  assert.equal(freshness(undefined), 1, "never seen");
  assert.equal(freshness(RULES.freshDays), 1);
  assert.equal(freshness(RULES.freshDays + 100), 1, "it never goes above 1");
  const yesterday = freshness(1);
  assert.ok(yesterday >= RULES.freshFloor && yesterday < RULES.freshFloor + 0.05, `seen yesterday: ${yesterday}`);
  let previous = 0;
  for (let d = 1; d <= RULES.freshDays; d++) {
    const f = freshness(d);
    assert.ok(f >= previous && f >= RULES.freshFloor && f <= 1, `day ${d}`);
    previous = f;
  }
});

test("an object that appeared recently is picked far less often than one that did not", () => {
  const everyone = entities.filter((e) => e.fame === 3).slice(0, 30).map((e) => e.id);
  let normal = 0;
  let recent = 0;
  for (let n = 1; n <= 300; n++) {
    normal += [...objectsOf(generate(seedForPuzzle(n), entities))].filter((id) => everyone.includes(id)).length;
    recent += [...objectsOf(generate(seedForPuzzle(n), entities, { seen: [new Set(everyone)] }))].filter((id) => everyone.includes(id)).length;
  }
  assert.ok(recent < normal * 0.6, `${recent} appearances when seen yesterday against ${normal} when not`);
});

test("a puzzle always still builds, however much has been seen recently", () => {
  const all = new Set(entities.map((e) => e.id));
  const days = Array.from({ length: RULES.freshDays }, () => all);
  for (let n = 1; n <= 20; n++) assert.ok(generate(seedForPuzzle(n), entities, { seen: days }), `seed ${n}`);
});

test("over a year the pool is used evenly: few everyday objects are almost never seen (under 2 days), repeats within a week stay low, and familiar objects still lead", () => {
  const series = generateSeries(1, 365, entities);
  const days = {};
  series.forEach((p) => objectsOf(p).forEach((id) => (days[id] = (days[id] || 0) + 1)));
  const everyday = entities.filter((e) => e.fame >= 2 && e.object === e.id); // objects, counted once however many numbers they hold
  const rare = everyday.filter((e) => (days[e.id] || 0) < 2);
  assert.ok(rare.length / everyday.length < 0.12, `${rare.length} of ${everyday.length} everyday objects appear on fewer than 2 days: ${rare.map((e) => e.id).join(", ")}`);
  let again = 0;
  for (let i = 7; i < series.length; i++) {
    const week = new Set();
    for (let j = i - 7; j < i; j++) objectsOf(series[j]).forEach((id) => week.add(id));
    again += [...objectsOf(series[i])].filter((id) => week.has(id)).length;
  }
  assert.ok(again / (series.length - 7) < 2.8, `${(again / (series.length - 7)).toFixed(2)} objects a day were also used in the last 7 days`);
  const fame = Object.fromEntries(entities.map((e) => [e.id, e.fame]));
  const items = series.flatMap((p) => [p.legs[0].anchor, ...questionsOf(p).map((x) => x.item)]);
  const share = items.filter((it) => fame[it.ent] === 3).length / items.length;
  assert.ok(share > 0.5, `only ${Math.round(share * 100)}% of questions use objects everyone knows`);
});

test("a series warms up for long enough to know what was seen recently", () => {
  assert.ok(Math.max(30, RULES.freshDays) >= RULES.freshDays);
  const a = generateSeries(60, 1, entities)[0];
  const b = generateSeries(60, 1, entities, RULES.freshDays)[0];
  assert.deepEqual(a, b, "the default warm-up is at least freshDays");
});
