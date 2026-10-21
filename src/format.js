// Number and date formatting. Pure functions, no DOM.

const NF = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function formatNumber(n) {
  return NF.format(n);
}
// Three significant digits, for values where one decimal place would round the figure away (2.7 g, 0.048 km/h).
const NFS = new Intl.NumberFormat("en-GB", { maximumSignificantDigits: 3 });
const formatSmall = (n) => NFS.format(n);

/** The era for a year: BC before the year 1, AD for the first thousand years (so "80 AD", not a bare "80"), and nothing after that. */
export function yearEra(year) {
  return year < 0 ? "BC" : year < 1000 ? "AD" : "";
}

export function yearLabel(year, approx = false) {
  const era = yearEra(year);
  return (approx ? "c. " : "") + Math.abs(year) + (era ? ` ${era}` : "");
}

/** Split a value into a big number and a unit, like { num: "53,150", unit: "tonnes" }. */
export function valueParts(category, item) {
  const v = item.value;
  const pre = item.approx ? "about " : "";
  switch (category) {
    case "length": {
      // Stored in metres, shown the way people say it: centimetres under 1 m, metres up to 999 m, then kilometres (1.1 km, 193 km, 9,288 km).
      if (v < 1) return { num: pre + formatSmall(v * 100), unit: "cm" };
      if (v < 1000) return { num: pre + formatNumber(v), unit: "m" };
      const km = v / 1000;
      return { num: pre + (km < 1000 ? formatSmall(km) : formatNumber(km)), unit: "km" };
    }
    case "speed":
      return { num: pre + (v < 1 ? formatSmall(v) : formatNumber(v)), unit: "km/h" }; // a snail is 0.048 km/h, not "0 km/h"
    case "count":
      return { num: pre + formatNumber(v), unit: "" };
    case "date":
      return { num: (item.approx ? "c. " : "") + Math.abs(v), unit: yearEra(v) };
    case "weight": {
      if (v < 1) return { num: pre + formatSmall(v * 1000), unit: "g" }; // a table tennis ball is 2.7 g, not "0 kg"
      if (v < 10) return { num: pre + formatSmall(v), unit: "kg" }; // 1.59 kg, 6.18 kg
      if (v < 1000) return { num: pre + formatNumber(v), unit: "kg" };
      if (v >= 1e12) { // a planet: 3.3 x 10^23 kg, not a string of digits
        const [m, e] = v.toExponential(2).split("e");
        return { num: `${pre}${Number(m)} x 10^${Number(e)}`, unit: "kg" };
      }
      const t = v / 1000;
      if (t >= 1e6) return { num: pre + formatNumber(t / 1e6), unit: "million tonnes" };
      return { num: pre + formatNumber(t), unit: t === 1 ? "tonne" : "tonnes" };
    }
    default:
      throw new Error(`unknown category: ${category}`);
  }
}

export function valueText(category, item) {
  const p = valueParts(category, item);
  return p.num + (p.unit ? " " + p.unit : "");
}

/**
 * Just the figure, for the ruler: the same as valueText but without "about" or "c.", because the big answer above already says that.
 * The unit stays, so when the chain switches category you can see the measure change.
 */
export function figureText(category, item) {
  return valueText(category, { ...item, approx: false });
}

const MAX_EVENT_NAME = 45;

/**
 * The line under the big figure. For a date it is the question's own wording, so "the sealing of Magna Carta" reads
 * "Sealing of Magna Carta" and the figure is never a mystery. If that is too long to sit well, the short label is used.
 * Everything else uses its label ("Hadrian's Wall length").
 */
export function displayName(category, item) {
  if (category === "date" && item.phrase) {
    const t = item.phrase.replace(/^the\s+/i, "");
    const name = t.charAt(0).toUpperCase() + t.slice(1);
    if (name.length <= MAX_EVENT_NAME) return name;
  }
  return item.label;
}

/** Whole years between two year numbers. There is no year zero. */
export function yearsBetween(a, b) {
  let d = Math.abs(a - b);
  if (a < 0 !== b < 0) d -= 1;
  return d;
}

/** A plain-English line for how far apart two values are. */
export function differenceText(category, words, item, prev) {
  const up = item.value > prev.value;
  const word = words[up ? 1 : 0];
  if (category === "date") {
    const approx = item.approx || prev.approx;
    return `${approx ? "About " : ""}${formatNumber(yearsBetween(item.value, prev.value))} years ${word} than ${prev.label}.`;
  }
  const hi = Math.max(item.value, prev.value);
  const lo = Math.min(item.value, prev.value);
  const r = hi / lo;
  const amount = r >= 2 ? `${formatNumber(Math.round(r * 10) / 10)} times` : `${Math.round((r - 1) * 100)}%`;
  return `That is ${amount} ${word} than ${prev.label}.`;
}

/** The question text for one step of the chain. */
export function questionText(category, words, item, prev) {
  if (category === "date") return `Did ${item.phrase} happen before or after ${prev.phrase}?`;
  return `Is ${item.phrase} ${words[1]} or ${words[0]} than ${prev.phrase}?`;
}

// ---- "Closer in time" questions: the card and two other events, one earlier and one later (see closerCandidates in engine.js) ----
const capFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** The two options in time order: the earlier one is the left button ("down"), the later one the right ("up"). The item is the nearer one. */
export function closerSides(item) {
  return item.closer.itemOn === "down" ? { left: item, right: item.closer.rival } : { left: item.closer.rival, right: item };
}

export function closerQuestion(item, prev) {
  const s = closerSides(item);
  return `Is ${prev.phrase} closer in time to ${s.left.phrase} or ${s.right.phrase}?`;
}

export function closerDifferenceText(item, prev) {
  const { dItem, dRival, rival } = item.closer;
  return `${capFirst(item.phrase)} is closer: ${formatNumber(dItem)} years from ${prev.phrase}, against ${formatNumber(dRival)} for ${rival.phrase}.`;
}
