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
  shareUrl: "", // add the web address here once there is one, and it is appended to every share card
  splits: [3, 4], // questions in the first half: 3 or 4, the second half gets the rest
  maxGap: [4, 3, 2.5, 2], // widest allowed gap by question position within a half
  fameWeight: { 3: 10, 2: 3, 1: 0.5 }, // how much more often well-known objects are picked than obscure ones
  hingeCooldown: 7, // a hinge is not reused within this many days
  hingeSinceCap: 365, // days since last use stops counting after this
  warmChance: 0.5, // chance a puzzle tries to open with a "warm-up" (an easy first question)
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
  hingeMaxGap: 3.1, // the hinge (last question of the first half) may sit a little further from its neighbour
  minGap: { default: 1.15, date: 1.12 },
  minYearsApart: 5,
  allowedStatuses: ["verified", "definitional"],
  nowYear: 2026, // dates are compared by "years ago", so this is frozen on purpose
  launchDate: "2026-10-16", // puzzle #1 (first public day, in UTC). Never change this after launch.
};

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

export function gapOk(category, a, b, position, slack = 1, isHinge = false) {
  if (category === "date" && Math.abs(a - b) < RULES.minYearsApart) return false;
  const r = gapRatio(category, a, b);
  const min = category === "date" ? RULES.minGap.date : RULES.minGap.default;
  const max = (isHinge ? RULES.hingeMaxGap : RULES.maxGap[Math.min(position, RULES.maxGap.length - 1)]) * slack;
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
  for (const e of raw.entities || raw) {
    const facts = {};
    for (const [cat, f] of Object.entries(e.facts)) {
      if (!CATEGORIES[cat]) continue;
      if (!allowedStatuses.includes(f.status)) continue;
      facts[cat] = f;
    }
    if (Object.keys(facts).length) out.push({ id: e.id, name: e.name, family: e.family || e.id, hint: e.hint || "", clue: e.clue || "", facts, fame: e.fame || 2 });
  }
  return out;
}

export function toItem(entity, category) {
  const f = entity.facts[category];
  return {
    ent: entity.id,
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

/**
 * Build one puzzle: a chain of 7 questions in two halves joined by a hinge object.
 * Returns null if no valid chain exists for this seed and pool.
 */
/** How often an object should be picked relative to others, from its familiarity rating (3, 2 or 1). */
export function weightOf(entity) {
  return RULES.fameWeight[entity.fame] ?? RULES.fameWeight[2];
}

export function generate(seed, entities, options = {}) {
  const history = options.history || []; // recent hinge ids, most recent last
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
  const wshuffle = (arr) =>
    arr
      .map((e) => ({ e, k: Math.pow(rng(), 1 / weightOf(e)) }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.e);
  // Reserved warm-up facts (facts with no neighbours within the gap rules) never appear in ordinary slots.
  const pool = (cat) => entities.filter((e) => e.facts[cat] && !e.facts[cat].warmup);
  const warmPool = (cat) => entities.filter((e) => e.facts[cat] && e.facts[cat].warmup && e.fame !== 1);
  const wantWarm = options.warm !== undefined ? options.warm : rng() < RULES.warmChance;
  const warmHistory = options.warmHistory || [];
  const warmSince = (e) => {
    const i = warmHistory.lastIndexOf(e.id);
    return i < 0 ? 1e6 : warmHistory.length - i;
  };
  // Does this puzzle end with a "deep cut"? Decided once per puzzle so the rate stays steady.
  const wantSpice = options.spice !== undefined ? options.spice : rng() < RULES.spiceChance;
  // Deep cuts rotate: the obscure object that has gone longest without appearing is tried first.
  const spiceHistory = options.spiceHistory || [];
  const spiceSince = (e) => {
    const i = spiceHistory.lastIndexOf(e.id);
    return i < 0 ? 1e6 : spiceHistory.length - i;
  };

  function buildSegment(cat, n, fixedAnchor, lastEntity, usedFamilies, slack, spiceAt = -1, warmFirst = false) {
    const eligible = pool(cat).filter(
      (e) => !usedFamilies.has(e.family) && (!lastEntity || e.family !== lastEntity.family)
    );
    // Enthusiast-only objects (fame 1) are kept out of ordinary slots. At most one "deep cut" per puzzle,
    // and only in the slot (spiceAt) chosen for it.
    const all = eligible.filter((e) => e.fame !== 1);
    const spicy = eligible.filter((e) => e.fame === 1);
    const anchors = fixedAnchor ? [fixedAnchor] : wshuffle(all).map((e) => toItem(e, cat));
    let budget = RULES.spiceBudget; // a deep-cut search gives up quickly rather than exploring every combination
    for (const anchor of anchors) {
      const seq = [];
      const families = new Set([anchor.family]);
      const dfs = (k, prev) => {
        if (spiceAt >= 0 && --budget < 0) return false;
        if (k === n) {
          const dirs = [];
          let p = anchor;
          for (const it of seq) {
            dirs.push(it.value > p.value);
            p = it;
          }
          return dirs.includes(true) && dirs.includes(false); // at least one higher and one lower
        }
        let cands;
        if (k === n - 1 && lastEntity) {
          cands = [toItem(lastEntity, cat)];
        } else {
          // Filter by family and by the gap rules first, so only workable objects are shuffled and built.
          const isSpice = k === spiceAt;
          const base = isSpice ? spicy.filter((e) => spiceSince(e) > RULES.spiceCooldown) : all;
          const stepOk = (e) =>
            warmFirst && k === 0
              ? warmGapOk(cat, prev.value, e.facts[cat].value)
              : gapOk(cat, prev.value, e.facts[cat].value, gapSlot(k, false), slack, false);
          const workable = base.filter((e) => !families.has(e.family) && stepOk(e));
          let ordered;
          if (warmFirst && k === 0) {
            // A warm-up should be easy, not silly: prefer the closest partners (at least warmMinGap away), mixed up a little.
            const byGap = workable
              .slice()
              .sort((a, b) => gapRatio(cat, prev.value, a.facts[cat].value) - gapRatio(cat, prev.value, b.facts[cat].value));
            ordered = [...shuffle(byGap.slice(0, 8)), ...byGap.slice(8)];
          } else {
            ordered = isSpice ? shuffle(workable).sort((a, b) => spiceSince(b) - spiceSince(a)) : wshuffle(workable);
          }
          cands = ordered.map((e) => toItem(e, cat));
        }
        for (const c of cands) {
          const isHingeStep = k === n - 1 && !!lastEntity;
          const gapGood = warmFirst && k === 0 ? warmGapOk(cat, prev.value, c.value) : gapOk(cat, prev.value, c.value, gapSlot(k, isHingeStep), slack, isHingeStep);
          if (!gapGood) continue;
          seq.push(c);
          families.add(c.family);
          if (dfs(k + 1, c)) return true;
          seq.pop();
          families.delete(c.family);
        }
        return false;
      };
      if (dfs(0, anchor)) return { anchor, items: seq };
    }
    return null;
  }

  const attempts = 600;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const slack = attempt < 200 ? 1 : attempt < 400 ? 1.5 : 3;
    const usePreferred = options.pair && attempt < 40;
    const cats = shuffle(CATEGORY_KEYS);
    const c1 = usePreferred ? options.pair[0] : cats[0];
    const c2 = usePreferred ? options.pair[1] : cats[1];
    const n1 = rng() < 0.5 ? RULES.splits[0] : RULES.splits[1];
    const n2 = RULES.chainLength - n1;
    const shuffled = shuffle(entities.filter((e) => e.facts[c1] && e.facts[c2] && !e.facts[c1].warmup && !e.facts[c2].warmup && e.fame !== 1)); // an obscure object is never a hinge
    // Where may the deep cut go? Any question from the 3rd on, chosen at random, but never the hinge.
    const targets = [];
    for (let i = RULES.deepCutFrom - 1; i < RULES.chainLength; i++) if (i !== n1 - 1) targets.push(i);
    const target = wantSpice ? targets[Math.floor(rng() * targets.length)] : -1;
    const targetCat = target < n1 ? c1 : c2;
    const spice =
      target >= 0 &&
      attempt < RULES.spiceAttempts &&
      pool(targetCat).some((e) => e.fame === 1 && spiceSince(e) > RULES.spiceCooldown);
    const spiceAt1 = spice && target < n1 ? target : -1;
    const spiceAt2 = spice && target >= n1 ? target - n1 : -1;
    // A warm-up: the puzzle starts from a reserved easy fact, and the first question is a big-gap gimme.
    let warmAnchor = null;
    if (wantWarm && attempt < RULES.warmAttempts) {
      const ready = warmPool(c1).filter((e) => warmSince(e) > RULES.warmCooldown);
      if (ready.length) warmAnchor = toItem(shuffle(ready)[0], c1);
    }
    // Hinges: nothing used within the cooldown comes first. Among those, the pick is weighted by how
    // well known the object is and by how long since it last appeared (capped), so famous hinges come
    // round more often than obscure ones, and no hinge is ever reused inside the cooldown.
    const rated = shuffled.map((e) => {
      const last = history.lastIndexOf(e.id);
      const since = last < 0 ? RULES.hingeSinceCap : history.length - last;
      return { e, since };
    });
    const ready = rated
      .filter((x) => x.since > RULES.hingeCooldown)
      .map((x) => ({ ...x, k: Math.pow(rng(), 1 / (weightOf(x.e) * Math.min(x.since, RULES.hingeSinceCap))) }))
      .sort((a, b) => b.k - a.k);
    const waiting = rated.filter((x) => x.since <= RULES.hingeCooldown).sort((a, b) => b.since - a.since);
    const hinges = [...ready, ...waiting].map((x) => x.e);
    let tried = 0;
    for (const H of hinges) {
      if (spice && tried++ >= RULES.spiceHingeTries) break; // a deep-cut attempt tries only a few hinges, then moves on
      const s1 = buildSegment(c1, n1, warmAnchor, H, new Set(), slack, spiceAt1, !!warmAnchor);
      if (!s1) continue;
      const used = new Set([s1.anchor.family, ...s1.items.map((x) => x.family)]);
      used.delete(H.family);
      const s2 = buildSegment(c2, n2, toItem(H, c2), null, used, slack, spiceAt2);
      if (!s2) continue;
      const deepAt = [...s1.items, ...s2.items].findIndex((it) => it.fame === 1);
      return {
        seed,
        c1,
        c2,
        n1,
        n2,
        slack,
        hinge: { id: H.id, name: H.name, hint: H.hint || "" },
        seg1: s1,
        seg2: s2,
        warmUp: !!warmAnchor,
        deepCut: deepAt >= 0,
        deepCutAt: deepAt, // question index (0-based) of the deep cut, or -1
      };
    }
  }
  return null;
}

/** Check a puzzle against every rule. Returns a list of problems (empty means valid). */
export function validatePuzzle(p) {
  const problems = [];
  if (!p) return ["no puzzle"];
  if (p.seg1.items.length !== p.n1) problems.push("first half has the wrong length");
  if (p.seg2.items.length !== p.n2) problems.push("second half has the wrong length");
  if (p.n1 + p.n2 !== RULES.chainLength) problems.push("chain is not 7 long");
  if (p.c1 === p.c2) problems.push("both halves use the same category");
  if (p.seg1.items[p.n1 - 1].ent !== p.hinge.id) problems.push("hinge is not the last item of the first half");
  if (p.seg2.anchor.ent !== p.hinge.id) problems.push("second half does not start at the hinge");
  for (const [seg, cat] of [[p.seg1, p.c1], [p.seg2, p.c2]]) {
    let prev = seg.anchor;
    const dirs = [];
    seg.items.forEach((it, k) => {
      const isHinge = seg === p.seg1 && k === seg.items.length - 1;
      const warmStep = p.warmUp && seg === p.seg1 && k === 0;
      if (warmStep) {
        if (!warmGapOk(cat, prev.value, it.value)) problems.push(`warm-up gap out of range: ${prev.label} to ${it.label}`);
      } else if (!gapOk(cat, prev.value, it.value, gapSlot(k, isHinge), p.slack || 1, isHinge)) {
        problems.push(`gap out of range: ${prev.label} to ${it.label}`);
      }
      if (prev.value === it.value) problems.push(`tie: ${prev.label} and ${it.label}`);
      dirs.push(it.value > prev.value);
      prev = it;
    });
    if (!(dirs.includes(true) && dirs.includes(false))) problems.push("answers are all one direction");
  }
  // Enthusiast-only objects (fame 1): at most one "deep cut", never question 1 or 2, never the hinge or the starting point.
  const asked = [...p.seg1.items, ...p.seg2.items];
  const deepItems = asked.map((it, i) => ({ it, i })).filter((x) => x.it.fame === 1);
  if (deepItems.length > 1) problems.push("more than one deep cut");
  for (const { it, i } of deepItems) {
    if (i < RULES.deepCutFrom - 1) problems.push(`deep cut too early: ${it.name} is question ${i + 1}`);
    if (i === p.n1 - 1) problems.push(`the hinge is an obscure object: ${it.name}`);
  }
  if (p.warmUp && !p.seg1.anchor.warmup) problems.push("a warm-up must start from a reserved warm-up fact");
  if (!p.warmUp && p.seg1.anchor.warmup) problems.push("a reserved warm-up fact is the start of a puzzle that is not a warm-up");
  if (p.seg1.anchor.fame === 1) problems.push(`obscure object as the starting point: ${p.seg1.anchor.name}`);
  const seen = new Set();
  for (const it of [p.seg1.anchor, ...p.seg1.items, ...p.seg2.items]) {
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

/** Every block of 20 days covers all 20 ordered category pairs once, in a seeded order. */
export function pairForDay(num) {
  const pairs = [];
  for (const a of CATEGORY_KEYS) for (const b of CATEGORY_KEYS) if (a !== b) pairs.push([a, b]);
  const rng = mulberry32(Math.floor((num - 1) / pairs.length) * 131 + 7);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs[(num - 1) % pairs.length];
}

/**
 * Generate a run of daily puzzles. For each category pair the hinge object used longest ago
 * is tried first, so hinges rotate instead of repeating. A warm-up period before the first
 * requested day builds that history.
 */
export function generateSeries(startNum, days, entities, warmup = 30) {
  const recent = [];
  const recentSpice = [];
  const recentWarm = [];
  const out = [];
  for (let n = Math.max(1, startNum - warmup); n < startNum + days; n++) {
    const p = generate(seedForPuzzle(n), entities, { history: recent, pair: pairForDay(n), spiceHistory: recentSpice, warmHistory: recentWarm });
    if (p) p.num = n;
    recent.push(p ? p.hinge.id : null);
    const deepItem = p ? [...p.seg1.items, ...p.seg2.items].find((it) => it.fame === 1) : null;
    recentSpice.push(deepItem ? deepItem.ent : null);
    recentWarm.push(p && p.warmUp ? p.seg1.anchor.ent : null);
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
 * The two fixed practice puzzles. They are the same for everyone, forever, and never change with the date,
 * so practice cannot become a way to play endless games. Each can be played once per device.
 * The first opens with a Warm-up and the second has a Deep cut, so players meet both badges before the daily puzzle.
 * Frozen copies live in puzzles/practice-1.json and puzzles/practice-2.json (see scripts/make-practice.mjs).
 */
export const PRACTICE = [
  { seed: 5090, options: { warm: true, spice: false } },
  { seed: 105030, options: { warm: false, spice: true } },
];

export function generatePractice(n, entities) {
  const c = PRACTICE[n - 1];
  if (!c) return null;
  const p = generate(c.seed, entities, c.options);
  if (p) p.practice = n;
  return p;
}
