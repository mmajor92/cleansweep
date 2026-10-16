// "How to play" is hidden. A new visitor gets a slim one-line note and a yellow ring on the "?".
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPage, pageHtml } from "./page.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const css = readFileSync(join(root, "styles.css"), "utf8");
const KEY = "cleansweep:help";
const ringed = (page) => page.els.helpbtn.classList.contains("nudge");

test("the page has a one-line note under the title, with a Got it button, and the How to play panel stays hidden", () => {
  const note = /<div class="firsttime" id="firsttime"[^>]*hidden>\s*<span>(.*?)<\/span>\s*<button[^>]*id="firsttimeclose"[^>]*>(.*?)<\/button>/s.exec(pageHtml);
  assert.ok(note, "the note is in the page, hidden until the code shows it");
  assert.match(note[1], /^First time\? Tap the <b>\?<\/b> for a practice round!$/);
  assert.equal(note[2], "Got it");
  assert.ok(/<div class="help" id="help" hidden>/.test(pageHtml), "the How to play panel is hidden by default");
  assert.ok(pageHtml.indexOf('id="firsttime"') < pageHtml.indexOf('id="help"'), "the note sits above the panel, under the title row");
  assert.ok(pageHtml.indexOf('id="firsttime"') > pageHtml.indexOf("</h1>"), "and below the title");
});

test("a first visit shows the note and the ring, and the panel does not open by itself", async () => {
  const page = await openPage();
  assert.equal(page.els.firsttime.hidden, false, "the note is showing");
  assert.ok(ringed(page), "the ? has its yellow ring");
  assert.equal(page.els.help.hidden, true, "the panel stays closed");
  assert.equal(page.store[KEY], undefined, "nothing is remembered until they react to it");
});

test("tapping Got it on the note removes it and the ring for good", async () => {
  const store = {};
  const page = await openPage({ store });
  page.els.firsttimeclose.listeners.click();
  assert.equal(page.els.firsttime.hidden, true);
  assert.ok(!ringed(page));
  assert.equal(page.els.help.hidden, true, "the panel is still closed");
  assert.equal(store[KEY], "1");
  const next = await openPage({ store });
  assert.equal(next.els.firsttime.hidden, true, "it does not come back on the next visit");
  assert.ok(!ringed(next));
});

test("tapping the ? opens the panel, removes the note, and is remembered", async () => {
  const store = {};
  const page = await openPage({ store });
  page.els.helpbtn.listeners.click();
  assert.equal(page.els.help.hidden, false, "the panel opens");
  assert.equal(page.els.firsttime.hidden, true, "the note goes: they have found it");
  assert.ok(!ringed(page));
  assert.equal(store[KEY], "1");
  page.els.helpbtn.listeners.click();
  assert.equal(page.els.help.hidden, true, "tapping again closes it");
  assert.equal((await openPage({ store })).els.firsttime.hidden, true);
});

test("choosing a practice puzzle closes the panel", async () => {
  const page = await openPage();
  page.els.helpbtn.listeners.click();
  assert.equal(page.els.help.hidden, false);
  // the two practice buttons each close the panel
  const buttons = page.els.help.querySelectorAll("[data-practice]");
  assert.equal(buttons.length, 2);
  buttons[0].listeners.click();
  assert.equal(page.els.help.hidden, true);
});

test("someone who already pressed Got it on the old panel never sees the note", async () => {
  const page = await openPage({ store: { [KEY]: "1" } });
  assert.equal(page.els.firsttime.hidden, true);
  assert.ok(!ringed(page));
});

test("answering the first question takes the note away for good, in the real game", async () => {
  const store = {};
  const page = await openPage({ store });
  assert.equal(page.els.firsttime.hidden, false);
  page.click({ pick: "up" });
  assert.equal(page.els.firsttime.hidden, true, "the note goes as soon as they answer");
  assert.ok(!ringed(page), "and so does the ring");
  assert.equal(store[KEY], "1", "and it is remembered");
  assert.equal((await openPage({ store })).els.firsttime.hidden, true, "it does not come back");
});

test("answering a practice question does the same", async () => {
  const store = {};
  const page = await openPage({ store });
  page.click({ mode: "practice", practice: "1" });
  assert.equal(page.els.firsttime.hidden, false, "choosing practice from somewhere else does not count: only an answer does");
  page.click({ pick: "up" });
  assert.equal(page.els.firsttime.hidden, true);
  assert.equal(store[KEY], "1");
});

test("someone who has already played a game here never sees the note", async () => {
  const saved = JSON.stringify({ version: 1, days: { 1: { picks: ["up"], done: false, results: [] } }, stats: { played: 0, streak: 0, bestStreak: 0, lastDone: 0, distribution: {}, bestScore: 0, bestPct: 0 } });
  const page = await openPage({ store: { "cleansweep:v1": saved } });
  assert.equal(page.els.firsttime.hidden, true);
  assert.ok(!ringed(page));
});

test("just looking at the page does not dismiss the note: it stays until they tap, or answer", async () => {
  const store = {};
  await openPage({ store });
  const again = await openPage({ store });
  assert.equal(again.els.firsttime.hidden, false);
  assert.ok(ringed(again));
});

test("if the browser will not save anything, the note is not shown (it could never be dismissed)", async () => {
  const page = await openPage({ store: new Proxy({}, { get() { throw new Error("blocked"); }, has() { throw new Error("blocked"); } }) });
  assert.equal(page.els.firsttime.hidden, true);
});

test("the ring is a still yellow ring: no animation", () => {
  const rule = /\.theme\.nudge \{([^}]*)\}/.exec(css)[1];
  assert.match(rule, /var\(--tape\)/);
  assert.ok(!/animation|transition/.test(rule));
});

test("the note stays slim, but the tap area around Got it is big enough for a thumb", () => {
  const mini = /\.btn\.mini \{([^}]*)\}/.exec(css)[1];
  assert.match(mini, /min-height: 0/, "the button itself is small");
  assert.match(mini, /position: relative/);
  const [, vertical, horizontal] = /\.btn\.mini::after \{[^}]*inset: -(\d+)px -(\d+)px/.exec(css);
  // about 26px of button plus this much above and below: the usual guidance is at least 44px
  assert.ok(26 + 2 * Number(vertical) >= 44, `only ${26 + 2 * Number(vertical)}px tall`);
  assert.ok(Number(horizontal) >= 6);
});
