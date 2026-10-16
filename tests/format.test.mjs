import test from "node:test";
import assert from "node:assert/strict";
import { differenceText, questionText, valueParts, valueText, yearLabel, yearsBetween } from "../src/format.js";

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
