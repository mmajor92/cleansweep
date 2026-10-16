// Saved progress, the daily lock and streaks. Storage is injected so this can be tested.

export const STORAGE_KEY = "cleansweep:v1";

export function emptyState() {
  return {
    version: 1,
    days: {}, // puzzle number -> { picks: [], done: bool, results: [] }
    stats: { played: 0, streak: 0, bestStreak: 0, lastDone: 0, distribution: {}, bestScore: 0, bestPct: 0 },
    practice: { done: [] }, // which of the fixed practice puzzles this device has finished
  };
}

export function loadState(storage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed.days !== "object") return emptyState();
    const done = parsed.practice && Array.isArray(parsed.practice.done) ? parsed.practice.done : [];
    return { ...emptyState(), ...parsed, stats: { ...emptyState().stats, ...parsed.stats }, practice: { done } };
  } catch (e) {
    return emptyState();
  }
}

export function saveState(storage, state) {
  try {
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false; // storage can be full or blocked. The game still works without it.
  }
}

/** Record one pick for today's puzzle so a reload resumes in the same place. */
export function recordPick(state, num, pick) {
  const day = state.days[num] || { picks: [], done: false, results: [] };
  if (day.done) return state;
  day.picks = [...day.picks, pick];
  state.days[num] = day;
  return state;
}

/** Mark a day finished and update streak statistics. Safe to call twice. */
export function completeDay(state, num, results, score = null) {
  const day = state.days[num] || { picks: [], done: false, results: [] };
  if (day.done) return state;
  day.done = true;
  day.results = results;
  if (score) day.score = score;
  state.days[num] = day;
  const s = state.stats;
  s.played += 1;
  s.streak = s.lastDone === num - 1 ? s.streak + 1 : 1;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.lastDone = num;
  if (score) {
    s.bestScore = Math.max(s.bestScore || 0, score.total);
    s.bestPct = Math.max(s.bestPct || 0, score.pct);
  }
  const correct = results.filter(Boolean).length;
  s.distribution[correct] = (s.distribution[correct] || 0) + 1;
  return state;
}

/** A streak is alive if the last finished puzzle was today's or yesterday's. */
export function currentStreak(state, todayNum) {
  const s = state.stats;
  return s.lastDone >= todayNum - 1 ? s.streak : 0;
}

export function dayRecord(state, num) {
  return state.days[num] || null;
}

/** Keep the saved data small: drop day records older than 60 days. */
export function prune(state, todayNum) {
  for (const key of Object.keys(state.days)) {
    if (Number(key) < todayNum - 60) delete state.days[key];
  }
  return state;
}

/** Remember that a practice puzzle has been finished. Practice never touches streaks or scores. */
export function markPracticeDone(state, n) {
  if (!state.practice) state.practice = { done: [] };
  if (!state.practice.done.includes(n)) state.practice.done = [...state.practice.done, n];
  return state;
}

/** The next practice puzzle not yet finished (1, 2 ...), or 0 when they are all done. */
export function practiceNext(state, total) {
  const done = (state.practice && state.practice.done) || [];
  for (let n = 1; n <= total; n++) if (!done.includes(n)) return n;
  return 0;
}
