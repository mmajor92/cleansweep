// Line Up: which facts become things on the board, and how they read.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LU_CATS, buildPool, itemText } from "../lineup/data.js";

const facts = JSON.parse(readFileSync(new URL("../data/facts.json", import.meta.url), "utf8"));
const pool = buildPool(facts.entities);

test("a fact reads as a short name on the board: the measure is dropped, the first letter is a capital", () => {
  assert.equal(itemText("weight", "the weight of a banana"), "A banana");
  assert.equal(itemText("length", "the height of the Eiffel Tower"), "The Eiffel Tower");
  assert.equal(itemText("length", "the total length of Tower Bridge"), "Tower Bridge");
  assert.equal(itemText("speed", "the speed of the Space Shuttle in orbit"), "The Space Shuttle in orbit");
  assert.equal(itemText("speed", "the top speed of a cheetah"), "A cheetah");
  assert.equal(itemText("date", "the completion of the Eiffel Tower"), "Completion of the Eiffel Tower");
  assert.equal(itemText("date", "the first Space Shuttle launch"), "First Space Shuttle launch");
});

test("a fact that would read badly is left out: brackets, no measure, or too long", () => {
  assert.equal(itemText("length", "the height of the Statue of Liberty (ground to torch tip)"), null);
  assert.equal(itemText("weight", "an average adult"), null);
  assert.equal(itemText("weight", ""), null);
  assert.equal(itemText("weight", "the weight of " + "a very long description of something ".repeat(3)), null);
});

test("the pool holds verified facts about well-known things only, in the four kinds of measure, each once", () => {
  assert.deepEqual(LU_CATS, ["length", "weight", "date", "speed"]);
  const byId = Object.fromEntries(facts.entities.map((e) => [e.id, e]));
  assert.equal(new Set(pool.map((p) => p.key)).size, pool.length, "a key appears twice");
  for (const p of pool) {
    const e = byId[p.id], f = e.facts[p.cat];
    assert.equal(f.status, "verified", p.key);
    assert.ok((e.fame || 2) >= 2, p.key + " is not well known");
    assert.equal(p.value, f.value, p.key);
    assert.match(p.text, /^[A-Z0-9]/, p.key + " should start with a capital: " + p.text);
    assert.ok(!p.text.includes("("), p.key);
    assert.ok(p.text.length <= 38, p.key);
  }
});

test("the facts people would argue about, or that read oddly, are kept out", () => {
  const keys = new Set(pool.map((p) => p.key));
  for (const k of ["burj:speed", "londoneye:speed", "tube:speed", "statue:weight", "marathon:length"]) assert.ok(!keys.has(k), k + " should not be on a board");
});

test("there is enough of every kind to keep the game fresh", () => {
  for (const c of LU_CATS) assert.ok(pool.filter((p) => p.cat === c).length >= 40, c);
  assert.ok(pool.length >= 300);
});
