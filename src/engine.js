// Clean Sweep engine. Pure functions only: no DOM, no storage, no network.
// Shared by the browser, the tests and the data linter.

export const CATEGORIES = {
  length: { name: "Length", icon: "\uD83D\uDCCF", buttons: ["Shorter", "Longer"], words: ["shorter", "longer"], scale: "log" },
  weight: { name: "Weight", icon: "\u2696\uFE0F", buttons: ["Lighter", "Heavier"], words: ["lighter", "heavier"], scale: "log" },
  date: { name: "Date", icon: "\uD83D\uDD70\uFE0F", buttons: ["Before", "After"], words: ["earlier", "later"], scale: "lin" },
  count: { name: "How many", icon: "\uD83D\uDD22", buttons: ["Lower", "Higher"], words: ["lower", "higher"], scale: "log" },
  speed: { name: "Speed", icon: "\uD83D\uDE80", buttons: ["Slower", "Faster"], words: ["slower", "faster"], scale: "log" },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const RULES = {
  chainLength: 7,
  shareUrl: "tinyurl.com/cleansweepdaily", // the last line of every share card. Set it to "" to leave it off.
  // A puzzle is a chain of 7 questions that can switch category at any point. Each switch happens through a "bridge":
  // one object that has facts in both categories, shown as the last question of one stretch and the starting point of the next.
  bridgeChances: [[1, 0.4], [2, 0.35], [3, 0.2], [4, 0.05]], // how many switches a puzzle has, and how often
  freshDays: 45, // an object that has not appeared for this many days is "fresh": it is picked as readily as its familiarity allows
  freshFloor: 0.15, // one that appeared yesterday is picked this fraction as often, rising back to normal over freshDays, so the whole pool gets used
  noRepeatDays: 1, // an object that appeared in a puzzle may not appear in the next this-many days' puzzles
  noRepeatFrom: 5, // the check on saved puzzle files starts here: puzzles 1 to 4 were published before the rule existed
  avoidAttempts: 300, // the first tries honour that rule strictly; after that it is lifted as a last resort, so a puzzle always builds
  pairTiers: [Infinity, 365], // the first tries refuse any question (two objects compared in one category) asked within this many days: first "ever", then a year
  pairTierAttempts: 6, // each of those is tried for this many attempts; after that the refusal is lifted (long before the rule above is), so a puzzle always builds
  pairBudget: 2500, // search steps a strict try may use before giving up (an ordinary try may use searchBudget), so a refused try fails fast
  pairOldAges: [365, 180, 60], // from then on questions are only PREFERRED: never asked first, then asked over 365 days ago, then over 180, then over 60, then the rest
  pairMemoryDays: 1100, // how far back the saved puzzles are read to learn which questions have been asked
  busyDay: 3, // a day with this many switches or more is "busy": the next day is capped at one fewer, so two wild days never come back to back
  maxPerCategory: 5, // no category may take more than this many of the 7 questions
  minUps: 2, // across the whole chain: at least this many "higher" answers ...
  maxUps: 5, // ... and at most this many, so it never feels lopsided
  maxRun: 4, // no more than this many answers in a row in the same direction (all higher, or all lower)
  stretchBothWays: 3, // a stretch this long or longer must have at least one higher and one lower answer (0 turns the rule off)
  minBridgeCandidates: 4, // a switch is only planned between two categories that share at least this many possible bridges
  hardAttempts: 100, // the first tries accept only bridges that are outside the cooldown; after that a recent one is a last resort
  attempts: 600, // tries before giving up on a seed
  searchBudget: 8000, // search steps per try
  maxGap: [3, 2.5, 2, 1.7], // widest gap a NEW puzzle may have, by question position within a stretch: no question is more than 3 times apart
  maxGapPublished: [4, 3, 2.5, 2], // the loosest limits ever used. A puzzle that is already published is validated against THESE, so tightening maxGap never makes an old puzzle invalid
  fameWeight: { 3: 10, 2: 3, 1: 0.5 }, // how much more often well-known objects are picked than obscure ones
  hingeCooldown: 7, // a bridge is not reused within this many days
  hingeSinceCap: 365, // days since last use stops counting after this
  warmChance: 0, // chance a puzzle tries to open with a "warm-up" (an easy first question). Off from puzzle 7: every question is a close call. Raise it to bring warm-ups back (they need facts flagged `warmup`)
  warmMinGap: 5, // a warm-up question compares values at least this many times apart ...
  warmMaxGap: 100000, // ... and at most this many (only the very large counts need the room)
  warmCooldown: 14, // a warm-up fact is not reused within this many days
  warmAttempts: 4, // attempts that look for a warm-up before the puzzle goes without one
  spiceChance: 0.5, // chance a puzzle tries to include one enthusiast-only "deep cut" (some days none fits)
  deepCutFrom: 3, // a deep cut is never question 1 or 2, so nobody loses straight away
  spiceCooldown: 21, // a deep cut object is not reused within this many days
  spiceBudget: 600, // search steps a deep-cut attempt may use before giving up
  spiceHingeTries: 4, // hinges a deep-cut attempt tries before moving on
  spiceAttempts: 2, // attempts that look for a deep cut before the puzzle goes without one
  hingeMaxGap: 3, // a bridge (the last question of a stretch) may sit as far from its neighbour as a first step
  hingeMaxGapPublished: 3.1, // the loosest limit ever used for a bridge (see maxGapPublished)
  minGap: { default: 1.15, date: 1.12 },
  minYearsApart: 5,
  allowedStatuses: ["verified", "definitional", "wikidata", "unchecked"], // "wikidata": taken from Wikidata and not checked against a second source: roughly right, which is enough for this game
  nowYear: 2026, // dates are compared by "years ago", so this is frozen on purpose
  launchDate: "2026-10-16", // puzzle #1 (first public day, in UTC). Never change this after launch.
};

/**
 * A question is two objects compared in one category. Its key does not depend on which one comes first, so "A against B" and
 * "B against A" are the same question. A fact is identified by its object, category and value, which is what a saved puzzle stores.
 */
export const factKey = (it) => `${it.ent}|${it.cat}|${it.value}`;
export const pairKey = (a, b) => [factKey(a), factKey(b)].sort().join("~");
/** The key of every question in a puzzle (old two-half puzzles are normalised first). */
export function pairsOf(puzzle) {
  return questionsOf(puzzle).map((q) => pairKey(q.prev, q.item));
}

/** Years before RULES.nowYear. There is no year zero. */
export function yearsAgo(year) {
  return year < 0 ? RULES.nowYear - year - 1 : RULES.nowYear - year;
}

/** How far apart two values are, as a ratio >= 1. Dates use "years ago". */
export function gapRatio(category, a, b) {
  const x = category === "date" ? yearsAgo(a) : a;
  const y = category === "date" ? yearsAgo(b) : b;
  return Math.max(x, y) / Math.min(x, y);
}

/** Which MAXR slot applies. The hinge (last item of the first half) may use a looser slot. */
export function gapSlot(k, isHinge) {
  return isHinge ? Math.min(k, 1) : k;
}

export function gapOk(category, a, b, position, slack = 1, isHinge = false, published = false) {
  if (category === "date" && Math.abs(a - b) < RULES.minYearsApart) return false;
  const r = gapRatio(category, a, b);
  const min = category === "date" ? RULES.minGap.date : RULES.minGap.default;
  const table = published ? RULES.maxGapPublished : RULES.maxGap;
  const max = (isHinge ? (published ? RULES.hingeMaxGapPublished : RULES.hingeMaxGap) : table[Math.min(position, table.length - 1)]) * slack;
  return r >= min && r <= max;
}

/** Turn raw entities into a usable pool. Unverified facts are dropped. */
/** A warm-up question: the two values are far apart, so the answer is easy. */
export function warmGapOk(category, a, b) {
  const r = gapRatio(category, a, b);
  return r >= RULES.warmMinGap && r <= RULES.warmMaxGap;
}

export function buildEntities(raw, allowedStatuses = RULES.allowedStatuses) {
  const out = [];
  const list = raw.entities || raw;
  const byId = Object.fromEntries(list.map((x) => [x.id, x]));
  for (const e of list) {
    const object = e.object || e.id; // an "extra" number (the Eiffel Tower's rivets, as well as its steps) names the object it belongs to
    const parent = object !== e.id ? byId[object] : null;
    const facts = {};
    for (const [cat, f] of Object.entries(e.facts)) {
      if (!CATEGORIES[cat]) continue;
      if (!allowedStatuses.includes(f.status)) continue;
      facts[cat] = f;
    }
    // An extra shares its object's family (so the two never appear in one puzzle), and its fame, hint and clue unless it sets its own.
    if (Object.keys(facts).length) out.push({ id: e.id, object, name: e.name, family: e.family || (parent && parent.family) || object, hint: e.hint || (parent && parent.hint) || "", clue: e.clue || (parent && parent.clue) || "", facts, fame: e.fame || (parent && parent.fame) || 2 });
  }
  return out;
}

export function toItem(entity, category) {
  const f = entity.facts[category];
  return {
    ent: entity.object || entity.id, // the object, so the day-to-day rules treat an extra number as the same object
    family: entity.family,
    name: entity.name,
    hint: entity.hint || "", // shown after the answer
    clue: entity.clue || "", // shown before the answer, never gives away a record
    cat: category,
    phrase: f.phrase,
    label: f.label,
    value: f.value,
    approx: !!f.approx,
    status: f.status,
    source: f.source,
    note: f.note || "",
    warmup: !!f.warmup, // reserved warm-up fact: only ever the starting point of a puzzle
    fame: entity.fame ?? 2, // 1 = enthusiast-only: only ever used as the final "deep cut" question
  };
}

/** Small, fast, seedable random number generator. */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How often an object should be picked relative to others, from its familiarity rating (3, 2 or 1). */
export function weightOf(entity) {
  return RULES.fameWeight[entity.fame] ?? RULES.fameWeight[2];
}

/**
 * Puzzles published before v3 have two halves (c1, c2, seg1, seg2 and one hinge). Everything now works on a list of "legs":
 * stretches of questions in one category, joined by bridges. This turns an old puzzle into that shape. A new one passes through.
 */
export function normalizePuzzle(p) {
  if (!p || p.legs || !p.seg1 || !p.seg2) return p;
  const { c1, c2, n1, n2, hinge, seg1, seg2, ...rest } = p;
  return { ...rest, bridges: [hinge.id], legs: [{ cat: c1, anchor: seg1.anchor, items: seg1.items }, { cat: c2, anchor: seg2.anchor, items: seg2.items }] };
}

/**
 * The 7 questions in order, each with what it is compared against. `start` marks the first question of a stretch.
 * `bridge` marks a question whose object carries the chain into the next stretch, and `nextAnchor` is that same object in the new category.
 */
export function questionsOf(puzzle) {
  const p = normalizePuzzle(puzzle);
  const out = [];
  p.legs.forEach((leg, li) => {
    let prev = leg.anchor;
    leg.items.forEach((item, k) => {
      const bridge = li < p.legs.length - 1 && k === leg.items.length - 1;
      out.push({ q: out.length, cat: leg.cat, item, prev, leg: li, k, start: k === 0, bridge, nextAnchor: bridge ? p.legs[li + 1].anchor : null });
      prev = item;
    });
  });
  return out;
}

/**
 * How much recent appearances cut an object's chance of being picked: 1 if it has not appeared for freshDays (or ever),
 * down to freshFloor if it appeared yesterday. This spreads the questions across the whole pool instead of the same
 * well-known objects coming round again and again while others are almost never seen.
 */
export function freshness(daysSince) {
  if (!daysSince) return 1;
  return RULES.freshFloor + (1 - RULES.freshFloor) * Math.min(1, daysSince / RULES.freshDays);
}

/** Every object a puzzle uses, as a set of ids (the starting object, every question, and each bridge). Works for older two-half puzzles too. */
export function objectsOf(puzzle) {
  const p = normalizePuzzle(puzzle);
  return new Set(p.legs.flatMap((l) => [l.anchor.ent, ...l.items.map((it) => it.ent)]));
}

/** Which category a day starts in: every block of 5 days uses each category once, in a seeded order. */
export function startCategoryFor(num) {
  const rng = mulberry32(Math.floor((num - 1) / CATEGORY_KEYS.length) * 131 + 7);
  const perm = CATEGORY_KEYS.slice();
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm[(num - 1) % CATEGORY_KEYS.length];
}

/**
 * Build one puzzle: a chain of 7 questions that can switch category at any point, through bridges.
 * Returns null if no valid chain exists for this seed and pool.
 * options: history (one array of bridge ids per recent day, most recent last), startCat, warm, spice, bridges (force how many switches),
 * maxBridges (cap how many), avoid (object ids that may not appear today), seen (one set of object ids per recent day, most recent last,
 * which makes objects not seen for a while more likely), spiceHistory, warmHistory.
 */
export function generate(seed, entities, options = {}) {
  const history = options.history || [];
  const rng = mulberry32(seed);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // Weighted shuffle: well-known objects tend to come first, obscure ones rarely do.
  const wshuffle = (arr) => arr.map((e) => ({ e, k: Math.pow(rng(), 1 / pickWeight(e)) })).sort((a, b) => b.k - a.k).map((x) => x.e);
  // Reserved warm-up facts (facts with no neighbours within the gap rules) never appear in ordinary slots.
  const poolBy = {};
  const warmBy = {};
  for (const c of CATEGORY_KEYS) {
    poolBy[c] = entities.filter((e) => e.facts[c] && !e.facts[c].warmup);
    warmBy[c] = entities.filter((e) => e.facts[c] && e.facts[c].warmup && e.fame !== 1);
  }
  const bridgeable = (a, b) => poolBy[a].filter((e) => e.fame !== 1 && e.facts[b] && !e.facts[b].warmup); // an obscure object is never a bridge
  const sharedCache = {};
  const sharedCount = (a, b) => (sharedCache[`${a}>${b}`] ??= bridgeable(a, b).length);
  const sinceUsed = (id) => {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (Array.isArray(h) ? h.includes(id) : h === id) return history.length - i;
    }
    return RULES.hingeSinceCap;
  };
  const wantWarm = options.warm !== undefined ? options.warm : rng() < RULES.warmChance;
  const warmHistory = options.warmHistory || [];
  const warmSince = (e) => {
    const i = warmHistory.lastIndexOf(e.object || e.id);
    return i < 0 ? 1e6 : warmHistory.length - i;
  };
  // Does this puzzle include a "deep cut"? Decided once per puzzle so the rate stays steady.
  const wantSpice = options.spice !== undefined ? options.spice : rng() < RULES.spiceChance;
  // Deep cuts rotate: the obscure object that has gone longest without appearing is tried first.
  const spiceHistory = options.spiceHistory || [];
  const spiceSince = (e) => {
    const i = spiceHistory.lastIndexOf(e.object || e.id);
    return i < 0 ? 1e6 : spiceHistory.length - i;
  };
  const startCat = options.startCat || CATEGORY_KEYS[Math.floor(rng() * CATEGORY_KEYS.length)];
  const avoid = new Set(options.avoid || []); // objects from the last day or days: not repeated, so the same question never comes two days running
  const avoidTries = options.avoidTries ?? RULES.avoidAttempts;
  const nothing = new Set();
  const lastSeen = new Map(); // object id -> days since it last appeared (1 = yesterday)
  const seenDays = (options.seen || []).slice(-RULES.freshDays);
  seenDays.forEach((ids, i) => {
    for (const id of ids) lastSeen.set(id, seenDays.length - i);
  });
  const pickWeight = (e) => weightOf(e) * freshness(lastSeen.get(e.object || e.id));
  // Questions asked before (`options.pairs`: one list of keys per day, most recent last). Keys are turned into small numbers so that
  // looking one up is cheap. Early tries refuse a question asked within the limit; every try PREFERS questions never asked, then
  // the ones asked longest ago, so a category that runs dry reuses its oldest questions first, and a puzzle always builds.
  const factId = new Map(); // fact key -> small number
  const idOf = (k) => {
    let v = factId.get(k);
    if (v === undefined) factId.set(k, (v = factId.size + 1));
    return v;
  };
  const pairNum = (a, b) => (a < b ? a * 2097152 + b : b * 2097152 + a);
  const pairAge = new Map(); // question -> days since it was last asked (1 = yesterday)
  (options.pairs || []).forEach((keys, i, all) => {
    for (const k of keys) {
      const [a, b] = k.split("~");
      pairAge.set(pairNum(idOf(a), idOf(b)), all.length - i);
    }
  });
  const pairsOn = pairAge.size > 0;
  const entFactIds = new Map(); // entity -> the ids of its facts by category
  const idOfFact = (e, c) => {
    let m = entFactIds.get(e);
    if (!m) entFactIds.set(e, (m = {}));
    return (m[c] ??= idOf(`${e.object || e.id}|${c}|${e.facts[c].value}`));
  };
  const pairLimitFor = (attempt) => (pairsOn ? RULES.pairTiers[Math.floor(attempt / RULES.pairTierAttempts)] ?? 0 : 0);
  const [oldA, oldB, oldC] = RULES.pairOldAges;
  const pairRank = (age) => (age === undefined ? 0 : age > oldA ? 1 : age > oldB ? 2 : age > oldC ? 3 : 4);

  /** Plan the shape of the chain: where it switches, and into which categories. */
  function makePlan() {
    let B = options.bridges;
    if (!B) {
      const choices = RULES.bridgeChances.filter(([n]) => !options.maxBridges || n <= options.maxBridges);
      let r = rng() * choices.reduce((t, [, p]) => t + p, 0);
      for (const [n, p] of choices) {
        B = n;
        if (r < p) break;
        r -= p;
      }
    }
    const where = shuffle([0, 1, 2, 3, 4, 5]).slice(0, B).sort((a, b) => a - b);
    const isB = Array(RULES.chainLength).fill(false);
    where.forEach((i) => (isB[i] = true));
    const cat = [startCat];
    for (let q = 0; q < RULES.chainLength - 1; q++) {
      if (isB[q]) {
        const opts = CATEGORY_KEYS.filter((c) => c !== cat[q] && sharedCount(cat[q], c) >= RULES.minBridgeCandidates);
        if (!opts.length) return null;
        cat.push(opts[Math.floor(rng() * opts.length)]);
      } else cat.push(cat[q]);
    }
    const counts = {};
    cat.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
    if (Math.max(...Object.values(counts)) > RULES.maxPerCategory) return null;
    const posInLeg = [];
    let k = 0;
    for (let q = 0; q < RULES.chainLength; q++) {
      posInLeg.push(k);
      k = isB[q] ? 0 : k + 1;
    }
    // how long the stretch that question q belongs to is
    const legLen = Array(RULES.chainLength).fill(0);
    for (let q = RULES.chainLength - 1; q >= 0; q--) legLen[q] = isB[q] || q === RULES.chainLength - 1 ? posInLeg[q] + 1 : legLen[q + 1];
    return { isB, cat, posInLeg, legLen };
  }

  /** Search for objects that fill the plan. Returns { anchor, seq, ents } or null. */
  function tryBuild(plan, slack, spiceAt, warmAnchor, allowWaiting, avoidNow, pairLimit = 0) {
    const { isB, cat, posInLeg, legLen } = plan;
    const N = RULES.chainLength;
    const warmFirst = !!warmAnchor;
    const anchors = warmAnchor ? [warmAnchor] : wshuffle(poolBy[cat[0]].filter((e) => e.fame !== 1 && !avoidNow.has(e.object || e.id))).map((e) => toItem(e, cat[0]));
    let budget = pairLimit > 0 ? RULES.pairBudget : RULES.searchBudget; // a search gives up quickly rather than exploring every combination
    for (const anchor of anchors) {
      const seq = [];
      const ents = [];
      const families = new Set([anchor.family]);
      let ups = 0;
      const dfs = (q, prev, lastUp, run, legUp, legDown) => {
        if (--budget < 0) return false;
        if (q === N) return ups >= RULES.minUps && ups <= RULES.maxUps;
        const c = cat[q];
        const b = isB[q];
        const spiceHere = q === spiceAt;
        // Enthusiast-only objects (fame 1) are kept out of ordinary slots: at most one deep cut per puzzle, only in its chosen slot.
        const base = (spiceHere ? poolBy[c].filter((e) => e.fame === 1 && spiceSince(e) > RULES.spiceCooldown) : poolBy[c].filter((e) => e.fame !== 1)).filter((e) => !avoidNow.has(e.object || e.id));
        const prevId = pairsOn ? idOf(factKey(prev)) : 0;
        const ageOf = (e) => pairAge.get(pairNum(prevId, idOfFact(e, c)));
        // the same list, with questions never asked first and then the ones asked longest ago (the order is otherwise kept)
        const rankOrder = (list) => (pairsOn ? list.map((e, i) => [pairRank(ageOf(e)), i, e]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((x) => x[2]) : list);
        const stepOk = (e) =>
          warmFirst && q === 0 ? warmGapOk(c, prev.value, e.facts[c].value) : gapOk(c, prev.value, e.facts[c].value, gapSlot(posInLeg[q], b), slack, b);
        let workable = base.filter((e) => !families.has(e.family) && stepOk(e));
        if (pairLimit > 0) workable = workable.filter((e) => { const age = ageOf(e); return age === undefined || age > pairLimit; }); // asked too recently: not in the first tries
        if (b) workable = workable.filter((e) => e.fame !== 1 && e.facts[cat[q + 1]] && !e.facts[cat[q + 1]].warmup);
        let ordered;
        if (b) {
          // Bridges: nothing used within the cooldown comes first, weighted by how well known the object is and by how long
          // since it last appeared (capped), so famous bridges come round more often than obscure ones.
          const rated = workable.map((e) => ({ e, s: sinceUsed(e.object || e.id) }));
          const ready = rated
            .filter((x) => x.s > RULES.hingeCooldown)
            .map((x) => ({ ...x, k: Math.pow(rng(), 1 / (pickWeight(x.e) * Math.min(x.s, RULES.hingeSinceCap))) }))
            .sort((x, y) => y.k - x.k);
          const waiting = rated.filter((x) => x.s <= RULES.hingeCooldown).sort((x, y) => y.s - x.s);
          ordered = allowWaiting ? [...rankOrder(ready.map((x) => x.e)), ...rankOrder(waiting.map((x) => x.e))] : rankOrder(ready.map((x) => x.e));
        } else if (warmFirst && q === 0) {
          // A warm-up should be easy, not silly: prefer the closest partners (at least warmMinGap away), mixed up a little.
          const byGap = workable.slice().sort((x, y) => gapRatio(c, prev.value, x.facts[c].value) - gapRatio(c, prev.value, y.facts[c].value));
          ordered = [...shuffle(byGap.slice(0, 8)), ...byGap.slice(8)];
        } else if (spiceHere) {
          ordered = shuffle(workable).sort((x, y) => spiceSince(y) - spiceSince(x));
        } else ordered = rankOrder(wshuffle(workable));
        for (const e of ordered) {
          const item = toItem(e, c);
          const up = item.value > prev.value;
          if (ups + (up ? 1 : 0) > RULES.maxUps) continue;
          if (ups + (up ? 1 : 0) + (N - 1 - q) < RULES.minUps) continue;
          const nextRun = q > 0 && up === lastUp ? run + 1 : 1;
          if (nextRun > RULES.maxRun) continue;
          const nUp = (posInLeg[q] === 0 ? 0 : legUp) + (up ? 1 : 0);
          const nDown = (posInLeg[q] === 0 ? 0 : legDown) + (up ? 0 : 1);
          const endOfStretch = b || q === N - 1;
          if (RULES.stretchBothWays && endOfStretch && legLen[q] >= RULES.stretchBothWays && (nUp === 0 || nDown === 0)) continue;
          seq.push(item);
          ents.push(e);
          families.add(e.family);
          if (up) ups++;
          const next = b ? toItem(e, cat[q + 1]) : item; // after a bridge, the next question starts from the same object in its new category
          if (dfs(q + 1, next, up, nextRun, nUp, nDown)) return true;
          seq.pop();
          ents.pop();
          families.delete(e.family);
          if (up) ups--;
        }
        return false;
      };
      if (dfs(0, anchor, false, 0, 0, 0)) return { anchor, seq, ents };
    }
    return null;
  }

  for (let attempt = 0; attempt < RULES.attempts; attempt++) {
    const slack = attempt < 200 ? 1 : attempt < 400 ? 1.5 : 3;
    const plan = makePlan();
    if (!plan) continue;
    // Where may the deep cut go? Any question from the 3rd on, chosen at random, but never a bridge.
    const targets = [];
    for (let i = RULES.deepCutFrom - 1; i < RULES.chainLength; i++) if (!plan.isB[i]) targets.push(i);
    const target = wantSpice && targets.length ? targets[Math.floor(rng() * targets.length)] : -1;
    const spice = target >= 0 && attempt < RULES.spiceAttempts && poolBy[plan.cat[target]].some((e) => e.fame === 1 && spiceSince(e) > RULES.spiceCooldown);
    // A warm-up: the puzzle starts from a reserved easy fact, and the first question is a big-gap gimme.
    let warmAnchor = null;
    if (wantWarm && attempt < RULES.warmAttempts) {
      const ready = warmBy[plan.cat[0]].filter((e) => warmSince(e) > RULES.warmCooldown && !(attempt < avoidTries && avoid.has(e.object || e.id)));
      if (ready.length) warmAnchor = toItem(shuffle(ready)[0], plan.cat[0]);
    }
    const built = tryBuild(plan, slack, spice ? target : -1, warmAnchor, attempt >= RULES.hardAttempts, attempt < avoidTries ? avoid : nothing, pairLimitFor(attempt));
    if (!built) continue;
    const legs = [];
    let cur = { cat: plan.cat[0], anchor: built.anchor, items: [] };
    built.seq.forEach((it, q) => {
      cur.items.push(it);
      if (plan.isB[q]) {
        legs.push(cur);
        cur = { cat: plan.cat[q + 1], anchor: toItem(built.ents[q], plan.cat[q + 1]), items: [] };
      }
    });
    legs.push(cur);
    const deepAt = built.seq.findIndex((it) => it.fame === 1);
    return {
      seed,
      slack,
      bridges: legs.slice(0, -1).map((l) => l.items[l.items.length - 1].ent),
      legs,
      warmUp: !!warmAnchor,
      deepCut: deepAt >= 0,
      deepCutAt: deepAt, // question index (0-based) of the deep cut, or -1
    };
  }
  return null;
}

/** Check a puzzle against every rule. Returns a list of problems (empty means valid). Old two-half puzzles are converted first. */
export function validatePuzzle(puzzle) {
  const legacy = !!puzzle && !puzzle.legs; // published before v3: it followed an older direction rule, so the new one is not applied to it
  const p = normalizePuzzle(puzzle);
  const problems = [];
  if (!p || !Array.isArray(p.legs) || !p.legs.length) return ["no puzzle"];
  const total = p.legs.reduce((n, l) => n + l.items.length, 0);
  if (total !== RULES.chainLength) problems.push(`chain is ${total} questions long, not ${RULES.chainLength}`);
  if (p.bridges.length !== p.legs.length - 1) problems.push("the number of bridges does not match the number of stretches");
  const counts = {};
  let ups = 0;
  let q = 0;
  const asked = [];
  const dirs = [];
  p.legs.forEach((leg, li) => {
    if (leg.items.length < 1) problems.push("a stretch has no questions");
    if (li > 0 && leg.cat === p.legs[li - 1].cat) problems.push("two stretches in a row use the same category");
    if (li > 0) {
      const before = p.legs[li - 1].items[p.legs[li - 1].items.length - 1];
      if (before.ent !== leg.anchor.ent) problems.push("a stretch does not start at the bridge");
      if (p.bridges[li - 1] !== before.ent) problems.push("the bridge list does not match the puzzle");
    }
    let prev = leg.anchor;
    leg.items.forEach((it, k) => {
      const isBridge = li < p.legs.length - 1 && k === leg.items.length - 1;
      const warmStep = p.warmUp && q === 0;
      if (warmStep) {
        if (!warmGapOk(leg.cat, prev.value, it.value)) problems.push(`warm-up gap out of range: ${prev.label} to ${it.label}`);
      } else if (!gapOk(leg.cat, prev.value, it.value, gapSlot(k, isBridge), p.slack || 1, isBridge, true)) {
        problems.push(`gap out of range: ${prev.label} to ${it.label}`);
      }
      if (prev.value === it.value) problems.push(`tie: ${prev.label} and ${it.label}`);
      if (it.value > prev.value) ups++;
      dirs.push(it.value > prev.value);
      if (it.fame === 1) {
        // Enthusiast-only objects (fame 1): at most one "deep cut", never question 1 or 2, never a bridge or the starting point.
        if (q < RULES.deepCutFrom - 1) problems.push(`deep cut too early: ${it.name} is question ${q + 1}`);
        if (isBridge) problems.push(`the bridge is an obscure object: ${it.name}`);
      }
      counts[leg.cat] = (counts[leg.cat] || 0) + 1;
      asked.push(it);
      prev = it;
      q++;
    });
    if (!legacy && RULES.stretchBothWays && leg.items.length >= RULES.stretchBothWays) {
      const d = dirs.slice(dirs.length - leg.items.length);
      if (!(d.includes(true) && d.includes(false))) problems.push(`answers are all one direction in a stretch of ${leg.items.length}`);
    }
  });
  if (!legacy) {
    let run = 1;
    let longest = 1;
    for (let i = 1; i < dirs.length; i++) {
      run = dirs[i] === dirs[i - 1] ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    if (longest > RULES.maxRun) problems.push(`${longest} answers in a row in the same direction`);
  }
  if (Math.max(...Object.values(counts)) > RULES.maxPerCategory) problems.push("one category takes too many of the questions");
  if (ups < RULES.minUps || ups > RULES.maxUps) problems.push(`the answers are lopsided: ${ups} of ${total} are higher`);
  if (asked.filter((it) => it.fame === 1).length > 1) problems.push("more than one deep cut");
  const start = p.legs[0].anchor;
  if (p.warmUp && !start.warmup) problems.push("a warm-up must start from a reserved warm-up fact");
  if (!p.warmUp && start.warmup) problems.push("a reserved warm-up fact is the start of a puzzle that is not a warm-up");
  if (start.fame === 1) problems.push(`obscure object as the starting point: ${start.name}`);
  const seen = new Set();
  for (const it of [start, ...asked]) {
    if (seen.has(it.family)) problems.push(`repeated object: ${it.name}`);
    seen.add(it.family);
  }
  return problems;
}

/** Answer for a question: "up" if the item is higher than the previous value. */
export function correctPick(item, prev) {
  return item.value > prev.value ? "up" : "down";
}

export function streaks(results) {
  let longest = 0;
  let cur = 0;
  for (const ok of results) {
    cur = ok ? cur + 1 : 0;
    if (cur > longest) longest = cur;
  }
  return { longest, correct: results.filter(Boolean).length };
}

/**
 * Puzzle number for a moment in time. #1 is RULES.launchDate. The day changes at 00:00 UTC for
 * everyone, so friends in different time zones always share the same puzzle number.
 */
export function puzzleNumber(date = new Date()) {
  const [y, m, d] = RULES.launchDate.split("-").map(Number);
  const launch = Date.UTC(y, m - 1, d);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.max(1, Math.round((today - launch) / 86400000) + 1);
}

/** The moment the next puzzle arrives: the next 00:00 UTC. */
export function nextPuzzleTime(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

export function seedForPuzzle(num) {
  return num * 7919 + 13;
}

/**
 * Generate a run of daily puzzles. Each day starts in a different category (see startCategoryFor), and the bridges used on recent days
 * are remembered, so a bridge is not reused inside its cooldown. A warm-up period before the first requested day builds that history.
 */
export function maxBridgesAfter(yesterdaysBridges) {
  // Pacing: after a busy day (three or more switches), the next day is calmer, so two wild days never come back to back.
  return yesterdaysBridges && yesterdaysBridges.length >= RULES.busyDay ? RULES.busyDay - 1 : undefined;
}

/** The objects the next puzzle must not use: everything from the last RULES.noRepeatDays days (a list of sets, one per day, most recent last). */
export function avoidAfter(daysOfObjects) {
  return daysOfObjects.slice(-RULES.noRepeatDays).flatMap((s) => [...s]);
}

export function generateSeries(startNum, days, entities, warmup = Math.max(30, RULES.freshDays), { pairMemory = true } = {}) {
  const recent = []; // one array of bridge ids per day
  const recentSpice = [];
  const recentWarm = [];
  const recentObjects = []; // one set of object ids per day
  const recentPairs = []; // one list of question keys per day
  const out = [];
  for (let n = Math.max(1, startNum - warmup); n < startNum + days; n++) {
    const p = generate(seedForPuzzle(n), entities, {
      history: recent,
      startCat: startCategoryFor(n),
      maxBridges: maxBridgesAfter(recent[recent.length - 1]),
      avoid: avoidAfter(recentObjects),
      seen: recentObjects,
      spiceHistory: recentSpice,
      warmHistory: recentWarm,
      pairs: pairMemory ? recentPairs.slice(-RULES.pairMemoryDays) : [],
    });
    if (p) p.num = n;
    recentObjects.push(p ? objectsOf(p) : new Set());
    recentPairs.push(p ? pairsOf(p) : []);
    recent.push(p ? p.bridges : []);
    const deepItem = p ? p.legs.flatMap((l) => l.items).find((it) => it.fame === 1) : null;
    recentSpice.push(deepItem ? deepItem.ent : null);
    recentWarm.push(p && p.warmUp ? p.legs[0].anchor.ent : null);
    if (n >= startNum) out.push(p);
  }
  return out;
}

export function generateDaily(num, entities) {
  return generateSeries(num, 1, entities)[0];
}

export function shareText(puzzle, results, num, score = null) {
  const { longest, correct } = streaks(results);
  const perfect = correct === RULES.chainLength;
  // A right answer is a broom, a wrong one a puff of dust.
  const g = (arr) => arr.map((r) => (r ? "\uD83E\uDDF9" : "\uD83D\uDCA8")).join("");
  const label = "Clean Sweep" + (num ? ` #${num}` : " (practice)");
  const lines = [
    perfect ? `\u2728 ${label} \u2728` : label,
    g(results), // one emoji per question: a broom for right, a puff of dust for wrong
    score ? `Score: ${score.pct}% (${score.total.toLocaleString("en-GB")} pts)` : "",
    `Longest Sweep: ${longest} | Cleaned: ${correct}/${RULES.chainLength}`,
    RULES.shareUrl || "",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * How long until the next puzzle, rounded up to the minute: "6h 12m", "6h" or "42m".
 * It counts real time, so it stays right when the clocks change.
 */
export function countdownText(now = new Date()) {
  const mins = Math.max(1, Math.ceil((nextPuzzleTime(now).getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * The two fixed practice puzzles. They are the same for everyone, forever, and never change with the date,
 * so practice cannot become a way to play endless games. Each can be played once per device.
 * The first opens with a Warm-up and has one switch of category; the second has a Deep cut and two switches, so players meet the badges and the switching before the daily puzzle.
 * Frozen copies live in puzzles/practice-1.json and puzzles/practice-2.json (see scripts/make-practice.mjs).
 */
// The seeds were found by searching the pool as it stood when v3 was built: friendly objects only (apart from the one Deep cut),
// not too many close calls, and different categories. Practice 1 has one switch and practice 2 has two, so players meet bridges early.
export const PRACTICE = [
  { seed: 2550, options: { warm: true, spice: false, bridges: 1, startCat: "speed" } },
  { seed: 3, options: { warm: false, spice: true, bridges: 2, startCat: "date" } },
];

export function generatePractice(n, entities) {
  const c = PRACTICE[n - 1];
  if (!c) return null;
  const p = generate(c.seed, entities, c.options);
  if (p) p.practice = n;
  return p;
}
