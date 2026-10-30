// Mystery Thing: the rules of the game, with no screen in it. The page code is in ui.js.
import { extendDays, pickDay } from "./schedule.js";
import { MIN_POOL } from "./data.js";

export const NOW_YEAR = 2026; // the same year the main game counts "years ago" from (RULES.nowYear): a test checks they agree
/** Puzzle 1 is this day (UTC). It comes from data/mystery-days.json, so there is one place to change it. */
export let LAUNCH = Date.UTC(2026, 9, 27);
export function setLaunch(dateStr) { const [y, m, d] = dateStr.split("-").map(Number); LAUNCH = Date.UTC(y, m - 1, d); }
/** The facts the game runs on: every object with two or more numbers, the possible answers, and the frozen days. Set once, at start. */
export let OBJS = [];
export let SECRETS = [];
export let byId = {};
export let DAYS = [];
export function setData(d) { OBJS = d.objs; SECRETS = d.secrets; byId = Object.fromEntries(OBJS.map((o) => [o.id, o])); }
export function setDays(days) { DAYS = days.slice(); }
export const ROUNDS = 6;
export const CATS = { length: { name: "Size" }, weight: { name: "Weight" }, speed: { name: "Speed" }, date: { name: "Year" } };
// The clues are the same on Easy and Normal (an arrow, and green or red). What changes is how much the list helps.
export const MODES = {
  easy: { dir: true, T: [2], cls: [0, 3], words: ["close", "far"], colours: true, narrow: true, help: "The list shrinks as you guess, dropping anything your clues rule out. Green means within double or half, red means further off." },
  normal: { dir: true, T: [2], cls: [0, 3], words: ["close", "far"], colours: true, narrow: false, help: "The list doesn’t shrink. Green means within double or half, red means further off." },
  hard: { dir: true, T: [], cls: ["n"], words: [""], colours: false, narrow: false, help: "The same list, but only arrows. No colours to say how near. Scores are multiplied by 1.5." },
};
export const MODE_LABEL = { easy: "Easy", normal: "Medium", hard: "Hard" }; // the setting called "normal" in the code is shown as Medium
export const PRACTICE = [{ id: "eiffel", cs: ["length", "date"] }, { id: "giraffe", cs: ["weight", "speed"] }]; // the same for everyone, and not counted
export const SQUARES = { 0: "\uD83D\uDFE9", 3: "\uD83D\uDFE5" };
export const ICON = { length: "\uD83D\uDCCF", weight: "\u2696\uFE0F", speed: "\uD83D\uDCA8", date: "\uD83D\uDCC5" };
export const SHARE_URL = "\uD83E\uDDF9 cleansweepdaily.fyi/mystery";
export const yearsAgo = (y) => (y < 0 ? NOW_YEAR - y - 1 : NOW_YEAR - y);
const NF0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
export function num(n) { if (n >= 100) return NF0.format(n); if (n >= 10) return NF1.format(n); return String(Number(n.toPrecision(3))); }
export function fmt(cat, v, ap) {
  const pre = ap ? "about " : "";
  if (cat === "length") { if (v < 1) return pre + num(v * 100) + " cm"; if (v < 1000) return pre + num(v) + " m"; const km = v / 1000; return pre + (km < 1000 ? num(km) : NF0.format(km)) + " km"; }
  if (cat === "speed") return pre + (v < 1 ? String(Number(v.toPrecision(2))) : num(v)) + " km/h";
  if (cat === "date") return (ap ? "c. " : "") + Math.abs(v) + (v < 0 ? " BC" : v < 1000 ? " AD" : "");
  if (v < 1) return pre + num(v * 1000) + " g";
  if (v < 1000) return pre + num(v) + " kg";
  if (v >= 1e12) { const [m, e] = v.toExponential(2).split("e"); return pre + Number(m) + " x 10^" + Number(e) + " kg"; }
  const t = v / 1000;
  if (t >= 1e6) return pre + num(t / 1e6) + " million tonnes";
  return pre + num(t) + (t === 1 ? " tonne" : " tonnes");
}
/** How a guess compares with the secret in each of the two clue categories. */
export function feedback(g, s, cs, mode) {
  const M = MODES[mode];
  return cs.map((c) => {
    const gv = g.c[c].v, sv = s.c[c].v;
    if (gv === sv) return { eq: true, lvl: 0, dir: null, cls: 0 };
    const a = c === "date" ? yearsAgo(gv) : gv, b = c === "date" ? yearsAgo(sv) : sv;
    const r = Math.max(a, b) / Math.min(a, b);
    let lvl = 0;
    for (const t of M.T) if (r > t) lvl++;
    return { eq: false, lvl, dir: sv > gv ? "up" : "down", cls: M.cls[lvl] };
  });
}
export const poolFor = (cs) => OBJS.filter((o) => cs.every((c) => o.c[c]));
export const sig = (fb) => fb.map((f) => (f.eq ? "=" : f.dir + f.lvl)).join("|");
/** What the mystery thing could still be: every object that would have given the same feedback as the secret did, for every guess so far. */
export function remaining(pool, guessObjs, secret, cs, mode) {
  return pool.filter((o) => !guessObjs.includes(o) && guessObjs.every((g) => sig(feedback(g, o, cs, mode)) === sig(feedback(g, secret, cs, mode))));
}
export const norm = (t) => t.toLowerCase().replace(/[\u2019']/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^(the|a|an) /, "");
/**
 * Type-to-find. "a", "an" and "the" at the start are ignored, so "pia", "piano", "a piano" and "the pia" all find A piano, and "a p" finds everything
 * with a word starting with p. Each word you type must start a word in the name; if nothing does, it falls back to matching anywhere in the name.
 * The names that start with what you typed come first.
 */
export function filterThings(items, query) {
  let q = query.toLowerCase().replace(/[\u2019']/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  q = q.replace(/^(the|an|a)(\s+|$)/, "");
  if (!q) return items;
  const toks = q.split(" ");
  const rows = items.map((o) => ({ o, n: norm(o.name) }));
  let hit = rows.filter(({ n }) => toks.every((t) => n.split(" ").some((w) => w.startsWith(t))));
  if (!hit.length) hit = rows.filter(({ n }) => toks.every((t) => n.includes(t)));
  hit.sort((a, b) => (b.n.startsWith(q) ? 1 : 0) - (a.n.startsWith(q) ? 1 : 0) || a.n.localeCompare(b.n));
  return hit.map((h) => h.o);
}
/** "6h 37m" or "52m": how long until the next puzzle (midnight UTC), worded exactly like Clean Sweep's countdown. A test checks they agree. */
export function countdownText(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(1, Math.ceil((next - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
export function dayNumber(now = Date.now()) { return Math.max(1, Math.floor((now - LAUNCH) / 864e5) + 1); }
/** A day is usable if its answer still exists, still has both clue numbers, and still gives a long enough list. */
function dayUsable(e) { const o = e && byId[e.id]; return !!o && e.cs.every((c) => o.c[c]) && poolFor(e.cs).length >= MIN_POOL; }
export function dailyPuzzle(no) {
  if (no > DAYS.length) DAYS = extendDays(DAYS, SECRETS, no); // a day nobody has frozen yet is worked out the same way for everyone
  let e = DAYS[no - 1];
  if (!dayUsable(e)) e = pickDay(DAYS, SECRETS, no - 1); // the facts changed under a frozen day: choose again rather than break
  return { no, daily: true, secret: byId[e.id], cs: e.cs };
}
export function practicePuzzle(n) {
  const p = PRACTICE[n - 1];
  return { no: 0, daily: false, practice: n, secret: byId[p.id], cs: p.cs };
}
export function randomPuzzle(notId) {
  const opts = SECRETS.filter((s) => s.id !== notId);
  const sec = opts[Math.floor(Math.random() * opts.length)];
  return { no: 0, daily: false, secret: byId[sec.id], cs: sec.pairs[Math.floor(Math.random() * sec.pairs.length)] };
}
// ---- Scoring. Closer guesses earn points, far ones lose a few, solving earns the most, and fewer guesses multiply it. ----
// Nothing here is shown while you play, because a number like "+74" would tell you exactly how near you were. Only the guesses multiplier is shown live.
export const MULT = [0, 3, 2.5, 2, 1.6, 1.3, 1]; // by number of guesses used
export const HARD_BONUS = { easy: 1, normal: 1, hard: 1.5 };
const stepsOff = (g, s, c) => { const a = c === "date" ? yearsAgo(g.c[c].v) : g.c[c].v, b = c === "date" ? yearsAgo(s.c[c].v) : s.c[c].v; return Math.abs(Math.log2(a / b)); }; // how many doublings apart
/** Green gives up to 20 (more the closer), red loses 5 per doubling beyond 2 times (never more than 30). */
export function clueScore(g, s, c) {
  if (g.c[c].v === s.c[c].v) return 20;
  const l = stepsOff(g, s, c);
  return l <= 1 ? 20 * (1 - l) : -Math.min(30, 5 * (l - 1));
}
export function scoreGame(p, guessIds, mode) {
  const gs = guessIds.filter((g) => g !== "GIVEUP").map((id) => byId[id]);
  const won = gs.length > 0 && gs[gs.length - 1] === p.secret;
  const per = gs.map((g, i) => {
    if (won && i === gs.length - 1) return { g, solved: true, pts: p.cs.map(() => 100) };
    const pts = p.cs.map((c) => clueScore(g, p.secret, c));
    return { g, solved: false, pts: i === 0 ? pts.map((x) => Math.max(0, x)) : pts }; // the first guess is a shot in the dark, so it can earn points but not lose them
  });
  const path = per.filter((x) => !x.solved).reduce((a, x) => a + x.pts.reduce((u, v) => u + v, 0), 0);
  const solve = won ? 100 * p.cs.length : 0;
  const mult = won ? MULT[gs.length] : 0.5;
  const bonus = HARD_BONUS[mode];
  return { per, path: Math.round(path), solve, mult, bonus, won, score: Math.round(Math.max(0, path + solve) * mult * bonus) };
}
/** A clean sweep: you solved it, and every clue on every guess was green (within double or half) or exact. Judged the same way on every setting, even Hard, where the colours are hidden. */
export function cleanSweep(p, guessIds) {
  const real = guessIds.filter((g) => g !== "GIVEUP");
  if (!real.length || real[real.length - 1] !== p.secret.id) return false;
  return real.every((id) => feedback(byId[id], p.secret, p.cs, "normal").every((f) => f.eq || f.lvl === 0));
}
/**
 * The card people share: the clues, one row per guess (an arrow, and a colour except on Hard), your score, and the address. On Easy there is also the "sweep" line,
 * because only Easy shows you how many things are still possible as you play.
 * In the two-emoji cells (Easy and Normal) a lone icon or tick is padded so it sits in the middle of its column: an en space (U+2002) on each side, plus a thin space (U+2009)
 * on the left, because an emoji is a little wider than two en spaces' worth. Measured in three fonts, that is within about 1.5 pixels of dead centre.
 */
export const HALF = "\u2002";
export const THIN = "\u2009";
export function shareText(p, guessIds, mode) {
  const gs = guessIds.filter((g) => g !== "GIVEUP").map((id) => byId[id]);
  const won = gs.length > 0 && gs[gs.length - 1] === p.secret;
  const colours = MODES[mode].colours;
  const middle = (e) => (colours ? HALF + THIN + e + HALF : e);
  const label = p.daily ? "Mystery Thing #" + p.no : "Mystery Thing (practice)";
  const head = "\uD83D\uDD0E " + label + " (" + MODE_LABEL[mode] + ") " + (won ? gs.length : "X") + "/" + ROUNDS + (cleanSweep(p, guessIds) ? " \uD83E\uDDF9\u2728" : "");
  const icons = p.cs.map((c) => middle(ICON[c])).join(" ");
  const rows = gs.map((g) => feedback(g, p.secret, p.cs, mode).map((f) => (f.eq ? middle("\u2705") : (f.dir === "up" ? "\u2B06\uFE0F" : "\u2B07\uFE0F") + (colours ? SQUARES[f.cls] : ""))).join(" "));
  const lines = [head, icons, ...rows];
  if (mode === "easy") {
    const pool = poolFor(p.cs);
    const counts = [pool.length];
    (won ? gs.slice(0, -1) : gs).forEach((_, i) => counts.push(remaining(pool, gs.slice(0, i + 1), p.secret, p.cs, mode).length));
    if (won && gs.length === 1) counts.push(1);
    lines.push("\uD83E\uDDF9 " + counts.join(" \u2192 "));
  }
  lines.push("\u2B50 " + scoreGame(p, guessIds, mode).score + " points", SHARE_URL);
  return lines.join("\n");
}
/*END LOGIC*/
