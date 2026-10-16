// The two practice puzzles: always on offer, as often as you like, and never counted.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateDaily, generatePractice } from "../src/engine.js";
import { displayName } from "../src/format.js";
import { entities, openPage, pageHtml, playThrough } from "./page.mjs";

const practice = [1, 2].map((n) => generatePractice(n, entities));
const daily = generateDaily(1, entities);
const saved = (page) => (page.store["cleansweep:v1"] ? JSON.parse(page.store["cleansweep:v1"]) : null);
const buttons = (html) => [...html.matchAll(/<button class="btn[^"]*"([^>]*)>([^<]*)<\/button>/g)].map((m) => m[2]);

test("the How to play panel always offers both practice puzzles, and it is never hidden", () => {
  const box = /<div class="practice" id="practicebox"([^>]*)>([\s\S]*?)<\/div>\s*<button class="btn" id="helpclose"/.exec(pageHtml);
  assert.ok(box, "the practice box is in the page");
  assert.ok(!/hidden/.test(box[1]), "it is not hidden");
  assert.equal((box[2].match(/data-mode="practice" data-practice="[12]"/g) || []).length, 2, "one button for each puzzle");
});

test("you can open either practice puzzle straight away, in any order", async () => {
  const page = await openPage();
  page.click({ mode: "practice", practice: "2" });
  assert.equal(page.meta(), "Practice 2 of 2");
  assert.ok(page.card().includes(`class="name">${displayName(practice[1].legs[0].cat, practice[1].legs[0].anchor)}<`), "it is the second practice puzzle");
  page.click({ mode: "practice", practice: "1" });
  assert.equal(page.meta(), "Practice 1 of 2");
  assert.ok(page.card().includes(`class="name">${displayName(practice[0].legs[0].cat, practice[0].legs[0].anchor)}<`), "it is the first practice puzzle");
});

test("practice goes round in a loop: 1, then 2, then 1 again, as often as you like", async () => {
  const page = await openPage();
  page.click({ mode: "practice", practice: "1" });
  for (const [round, [n, nextN]] of [[1, 2], [2, 1], [1, 2], [2, 1]].map((x, i) => [i, x])) {
    const played = playThrough(page, practice[n - 1]);
    assert.ok(played.done, `round ${round + 1}: practice ${n} finishes`);
    const b = buttons(page.card());
    assert.deepEqual(b, [`Practice puzzle ${nextN}`, "Back to today's puzzle"], `round ${round + 1}`);
    assert.match(page.card(), new RegExp(`data-practice="${nextN}"`));
    page.click({ mode: "practice", practice: String(nextN) });
    assert.equal(page.meta(), `Practice ${nextN} of 2`);
  }
});

test("practice is the same puzzle every time", async () => {
  const page = await openPage();
  page.click({ mode: "practice", practice: "1" });
  const first = playThrough(page, practice[0]);
  page.click({ mode: "practice", practice: "1" });
  const again = playThrough(page, practice[0]);
  assert.deepEqual(first.questions, again.questions);
});

test("it works after today's puzzle is finished, and today's result card has no practice button", async () => {
  const page = await openPage();
  playThrough(page, daily);
  assert.ok(/class="score"/.test(page.card()));
  assert.deepEqual(buttons(page.card()).filter((t) => /ractice/.test(t)), [], "no practice button on the result card");
  page.click({ mode: "practice", practice: "1" });
  assert.equal(page.meta(), "Practice 1 of 2");
  const played = playThrough(page, practice[0]);
  assert.ok(played.done);
  page.click({ mode: "daily" });
  assert.match(page.card(), /class="score"/, "back to today's finished result");
});

test("practice counts for nothing and saves nothing", async () => {
  const page = await openPage();
  playThrough(page, daily);
  const before = JSON.stringify(saved(page));
  for (const n of [1, 2, 1]) {
    page.click({ mode: "practice", practice: String(n) });
    playThrough(page, practice[n - 1]);
  }
  assert.equal(JSON.stringify(saved(page)), before, "your saved data is exactly as it was");
  assert.equal(saved(page).stats.played, 1);
  assert.ok(!("practice" in saved(page)));
});

test("practice shows no share button and no Warm-up or Deep cut badge", async () => {
  const page = await openPage();
  page.click({ mode: "practice", practice: "1" });
  const a = playThrough(page, practice[0]);
  assert.ok(!/id="share"|id="copy"/.test(page.card()));
  page.click({ mode: "practice", practice: "2" });
  const b = playThrough(page, practice[1]);
  for (const html of [...a.questions, ...a.reveals, ...b.questions, ...b.reveals]) assert.ok(!/Warm-up|Deep cut|deep cut/.test(html));
});

test("a practice number that is too high is held at the last puzzle, and no number means the first", async () => {
  const page = await openPage();
  page.click({ mode: "practice", practice: "7" });
  assert.equal(page.meta(), "Practice 2 of 2", "a number too high is held at the last puzzle");
  page.click({ mode: "practice" });
  assert.equal(page.meta(), "Practice 1 of 2", "no number means the first");
});
