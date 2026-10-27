// Which mystery thing is on which day, and which two clues it comes with.
// The days are FROZEN in data/mystery-days.json (like the puzzle files for Clean Sweep), so adding facts later never changes a day
// that has been published. A day nobody has frozen yet is worked out the same way, so everyone gets the same one.

/** Small, fast, seedable random number generator (the same one the main game uses). */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pairKey = (p) => p.join("+");

/**
 * Day number k (0 is the first day). Every possible answer is used once before any is used again, and the same clue pair
 * never comes two days running. secrets is [{ id, pairs: [[cat, cat], ...] }]. days is what is already decided, in order.
 */
export function pickDay(days, secrets, k) {
  const ids = secrets.map((s) => s.id);
  let cycle = new Set();
  for (let i = 0; i < k && i < days.length; i++) {
    const id = days[i].id;
    if (cycle.has(id)) cycle = new Set([id]);
    else cycle.add(id);
    if (ids.every((x) => cycle.has(x))) cycle = new Set(); // everything has had a turn: a new round begins
  }
  const last = k > 0 ? days[k - 1] : null;
  let cand = secrets.filter((s) => !cycle.has(s.id));
  if (!cand.length) cand = secrets.slice();
  if (last && cand.length > 1) {
    const other = cand.filter((s) => s.id !== last.id);
    if (other.length) cand = other;
  }
  const prev = last ? pairKey(last.cs) : null;
  const fresh = prev ? cand.filter((s) => s.pairs.some((p) => pairKey(p) !== prev)) : cand; // prefer an answer that can use a different clue pair from yesterday's
  if (fresh.length) cand = fresh;
  const rng = mulberry32(0x5eed + k * 7919);
  const s = cand[Math.floor(rng() * cand.length)];
  let opts = s.pairs.filter((p) => pairKey(p) !== prev);
  if (!opts.length) opts = s.pairs;
  return { id: s.id, cs: opts[Math.floor(rng() * opts.length)].slice() };
}

/** The same days, carried on until there are at least `count` of them. */
export function extendDays(days, secrets, count) {
  const out = days.slice();
  while (out.length < count) out.push(pickDay(out, secrets, out.length));
  return out;
}
