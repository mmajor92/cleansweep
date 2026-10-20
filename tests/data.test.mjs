import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORY_KEYS } from "../src/engine.js";
import { entities, rawFacts } from "./helpers.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");

test("every verified fact has a source URL and a check date", () => {
  for (const e of rawFacts.entities) {
    for (const [cat, f] of Object.entries(e.facts)) {
      if (f.status === "verified") {
        assert.match(f.source, /^https?:\/\//, `${e.id}/${cat}`);
        assert.match(f.checkedOn, /^\d{4}-\d{2}-\d{2}$/, `${e.id}/${cat}`);
      }
    }
  }
});

test("definitional facts say why they are true", () => {
  for (const e of rawFacts.entities) {
    for (const [cat, f] of Object.entries(e.facts)) {
      if (f.status === "definitional") assert.ok(f.basis, `${e.id}/${cat}`);
    }
  }
});

test("no fact value is zero or negative except BC years", () => {
  for (const e of rawFacts.entities) {
    for (const [cat, f] of Object.entries(e.facts)) {
      if (cat === "date") assert.notEqual(f.value, 0);
      else assert.ok(f.value > 0, `${e.id}/${cat}`);
    }
  }
});

test("there are enough facts in every category", () => {
  for (const c of CATEGORY_KEYS) {
    assert.ok(entities.filter((e) => e.facts[c]).length >= 12, c);
  }
});

test("there are at least 12 hinge objects", () => {
  assert.ok(entities.filter((e) => Object.keys(e.facts).length >= 2).length >= 12);
});

test("candidates are not in the production pool", () => {
  const cands = JSON.parse(readFileSync(join(root, "data/candidates.json"), "utf8"));
  const ids = new Set(rawFacts.entities.map((e) => e.id));
  for (const c of cands.entities) assert.ok(!ids.has(c.id), c.id);
});

test("no text field uses an em or en dash", () => {
  const text = readFileSync(join(root, "data/facts.json"), "utf8");
  assert.ok(!/[\u2014\u2013]/.test(text));
});

test("hints and clues are short, plain and carry no dashes", () => {
  for (const e of rawFacts.entities) {
    for (const key of ["hint", "clue"]) {
      if (e[key] === undefined) continue;
      assert.ok(typeof e[key] === "string" && e[key].length > 0 && e[key].length <= 80, `${e.id}.${key}`);
      assert.ok(!/[\u2014\u2013]/.test(e[key]), `${e.id}.${key}`);
    }
  }
});

test("clues contain no numbers except a year or decade", () => {
  for (const e of rawFacts.entities) {
    if (e.clue) assert.ok(!/\d/.test(e.clue.replace(/\b(18|19|20)\d\d?s?\b/g, "")), `${e.id}.clue`);
  }
});

test("a fact from Wikidata says so, points at its Wikidata page, and has a check date", () => {
  let n = 0;
  for (const e of rawFacts.entities) {
    for (const [cat, f] of Object.entries(e.facts)) {
      if (f.status !== "wikidata") continue;
      n++;
      assert.match(f.source, /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/, `${e.id}/${cat}`);
      assert.match(f.checkedOn, /^\d{4}-\d{2}-\d{2}$/, `${e.id}/${cat}`);
    }
  }
  assert.ok(n >= 28, `${n} facts are from Wikidata`);
});
