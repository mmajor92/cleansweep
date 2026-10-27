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
  if (!v) return { text: "Not played yet", done: false };
  if (v.s === "done") return { text: "\u2713 " + v.t, done: true };
  if (v.s === "lost") return { text: "Not solved", done: false };
  return { text: "In progress", done: false };
}

export function showNewBadge(now = Date.now()) {
  return utcDay(now) <= MYSTERY_NEW_UNTIL;
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
