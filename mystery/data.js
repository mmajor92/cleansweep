// Turns the shared facts (data/facts.json) into what Mystery Thing needs: every object that has two or more of size, weight, speed and year,
// and the list of objects that can be the answer. A fact added for Clean Sweep can feed this game too, with no extra work.

export const DATA_CATS = ["length", "weight", "speed", "date"]; // count is left out: "steps" against "seats" is not a fair comparison
export const MIN_POOL = 50; // a puzzle's clue pair must give a guess list of at least this many things
// Answers must be things people can picture: only the "everyone knows" objects (fame 3), minus a few that were rated generously
// (a rifle bullet, space probes, fighter jets). Any object can still be GUESSED.
export const NOT_AN_ANSWER = /rifle bullet|Juno|New Horizons|F-22|F-35|F-16|Segway/;

const typo = (s) => (s || "").replace(/'/g, "\u2019");
// Some labels are just the object's name ("A black rhinoceros" for its weight). Fine on Clean Sweep's ruler, but on the result card they sit
// beside "Black rhino height" and "Black rhino top speed". Those become "Black rhinoceros weight". Labels that already say what they measure are left alone.
const ARTICLE = /^(a|an|the)\s+/i;
const CAT_WORD = { length: "size", weight: "weight", speed: "speed", date: "year" };
export function tidyLabel(label, cat, name) {
  const l = (label || "").trim();
  const bare = l.replace(ARTICLE, "");
  if (!ARTICLE.test(l) && bare.toLowerCase() !== (name || "").replace(ARTICLE, "").toLowerCase()) return l;
  return bare.charAt(0).toUpperCase() + bare.slice(1) + " " + CAT_WORD[cat];
}
const subsets2 = (arr) => arr.flatMap((x, i) => arr.slice(i + 1).map((y) => [x, y]));

/** entities is the "entities" list from data/facts.json. */
export function buildData(entities) {
  const objs = entities
    .filter((e) => !e.object)
    .map((e) => ({
      id: e.id,
      name: typo(e.name),
      fame: e.fame || 2,
      c: Object.fromEntries(
        DATA_CATS.filter((k) => e.facts[k] && !e.facts[k].warmup).map((k) => [k, { v: e.facts[k].value, ap: !!e.facts[k].approx, label: typo(tidyLabel(e.facts[k].label, k, e.name)), note: typo(e.facts[k].note || "") }]),
      ),
    }))
    .filter((o) => Object.keys(o.c).length >= 2);
  const pool = (p) => objs.filter((o) => o.c[p[0]] && o.c[p[1]]);
  const secrets = objs
    .filter((o) => o.fame >= 3 && !NOT_AN_ANSWER.test(o.name))
    .map((o) => ({ id: o.id, pairs: subsets2(DATA_CATS.filter((c) => o.c[c])).filter((p) => pool(p).length >= MIN_POOL) }))
    .filter((s) => s.pairs.length > 0);
  return { objs, secrets };
}
