// The harvester also collects dates of EVENTS and famous people, not only when a thing was made.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROPERTIES, PERSON_MIN_LINKS, PROPERTIES, buildQuery, mergeRows, parseBindings, selectProperties } from "../scripts/lib/wikidata.mjs";

const prop = (pid) => PROPERTIES.find((p) => p.pid === pid);
const bind = (qid, label, links, v) => ({ item: { value: `http://www.wikidata.org/entity/${qid}` }, itemLabel: { value: label }, links: { value: String(links) }, v: { value: String(v) } });
const rowsOf = (pid, ...b) => parseBindings({ results: { bindings: b } }, prop(pid));

test("dates of events, discoveries, publications and famous people are collected, as well as dates of things being made", () => {
  const dates = PROPERTIES.filter((p) => p.cat === "date").map((p) => `${p.pid}:${p.kind}`);
  for (const want of ["P571:creation", "P1619:opening", "P606:first flight", "P619:launch", "P585:event", "P580:start", "P582:end", "P575:discovery", "P577:publication", "P569:birth", "P570:death"]) assert.ok(dates.includes(want), `${want} is missing`);
  for (const p of PROPERTIES.filter((x) => x.cat === "date")) assert.equal(p.type, "time", p.pid);
});

test("only the birth and death queries ask for humans, and they ask for the very famous; every other query still excludes humans", () => {
  for (const p of PROPERTIES) {
    const q = buildQuery(p, { minLinks: 50, limit: 400 });
    if (p.subject === "person") {
      assert.match(q, /\?item wdt:P31 wd:Q5 \./, `${p.pid} must ask for humans`);
      assert.doesNotMatch(q, /FILTER NOT EXISTS \{ \?item wdt:P31 wd:Q5 \}/, `${p.pid} must not exclude humans`);
      assert.match(q, new RegExp(`FILTER\\(\\?links >= ${PERSON_MIN_LINKS}\\)`), `${p.pid} needs the higher fame bar`);
    } else {
      assert.match(q, /FILTER NOT EXISTS \{ \?item wdt:P31 wd:Q5 \}/, `${p.pid} must exclude humans`);
      assert.match(q, /FILTER NOT EXISTS \{ \?item wdt:P31 wd:Q16521 \}/, `${p.pid} must exclude taxa`);
      assert.match(q, /FILTER\(\?links >= 50\)/, `${p.pid} keeps the normal fame bar`);
    }
  }
  assert.deepEqual(PROPERTIES.filter((p) => p.subject === "person").map((p) => p.pid).sort(), ["P569", "P570"]);
  assert.match(buildQuery(prop("P570"), { minLinks: 500 }), /FILTER\(\?links >= 500\)/, "a higher bar asked for on the command line still wins");
});

test("every new date query requires year precision and puts the date first, like the others", () => {
  for (const pid of ["P585", "P580", "P582", "P575", "P577", "P569", "P570"]) {
    const q = buildQuery(prop(pid), {});
    assert.ok(q.indexOf(`p:${pid}/psv:${pid}`) < q.indexOf("wikibase:sitelinks"), `${pid}: the date comes before the fame check`);
    assert.match(q, /FILTER\(\?prec >= 9\)/, `${pid}: no dates less exact than a year`);
  }
});

test("a date is all an event or a famous person has, so it is kept; a lone height still is not", () => {
  const rows = [...rowsOf("P585", bind("Q1", "Battle of Marathon", 120, "-0490-09-12T00:00:00Z")), ...rowsOf("P570", bind("Q2", "Augustus", 200, "0014-08-19T00:00:00Z")), ...rowsOf("P2048", bind("Q3", "Some tower", 90, 120))];
  const out = mergeRows(rows, { minCategories: 2 });
  assert.deepEqual(out.map((e) => e.qid).sort(), ["Q1", "Q2"]);
  assert.equal(out.find((e) => e.qid === "Q2").facts.date.value, 14);
});

test("when Wikidata lists more than one date for the same thing, the reviewer is told", () => {
  const rows = [...rowsOf("P585", bind("Q1", "A disputed event", 100, "0476-01-01T00:00:00Z"), bind("Q1", "A disputed event", 100, "0480-01-01T00:00:00Z"), bind("Q2", "A settled event", 100, "1066-10-14T00:00:00Z"), bind("Q2", "A settled event", 100, "1066-10-14T00:00:00Z"))];
  const out = Object.fromEntries(mergeRows(rows).map((e) => [e.qid, e.facts.date]));
  assert.match(out.Q1.needsReview, /more than one value \(476, 480\)/);
  assert.equal(out.Q1.value, 476, "the first is still the suggestion");
  assert.equal(out.Q2.needsReview, undefined, "the same date twice is not a conflict");
});

test("a BC date and a disputed date are both reported, and the new rows say they are standalone", () => {
  const rows = rowsOf("P585", bind("Q1", "Old event", 100, "-0480-01-01T00:00:00Z"), bind("Q1", "Old event", 100, "-0479-01-01T00:00:00Z"));
  assert.ok(rows.every((r) => r.standalone === true));
  const fact = mergeRows(rows)[0].facts.date;
  assert.match(fact.needsReview, /BC date/);
  assert.match(fact.needsReview, /more than one value/);
  assert.equal(rowsOf("P2048", bind("Q9", "Tower", 90, 100))[0].standalone, false);
});

test("the suggested phrase says what kind of date it is", () => {
  const phrase = (pid, label) => mergeRows(rowsOf(pid, bind("Q1", label, 100, "1900-01-01T00:00:00Z")), { minCategories: 1 })[0].facts.date.suggestedPhrase;
  assert.equal(phrase("P585", "the Great Fire"), "the date of the Great Fire");
  assert.equal(phrase("P580", "World War I"), "the start of World War I");
  assert.equal(phrase("P582", "World War I"), "the end of World War I");
  assert.equal(phrase("P575", "penicillin"), "the discovery of penicillin");
  assert.equal(phrase("P577", "Star Wars"), "the publication of Star Wars");
  assert.equal(phrase("P569", "Mozart"), "the birth of Mozart");
  assert.equal(phrase("P570", "Mozart"), "the death of Mozart");
  assert.equal(phrase("P619", "Apollo 11"), "the launch of Apollo 11", "older kinds are unchanged");
});

test("start, end and discovery dates are off unless asked for (the first live run showed them to be mostly noise); the useful kinds stay on", () => {
  const off = PROPERTIES.filter((p) => p.off).map((p) => p.pid).sort();
  assert.deepEqual(off, ["P575", "P580", "P582"]);
  assert.equal(DEFAULT_PROPERTIES.length, PROPERTIES.length - 3);
  for (const pid of ["P585", "P577", "P569", "P570", "P2067", "P2048", "P2043", "P2052", "P1083", "P1619", "P606", "P619", "P571"]) assert.ok(DEFAULT_PROPERTIES.some((p) => p.pid === pid), `${pid} should be on by default`);
});

test("selectProperties: nothing named gives the usual set; names are trimmed, any case, and in the file's order; a typo is an error that lists the valid ids", () => {
  assert.deepEqual(selectProperties(""), DEFAULT_PROPERTIES);
  assert.deepEqual(selectProperties(undefined), DEFAULT_PROPERTIES);
  assert.deepEqual(selectProperties(" p2067 , P2048 ").map((p) => p.pid), ["P2048", "P2067"]);
  assert.deepEqual(selectProperties("P575").map((p) => p.pid), ["P575"], "an off kind can be asked for");
  assert.throws(() => selectProperties("P2067,P99999"), /Unknown property id: P99999.*P2067/);
  assert.throws(() => selectProperties("P1,P2"), /Unknown property ids: P1, P2/);
});
