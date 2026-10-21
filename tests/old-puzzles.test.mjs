// Puzzles published before v3 (two halves and one hinge) must keep working: playing, resuming part-way, and finishing.
// Puzzles 1 and 2 are the real published files and stay in the old shape for good, so this runs the real game code against them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { correctPick, questionsOf } from "../src/engine.js";
import { mountGame } from "../src/ui.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
let clickHandler = null;

/** Just enough of a browser for the game's own code. Returns a function that puts the real timers back. */
function fakeBrowser() {
  const realInterval = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  globalThis.document = {
    body: { appendChild() {} },
    addEventListener: (type, handler) => { if (type === "click") clickHandler = handler; },
    getElementById: () => ({ textContent: "", style: {}, setAttribute() {}, appendChild() {} }),
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
    execCommand: () => true,
    visibilityState: "visible",
  };
  globalThis.setInterval = () => 0; // the result card starts a countdown clock: not wanted here
  globalThis.clearInterval = () => {};
  return () => {
    globalThis.setInterval = realInterval;
    globalThis.clearInterval = realClear;
    delete globalThis.document;
  };
}

function memoryStorage() {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}

function open(puzzle, storage, todayNum) {
  const card = { innerHTML: "", querySelector: () => ({ focus() {}, style: {}, getAttribute: () => null }), querySelectorAll: () => [], appendChild() {} };
  const el = () => ({ innerHTML: "", textContent: "", style: {}, setAttribute() {} });
  mountGame({ root: { tabs: el(), meta: el(), chain: el(), card }, storage, todayNum, dailyPuzzle: puzzle, practicePuzzles: [] });
  return {
    card: () => card.innerHTML,
    click: (dataset, id) => clickHandler({ target: { closest: () => ({ dataset: dataset || {}, id: id || "" }) } }),
  };
}

const grab = (html, cls) => (new RegExp(`class="${cls}[^"]*">(.*?)</p>`).exec(html) || [])[1];
const essence = (html) => ({
  tier: grab(html, "tierrow"), big: grab(html, "big"), name: grab(html, "name"), ask: grab(html, "ask"), clue: grab(html, "clue"),
  buttons: [...html.matchAll(/<button class="choice" data-pick="(\w+)">([^<]*)</g)].map((m) => m[1] + m[2]).join("|"),
});
const result = (html) => ({ score: grab(html, "score"), line: grab(html, "name") });

function answerAll(game, picks, from, to) {
  for (let q = from; q < to; q++) {
    game.click({ pick: picks[q] });
    game.click({}, "next");
  }
}

for (const n of [1, 2]) {
  const old = JSON.parse(readFileSync(join(root, "puzzles", `${n}.json`), "utf8"));
  const picks = questionsOf(old).map((x) => correctPick(x.item, x.prev));
  const mixed = picks.map((p, i) => (i === 1 || i === 4 ? (p === "up" ? "down" : "up") : p)); // a couple of wrong answers too

  test(`puzzle ${n} is still in the old two-half shape, and the game plays it to a perfect result`, () => {
    assert.ok(old.seg1 && old.seg2 && old.hinge && !old.legs, `puzzles/${n}.json is meant to stay in the old shape`);
    const restore = fakeBrowser();
    try {
      const game = open(old, memoryStorage(), n);
      answerAll(game, picks, 0, 7);
      assert.match(game.card(), /class="score">100/);
      const listed = /Facts in this puzzle<\/summary><ul>([\s\S]*?)<\/ul>/.exec(game.card())[1].split("</li>").filter((x) => x.includes("<li>"));
      assert.equal(listed.length, 9, "the first start, 7 questions, and the new start after the hinge");
    } finally {
      restore();
    }
  });

  test(`puzzle ${n} resumes exactly where it was left, wherever you stop, and ends with the same result`, () => {
    const restore = fakeBrowser();
    try {
      const straight = open(old, memoryStorage(), n);
      answerAll(straight, mixed, 0, 7);
      const wanted = result(straight.card());
      for (let stop = 1; stop <= 6; stop++) {
        const storage = memoryStorage();
        const first = open(old, storage, n);
        answerAll(first, mixed, 0, stop);
        const before = essence(first.card());
        const again = open(old, storage, n); // the page is closed and opened again
        assert.deepEqual(essence(again.card()), before, `after ${stop} answers`);
        answerAll(again, mixed, stop, 7);
        assert.deepEqual(result(again.card()), wanted, `finishing after a reload at question ${stop + 1}`);
      }
    } finally {
      restore();
    }
  });
}

test("someone who finished puzzle 1 before the update still sees their finished result afterwards", () => {
  const restore = fakeBrowser();
  try {
    const old = JSON.parse(readFileSync(join(root, "puzzles", "1.json"), "utf8"));
    const mixed = questionsOf(old).map((x, i) => (i === 3 ? (correctPick(x.item, x.prev) === "up" ? "down" : "up") : correctPick(x.item, x.prev)));
    const storage = memoryStorage();
    const played = open(old, storage, 1);
    answerAll(played, mixed, 0, 7);
    const finished = result(played.card());
    const later = open(old, storage, 1); // the page opened again, as the same day's puzzle, already done
    assert.deepEqual(result(later.card()), finished);
    assert.match(later.card(), /Facts in this puzzle/);
  } finally {
    restore();
  }
});
