// Which things are on which day, and how hard it is. The days are FROZEN in data/lineup-days.json (like the other games),
// so adding facts later never changes a day that has been published. A day nobody has frozen yet is worked out the same way for everyone.
// How close together the five values are (the difficulty) is chosen at random for each day, so no weekday is always the easy one.

/** Small, fast, seedable random number generator (the same one the main game uses). A test checks they agree. */
export function lineupRng(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How many things are on a board. */
export const BOARD_SIZE = 6;
/** The range the day's difficulty is chosen from, at random: how close the closest two neighbours are (times apart for sizes, weights and speeds; years apart for dates). Lower numbers are harder. */
export const GAP_RANGE = { lo: 1.1, hi: 2.5, dlo: 4, dhi: 80 };
const CAT_ORDER = ["length", "weight", "date", "speed"];
const boardKey = (cat, items) => cat + "|" + items.map((x) => x.id).sort().join(",");

/** The items from the lowest value to the highest (for years, the oldest first). */
export function inOrder(items) {
  return items.slice().sort((a, b) => a.value - b.value);
}

/** How close the closest two neighbours are: a ratio for sizes, weights and speeds (1.2 means 20% apart), years apart for dates. */
export function minGap(items, cat) {
  const s = inOrder(items);
  let g = Infinity;
  for (let i = 1; i < s.length; i++) g = Math.min(g, cat === "date" ? s[i].value - s[i - 1].value : s[i].value / s[i - 1].value);
  return g;
}

// A rounded figure (a "typical" weight, an approximate year) needs a wider gap to its neighbours, so the order is never a matter of opinion.
const WIDE = { size: 1.35, date: 100 };
/** Is b (the higher one) far enough above a for the order to be clear? */
function gapOK(a, b, cat, thr) {
  const rough = a.approx || b.approx;
  if (cat === "date") return b.value - a.value >= (rough ? Math.max(thr, WIDE.date) : thr);
  return a.value > 0 && b.value / a.value >= (rough ? Math.max(thr, WIDE.size) : thr);
}

function shuffled(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * A board of things, each far enough above the one before, with at least one close pair so that the day is as hard as it was meant to be.
 * It is never a board that has been used before (`taken` holds the earlier boards).
 * A randomised search: it tries things in a random order, so the same pool still gives a different answer on every day.
 */
function findBoard(sorted, cat, thr, rng, needFamous, band, taken) {
  let nodes = 0;
  const tight = (chain) => {
    const rough = chain.some((c) => c.approx);
    const g = minGap(chain, cat);
    if (band === Infinity) return true; // the last resort: any five that are clearly in order
    return cat === "date" ? g <= Math.max(thr, rough ? WIDE.date : 0) * band * 1.125 + 6 : g <= Math.max(thr, rough ? WIDE.size : 0) * band;
  };
  function dfs(chain) {
    if (chain.length === BOARD_SIZE) return chain.filter((c) => c.fame >= 3).length >= needFamous && tight(chain) && !taken.has(boardKey(cat, chain)) ? chain : null;
    if (++nodes > 40000) return null;
    const last = chain[chain.length - 1];
    const fams = new Set(chain.map((c) => c.family));
    for (const c of shuffled(sorted.filter((x) => !fams.has(x.family) && x.value > last.value && gapOK(last, x, cat, thr)), rng)) {
      const r = dfs(chain.concat(c));
      if (r) return r;
    }
    return null;
  }
  for (const start of shuffled(sorted, rng)) {
    const r = dfs([start]);
    if (r) return r;
    if (nodes > 40000) break;
  }
  return null;
}

// Speed is the thinnest pool, so it comes up a little less often than the others.
const CAT_WEIGHT = { length: 1, weight: 1, date: 1, speed: 0.6 };

/** Day number k (0 is the first day). pool is the list from data.js. days is what is already decided, in order. Returns { cat, ids, gap }. */
export function pickPuzzle(days, pool, k) {
  const rng = lineupRng(0x1e0000 + k * 104729);
  const prev = k > 0 && days[k - 1] ? days[k - 1].cat : null;
  let cats = CAT_ORDER.filter((c) => c !== prev && pool.some((p) => p.cat === c));
  if (!cats.length) cats = CAT_ORDER.filter((c) => pool.some((p) => p.cat === c)); // only one kind available: it has to repeat
  let roll = rng() * cats.reduce((t, c) => t + CAT_WEIGHT[c], 0);
  const cat = cats.find((c) => (roll -= CAT_WEIGHT[c]) < 0) || cats[cats.length - 1];
  const taken = new Set(days.slice(0, k).map((d) => boardKey(d.cat, d.ids.map((id) => ({ id })))));
  const recent = new Set();
  for (let i = Math.max(0, k - 25); i < k && days[i]; i++) for (const id of days[i].ids) recent.add(id);
  // The difficulty for the day, chosen at random from GAP_RANGE.
  const thr0 = cat === "date" ? Math.exp(Math.log(GAP_RANGE.dlo) + rng() * (Math.log(GAP_RANGE.dhi) - Math.log(GAP_RANGE.dlo))) : Math.exp(Math.log(GAP_RANGE.lo) + rng() * (Math.log(GAP_RANGE.hi) - Math.log(GAP_RANGE.lo)));
  // First choice: things not used lately, at least three well known. If that cannot be done, allow lately used things, and only then two well known.
  for (const [allowRecent, needFamous] of [[false, 3], [true, 3], [true, 2]]) {
    let cand = pool.filter((p) => p.cat === cat && (allowRecent || !recent.has(p.id)));
    if (cand.length < 12 && !allowRecent) continue;
    const sorted = inOrder(cand);
    let thr = thr0;
    for (let level = 0; level < 16; level++) {
      // How close the closest pair must be (compared with the difficulty asked for) widens with each failed level, and goes away at the end.
      const chosen = findBoard(sorted, cat, thr, rng, needFamous, level >= 11 ? Infinity : 1.6 * (1 + level * 0.35), taken);
      if (chosen) {
        const solution = inOrder(chosen);
        let start = chosen;
        for (let t = 0; t < 80; t++) {
          const perm = shuffled(chosen, rng);
          if (perm.filter((x, i) => x === solution[i]).length <= 1) { start = perm; break; }
        }
        if (start.filter((x, i) => x === solution[i]).length > 1) start = solution.slice(1).concat(solution[0]); // a safe fallback: everything shifted by one
        return { cat, ids: start.map((x) => x.id), gap: Number(minGap(chosen, cat).toFixed(2)) };
      }
      thr = cat === "date" ? thr * 0.8 : 1 + (thr - 1) * 0.8; // nothing fits: make the day a little easier to build and try again
    }
  }
  throw new Error("Line Up: could not find a board for day " + (k + 1));
}

/** The same days, carried on until there are at least `count` of them. */
export function extendPuzzles(days, pool, count) {
  const out = days.slice();
  while (out.length < count) out.push(pickPuzzle(out, pool, out.length));
  return out;
}
