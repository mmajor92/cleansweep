// The two games show each other's progress for today: a short note each leaves on the player's own device.
import test from "node:test";
import assert from "node:assert/strict";
import { breakStreak, bumpStreak, clearStatus, dayBefore, flameText, GAME_LIST, iconState, LINEUP_NEW_UNTIL, maybeAllDone, MILESTONES, milestoneText, MYSTERY_NEW_UNTIL, nextButtonsHTML, paintCards, pickMilestone, readStatus, showNewBadge, streakNow, utcDay, wireSwitcher, withFlame, writeStatus } from "../src/games.js";
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

test("a box's icon: not played, in progress, done, or finished without solving", () => {
  assert.equal(iconState(null), "none");
  assert.equal(iconState({ s: "play", t: "" }), "play");
  assert.equal(iconState({ s: "done", t: "Done \u00b7 71%" }), "done");
  assert.equal(iconState({ s: "lost", t: "" }), "lost");
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
  const els = { newbadge: { hidden: false }, "gs-cs": { className: "" }, "gs-mt": { className: "" } };
  paintCards(mem(), { getElementById: (id) => els[id] }, Date.parse(MYSTERY_NEW_UNTIL + "T12:00:00Z") + 5 * 864e5);
  assert.equal(els.newbadge.hidden, true);
  assert.equal(els["gs-cs"].className, "st none");
});

// ---- the real Clean Sweep screens ----
const DAYS_IN = 3; // the page opens on puzzle 4
const today = () => { const [y, m, d] = RULES.launchDate.split("-").map(Number); return utcDay(Date.UTC(y, m - 1, d + DAYS_IN, 12)); };
const yesterday = () => { const [y, m, d] = RULES.launchDate.split("-").map(Number); return utcDay(Date.UTC(y, m - 1, d + DAYS_IN - 1, 12)); };

test("Clean Sweep marks today as in progress after the first answer, and done with its score at the end, and shows it on its own box", async () => {
  const page = await openPage({ dayOffset: DAYS_IN });
  const { picks } = answersFor(generateDaily(DAYS_IN + 1, entities));
  assert.equal(page.store["status:cs"], undefined, "nothing is written before anyone plays");
  assert.equal(page.els["gs-cs"].className, "st none");
  page.click({ pick: picks[0] });
  assert.deepEqual(JSON.parse(page.store["status:cs"]), { d: today(), s: "play", t: "" });
  assert.equal(page.els["gs-cs"].className, "st play");
  page.click({}, "next");
  for (let i = 1; i < picks.length; i++) { page.click({ pick: picks[i] }); page.click({}, "next"); }
  const note = JSON.parse(page.store["status:cs"]);
  assert.equal(note.s, "done");
  assert.match(note.t, /^Done \u00b7 \d+%$/);
  assert.equal(page.els["gs-cs"].className, "st done");
  const pct = /<p class="score">(\d+)/.exec(page.card());
  assert.ok(pct && note.t === `Done \u00b7 ${pct[1]}%`, "the card and the note should give the same score");
});

test("Clean Sweep shows how Mystery Thing is going today in its box, and ignores a note from yesterday", async () => {
  for (const [note, want] of [
    [{ s: "done", t: "Done \u00b7 600 pts" }, "st done"],
    [{ s: "play", t: "" }, "st play"],
    [{ s: "lost", t: "" }, "st lost"],
  ]) {
    const page = await openPage({ store: { "status:mt": JSON.stringify({ d: today(), ...note }) }, dayOffset: DAYS_IN });
    assert.equal(page.els["gs-mt"].className, want);
  }
  const old = await openPage({ store: { "status:mt": JSON.stringify({ d: yesterday(), s: "done", t: "Done \u00b7 600 pts" }) }, dayOffset: DAYS_IN });
  assert.equal(old.els["gs-mt"].className, "st none");
});

test("practice puzzles leave no note, and playing one does not mark today as played", async () => {
  const page = await openPage({ dayOffset: DAYS_IN });
  page.click({ mode: "practice", practice: "1" });
  page.click({ pick: "up" });
  assert.equal(page.store["status:cs"], undefined);
  assert.equal(page.els["gs-cs"].className, "st none");
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

test("the flame goes after the puzzle number from a 2-day streak, and nothing is added for a shorter one", () => {
  assert.equal(withFlame("Puzzle #12", 0), "Puzzle #12");
  assert.equal(withFlame("Puzzle #12", 1), "Puzzle #12");
  assert.equal(withFlame("Puzzle #12", 2), "Puzzle #12 \u00b7 \uD83D\uDD25 2");
  assert.equal(withFlame("Puzzle #12", 30), "Puzzle #12 \u00b7 \uD83D\uDD25 30");
});

test("there are three games, each with its status icon, place on the site, and the count for a tap on its box", () => {
  assert.deepEqual(GAME_LIST.map((g) => g.game), ["cs", "mt", "lu"]);
  assert.deepEqual(GAME_LIST.map((g) => g.path), ["", "mystery/", "lineup/"]);
  assert.deepEqual(GAME_LIST.map((g) => g.event), ["switch-to-clean-sweep", "switch-to-mystery", "switch-to-lineup"]);
  for (const g of GAME_LIST) assert.equal(g.status, "gs-" + g.game);
});

test("a tap on another game, in the switcher or on a result card's buttons, is counted once; a tap on the page you are on is not; and the count says which game", () => {
  const events = [];
  globalThis.goatcounter = { count: (o) => events.push(o.path) };
  try {
    let handler;
    const link = (game, current) => ({ getAttribute: (k) => (k === "data-g" ? game : k === "aria-current" && current ? "page" : null) });
    wireSwitcher({ addEventListener: (t, h) => { if (t === "click") handler = h; } });
    const tap = (a) => handler({ target: { closest: (sel) => { assert.equal(sel, "#games a[data-g], .nextgames a[data-g]"); return a; } } });
    tap(link("mt", false)); tap(link("lu", false)); tap(link("cs", true)); handler({ target: { closest: () => null } }); handler({ target: {} });
    assert.deepEqual(events, ["switch-to-mystery", "switch-to-lineup"]);
    wireSwitcher({}); wireSwitcher(null); // a page without a document is left alone
  } finally { delete globalThis.goatcounter; }
});

test("paintCards puts each game's icon on its box, says it in words for screen readers, and hides each New tag after its own date", () => {
  const st = mem(), now = Date.UTC(2026, 9, 27, 12);
  writeStatus(st, "lu", "done", "Done \u00b7 2/3", now); writeStatus(st, "mt", "lost", "", now); writeStatus(st, "cs", "play", "", now);
  const box = () => { const attrs = {}; return { attrs, setAttribute: (k, v) => { attrs[k] = v; } }; };
  const boxes = { cs: box(), mt: box(), lu: box() };
  const els = { "gs-cs": { className: "", parentElement: boxes.cs }, "gs-mt": { className: "", parentElement: boxes.mt }, "gs-lu": { className: "", parentElement: boxes.lu }, newbadge: { hidden: false }, "newbadge-lu": { hidden: false } };
  const doc = { getElementById: (id) => els[id] };
  paintCards(st, doc, now);
  assert.equal(els["gs-cs"].className, "st play"); assert.equal(els["gs-mt"].className, "st lost"); assert.equal(els["gs-lu"].className, "st done");
  assert.equal(boxes.cs.attrs["aria-label"], "Clean Sweep, in progress"); assert.equal(boxes.mt.attrs["aria-label"], "Mystery Thing, not solved"); assert.equal(boxes.lu.attrs["aria-label"], "Line Up, done");
  assert.equal(boxes.lu.attrs.title, "Line Up: done");
  assert.equal(els.newbadge.hidden, false); assert.equal(els["newbadge-lu"].hidden, false);
  const later = Date.parse(MYSTERY_NEW_UNTIL + "T12:00:00Z") + 5 * 864e5; // after Mystery Thing's date, before Line Up's
  paintCards(mem(), doc, later);
  assert.equal(els["gs-lu"].className, "st none", "tomorrow they are all unplayed again");
  assert.equal(boxes.lu.attrs["aria-label"], "Line Up, not played");
  assert.equal(els.newbadge.hidden, true); assert.equal(els["newbadge-lu"].hidden, false, "Line Up's tag lasts longer");
  assert.ok(LINEUP_NEW_UNTIL > MYSTERY_NEW_UNTIL);
  paintCards(mem(), doc, Date.parse(LINEUP_NEW_UNTIL + "T12:00:00Z") + 864e5);
  assert.equal(els["newbadge-lu"].hidden, true);
});

test("the two buttons on a result card: one for each of the other games, yellow to play or finish, an outline with its icon when finished", () => {
  const st = mem(), now = Date.UTC(2026, 9, 27, 12);
  const html = (cur, base) => nextButtonsHTML(st, cur, base, now);
  const buttons = (h) => [...h.matchAll(/<a class="btn (primary|quiet) nxt" data-g="(\w+)" href="([^"]*)" aria-label="([^"]*)">(.*?)<\/a>/g)].map((m) => ({ kind: m[1], g: m[2], href: m[3], say: m[4], label: m[5] }));
  assert.ok(html("lu", "../").startsWith('<div class="nextgames" id="nextgames">'));
  let b = buttons(html("lu", "../"));
  assert.deepEqual(b.map((x) => [x.g, x.href, x.kind, x.label]), [["cs", "../", "primary", "Play Clean Sweep"], ["mt", "../mystery/", "primary", "Play Mystery Thing"]], "nothing played: two yellow Play buttons, never the page you are on");
  assert.deepEqual(buttons(html("cs", "")).map((x) => [x.g, x.href]), [["mt", "mystery/"], ["lu", "lineup/"]], "from the front page the links start from the front page");
  assert.deepEqual(buttons(html("mt", "../")).map((x) => x.href), ["../", "../lineup/"]);
  writeStatus(st, "cs", "play", "", now); writeStatus(st, "mt", "done", "x", now);
  b = buttons(html("lu", "../"));
  assert.deepEqual(b.map((x) => [x.g, x.kind, x.label, x.say]), [["cs", "primary", "Finish Clean Sweep", "Clean Sweep, in progress"], ["mt", "quiet", '<i class="st done" aria-hidden="true"></i>Mystery Thing', "Mystery Thing, done"]]);
  writeStatus(st, "cs", "lost", "", now);
  b = buttons(html("lu", "../"));
  assert.deepEqual(b.map((x) => [x.kind, x.label]), [["quiet", '<i class="st lost" aria-hidden="true"></i>Clean Sweep'], ["quiet", '<i class="st done" aria-hidden="true"></i>Mystery Thing']], "both finished: two outline buttons, still tappable");
  assert.deepEqual(buttons(nextButtonsHTML(st, "lu", "../", now + 864e5)).map((x) => x.kind), ["primary", "primary"], "tomorrow they are all unplayed again");
});

test("all-three-done is counted once, on the day every game has been finished (solved or not)", () => {
  const st = mem(), now = Date.UTC(2026, 9, 27, 12), events = [];
  globalThis.goatcounter = { count: (o) => events.push(o.path) };
  try {
    writeStatus(st, "cs", "done", "x", now); writeStatus(st, "mt", "play", "", now); writeStatus(st, "lu", "done", "x", now);
    maybeAllDone(st, now); assert.deepEqual(events, [], "one game is still in progress");
    writeStatus(st, "mt", "lost", "", now);
    maybeAllDone(st, now); maybeAllDone(st, now);
    assert.deepEqual(events, ["all-three-done"], "counted once however often it is asked");
    maybeAllDone(st, now + 864e5); assert.deepEqual(events, ["all-three-done"], "the next day has no notes yet");
  } finally { delete globalThis.goatcounter; }
});

test("the solved-streak banner has its own picture in each game", () => {
  assert.equal(milestoneText({ kind: "solved", n: 7 }), "\uD83D\uDD0E 7 solved in a row");
  assert.equal(milestoneText({ kind: "solved", n: 7 }, "\uD83D\uDCCA"), "\uD83D\uDCCA 7 solved in a row");
  assert.equal(milestoneText({ kind: "tried", n: 30 }, "\uD83D\uDCCA"), "\uD83D\uDD25 30 days in a row");
});

test("Clean Sweep shows its own flame after the puzzle number and on the result card; a streak that has lapsed shows none", async () => {
  const stateWith = (streak, lastDone) => JSON.stringify({ version: 1, days: {}, stats: { played: streak, streak, bestStreak: streak, lastDone, distribution: {}, bestScore: 0, bestPct: 0 } });
  const alive = await openPage({ store: { "cleansweep:v1": stateWith(4, DAYS_IN) }, dayOffset: DAYS_IN }); // finished puzzle 3, today is puzzle 4
  assert.equal(alive.meta(), "Puzzle #4 \u00b7 \uD83D\uDD25 4");
  const lapsed = await openPage({ store: { "cleansweep:v1": stateWith(4, 1) }, dayOffset: DAYS_IN }); // last finished puzzle 1: two days missed
  assert.equal(lapsed.meta(), "Puzzle #4");
  const fresh = await openPage({ dayOffset: DAYS_IN });
  assert.equal(fresh.meta(), "Puzzle #4");
  const { picks } = answersFor(generateDaily(DAYS_IN + 1, entities));
  for (const p of picks) { alive.click({ pick: p }); alive.click({}, "next"); }
  assert.match(alive.card(), /<p class="kicker">Puzzle #4 \u00b7 \uD83D\uDD25 5<\/p>/, "finishing today makes it 5, and the result card shows it");
  assert.deepEqual(Object.keys(alive.store).filter((k) => k.startsWith("streak:")), [], "no streak note is left for other games any more");
});
