import test from "node:test";
import assert from "node:assert/strict";
import { PROPERTIES, buildQuery, mergeRows, parseBindings, tidy, yearFromIso } from "../scripts/lib/wikidata.mjs";

const prop = (pid) => PROPERTIES.find((p) => p.pid === pid);
const binding = (qid, label, links, v) => ({
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  itemLabel: { value: label },
  links: { value: String(links) },
  v: { value: String(v) },
});

test("queries exclude humans and taxa and ask for famous items", () => {
  const q = buildQuery(prop("P2048"), { minLinks: 60, limit: 10 });
  assert.match(q, /FILTER\(\?links >= 60\)/);
  assert.match(q, /FILTER NOT EXISTS \{ \?item wdt:P31 wd:Q5 \}/);
  assert.match(q, /FILTER NOT EXISTS \{ \?item wdt:P31 wd:Q16521 \}/);
  assert.match(q, /LIMIT 10/);
  assert.match(q, /psn:P2048/);
});

test("date queries require year precision", () => {
  const q = buildQuery(prop("P571"));
  assert.match(q, /timePrecision \?prec/);
  assert.match(q, /FILTER\(\?prec >= 9\)/);
});

test("speed converts metres per second to km/h", () => {
  const rows = parseBindings({ results: { bindings: [binding("Q1", "Fast thing", 90, 100)] } }, prop("P2052"));
  assert.equal(rows[0].value, 360);
});

test("tidy removes conversion noise", () => {
  assert.equal(tidy(61.660000001), 61.66);
  assert.equal(tidy(0), 0);
});

test("years: positive pass through, BC is flagged for review", () => {
  assert.deepEqual(yearFromIso("1969-03-02T00:00:00Z"), { year: 1969, review: null });
  assert.equal(yearFromIso("-0043-03-15T00:00:00Z").year, -44);
  assert.match(yearFromIso("-0043-03-15T00:00:00Z").review, /BC/);
  assert.equal(yearFromIso("0000-01-01T00:00:00Z"), null);
  assert.equal(yearFromIso("nonsense"), null);
});

test("rows without an English label or a positive value are skipped", () => {
  const json = { results: { bindings: [
    binding("Q2", "Q2", 80, 5),        // label is just the id
    binding("Q3", "Good", 80, -4),     // negative
    binding("Q4", "Zero", 80, 0),      // zero
    binding("Q5", "Fine", 80, 12),
  ] } };
  const rows = parseBindings(json, prop("P2067"));
  assert.deepEqual(rows.map((r) => r.qid), ["Q5"]);
});

test("merge keeps only objects with enough categories and sorts richest first", () => {
  const rows = [
    ...parseBindings({ results: { bindings: [binding("Q10", "Big Ship", 100, 300), binding("Q11", "Lonely", 200, 5)] } }, prop("P2043")),
    ...parseBindings({ results: { bindings: [binding("Q10", "Big Ship", 100, 50000000)] } }, prop("P2067")),
    ...parseBindings({ results: { bindings: [binding("Q10", "Big Ship", 100, 15)] } }, prop("P2052")),
    ...parseBindings({ results: { bindings: [binding("Q12", "Pair", 90, 2000)] } }, prop("P1083")),
    ...parseBindings({ results: { bindings: [binding("Q12", "Pair", 90, "1950-01-01T00:00:00Z")] } }, prop("P571")),
  ];
  const out = mergeRows(rows, { minCategories: 2 });
  assert.deepEqual(out.map((e) => e.qid), ["Q10", "Q12"]);
  assert.equal(out[0].categories, 3);
  assert.equal(out[0].facts.speed.value, 54);
  assert.equal(out[0].facts.length.suggestedPhrase, "the length of Big Ship");
  assert.equal(out[0].facts.length.status, "candidate");
  assert.match(out[0].facts.weight.source, /wikidata\.org\/wiki\/Q10$/);
});

test("height and length for one object keep an alternative", () => {
  const rows = [
    ...parseBindings({ results: { bindings: [binding("Q20", "Tower", 70, 100)] } }, prop("P2048")),
    ...parseBindings({ results: { bindings: [binding("Q20", "Tower", 70, 120)] } }, prop("P2043")),
    ...parseBindings({ results: { bindings: [binding("Q20", "Tower", 70, 9000)] } }, prop("P2067")),
  ];
  const [e] = mergeRows(rows);
  assert.equal(e.facts.length.value, 100);
  assert.deepEqual(e.facts.length.alternatives, [{ kind: "length", value: 120 }]);
});
