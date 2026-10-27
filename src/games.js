// The two games on this site (Clean Sweep and Mystery Thing) show each other's progress for today.
// Each game writes a tiny note about today's puzzle to the player's own device (localStorage) and reads the other's.
// Nothing is sent anywhere. The note only counts on the day it was written (UTC, the same day the puzzles change).

/** The "New" badge next to Mystery Thing goes away by itself after this date (YYYY-MM-DD, UTC). */
export const MYSTERY_NEW_UNTIL = "2026-12-15";

const STATUS_KEY = (game) => "status:" + game;

/** Today's date as YYYY-MM-DD in UTC. */
export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** state is "play" (started), "done" (finished) or "lost" (finished without solving). text is shown after a tick when done. */
export function writeStatus(storage, game, state, text = "", now = Date.now()) {
  if (!storage) return;
  try {
    storage.setItem(STATUS_KEY(game), JSON.stringify({ d: utcDay(now), s: state, t: text }));
  } catch (e) {
    /* storage can be full or blocked: the games still work, they just cannot show each other's progress */
  }
}

/** Forgets a game's note (used when someone clears their saved games). */
export function clearStatus(storage, game) {
  try {
    if (storage) storage.removeItem(STATUS_KEY(game));
  } catch (e) {
    /* nothing to forget, or storage blocked */
  }
}

/** What a game last wrote for today, or null when it has not been played today. */
export function readStatus(storage, game, now = Date.now()) {
  if (!storage) return null;
  try {
    const v = JSON.parse(storage.getItem(STATUS_KEY(game)) || "null");
    if (v && v.d === utcDay(now) && (v.s === "play" || v.s === "done" || v.s === "lost")) return v;
  } catch (e) {
    /* a note we cannot read counts as no note */
  }
  return null;
}

/** The words for a card. Done gets a tick and the result; a puzzle that ended unsolved just says so. */
export function statusLine(v) {
  if (!v) return { text: "Not played", done: false };
  if (v.s === "done") return { text: "\u2713 " + v.t, done: true };
  if (v.s === "lost") return { text: "Not solved", done: false };
  return { text: "In progress", done: false };
}

export function showNewBadge(now = Date.now()) {
  return utcDay(now) <= MYSTERY_NEW_UNTIL;
}

// ---- streaks ----
// A streak is { n, last, best }: n days in a row, the latest of them on the day `last` (YYYY-MM-DD, UTC). Each game keeps its own.
// A streak is alive if it last counted today or yesterday. Each game also leaves its tried streak as a note (streak:cs, streak:mt)
// so the other page can show a flame on its card. The flame is only on the cards and the result card, never in the text people share.

/** Streak milestones: the result card gets a banner on the day a streak reaches one. */
export const MILESTONES = [7, 30, 100];

/** The day before a YYYY-MM-DD day. */
export function dayBefore(day) {
  return utcDay(Date.parse(day + "T12:00:00Z") - 864e5);
}

/** Counts `day` into the streak (once: counting the same day again changes nothing). */
export function bumpStreak(rec, day) {
  if (rec && rec.last === day) return rec;
  const n = rec && rec.last === dayBefore(day) ? rec.n + 1 : 1;
  return { n, last: day, best: Math.max(n, rec ? rec.best || 0 : 0) };
}

/** A streak that ends today (a puzzle that was not solved ends the solved streak). The best is kept. */
export function breakStreak(rec, day) {
  return { n: 0, last: day, best: rec ? rec.best || 0 : 0 };
}

/** How long the streak is right now: 0 unless it last counted today or yesterday. */
export function streakNow(rec, now = Date.now()) {
  if (!rec) return 0;
  const today = utcDay(now);
  return rec.last === today || rec.last === dayBefore(today) ? rec.n : 0;
}

export function writeStreak(storage, game, rec) {
  if (!storage || !rec) return;
  try {
    storage.setItem("streak:" + game, JSON.stringify(rec));
  } catch (e) {
    /* storage can be full or blocked */
  }
}

export function readStreak(storage, game) {
  if (!storage) return null;
  try {
    const v = JSON.parse(storage.getItem("streak:" + game) || "null");
    if (v && Number.isFinite(v.n) && typeof v.last === "string") return v;
  } catch (e) {
    /* unreadable counts as none */
  }
  return null;
}

/** The flame for a card: only from a 2-day streak (a flame for one day looks silly). */
export function flameText(n) {
  return n >= 2 ? "\uD83D\uDD25 " + n : "";
}

/** Today's milestone, if a streak reached one today. Only one banner a day: the bigger streak wins, and the solved streak wins a tie. */
export function pickMilestone(tried, solved, now = Date.now()) {
  const today = utcDay(now);
  const hit = (rec) => (rec && rec.last === today && MILESTONES.includes(rec.n) ? rec.n : 0);
  const t = hit(tried);
  const s = hit(solved);
  if (!t && !s) return null;
  return s >= t ? { kind: "solved", n: s } : { kind: "tried", n: t };
}

export function milestoneText(m) {
  return m.kind === "solved" ? "\uD83D\uDD0E " + m.n + " solved in a row" : "\uD83D\uDD25 " + m.n + " days in a row";
}

/** Puts each game's flame on its card (elements gf-cs and gf-mt). When neither card has one, the flame line is not drawn at all. */
export function paintFlames(storage, doc = globalThis.document, now = Date.now()) {
  if (!doc || typeof doc.getElementById !== "function") return;
  let any = false;
  for (const [id, game] of [["gf-cs", "cs"], ["gf-mt", "mt"]]) {
    const el = doc.getElementById(id);
    if (!el) continue;
    el.textContent = flameText(streakNow(readStreak(storage, game), now));
    if (el.textContent) any = true;
  }
  const nav = doc.getElementById("games");
  if (nav && nav.classList) nav.classList[any ? "add" : "remove"]("hasflame");
}

/** Puts both games' status for today onto the two cards (elements gs-cs and gs-mt), if the page has them. */
export function paintCards(storage, doc = globalThis.document, now = Date.now()) {
  if (!doc || typeof doc.getElementById !== "function") return;
  for (const [id, game] of [["gs-cs", "cs"], ["gs-mt", "mt"]]) {
    const el = doc.getElementById(id);
    if (!el) continue;
    const line = statusLine(readStatus(storage, game, now));
    el.textContent = line.text;
    if (el.classList) el.classList[line.done ? "add" : "remove"]("done");
  }
  const badge = doc.getElementById("newbadge");
  if (badge) badge.hidden = !showNewBadge(now);
  paintFlames(storage, doc, now);
}

/** Optional visitor counting with GoatCounter. Does nothing unless a code is set in src/site.js. Counts only, nothing personal. */
export function startCounter(code, doc = globalThis.document) {
  if (!code || !doc || !doc.head || typeof doc.createElement !== "function") return;
  try {
    const s = doc.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", `https://${code}.goatcounter.com/count`);
    doc.head.appendChild(s);
  } catch (e) {
    /* counting is optional */
  }
}

export function countEvent(name) {
  try {
    const gc = globalThis.goatcounter;
    if (gc && typeof gc.count === "function") gc.count({ path: name, title: name, event: true });
  } catch (e) {
    /* counting must never get in the way of a game */
  }
}
