// Mystery Thing: the facts it is built from, and the frozen days file.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DATA_CATS, MIN_POOL, NOT_AN_ANSWER, buildData, tidyLabel } from "../mystery/data.js";
import { PRACTICE } from "../mystery/logic.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const facts = read("../data/facts.json"), file = read("../data/mystery-days.json");
const { objs, secrets } = buildData(facts.entities);
const byId = Object.fromEntries(objs.map((o) => [o.id, o]));
const pool = (cs) => objs.filter((o) => cs.every((c) => o.c[c]));
const key = (cs) => cs.join("+");

test("an object is in the game only if it has two or more of size, weight, speed and year; counts are never used", () => {
  for (const o of objs) { assert.ok(Object.keys(o.c).length >= 2, o.id); assert.ok(Object.keys(o.c).every((c) => DATA_CATS.includes(c)), o.id); }
  assert.ok(!objs.some((o) => o.c.count), "a count crept in");
  assert.ok(byId.eiffel && byId.giraffe, "the practice objects are missing");
});

test("the answers are the well-known objects only, minus the ones people could not picture, and each can be found in a list of 50 or more", () => {
  assert.ok(secrets.length >= 60, `only ${secrets.length} answers`);
  for (const s of secrets) {
    const o = byId[s.id];
    assert.ok(o.fame >= 3, `${s.id} is not well known`);
    assert.ok(!NOT_AN_ANSWER.test(o.name), `${s.id} should not be an answer`);
    assert.ok(s.pairs.length > 0);
    for (const p of s.pairs) { assert.ok(pool(p).includes(o), `${s.id} is not in its own list`); assert.ok(pool(p).length >= MIN_POOL, `${s.id} ${key(p)} has ${pool(p).length}`); }
  }
});

test("names use proper apostrophes and every number is a finite number", () => {
  for (const o of objs) { assert.ok(!o.name.includes("'"), o.name); for (const f of Object.values(o.c)) { assert.ok(Number.isFinite(f.v), o.id); assert.ok(!f.label.includes("'"), f.label); } }
});

test("the two practice puzzles use real answers with a long enough list", () => {
  assert.equal(PRACTICE.length, 2);
  for (const p of PRACTICE) { const o = byId[p.id]; assert.ok(o, p.id); assert.ok(p.cs.every((c) => o.c[c]), p.id); assert.ok(pool(p.cs).length >= MIN_POOL, p.id); }
});

test("data/mystery-days.json: a real launch date, days that make sense, and a few weeks of them ahead", () => {
  assert.match(file.launchDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(file.launchDate)));
  assert.ok(file.days.length >= 28, `only ${file.days.length} frozen days`);
  const by = Object.fromEntries(secrets.map((s) => [s.id, s]));
  file.days.forEach((d, i) => {
    assert.ok(by[d.id], `day ${i + 1}: ${d.id} cannot be an answer`);
    assert.ok(by[d.id].pairs.some((p) => key(p) === key(d.cs)), `day ${i + 1}: ${d.id} cannot have ${key(d.cs)}`);
  });
  const n = Math.min(file.days.length, secrets.length);
  assert.equal(new Set(file.days.slice(0, n).map((d) => d.id)).size, n, "an answer repeats within a round");
});

test("no label on the result card is just the object's name: they all say what they measure", () => {
  for (const o of objs) for (const [c, f] of Object.entries(o.c)) {
    assert.ok(f.label.trim().length > 0, `${o.id} ${c}`);
    assert.ok(!/^(a|an|the)\s/i.test(f.label), `${o.id} ${c}: "${f.label}" starts with an article`);
    assert.notEqual(f.label.toLowerCase(), o.name.replace(/^(a|an|the)\s+/i, "").toLowerCase(), `${o.id} ${c}: "${f.label}" is just the name`);
  }
  assert.equal(byId.blackrhino.c.weight.label, "Black rhinoceros weight");
  assert.equal(byId.blackrhino.c.length.label, "Black rhino height", "a label that already says what it measures is left alone");
});

test("tidyLabel: articles go, the first letter is capitalised, the measure is added, and good labels are untouched", () => {
  assert.equal(tidyLabel("A baseball", "weight", "A baseball"), "Baseball weight");
  assert.equal(tidyLabel("An AA battery", "weight", "An AA battery"), "AA battery weight");
  assert.equal(tidyLabel("A T. rex", "weight", "A T. rex"), "T. rex weight");
  assert.equal(tidyLabel("The Shard", "length", "The Shard"), "Shard size");
  assert.equal(tidyLabel("Magna Carta", "date", "Magna Carta"), "Magna Carta year");
  assert.equal(tidyLabel("a giant panda", "weight", "A giant panda"), "Giant panda weight");
  for (const [l, c] of [["Fuji last erupts", "date"], ["Black rhino height", "length"], ["Sawe's marathon pace", "speed"], ["Palace front", "length"]]) assert.equal(tidyLabel(l, c, "Whatever"), l);
  assert.equal(tidyLabel("", "weight", "A thing"), "", "an empty label is not turned into a made-up one");
});
