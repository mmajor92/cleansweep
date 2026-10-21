// Scoring. Pure functions, no DOM.
//
// Every question is tagged before you answer, by how close the two values are:
//   Close call  (under 1.5x apart)       worth 2.0x
//   Medium      (1.5x to under 2.2x)     worth 1.5x
//   Easy        (2.2x or more apart)     worth 1.0x
// A right answer scores BASE points times its tier, then times a streak bonus: each right answer in
// a row adds 10% more than the one before. A wrong answer scores 0 and resets the streak. The next
// right answer starts a fresh streak at 1.0x, so one or two slips cost you the streak bonus, not the game.
import { closerRatio, gapRatio, questionsOf } from "./engine.js";

export const SCORING = {
  base: 100,
  streakStep: 0.1,
  deepCut: 1.5, // bonus for the enthusiast-only final question
  tiers: [
    { key: "close", label: "Close call", maxRatio: 1.5, mult: 2 },
    { key: "medium", label: "Medium", maxRatio: 2.2, mult: 1.5 },
    { key: "easy", label: "Easy", maxRatio: Infinity, mult: 1 },
  ],
};

/** The tier for a gap ratio. */
export function tierFor(ratio) {
  return SCORING.tiers.find((t) => ratio < t.maxRatio);
}

/** The tier multiplier: 2, 1.5 or 1. */
export function difficulty(ratio) {
  return tierFor(ratio).mult;
}

/** run = right answers in a row, counting this one. */
export function streakMultiplier(run) {
  return 1 + SCORING.streakStep * (Math.max(run, 1) - 1);
}

/** Which of the 7 questions are "deep cuts" (enthusiast-only objects)? At most one, never the first two. */
export function questionDeep(puzzle) {
  return questionsOf(puzzle).map((x) => x.item.fame === 1);
}

/** The gap ratio of each of the 7 questions, in order. */
export function questionRatios(puzzle) {
  return questionsOf(puzzle).map((x) => (x.item.closer ? closerRatio(x.item) : gapRatio(x.cat, x.prev.value, x.item.value)));
}

/**
 * Score a (possibly partial) run of results against the puzzle's gap ratios.
 * Returns the total so far, the maximum possible (every answer right), the percentage, and a
 * per-question breakdown.
 */
export function scoreRun(ratios, results, deep = []) {
  let run = 0;
  let total = 0;
  const detail = ratios.map((ratio, i) => {
    const answered = i < results.length;
    const correct = answered && results[i] === true;
    run = correct ? run + 1 : 0;
    const tier = tierFor(ratio);
    const m = correct ? streakMultiplier(run) : 1;
    const bonus = deep[i] ? SCORING.deepCut : 1;
    const points = correct ? Math.round(SCORING.base * tier.mult * bonus * m) : 0;
    if (answered) total += points;
    return { answered, correct, ratio, tier, deep: !!deep[i], difficulty: tier.mult, multiplier: m, points };
  });
  let max = 0;
  ratios.forEach((ratio, i) => {
    max += Math.round(SCORING.base * difficulty(ratio) * (deep[i] ? SCORING.deepCut : 1) * streakMultiplier(i + 1));
  });
  return { total, max, pct: max ? Math.round((100 * total) / max) : 0, detail };
}
