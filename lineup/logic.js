// Line Up: the rules of the game, with no screen in it. The page code is in ui.js.
import { BOARD_SIZE, extendPuzzles, inOrder, minGap, pickPuzzle } from "./schedule.js";

export const TRIES = 3;
/** Puzzle 1 is this day (UTC). It comes from data/lineup-days.json, so there is one place to change it. */
export let LU_LAUNCH = Date.UTC(2026, 9, 30);
export function setLaunch(dateStr) { const [y, m, d] = dateStr.split("-").map(Number); LU_LAUNCH = Date.UTC(y, m - 1, d); }
/** The facts the game runs on, and the frozen days. Set once, at start. */
export let POOL = [];
export let byKey = {};
export let DAYS = [];
export function setPool(p) { POOL = p; byKey = Object.fromEntries(p.map((x) => [x.key, x])); }
export function setDays(days) { DAYS = days.slice(); }

export const CAT = {
  length: { icon: "\uD83D\uDCCF", prompt: "Smallest to biggest", hint: "by length or height", ends: ["Smallest", "Biggest"] },
  weight: { icon: "\u2696\uFE0F", prompt: "Lightest to heaviest", hint: "by weight", ends: ["Lightest", "Heaviest"] },
  date: { icon: "\uD83D\uDCC5", prompt: "Oldest to newest", hint: "by year", ends: ["Oldest", "Newest"] },
  speed: { icon: "\u26A1", prompt: "Slowest to fastest", hint: "by top speed", ends: ["Slowest", "Fastest"] },
};
export const SHARE_URL = "\uD83E\uDDF9 cleansweepdaily.fyi/lineup";
export const TILE_RIGHT = "\uD83D\uDFE9";
export const TILE_WRONG = "\uD83D\uDFE5";
/** Two fixed practice puzzles, the same for everyone and not counted. Wide gaps and famous things, so they teach the game. */
export const PRACTICE = [
  { cat: "weight", ids: ["blackcab", "iphone1", "shuttle", "eiffel", "bicycle", "tiger"] },
  { cat: "date", ids: ["wall", "pyramid", "titanic", "magna", "colosseum", "declaration"] },
];

// ---- points ----
// Each thing scores its best result over the tries: 100 if it is exactly right on try 1, 60 on try 2, 35 on try 3. A near miss earns part of
// that (one place out 40%, two out 15%, further out nothing), so 3rd instead of 2nd beats 4th. A clean sweep (everything right on try 1) adds 100.
// The whole score is then multiplied by how hard the day is: Easy x1, Medium x1.25, Hard x1.5.
export const POINTS = { base: 100, tryWeight: [1, 0.6, 0.35], near: [1, 0.4, 0.15], bonus: 100 };
export const TIER = { easy: { name: "Easy", mult: 1 }, medium: { name: "Medium", mult: 1.25 }, hard: { name: "Hard", mult: 1.5 } };
/** A day is Hard if its closest two neighbours are less than the first figure apart, Medium if less than the second (times apart for sizes, weights and speeds; years apart for dates). */
export const TIER_GAPS = { size: [1.65, 2.2], date: [15, 40] };
export function tierFor(cat, gap) {
  const [hard, medium] = cat === "date" ? TIER_GAPS.date : TIER_GAPS.size;
  return gap < hard ? "hard" : gap < medium ? "medium" : "easy";
}
/** The score for a game: { raw, bonus, mult, points, tier }. `tries` is the list of orders checked so far. */
export function scoreGame(puzzle, tries) {
  let sum = 0;
  puzzle.solution.forEach((id, pos) => {
    let best = 0;
    tries.forEach((t, k) => { best = Math.max(best, POINTS.base * POINTS.tryWeight[k] * (POINTS.near[Math.abs(t.indexOf(id) - pos)] || 0)); });
    sum += best;
  });
  const bonus = solvedTry(tries, puzzle.solution) === 1 ? POINTS.bonus : 0;
  const raw = Math.round(sum) + bonus;
  const mult = TIER[puzzle.tier || "easy"].mult;
  return { raw, bonus, mult, points: Math.round(raw * mult), tier: puzzle.tier || "easy" };
}

// ---- numbers, worded as in Mystery Thing (a test checks they agree) ----
const NF0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
export function numFmt(n) { if (n >= 100) return NF0.format(n); if (n >= 10) return NF1.format(n); return String(Number(n.toPrecision(3))); }
export function fmtValue(cat, v, ap) {
  const pre = ap ? "about " : "";
  if (cat === "length") { if (v < 1) return pre + numFmt(v * 100) + " cm"; if (v < 1000) return pre + numFmt(v) + " m"; const km = v / 1000; return pre + (km < 1000 ? numFmt(km) : NF0.format(km)) + " km"; }
  if (cat === "speed") return pre + (v < 1 ? String(Number(v.toPrecision(2))) : numFmt(v)) + " km/h";
  if (cat === "date") return (ap ? "c. " : "") + Math.abs(v) + (v < 0 ? " BC" : v < 1000 ? " AD" : "");
  if (v < 1) return pre + numFmt(v * 1000) + " g";
  if (v < 1000) return pre + numFmt(v) + " kg";
  if (v >= 1e12) { const [m, e] = v.toExponential(2).split("e"); return pre + Number(m) + " x 10^" + Number(e) + " kg"; }
  const t = v / 1000;
  if (t >= 1e6) return pre + numFmt(t / 1e6) + " million tonnes";
  return pre + numFmt(t) + (t === 1 ? " tonne" : " tonnes");
}

// ---- days and puzzles ----
export function dayNumber(now = Date.now()) { return Math.max(1, Math.floor((now - LU_LAUNCH) / 864e5) + 1); }

/** The items of a frozen day, or null when the facts have changed under it (a thing is gone, or two values now tie). */
function resolveDay(day) {
  const items = day && day.ids ? day.ids.map((id) => byKey[id + ":" + day.cat]) : [];
  if (items.length !== BOARD_SIZE || items.some((x) => !x) || new Set(items.map((x) => x.value)).size !== BOARD_SIZE) return null;
  return items;
}
function makePuzzle(no, daily, practice, cat, items) {
  return { no, daily, practice, cat, items, start: items.map((x) => x.id), solution: inOrder(items).map((x) => x.id), tier: daily ? tierFor(cat, minGap(items, cat)) : "easy" };
}
export function puzzleFor(no) {
  if (no > DAYS.length) DAYS = extendPuzzles(DAYS, POOL, no); // a day nobody has frozen yet is worked out the same way for everyone
  let day = DAYS[no - 1];
  let items = resolveDay(day);
  if (!items) { day = pickPuzzle(DAYS, POOL, no - 1); items = resolveDay(day); } // the facts changed under a frozen day: choose again rather than break
  return makePuzzle(no, true, 0, day.cat, items);
}
export function practicePuzzle(n) {
  const p = PRACTICE[n - 1];
  return makePuzzle(0, false, n, p.cat, p.ids.map((id) => byKey[id + ":" + p.cat]));
}

// ---- tries ----
/** For each position: is the thing in it in the right place? */
export function rightPlaces(order, solution) { return order.map((id, i) => id === solution[i]); }
/** Positions that are locked: right in an earlier try. Locked things never move, so every one of them stays right. */
export function lockedPositions(tries, solution) {
  const s = new Set();
  for (const t of tries) rightPlaces(t, solution).forEach((ok, i) => { if (ok) s.add(i); });
  return s;
}
/** Which try got everything right (1 to 3), or 0. */
export function solvedTry(tries, solution) {
  for (let i = 0; i < tries.length; i++) if (tries[i].every((id, p) => id === solution[p])) return i + 1;
  return 0;
}
export const isOver = (tries, solution) => solvedTry(tries, solution) > 0 || tries.length >= TRIES;

/** The result as it is shared: one row of squares per try, green where it was right. */
export function shareText(puzzle, tries) {
  const n = solvedTry(tries, puzzle.solution);
  const rows = tries.map((t) => rightPlaces(t, puzzle.solution).map((ok) => (ok ? TILE_RIGHT : TILE_WRONG)).join(""));
  const head = "\uD83D\uDCCA Line Up" + (puzzle.daily ? " #" + puzzle.no : " (practice)") + " " + CAT[puzzle.cat].icon + " " + (n ? n : "X") + "/" + TRIES + (puzzle.daily ? " \u00b7 " + scoreGame(puzzle, tries).points + " pts" : "");
  return [head, ...rows, SHARE_URL].join("\n");
}

/** "6h 37m" or "52m": how long until the next puzzle (midnight UTC), worded exactly like the other games' countdowns. A test checks they agree. */
export function countdownText(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(1, Math.ceil((next - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
