// Pure helpers for harvesting candidate facts from Wikidata. No network here, so it can be unit tested.

/** Properties we read. `kind` is a plain-English word used to suggest a phrase. */
export const PROPERTIES = [
  { cat: "length", pid: "P2048", kind: "height", type: "quantity", factor: 1 },
  { cat: "length", pid: "P2043", kind: "length", type: "quantity", factor: 1 },
  { cat: "weight", pid: "P2067", kind: "mass", type: "quantity", factor: 1 },
  { cat: "speed", pid: "P2052", kind: "top speed", type: "quantity", factor: 3.6 }, // m/s to km/h
  // Capacity is a plain count, often with no unit, and Wikidata only stores the "normalised" value for quantities with a
  // unit it can convert. The first live run returned 0 rows with the normalised value, so `raw` asks for the value as entered.
  { cat: "count", pid: "P1083", kind: "capacity", type: "quantity", factor: 1, raw: true },
  { cat: "date", pid: "P571", kind: "creation", type: "time" },
  { cat: "date", pid: "P1619", kind: "opening", type: "time" },
  { cat: "date", pid: "P606", kind: "first flight", type: "time" },
  { cat: "date", pid: "P619", kind: "launch", type: "time" },
  // Dates of EVENTS and famous people. These items have a date and nothing else, so they are `standalone`: they are kept even
  // though they are in only one category (the others need two, so that they can bridge).
  { cat: "date", pid: "P585", kind: "event", type: "time", standalone: true }, // a battle, an eruption, a disaster, a treaty
  { cat: "date", pid: "P580", kind: "start", type: "time", standalone: true }, // the start of a war, a reign, a project
  { cat: "date", pid: "P582", kind: "end", type: "time", standalone: true },
  { cat: "date", pid: "P575", kind: "discovery", type: "time", standalone: true }, // a discovery or an invention
  { cat: "date", pid: "P577", kind: "publication", type: "time", standalone: true }, // a book, a film, an album
  // Humans are excluded from every other query. These two ask for humans ONLY, and set the fame bar higher so that only the most famous come back.
  { cat: "date", pid: "P569", kind: "birth", type: "time", subject: "person", standalone: true },
  { cat: "date", pid: "P570", kind: "death", type: "time", subject: "person", standalone: true },
];

/** People need many more language editions than objects before we ask about them: this keeps the list to the very famous. */
export const PERSON_MIN_LINKS = 120;

/**
 * Build a SPARQL query for one property. Humans and taxa are excluded.
 *
 * The property pattern comes FIRST and the optimizer is told to keep the order we wrote. Starting from "everything that
 * has a height" and then checking how famous it is is far cheaper than starting from "everything famous" and then
 * checking for a height, which made Wikidata give up (HTTP 504).
 *
 * `sample: true` is the lighter version used when the full one times out. It has no ORDER BY, so Wikidata can stop as soon
 * as it has enough rows. It asks for three times as many, and the caller sorts them by fame and keeps the best.
 */
export function buildQuery(prop, { minLinks = 50, limit = 400, sample = false } = {}) {
  const person = prop.subject === "person";
  const fame = person ? Math.max(minLinks, PERSON_MIN_LINKS) : minLinks;
  const value =
    prop.type === "time"
      ? `?item p:${prop.pid}/psv:${prop.pid} ?node .
  ?node wikibase:timeValue ?v ; wikibase:timePrecision ?prec .
  FILTER(?prec >= 9)`
      : `?item p:${prop.pid}/${prop.raw ? "psv" : "psn"}:${prop.pid}/wikibase:quantityAmount ?v .`;
  return `SELECT ?item ?itemLabel ?links ?v WHERE {
  hint:Query hint:optimizer "None" .
  ${value}
  ?item wikibase:sitelinks ?links .
  FILTER(?links >= ${fame})
  ${person ? "?item wdt:P31 wd:Q5 ." : "FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }\n  FILTER NOT EXISTS { ?item wdt:P31 wd:Q16521 }"}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}${sample ? "" : "\nORDER BY DESC(?links)"}
LIMIT ${sample ? limit * 3 : limit}`;
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
    rows.push({ qid, label, links, cat: prop.cat, pid: prop.pid, kind: prop.kind, value, review, standalone: !!prop.standalone });
  }
  return rows;
}

const UNITS = { length: "m", weight: "kg", speed: "km/h", date: "year", count: "" };

function suggestPhrase(row) {
  const L = row.label;
  switch (row.cat) {
    case "date": {
      const words = { "first flight": "the first flight of", launch: "the launch of", opening: "the opening of", event: "the date of", start: "the start of", end: "the end of", discovery: "the discovery of", publication: "the publication of", birth: "the birth of", death: "the death of" };
      return `${words[row.kind] || "the creation of"} ${L}`;
    }
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
    const same = e.options[r.cat].find((o) => o.pid === r.pid);
    if (!same) e.options[r.cat].push({ ...r });
    else if (same.value !== r.value) (same.others ||= new Set()).add(r.value); // Wikidata lists more than one value: a reviewer must choose
    byQid.set(r.qid, e);
  }
  const out = [];
  for (const e of byQid.values()) {
    const cats = Object.keys(e.options);
    const standalone = cats.some((c) => e.options[c].some((o) => o.standalone)); // an event or a famous person: a date is all it has
    if (cats.length < minCategories && !standalone) continue;
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
        ...(first.review || first.others ? { needsReview: [first.review, first.others && `Wikidata lists more than one value (${[first.value, ...first.others].join(", ")}): check which is right`].filter(Boolean).join("; ") } : {}),
        ...(rest.length ? { alternatives: rest.map((o) => ({ kind: o.kind, value: o.value })) } : {}),
      };
    }
    out.push({ qid: e.qid, label: e.label, links: e.links, categories: cats.length, facts });
  }
  return out.sort((a, b) => b.categories - a.categories || b.links - a.links);
}
