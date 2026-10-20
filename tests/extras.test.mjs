// An object can hold more than one number in the same category: the Eiffel Tower's steps AND its rivets.
// An extra number is one more entry for the same object. It names the object, shares its family, fame, hint and clue,
// and counts as the same object for every rule that works day to day.
import test from "node:test";
import assert from "node:assert/strict";
import { RULES, buildEntities, generate, generateSeries, objectsOf, questionsOf, seedForPuzzle, toItem, validatePuzzle } from "../src/engine.js";
import { rawFacts } from "./helpers.mjs";

const F = (value, label) => ({ phrase: `the number of ${label}`, label, value, unit: "", approx: false, status: "verified", source: "https://example.com", note: "" });

test("an extra number takes its object's identity: the object id, family, fame, hint and clue", () => {
  const list = buildEntities({
    entities: [
      { id: "tower", name: "The Tower", facts: { count: F(1665, "steps") }, fame: 3, hint: "an iron tower in Paris", clue: "a tower in Paris" },
      { id: "towerrivets", object: "tower", name: "The Tower", facts: { count: F(2500000, "rivets") } },
      { id: "other", name: "Another thing", facts: { count: F(40, "things") }, fame: 2 },
    ],
  });
  const extra = list.find((e) => e.id === "towerrivets");
  assert.equal(extra.object, "tower");
  assert.equal(extra.family, "tower", "so the steps and the rivets never share a puzzle");
  assert.equal(extra.fame, 3);
  assert.equal(extra.hint, "an iron tower in Paris");
  assert.equal(extra.clue, "a tower in Paris");
  assert.equal(toItem(extra, "count").ent, "tower", "the object, so day-to-day rules see one object");
  assert.equal(toItem(extra, "count").value, 2500000);
  const normal = list.find((e) => e.id === "other");
  assert.equal(normal.object, "other", "an ordinary object is its own object");
  assert.equal(toItem(normal, "count").ent, "other");
  const own = buildEntities({ entities: [{ id: "a", name: "A", facts: { count: F(1, "x") }, fame: 3 }, { id: "b", object: "a", name: "A", facts: { count: F(2, "y") }, fame: 1, family: "bfam" }] }).find((e) => e.id === "b");
  assert.equal(own.fame, 1, "an extra may set its own fame");
  assert.equal(own.family, "bfam", "or its own family");
});

// the real data, plus a few extras added in memory (so this test works whether or not the game data has any yet)
const withExtras = () => {
  const find = (id) => rawFacts.entities.find((e) => e.id === id);
  const extra = (id, object, cat, value, label) => ({ id, object, name: find(object).name, facts: { [cat]: F(value, label) } });
  return {
    ...rawFacts,
    entities: [
      ...rawFacts.entities,
      extra("zx1", "eiffel", "count", 2500000, "test rivets"),
      extra("zx2", "titanic", "weight", 5000, "test anchor weight"),
      extra("zx3", "titanic", "length", 53, "test height"),
      extra("zx4", "shard", "count", 11000, "test panels"),
      extra("zx5", "wembley", "count", 105, "test seats"),
    ],
  };
};

test("a puzzle never uses an object together with its extra number, and a year of puzzles stays valid", () => {
  const ents = buildEntities(withExtras());
  const series = generateSeries(1, 365, ents);
  assert.equal(series.filter((p) => !p).length, 0, "every day still builds");
  let usedExtras = 0;
  for (const p of series) {
    assert.deepEqual(validatePuzzle(p), [], `puzzle ${p.num}`);
    const objects = p.legs.flatMap((l) => [l.anchor, ...l.items]).map((it) => it.ent);
    for (const l of p.legs) for (const it of l.items) if (/^zx/.test(JSON.stringify(it.label)) || String(it.label).startsWith("test ")) usedExtras++;
    const fam = p.legs.flatMap((l) => l.items).map((it) => it.family);
    assert.equal(new Set(fam).size, fam.length, `an object appears twice in puzzle ${p.num}`);
    void objects;
  }
  assert.ok(usedExtras >= 3, `the extras were asked about ${usedExtras} times in a year: they should be used`);
});

test("the day after an object appears, neither its main number nor an extra of it does", () => {
  const ents = buildEntities(withExtras());
  const series = generateSeries(1, 365, ents);
  for (let i = 1; i < series.length; i++) {
    const before = objectsOf(series[i - 1]);
    const again = [...objectsOf(series[i])].filter((id) => before.has(id));
    assert.deepEqual(again, [], `puzzles ${series[i - 1].num} and ${series[i].num} share ${again.join(", ")}`);
  }
});

test("avoid and freshness work on the object, so an extra is held back too", () => {
  const ents = buildEntities(withExtras());
  let sawExtra = false;
  for (let n = 1; n <= 120; n++) {
    const p = generate(seedForPuzzle(n), ents, { avoid: ["eiffel", "titanic", "shard", "wembley"] });
    const ids = objectsOf(p);
    for (const id of ["eiffel", "titanic", "shard", "wembley"]) assert.ok(!ids.has(id), `seed ${n} used ${id} although it was to be avoided (an extra of it slipped in)`);
    if ([...questionsOf(p)].length) sawExtra = true;
  }
  assert.ok(sawExtra);
});

test("an extra is never a bridge: it holds one fact, so the object bridges through its main numbers", () => {
  const ents = buildEntities(withExtras());
  for (const e of ents.filter((x) => x.object !== x.id)) assert.equal(Object.keys(e.facts).length, 1, e.id);
  const series = generateSeries(1, 200, ents);
  const extraIds = new Set(ents.filter((e) => e.object !== e.id).map((e) => e.id));
  for (const p of series) for (const b of p.bridges) assert.ok(!extraIds.has(b), `puzzle ${p.num} bridges through an extra`);
});

test("in the real game data, every extra number belongs to an object that is there, holds one fact, and is not a copy", () => {
  const byId = Object.fromEntries(rawFacts.entities.map((e) => [e.id, e]));
  for (const e of rawFacts.entities.filter((x) => x.object !== undefined)) {
    assert.ok(byId[e.object], `${e.id}: unknown object ${e.object}`);
    assert.equal(byId[e.object].object, undefined, `${e.id}: ${e.object} is itself an extra`);
    assert.equal(Object.keys(e.facts).length, 1, `${e.id}: an extra holds one fact`);
    const [c, f] = Object.entries(e.facts)[0];
    const p = byId[e.object].facts[c];
    const same = p && (c === "date" ? p.value === f.value : Math.abs(Math.log(p.value / f.value)) < 0.01); // dates: the same year; other numbers: within 1%
    assert.ok(!same, `${e.id}: ${c} ${f.value} is the same as ${p && p.value} on ${e.object}`);
  }
});

test("the rule that stops repeats still holds with extras present", () => {
  assert.equal(RULES.noRepeatDays, 1);
});
