// Pure helpers for harvesting candidate facts from Wikidata. No network here, so it can be unit tested.

/** Properties we read. `kind` is a plain-English word used to suggest a phrase. */
export const PROPERTIES = [
  { cat: "length", pid: "P2048", kind: "height", type: "quantity", factor: 1 },
  { cat: "length", pid: "P2043", kind: "length", type: "quantity", factor: 1 },
  { cat: "weight", pid: "P2067", kind: "mass", type: "quantity", factor: 1 },
  { cat: "speed", pid: "P2052", kind: "top speed", type: "quantity", factor: 3.6 }, // m/s to km/h
  { cat: "count", pid: "P1083", kind: "capacity", type: "quantity", factor: 1 },
  { cat: "date", pid: "P571", kind: "creation", type: "time" },
  { cat: "date", pid: "P1619", kind: "opening", type: "time" },
  { cat: "date", pid: "P606", kind: "first flight", type: "time" },
  { cat: "date", pid: "P619", kind: "launch", type: "time" },
];

/** Build a SPARQL query for one property. Humans and taxa are excluded. */
export function buildQuery(prop, { minLinks = 50, limit = 400 } = {}) {
  const value =
    prop.type === "time"
      ? `?item p:${prop.pid}/psv:${prop.pid} ?node .
  ?node wikibase:timeValue ?v ; wikibase:timePrecision ?prec .
  FILTER(?prec >= 9)`
      : `?item p:${prop.pid}/psn:${prop.pid}/wikibase:quantityAmount ?v .`;
  return `SELECT ?item ?itemLabel ?links ?v WHERE {
  ?item wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  ${value}
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q16521 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?links)
LIMIT ${limit}`;
}

/** Round to 4 significant figures to avoid unit-conversion noise like 61.660000001. */
export function tidy(n) {
  if (!Number.isFinite(n) || n === 0) return n;
  return Number(n.toPrecision(4));
}

/**
 * Wikidata/XSD years: positive years are normal. For negative years the RDF export is
 * ambiguous about the missing year zero, so we convert as "astronomical" and flag it for review.
 */
export function yearFromIso(iso) {
  const m = /^(-?)(\d+)-/.exec(iso || "");
  if (!m) return null;
  const n = parseInt(m[2], 10);
  if (!m[1]) return n === 0 ? null : { year: n, review: null };
  return { year: -(n + 1), review: "BC date: check the year offset against the source" };
}

/** Turn a SPARQL JSON response into simple rows. */
export function parseBindings(json, prop) {
  const rows = [];
  for (const b of json?.results?.bindings || []) {
    const qid = /\/entity\/(Q\d+)$/.exec(b.item?.value || "")?.[1];
    const label = b.itemLabel?.value;
    if (!qid || !label || /^Q\d+$/.test(label)) continue; // no English label
    const links = Number(b.links?.value || 0);
    let value;
    let review = null;
    if (prop.type === "time") {
      const y = yearFromIso(b.v?.value);
      if (!y) continue;
      value = y.year;
      review = y.review;
    } else {
      const raw = Number(b.v?.value);
      if (!Number.isFinite(raw) || raw <= 0) continue;
      value = tidy(raw * prop.factor);
    }
    rows.push({ qid, label, links, cat: prop.cat, pid: prop.pid, kind: prop.kind, value, review });
  }
  return rows;
}

const UNITS = { length: "m", weight: "kg", speed: "km/h", date: "year", count: "" };

function suggestPhrase(row) {
  const L = row.label;
  switch (row.cat) {
    case "date":
      return row.kind === "first flight" ? `the first flight of ${L}` : row.kind === "launch" ? `the launch of ${L}` : row.kind === "opening" ? `the opening of ${L}` : `the creation of ${L}`;
    case "weight":
      return `the weight of ${L}`;
    case "speed":
      return `the top speed of ${L}`;
    case "count":
      return `the capacity of ${L}`;
    default:
      return `the ${row.kind} of ${L}`;
  }
}

/**
 * Merge rows from several properties into entities. Keeps those with at least `minCategories`
 * categories. When several properties map to one category (height and length) the first is
 * the suggestion and the others are kept as alternatives for the reviewer.
 */
export function mergeRows(rows, { minCategories = 2 } = {}) {
  const byQid = new Map();
  for (const r of rows) {
    const e = byQid.get(r.qid) || { qid: r.qid, label: r.label, links: r.links, options: {} };
    (e.options[r.cat] ||= []);
    if (!e.options[r.cat].some((o) => o.pid === r.pid)) e.options[r.cat].push(r);
    byQid.set(r.qid, e);
  }
  const out = [];
  for (const e of byQid.values()) {
    const cats = Object.keys(e.options);
    if (cats.length < minCategories) continue;
    const facts = {};
    for (const cat of cats) {
      const [first, ...rest] = e.options[cat];
      facts[cat] = {
        suggestedPhrase: suggestPhrase(first),
        suggestedLabel: first.label.slice(0, 40),
        value: first.value,
        unit: UNITS[cat],
        kind: first.kind,
        source: `https://www.wikidata.org/wiki/${e.qid}`,
        status: "candidate",
        ...(first.review ? { needsReview: first.review } : {}),
        ...(rest.length ? { alternatives: rest.map((o) => ({ kind: o.kind, value: o.value })) } : {}),
      };
    }
    out.push({ qid: e.qid, label: e.label, links: e.links, categories: cats.length, facts });
  }
  return out.sort((a, b) => b.categories - a.categories || b.links - a.links);
}
