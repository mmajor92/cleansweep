// Number and date formatting. Pure functions, no DOM.

const NF = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function formatNumber(n) {
  return NF.format(n);
}

export function yearLabel(year, approx = false) {
  return (approx ? "c. " : "") + (year < 0 ? `${-year} BC` : String(year));
}

/** Split a value into a big number and a unit, like { num: "53,150", unit: "tonnes" }. */
export function valueParts(category, item) {
  const v = item.value;
  const pre = item.approx ? "about " : "";
  switch (category) {
    case "length":
      return { num: pre + formatNumber(v), unit: "m" };
    case "speed":
      return { num: pre + formatNumber(v), unit: "km/h" };
    case "count":
      return { num: pre + formatNumber(v), unit: "" };
    case "date":
      return { num: yearLabel(v, item.approx), unit: "" };
    case "weight": {
      if (v < 1000) return { num: pre + formatNumber(v), unit: "kg" };
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
