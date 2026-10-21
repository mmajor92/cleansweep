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


const CLOSER_REACH = 38; // the farther option sits this far from the middle (a percent of the tape) in a "closer in time" question

/**
 * Where the two options of a "closer in time" question land. Each goes out from the middle on its own side (the earlier one to the left),
 * by how many YEARS it is from the card. The game's usual ruler uses a ratio of values, which would get "closer in time" wrong.
 */
export function closerPositions(item) {
  const { dItem, dRival, itemOn } = item.closer;
  const far = Math.max(dItem, dRival);
  const pos = (d, onLeft) => 50 + (onLeft ? -1 : 1) * CLOSER_REACH * (d / far);
  return { item: pos(dItem, itemOn === "down"), rival: pos(dRival, itemOn !== "down") };
}
