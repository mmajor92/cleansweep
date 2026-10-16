// Closing the page part-way through and coming back must put you exactly where you were, including across a switch of category.
import test from "node:test";
import assert from "node:assert/strict";
import { generateDaily } from "../src/engine.js";
import { answersFor, entities, openPage } from "./page.mjs";

function dayWithSwitches(n) {
  for (let d = 1; d <= 150; d++) if (generateDaily(d, entities).bridges.length === n) return d - 1;
  throw new Error(`no puzzle with ${n} switches`);
}

// What matters on a question screen. (The little "you just answered" animation is not replayed after a reload, by design.)
const grab = (html, cls) => (new RegExp(`class="${cls}[^"]*">(.*?)</p>`).exec(html) || [])[1];
const essence = (html) => ({
  tier: grab(html, "tierrow"),
  big: grab(html, "big"),
  name: grab(html, "name"),
  ask: grab(html, "ask"),
  clue: grab(html, "clue"),
  buttons: [...html.matchAll(/<button class="choice" data-pick="(\w+)">([^<]*)</g)].map((m) => m[1] + m[2]).join("|"),
});
const result = (html) => ({ score: grab(html, "score"), line: grab(html, "name"), grid: (/class="grid"[^>]*>([^<]*)</.exec(html) || [])[1] });

function finish(page, picks, from) {
  for (let q = from; q < 7; q++) {
    page.click({ pick: picks[q] });
    page.click({}, "next");
  }
  return page.card();
}

for (const switches of [1, 2, 4]) {
  test(`a game with ${switches} switch${switches > 1 ? "es" : ""} resumes exactly where it was left, wherever you stop, and ends with the same result`, async () => {
    const day = dayWithSwitches(switches);
    const { picks } = answersFor(generateDaily(day + 1, entities));
    // a few wrong answers too, so the result is not simply "perfect"
    const mixed = picks.map((p, i) => (i === 1 || i === 4 ? (p === "up" ? "down" : "up") : p));
    const straight = await openPage({ dayOffset: day });
    const wanted = result(finish(straight, mixed, 0));
    for (let stop = 1; stop <= 6; stop++) {
      const store = {};
      const first = await openPage({ store, dayOffset: day });
      for (let q = 0; q < stop; q++) {
        first.click({ pick: mixed[q] });
        first.click({}, "next");
      }
      const before = essence(first.card());
      const again = await openPage({ store, dayOffset: day }); // the page is closed and opened again
      assert.deepEqual(essence(again.card()), before, `after ${stop} answers (${switches} switches)`);
      assert.deepEqual(result(finish(again, mixed, stop)), wanted, `finishing after a reload at question ${stop + 1}`);
    }
  });
}
