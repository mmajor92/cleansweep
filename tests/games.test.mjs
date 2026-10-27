// The two games show each other's progress for today: a short note each leaves on the player's own device.
import test from "node:test";
import assert from "node:assert/strict";
import { MILESTONES, MYSTERY_NEW_UNTIL, breakStreak, bumpStreak, clearStatus, dayBefore, flameText, milestoneText, paintCards, paintFlames, pickMilestone, readStatus, readStreak, showNewBadge, statusLine, streakNow, utcDay, writeStatus, writeStreak } from "../src/games.js";
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
  assert.deepEqual(statusLine(null), { text: "Not played", done: false });
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
  assert.equal(els["gs-cs"].textContent, "Not played");
});

// ---- the real Clean Sweep screens ----
const DAYS_IN = 3; // the page opens on puzzle 4
const today = () => { const [y, m, d] = RULES.launchDate.split("-").map(Number); return utcDay(Date.UTC(y, m - 1, d + DAYS_IN, 12)); };
const yesterday = () => { const [y, m, d] = RULES.launchDate.split("-").map(Number); return utcDay(Date.UTC(y, m - 1, d + DAYS_IN - 1, 12)); };

test("Clean Sweep marks today as in progress after the first answer, and done with its score at the end, and shows it on its own card", async () => {
  const page = await openPage({ dayOffset: DAYS_IN });
  const { picks } = answersFor(generateDaily(DAYS_IN + 1, entities));
  assert.equal(page.store["status:cs"], undefined, "nothing is written before anyone plays");
  assert.equal(page.els["gs-cs"].textContent, "Not played");
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
  assert.equal(old.els["gs-mt"].textContent, "Not played");
});

test("practice puzzles leave no note, and playing one does not mark today as played", async () => {
  const page = await openPage({ dayOffset: DAYS_IN });
  page.click({ mode: "practice", practice: "1" });
  page.click({ pick: "up" });
  assert.equal(page.store["status:cs"], undefined);
  assert.equal(page.els["gs-cs"].textContent, "Not played");
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

// ---- streaks ----
const D = (y, m, d) => utcDay(Date.UTC(y, m - 1, d, 12));

test("a streak counts a day once, carries on the next day, and starts again after a missed day (keeping the best)", () => {
  let r = bumpStreak(null, "2026-10-27");
  assert.deepEqual(r, { n: 1, last: "2026-10-27", best: 1 });
  assert.equal(bumpStreak(r, "2026-10-27"), r, "the same day again changes nothing");
  r = bumpStreak(r, "2026-10-28"); r = bumpStreak(r, "2026-10-29");
  assert.deepEqual(r, { n: 3, last: "2026-10-29", best: 3 });
  r = bumpStreak(r, "2026-10-31"); // 30th was missed
  assert.deepEqual(r, { n: 1, last: "2026-10-31", best: 3 });
  assert.equal(dayBefore("2027-01-01"), "2026-12-31", "across a year end");
  assert.equal(dayBefore("2026-03-01"), "2026-02-28");
  assert.equal(bumpStreak({ n: 4, last: "2026-12-31", best: 4 }, "2027-01-01").n, 5);
});

test("a streak is alive today and tomorrow, then gone; an unsolved day ends the solved streak but keeps its best", () => {
  const r = { n: 5, last: "2026-10-27", best: 9 };
  assert.equal(streakNow(r, Date.UTC(2026, 9, 27, 23, 59)), 5);
  assert.equal(streakNow(r, Date.UTC(2026, 9, 28, 0, 1)), 5, "still alive the next day: you have until midnight to keep it");
  assert.equal(streakNow(r, Date.UTC(2026, 9, 29, 0, 1)), 0, "a whole day missed");
  assert.equal(streakNow(null), 0);
  const b = breakStreak(r, "2026-10-28");
  assert.deepEqual(b, { n: 0, last: "2026-10-28", best: 9 });
  assert.equal(streakNow(b, Date.UTC(2026, 9, 28, 12)), 0);
  assert.equal(bumpStreak(b, "2026-10-29").n, 1, "solving the next day starts again at 1");
});

test("the flame shows from a 2-day streak only", () => {
  assert.equal(flameText(0), ""); assert.equal(flameText(1), ""); assert.equal(flameText(2), "\uD83D\uDD25 2"); assert.equal(flameText(41), "\uD83D\uDD25 41");
});

test("a milestone is picked only on the day it is reached; the bigger streak wins and the solved streak wins a tie", () => {
  const now = Date.UTC(2026, 9, 27, 12), today = "2026-10-27", yday = "2026-10-26";
  assert.deepEqual(MILESTONES, [7, 30, 100]);
  assert.equal(pickMilestone({ n: 6, last: today }, { n: 6, last: today }, now), null);
  assert.deepEqual(pickMilestone({ n: 7, last: today }, { n: 3, last: today }, now), { kind: "tried", n: 7 });
  assert.deepEqual(pickMilestone({ n: 7, last: today }, { n: 7, last: today }, now), { kind: "solved", n: 7 }, "a tie goes to the solved streak");
  assert.deepEqual(pickMilestone({ n: 30, last: today }, { n: 7, last: today }, now), { kind: "tried", n: 30 }, "the bigger one");
  assert.deepEqual(pickMilestone({ n: 8, last: today }, { n: 100, last: today }, now), { kind: "solved", n: 100 });
  assert.equal(pickMilestone({ n: 7, last: yday }, { n: 7, last: yday }, now), null, "yesterday's milestone is not today's");
  assert.equal(pickMilestone(null, null, now), null);
  assert.equal(milestoneText({ kind: "tried", n: 7 }), "\uD83D\uDD25 7 days in a row");
  assert.equal(milestoneText({ kind: "solved", n: 30 }), "\uD83D\uDD0E 30 solved in a row");
});

test("flames go on the cards, and the flame line is only drawn when a card has one", () => {
  const st = mem(), now = Date.UTC(2026, 9, 27, 12);
  const cls = new Set(), els = { "gf-cs": { textContent: "x" }, "gf-mt": { textContent: "x" }, games: { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) } } };
  const doc = { getElementById: (id) => els[id] };
  paintFlames(st, doc, now);
  assert.equal(els["gf-cs"].textContent, ""); assert.equal(els["gf-mt"].textContent, ""); assert.ok(!cls.has("hasflame"), "no flame anywhere: no flame line");
  writeStreak(st, "mt", { n: 3, last: "2026-10-26", best: 3 });
  paintFlames(st, doc, now);
  assert.equal(els["gf-mt"].textContent, "\uD83D\uDD25 3"); assert.equal(els["gf-cs"].textContent, ""); assert.ok(cls.has("hasflame"));
  writeStreak(st, "mt", { n: 1, last: "2026-10-26", best: 3 });
  paintFlames(st, doc, now);
  assert.equal(els["gf-mt"].textContent, ""); assert.ok(!cls.has("hasflame"), "a streak of 1 shows nothing");
  assert.deepEqual(readStreak(st, "mt"), { n: 1, last: "2026-10-26", best: 3 });
  assert.equal(readStreak(mem(), "mt"), null);
});

test("Clean Sweep leaves its streak for Mystery Thing's card, and shows a flame on its own card; a streak that has lapsed shows none", async () => {
  const [y, m, d] = RULES.launchDate.split("-").map(Number);
  const dateOf = (num) => utcDay(Date.UTC(y, m - 1, d + num - 1, 12));
  const stateWith = (streak, lastDone) => JSON.stringify({ version: 1, days: {}, stats: { played: streak, streak, bestStreak: streak, lastDone, distribution: {}, bestScore: 0, bestPct: 0 } });
  const alive = await openPage({ store: { "cleansweep:v1": stateWith(4, DAYS_IN) }, dayOffset: DAYS_IN }); // finished puzzle 3, today is puzzle 4
  assert.deepEqual(JSON.parse(alive.store["streak:cs"]), { n: 4, last: dateOf(DAYS_IN), best: 4 });
  assert.equal(alive.els["gf-cs"].textContent, "\uD83D\uDD25 4");
  assert.ok(alive.els.games.classList.contains("hasflame"));
  const lapsed = await openPage({ store: { "cleansweep:v1": stateWith(4, 1) }, dayOffset: DAYS_IN }); // last finished puzzle 1: two days missed
  assert.equal(lapsed.els["gf-cs"].textContent, "");
  assert.ok(!lapsed.els.games.classList.contains("hasflame"));
  const other = await openPage({ store: { "streak:mt": JSON.stringify({ n: 3, last: yesterday(), best: 3 }) }, dayOffset: DAYS_IN });
  assert.equal(other.els["gf-mt"].textContent, "\uD83D\uDD25 3", "Mystery Thing's streak shows on Clean Sweep's page");
  assert.ok(other.els.games.classList.contains("hasflame"));
});
