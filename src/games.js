// The games on this site (Clean Sweep, Mystery Thing and Line Up) show each other's progress for today.
// Each game writes a tiny note about today's puzzle to the player's own device (localStorage) and reads the others'.
// Nothing is sent anywhere. The note only counts on the day it was written (UTC, the same day the puzzles change).

/** The "New" badges go away by themselves after these dates (YYYY-MM-DD, UTC). */
export const MYSTERY_NEW_UNTIL = "2026-12-15";
export const LINEUP_NEW_UNTIL = "2027-01-05";

/** Every game: its short name, the id of its status icon in the switcher, where it lives relative to the front page, and the count for a tap on its box. */
export const GAME_LIST = [
  { game: "cs", name: "Clean Sweep", status: "gs-cs", path: "", event: "switch-to-clean-sweep" },
  { game: "mt", name: "Mystery Thing", status: "gs-mt", path: "mystery/", event: "switch-to-mystery" },
  { game: "lu", name: "Line Up", status: "gs-lu", path: "lineup/", event: "switch-to-lineup" },
];
const SPOKEN = { none: "not played", play: "in progress", done: "done", lost: "not solved" };

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

/** Which icon a game gets in the switcher: none (not played), play (in progress), done, or lost (finished without solving). */
export function iconState(v) {
  return v ? v.s : "none";
}

export function showNewBadge(now = Date.now(), until = MYSTERY_NEW_UNTIL) {
  return utcDay(now) <= until;
}

/**
 * The two buttons at the bottom of a result card, one for each of the other two games, so the player chooses where to go next.
 * A game that is not finished is a yellow button ("Play ..." or "Finish ..."); a finished one is an outline button with its icon.
 * base is where the front page is, relative to this page: "" on the front page, "../" on the other two.
 */
export function nextButtonsHTML(storage, current, base = "", now = Date.now()) {
  const buttons = GAME_LIST.filter((g) => g.game !== current).map((g) => {
    const state = iconState(readStatus(storage, g.game, now));
    const finished = state === "done" || state === "lost";
    const label = state === "none" ? "Play " + g.name : state === "play" ? "Finish " + g.name : '<i class="st ' + state + '" aria-hidden="true"></i>' + g.name;
    return '<a class="btn ' + (finished ? "quiet" : "primary") + ' nxt" data-g="' + g.game + '" href="' + base + g.path + '" aria-label="' + g.name + ", " + SPOKEN[state] + '">' + label + "</a>";
  });
  return '<div class="nextgames" id="nextgames">' + buttons.join("") + "</div>";
}

// ---- streaks ----
// A streak is { n, last, best }: n days in a row, the latest of them on the day `last` (YYYY-MM-DD, UTC). Each game keeps its own.
// A streak is alive if it last counted today or yesterday. A game shows its own flame next to its puzzle number and on its result card,
// never in the text people share.

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

/** The flame for a game: only from a 2-day streak (a flame for one day looks silly). */
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

/** The banner words. The solved streak has its own little picture in each game (a magnifying glass for Mystery Thing). */
export function milestoneText(m, solvedIcon = "\uD83D\uDD0E") {
  return m.kind === "solved" ? solvedIcon + " " + m.n + " solved in a row" : "\uD83D\uDD25 " + m.n + " days in a row";
}

/** "Puzzle #12" with the flame after it from a 2-day streak: "Puzzle #12 \u00b7 \uD83D\uDD25 12". */
export function withFlame(text, n) {
  const f = flameText(n);
  return f ? text + " \u00b7 " + f : text;
}

/**
 * Puts each game's status icon in the switcher (elements gs-cs, gs-mt and gs-lu) and says it in words for screen readers,
 * and hides each New tag after its date. A page without a switcher is left alone.
 */
export function paintCards(storage, doc = globalThis.document, now = Date.now()) {
  if (!doc || typeof doc.getElementById !== "function") return;
  for (const g of GAME_LIST) {
    const el = doc.getElementById(g.status);
    if (!el) continue;
    const state = iconState(readStatus(storage, g.game, now));
    el.className = "st " + state;
    const link = el.parentElement;
    if (link && typeof link.setAttribute === "function") {
      link.setAttribute("aria-label", g.name + ", " + SPOKEN[state]);
      link.setAttribute("title", g.name + ": " + SPOKEN[state]);
    }
  }
  const mt = doc.getElementById("newbadge");
  if (mt) mt.hidden = !showNewBadge(now, MYSTERY_NEW_UNTIL);
  const lu = doc.getElementById("newbadge-lu");
  if (lu) lu.hidden = !showNewBadge(now, LINEUP_NEW_UNTIL);
}

/** Counts a tap on another game, in the switcher or in the two buttons on a result card (a count only, nothing about the player). */
export function wireSwitcher(doc = globalThis.document) {
  if (!doc || typeof doc.addEventListener !== "function") return;
  doc.addEventListener("click", (e) => {
    const a = e.target && typeof e.target.closest === "function" ? e.target.closest("#games a[data-g], .nextgames a[data-g]") : null;
    if (!a || a.getAttribute("aria-current") === "page") return;
    const g = GAME_LIST.find((x) => x.game === a.getAttribute("data-g"));
    if (g) countEvent(g.event);
  });
}

/** Counts, once a day, the day all three games have been finished (solved or not). The note stops it counting twice. */
export function maybeAllDone(storage, now = Date.now()) {
  if (!storage) return;
  try {
    if (!GAME_LIST.every((g) => { const s = readStatus(storage, g.game, now); return s && (s.s === "done" || s.s === "lost"); })) return;
    const today = utcDay(now);
    if (storage.getItem("status:all") === today) return;
    storage.setItem("status:all", today);
    countEvent("all-three-done");
  } catch (e) {
    /* counting is optional */
  }
}

/**
 * Copies text for a player, in two steps, and says whether it worked (true or false). It never throws.
 * 1. The browser's own clipboard. 2. If that is refused or missing, the older way: a hidden text box and the copy command, which many
 * in-app browsers and older phones still allow. If both fail, the caller shows the text in a box to copy by hand.
 */
export async function copyText(text, doc = globalThis.document, nav = globalThis.navigator) {
  try {
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* refused: try the older way */
  }
  try {
    if (!doc || typeof doc.createElement !== "function" || !doc.body || typeof doc.execCommand !== "function") return false;
    const before = doc.activeElement;
    const ta = doc.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.setAttribute("aria-hidden", "true");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    doc.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) { /* some browsers have no such call */ }
    let ok = false;
    try { ok = !!doc.execCommand("copy"); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    if (before && typeof before.focus === "function") before.focus();
    return ok;
  } catch (e) {
    return false;
  }
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
