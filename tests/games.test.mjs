// The two games show each other's progress for today: a short note each leaves on the player's own device.
import test from "node:test";
import assert from "node:assert/strict";
import { MYSTERY_NEW_UNTIL, clearStatus, paintCards, readStatus, showNewBadge, statusLine, utcDay, writeStatus } from "../src/games.js";
import { RULES, generateDaily } from "../src/engine.js";
import { answersFor, entities, openPage } from "./page.mjs";

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m }; };
const NOON = Date.UTC(2026, 9, 27, 12);

test("a note is read back on the day it was written, and not the next day", () => {
  const st = mem();
  writeStatus(st, "mt", "done", "Done \u00b7 600 pts", NOON);
  assert.deepEqual(readStatus(st, "mt", NOON + 3600e3), { d: "2026-10-27", s: "done", t: "Done \u00b7 600 pts" });
  assert.equal(readStatus(st, "mt", NOON + 864e5), null, "yesterday's note must not count as today");
  assert.equal(readStatus(st, "cs", NOON), null, "the other game has written nothing");
  clearStatus(st, "mt");
  assert.equal(readStatus(st, "mt", NOON), null);
});

test("the words on a card: not played, in progress, done with the result, and not solved", () => {
  assert.deepEqual(statusLine(null), { text: "Not played yet", done: false });
  assert.deepEqual(statusLine({ s: "play", t: "" }), { text: "In progress", done: false });
  assert.deepEqual(statusLine({ s: "done", t: "Done \u00b7 71%" }), { text: "\u2713 Done \u00b7 71%", done: true });
  assert.deepEqual(statusLine({ s: "lost", t: "" }), { text: "Not solved", done: false });
});

test("a broken or blocked store never gets in the way", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.doesNotThrow(() => { writeStatus(broken, "cs", "done", "x"); clearStatus(broken, "cs"); });
  assert.equal(readStatus(broken, "cs"), null);
  assert.equal(readStatus(null, "cs"), null);
  const junk = mem(); junk.setItem("status:cs", "{not json"); assert.equal(readStatus(junk, "cs", NOON), null);
  junk.setItem("status:cs", JSON.stringify({ d: "2026-10-27", s: "weird", t: "" })); assert.equal(readStatus(junk, "cs", NOON), null);
});

test("the New badge goes away by itself after its date", () => {
  assert.ok(showNewBadge(Date.parse(MYSTERY_NEW_UNTIL + "T12:00:00Z")));
  assert.ok(!showNewBadge(Date.parse(MYSTERY_NEW_UNTIL + "T12:00:00Z") + 864e5));
  const els = { newbadge: { hidden: false }, "gs-cs": { textContent: "", classList: { add() {}, remove() {} } }, "gs-mt": { textContent: "", classList: { add() {}, remove() {} } } };
  paintCards(mem(), { getElementById: (id) => els[id] }, Date.parse(MYSTERY_NEW_UNTIL + "T12:00:00Z") + 5 * 864e5);
  assert.equal(els.newbadge.hidden, true);
  assert.equal(els["gs-cs"].textContent, "Not played yet");
});

// ---- the real Clean Sweep screens ----
const DAYS_IN = 3; // the page opens on puzzle 4
const today = () => { const [y, m, d] = RULES.launchDate.split("-").map(Number); return utcDay(Date.UTC(y, m - 1, d + DAYS_IN, 12)); };
const yesterday = () => { const [y, m, d] = RULES.launchDate.split("-").map(Number); return utcDay(Date.UTC(y, m - 1, d + DAYS_IN - 1, 12)); };

test("Clean Sweep marks today as in progress after the first answer, and done with its score at the end, and shows it on its own card", async () => {
  const page = await openPage({ dayOffset: DAYS_IN });
  const { picks } = answersFor(generateDaily(DAYS_IN + 1, entities));
  assert.equal(page.store["status:cs"], undefined, "nothing is written before anyone plays");
  assert.equal(page.els["gs-cs"].textContent, "Not played yet");
  page.click({ pick: picks[0] });
  assert.deepEqual(JSON.parse(page.store["status:cs"]), { d: today(), s: "play", t: "" });
  assert.equal(page.els["gs-cs"].textContent, "In progress");
  page.click({}, "next");
  for (let i = 1; i < picks.length; i++) { page.click({ pick: picks[i] }); page.click({}, "next"); }
  const note = JSON.parse(page.store["status:cs"]);
  assert.equal(note.s, "done");
  assert.match(note.t, /^Done \u00b7 \d+%$/);
  assert.equal(page.els["gs-cs"].textContent, "\u2713 " + note.t);
  assert.ok(page.els["gs-cs"].classList.contains("done"));
  const pct = /<p class="score">(\d+)/.exec(page.card());
  assert.ok(pct && note.t === `Done \u00b7 ${pct[1]}%`, "the card and the note should give the same score");
});

test("Clean Sweep shows how Mystery Thing is going today, and ignores a note from yesterday", async () => {
  for (const [note, want] of [
    [{ s: "done", t: "Done \u00b7 600 pts" }, "\u2713 Done \u00b7 600 pts"],
    [{ s: "play", t: "" }, "In progress"],
    [{ s: "lost", t: "" }, "Not solved"],
  ]) {
    const page = await openPage({ store: { "status:mt": JSON.stringify({ d: today(), ...note }) }, dayOffset: DAYS_IN });
    assert.equal(page.els["gs-mt"].textContent, want);
  }
  const old = await openPage({ store: { "status:mt": JSON.stringify({ d: yesterday(), s: "done", t: "Done \u00b7 600 pts" }) }, dayOffset: DAYS_IN });
  assert.equal(old.els["gs-mt"].textContent, "Not played yet");
});

test("practice puzzles leave no note, and playing one does not mark today as played", async () => {
  const page = await openPage({ dayOffset: DAYS_IN });
  page.click({ mode: "practice", practice: "1" });
  page.click({ pick: "up" });
  assert.equal(page.store["status:cs"], undefined);
  assert.equal(page.els["gs-cs"].textContent, "Not played yet");
});

test("a finished day reloaded still shows as done, so the other game can see it", async () => {
  const first = await openPage({ dayOffset: DAYS_IN });
  const { picks } = answersFor(generateDaily(DAYS_IN + 1, entities));
  for (const p of picks) { first.click({ pick: p }); first.click({}, "next"); }
  const store = { ...first.store };
  delete store["status:cs"]; // a player who finished before this feature existed has no note yet
  const again = await openPage({ store, dayOffset: DAYS_IN });
  assert.match(JSON.parse(again.store["status:cs"]).t, /^Done \u00b7 \d+%$/);
});
