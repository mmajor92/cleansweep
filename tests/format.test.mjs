import test from "node:test";
import assert from "node:assert/strict";
import { differenceText, displayName, figureText, questionText, valueParts, valueText, yearLabel, yearsBetween } from "../src/format.js";
import { entities } from "./helpers.mjs";

test("yearLabel handles BC and approximate years", () => {
  assert.equal(yearLabel(1969), "1969");
  assert.equal(yearLabel(-30), "30 BC");
  assert.equal(yearLabel(-2560, true), "c. 2560 BC");
});

test("yearsBetween skips year zero", () => {
  assert.equal(yearsBetween(1969, -30), 1998);
  assert.equal(yearsBetween(-30, -2560), 2530);
  assert.equal(yearsBetween(1912, 1889), 23);
});

test("weight formatting switches units", () => {
  assert.deepEqual(valueParts("weight", { value: 274 }), { num: "274", unit: "kg" });
  assert.deepEqual(valueParts("weight", { value: 6000, approx: true }), { num: "about 6", unit: "tonnes" });
  assert.deepEqual(valueParts("weight", { value: 53150000 }), { num: "53,150", unit: "tonnes" });
  assert.deepEqual(valueParts("weight", { value: 1000, approx: true }), { num: "about 1", unit: "tonne" }); // one tonne, not "1 tonnes"
  assert.deepEqual(valueParts("weight", { value: 1500 }), { num: "1.5", unit: "tonnes" });
  assert.deepEqual(valueParts("weight", { value: 5.9e9 }), { num: "5.9", unit: "million tonnes" });
});

test("other categories format correctly", () => {
  assert.equal(valueText("length", { value: 269.1 }), "269.1 m");
  assert.equal(valueText("speed", { value: 2179 }), "2,179 km/h");
  assert.equal(valueText("count", { value: 1665 }), "1,665");
  assert.equal(valueText("date", { value: 1912 }), "1912");
});

test("difference text uses percent below 2x and times above", () => {
  const words = ["lighter", "heavier"];
  assert.equal(differenceText("weight", words, { value: 150, label: "A" }, { value: 100, label: "B" }), "That is 50% heavier than B.");
  assert.equal(differenceText("weight", words, { value: 300, label: "A" }, { value: 100, label: "B" }), "That is 3 times heavier than B.");
  assert.equal(
    differenceText("date", ["earlier", "later"], { value: 1889, label: "E" }, { value: 1912, label: "T" }),
    "23 years earlier than T."
  );
});

test("question text differs for dates", () => {
  const item = { phrase: "the Eiffel Tower's completion" };
  const prev = { phrase: "the sinking of the Titanic" };
  assert.equal(questionText("date", ["earlier", "later"], item, prev), "Did the Eiffel Tower's completion happen before or after the sinking of the Titanic?");
  assert.equal(questionText("length", ["shorter", "longer"], { phrase: "A" }, { phrase: "B" }), "Is A longer or shorter than B?");
});

test("years below 1000 are written with AD, BC keeps BC, and the era is the small unit under the big figure", () => {
  assert.equal(yearLabel(80), "80 AD");
  assert.equal(yearLabel(122, true), "c. 122 AD");
  assert.equal(yearLabel(999), "999 AD");
  assert.equal(yearLabel(1000), "1000");
  assert.deepEqual(valueParts("date", { value: 80 }), { num: "80", unit: "AD" });
  assert.deepEqual(valueParts("date", { value: -44 }), { num: "44", unit: "BC" });
  assert.deepEqual(valueParts("date", { value: -2560, approx: true }), { num: "c. 2560", unit: "BC" });
  assert.deepEqual(valueParts("date", { value: 1215 }), { num: "1215", unit: "" });
  assert.equal(valueText("date", { value: 80 }), "80 AD");
  assert.equal(valueText("date", { value: -44 }), "44 BC");
});

test("no year in the pool is ever shown as a bare number below 1000", () => {
  for (const e of entities) {
    const f = e.facts.date;
    if (!f) continue;
    const text = valueText("date", f);
    if (f.value > 0 && f.value < 1000) assert.match(text, / AD$/, `${e.id}: ${text}`);
    if (f.value < 0) assert.match(text, / BC$/, `${e.id}: ${text}`);
  }
});

test("figureText is the figure and its unit, without 'about' or 'c.', because the big answer already says that", () => {
  assert.equal(valueText("length", { value: 117500, approx: true }), "about 117,500 m");
  assert.equal(figureText("length", { value: 117500, approx: true }), "117,500 m");
  assert.equal(figureText("weight", { value: 6000, approx: true }), "6 tonnes");
  assert.equal(figureText("date", { value: -2560, approx: true }), "2560 BC");
  assert.equal(figureText("date", { value: 80 }), "80 AD");
  assert.equal(figureText("count", { value: 22 }), "22");
  assert.equal(figureText("speed", { value: 44 }), valueText("speed", { value: 44 }), "an exact figure is unchanged");
});

test("displayName: a date uses the question's own wording; a long one, and every other category, uses its label", () => {
  const date = (phrase, label) => displayName("date", { phrase, label });
  assert.equal(date("the sealing of Magna Carta", "Magna Carta"), "Sealing of Magna Carta");
  assert.equal(date("the opening of the Colosseum", "Colosseum opens"), "Opening of the Colosseum");
  assert.equal(date("Columbus's first landing in the Americas", "Columbus lands"), "Columbus's first landing in the Americas");
  assert.equal(date("the first international cricket match between Australia and England", "First international cricket match"), "First international cricket match", "too long, so the short label");
  assert.equal(displayName("length", { phrase: "the length of Hadrian's Wall", label: "Hadrian's Wall length" }), "Hadrian's Wall length");
});

test("every date in the pool gets a tidy line under its figure: capitalised, no leading 'the', and not too long", () => {
  for (const e of entities) {
    const f = e.facts.date;
    if (!f) continue;
    const line = displayName("date", f);
    assert.match(line, /^[A-Z0-9]/, `${e.id}: "${line}" should start with a capital`);
    assert.ok(!/^the /i.test(line), `${e.id}: "${line}"`);
    assert.ok(line.length <= 45 || line === f.label, `${e.id}: "${line}" is too long`);
  }
});

