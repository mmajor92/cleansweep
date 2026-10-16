// The ruler's one rule: how far the new dot slides out of the middle.
// The ruler always shows your current value in the middle, so it can never give anything away about the answer.
import { gapRatio } from "./engine.js";

const REACH_RATIO = 3; // a gap of 3x or more takes the dot all the way out
const MAX_MOVE = 44; // the furthest it goes from the middle: out to 6% or 94% of the tape
const CURVE = 0.7; // below 1 stretches small gaps, so nothing barely moves

/**
 * Where the new dot lands, as a percent across the ruler, when your current value sits in the middle (50).
 * How far it moves from the middle shows how close the two values are (the same measure as the Easy, Medium and
 * Close call tags), so a close call moves a little, a medium gap a fair way, and an easy one nearly to the end.
 * Older and smaller is to the left, newer and bigger to the right.
 */
export function slideAt(category, from, to) {
  const d = Math.min(1, Math.log(gapRatio(category, from, to)) / Math.log(REACH_RATIO));
  return 50 + (to >= from ? 1 : -1) * MAX_MOVE * Math.pow(d, CURVE);
}

