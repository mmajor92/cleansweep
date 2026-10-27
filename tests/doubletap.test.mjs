// A tap on an answer button must count once. After a tap, the old answer buttons stay on screen (fading) for about a third of a second,
// so a quick second tap, or a double-tap, lands on a button that is still there. It must be ignored.
import test from "node:test";
import assert from "node:assert/strict";
import { generateDaily } from "../src/engine.js";
import { answersFor, entities, openPage } from "./page.mjs";

async function play(extraTapsAfterAnswer, extraNextTaps) {
  const page = await openPage({ dayOffset: 3 });
  const { picks } = answersFor(generateDaily(4, entities));
  for (const pick of picks) {
    page.click({ pick });
    for (let i = 0; i < extraTapsAfterAnswer; i++) page.click({ pick: i % 2 ? "up" : "down" }); // stale buttons, either one
    page.click({}, "next");
    for (let i = 0; i < extraNextTaps; i++) page.click({}, "next");
  }
  return page;
}

test("tapping an answer once, twice or three times gives exactly the same result and the same saved state", async () => {
  const clean = await play(0, 0);
  for (const taps of [1, 2, 3]) {
    const messy = await play(taps, 0);
    assert.equal(messy.card(), clean.card(), `${taps} extra tap(s) after each answer changed the result card`);
    assert.deepEqual(messy.store, clean.store, `${taps} extra tap(s) after each answer changed what is saved`);
  }
});

test("tapping Next twice does not skip the next question", async () => {
  const clean = await play(0, 0);
  const messy = await play(0, 2);
  assert.equal(messy.card(), clean.card());
  assert.deepEqual(messy.store, clean.store);
});

test("the result never says more than seven answers", async () => {
  const messy = await play(2, 1);
  const m = /Cleaned (\d+) of (\d+)/.exec(messy.card());
  assert.ok(m && Number(m[1]) <= Number(m[2]), m && m[0]);
  assert.equal(m[2], "7");
});
