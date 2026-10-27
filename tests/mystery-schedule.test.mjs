// Mystery Thing: which answer is on which day. The days are frozen in a file, so adding facts never changes a published day.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RULES, countdownText as engineCountdown, mulberry32 as engineRng, yearsAgo as engineYearsAgo } from "../src/engine.js";
import * as L from "../mystery/logic.js";
import { buildData } from "../mystery/data.js";
import { extendDays, mulberry32, pickDay } from "../mystery/schedule.js";

const facts = JSON.parse(readFileSync(new URL("../data/facts.json", import.meta.url), "utf8"));
const data = buildData(facts.entities);
const { secrets } = data;
const key = (cs) => cs.join("+");

test("the two small helpers copied from the main game still agree with it (the Mystery Thing page is built without the main engine)", () => {
  const a = mulberry32(12345), b = engineRng(12345);
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
  assert.equal(L.NOW_YEAR, RULES.nowYear, "Mystery Thing counts years from a different year than the main game");
  for (const y of [-3000, -30, -1, 1, 800, 1066, 1912, 1969, 2007, 2026]) assert.equal(L.yearsAgo(y), engineYearsAgo(y), String(y));
});

test("every possible answer comes up once before any comes up again, over three rounds", () => {
  const n = secrets.length, days = extendDays([], secrets, n * 3);
  for (let r = 0; r < 3; r++) assert.equal(new Set(days.slice(r * n, (r + 1) * n).map((d) => d.id)).size, n, `round ${r + 1} repeated an answer`);
});

test("the days are worked out the same way every time, and carrying on never changes the days already decided", () => {
  const a = extendDays([], secrets, 60), b = extendDays([], secrets, 60);
  assert.deepEqual(a, b);
  const frozen = a.slice(0, 25), carried = extendDays(frozen, secrets, 70);
  assert.deepEqual(carried.slice(0, 25), frozen);
  assert.deepEqual(carried.slice(0, 60), a, "carrying on from 25 gives the same days as building straight through");
});

test("each day's clue pair is one the answer can really have, and the same pair rarely comes two days running", () => {
  const days = extendDays([], secrets, 400), by = Object.fromEntries(secrets.map((s) => [s.id, s]));
  let same = 0;
  days.forEach((d, i) => { assert.ok(by[d.id].pairs.some((p) => key(p) === key(d.cs)), `day ${i + 1}`); if (i && key(days[i - 1].cs) === key(d.cs)) same++; });
  assert.ok(same / days.length < 0.1, `${same} of ${days.length} days repeated yesterday's pair`);
});

test("an answer added to the facts part-way through a round can still come up in that round", () => {
  const early = secrets.slice(0, secrets.length - 5);
  const days = extendDays([], early, 20);
  const grown = extendDays(days, secrets, days.length + secrets.length);
  const seenAfter = new Set(grown.slice(20, 20 + secrets.length).map((d) => d.id));
  for (const s of secrets.slice(-5)) assert.ok(seenAfter.has(s.id), `${s.id} never came up`);
});

test("pickDay never repeats yesterday's answer", () => {
  const days = extendDays([], secrets, 300);
  days.forEach((d, i) => { if (i) assert.notEqual(d.id, days[i - 1].id); });
  assert.ok(pickDay([], secrets, 0).id);
});

test("the day number counts from the launch date in UTC, never below 1", () => {
  L.setLaunch("2026-10-27");
  assert.equal(L.dayNumber(Date.UTC(2026, 9, 20)), 1, "before launch it still gives puzzle 1");
  assert.equal(L.dayNumber(Date.UTC(2026, 9, 27, 0, 0, 1)), 1);
  assert.equal(L.dayNumber(Date.UTC(2026, 9, 27, 23, 59, 59)), 1);
  assert.equal(L.dayNumber(Date.UTC(2026, 9, 28)), 2);
  assert.equal(L.dayNumber(Date.UTC(2026, 10, 26, 12)), 31);
});

test("a day nobody has frozen yet is worked out the same for everyone, and a frozen day wins over the facts", () => {
  L.setData(data);
  L.setLaunch("2026-10-27");
  L.setDays([]);
  const live = L.dailyPuzzle(9);
  L.setDays(extendDays([], secrets, 30));
  assert.equal(L.dailyPuzzle(9).secret.id, live.secret.id);
  assert.deepEqual(L.dailyPuzzle(9).cs, live.cs);
  // a frozen day whose answer no longer exists is replaced rather than breaking the page
  L.setDays([{ id: "no-such-thing", cs: ["length", "weight"] }, ...extendDays([], secrets, 5)]);
  const fixed = L.dailyPuzzle(1);
  assert.ok(fixed.secret && fixed.cs.length === 2);
  // and so is one whose clue pair the answer does not have
  const noSpeed = data.objs.find((x) => x.fame >= 3 && !x.c.speed && x.c.length && x.c.weight);
  L.setDays([{ id: noSpeed.id, cs: ["length", "speed"] }]);
  assert.ok(L.dailyPuzzle(1).cs.every((c) => L.dailyPuzzle(1).secret.c[c]));
  L.setDays(extendDays([], secrets, 400));
});

test("the countdown to the next puzzle reads exactly like Clean Sweep's, at every time of day", () => {
  for (const [h, m, sec] of [[0, 0, 0], [0, 0, 1], [6, 22, 30], [12, 0, 0], [18, 0, 0], [22, 59, 59], [23, 0, 0], [23, 30, 0], [23, 59, 0], [23, 59, 30]]) {
    const t = new Date(Date.UTC(2026, 10, 3, h, m, sec));
    assert.equal(L.countdownText(t), engineCountdown(t), `${h}:${m}:${sec}`);
  }
  assert.equal(L.countdownText(new Date(Date.UTC(2026, 10, 3, 17, 23, 0))), "6h 37m");
  assert.equal(L.countdownText(new Date(Date.UTC(2026, 10, 3, 23, 8, 0))), "52m");
  assert.equal(L.countdownText(new Date(Date.UTC(2026, 11, 31, 20, 0, 0))), "4h", "across a year end");
});
