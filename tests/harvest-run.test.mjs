// The harvester copes with Wikidata being slow: it never repeats a query that timed out, tries a lighter one instead,
// skips what still fails, and carries on. All tested with pretend Wikidata answers, so no network is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROPERTIES, buildQuery } from "../scripts/lib/wikidata.mjs";
import { harvestAll, runQuery } from "../scripts/lib/harvest-run.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const prop = (pid) => PROPERTIES.find((p) => p.pid === pid);

const binding = (qid, label, links, v) => ({ item: { value: `http://www.wikidata.org/entity/${qid}` }, itemLabel: { value: label }, links: { value: String(links) }, v: { value: String(v) } });
const ok = (...b) => ({ ok: true, status: 200, json: async () => ({ results: { bindings: b } }), text: async () => "", headers: { get: () => null } });
const fail = (status, text = "", retryAfter = null) => ({ ok: false, status, json: async () => ({}), text: async () => text, headers: { get: (h) => (h === "retry-after" ? retryAfter : null) } });

/** A pretend fetch. `handler(pid, isLight, callNumber)` returns the response. Every call is recorded. */
function pretend(handler) {
  const calls = [];
  const fetchImpl = async (url) => {
    const q = new URL(url).searchParams.get("query");
    const pid = /P\d+/.exec(q)[0];
    const light = !/ORDER BY/.test(q);
    calls.push({ pid, light, q });
    const out = handler(pid, light, calls.length);
    if (out instanceof Error) throw out;
    return out;
  };
  return { fetchImpl, calls };
}
const run = (handler, props = PROPERTIES, extra = {}) => {
  const f = pretend(handler);
  const sleeps = [];
  const logs = [];
  return harvestAll({ properties: props, minLinks: 50, limit: 2, fetchImpl: f.fetchImpl, sleep: async (ms) => sleeps.push(ms), log: (l) => logs.push(l), userAgent: "test-agent", ...extra }).then((r) => ({ ...r, calls: f.calls, sleeps, logs }));
};

test("the property comes first and the optimizer keeps our order; the full query is sorted, the light one is not", () => {
  const full = buildQuery(prop("P2048"), { minLinks: 50, limit: 400 });
  const light = buildQuery(prop("P2048"), { minLinks: 50, limit: 400, sample: true });
  for (const q of [full, light]) {
    assert.ok(q.indexOf("psn:P2048") < q.indexOf("wikibase:sitelinks"), "the height pattern comes before the fame check");
    assert.ok(q.indexOf('hint:optimizer "None"') < q.indexOf("psn:P2048"));
    assert.match(q, /FILTER NOT EXISTS \{ \?item wdt:P31 wd:Q5 \}/);
    assert.match(q, /FILTER NOT EXISTS \{ \?item wdt:P31 wd:Q16521 \}/);
    assert.ok(q.indexOf("FILTER(?links >= 50)") < q.indexOf("FILTER NOT EXISTS"), "the cheap fame check comes before the exclusions");
  }
  assert.match(full, /ORDER BY DESC\(\?links\)\nLIMIT 400$/);
  assert.ok(!/ORDER BY/.test(light), "no sorting, so Wikidata can stop early");
  assert.match(light, /LIMIT 1200$/, "it asks for three times as many, to sort them ourselves");
});

test("date queries check precision before fame", () => {
  const q = buildQuery(prop("P571"));
  assert.ok(q.indexOf("FILTER(?prec >= 9)") < q.indexOf("wikibase:sitelinks"));
});

test("a timeout goes straight to the lighter query and never repeats the same query", async () => {
  const r = await run((pid, light) => (pid === "P2048" ? (light ? ok(binding("Q1", "Tower", 90, 300)) : fail(504)) : ok()), [prop("P2048")]);
  assert.deepEqual(r.calls.map((c) => c.light), [false, true], "full once, then light once: no repeats");
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.skipped, []);
  assert.equal(r.queries[0].via, "light");
});

test("an error that mentions a timeout in its text counts as a timeout too", async () => {
  const r = await run((pid, light) => (light ? ok(binding("Q1", "Tower", 90, 300)) : fail(500, "java.util.concurrent.TimeoutException")), [prop("P2048")]);
  assert.deepEqual(r.calls.map((c) => c.light), [false, true]);
});

test("the lighter query's sample is sorted by fame and trimmed to the limit", async () => {
  const r2 = await run((pid, light) => (light ? ok(binding("Q1", "A", 10, 1), binding("Q2", "B", 90, 2), binding("Q3", "C", 50, 3), binding("Q4", "D", 70, 4)) : fail(504)), [prop("P2048")]);
  assert.deepEqual(r2.rows.map((x) => x.qid), ["Q2", "Q4"], "the two most famous of the four, as the limit is 2");
});

test("a kind of fact that fails both ways is skipped, and the rest carry on", async () => {
  const value = (pid) => (prop(pid).type === "time" ? "1969-01-01T00:00:00Z" : 5); // dates arrive as dates, the rest as numbers
  const r = await run((pid) => (pid === "P2067" ? fail(504) : ok(binding("Q" + pid.slice(1), "Thing " + pid, 80, value(pid)))));
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].pid, "P2067");
  assert.equal(r.skipped[0].cat, "weight");
  assert.match(r.skipped[0].reason, /full query: HTTP 504/);
  assert.match(r.skipped[0].reason, /lighter query: HTTP 504/);
  assert.equal(r.rows.length, PROPERTIES.length - 1, "every other property still delivered its row");
  assert.equal(r.queries.find((q) => q.pid === "P2067").via, null);
  assert.equal(r.queries.filter((q) => q.via === "full").length, PROPERTIES.length - 1);
});

test("if everything fails there are no rows, which the script treats as a failed run", async () => {
  const r = await run(() => fail(504));
  assert.equal(r.rows.length, 0);
  assert.equal(r.skipped.length, PROPERTIES.length);
});

test("being rate limited waits as long as Wikidata says, then repeats the same query", async () => {
  let n = 0;
  const r = await run(() => (n++ === 0 ? fail(429, "", "3") : ok(binding("Q1", "Tower", 90, 300))), [prop("P2048")]);
  assert.ok(r.sleeps.includes(3000), "waited 3 seconds");
  assert.deepEqual(r.calls.map((c) => c.light), [false, false], "the same full query, twice");
  assert.equal(r.rows.length, 1);
});

test("a bad query is not retried, and the reason Wikidata gives is kept", async () => {
  const r = await run(() => fail(400, "MalformedQueryException: Encountered   something odd"), [prop("P2048")]);
  assert.equal(r.calls.length, 1, "no lighter query: it would be refused for the same reason");
  assert.match(r.skipped[0].reason, /did not accept the query: MalformedQueryException: Encountered something odd/);
});

test("a network blip gets one more try after 5 seconds", async () => {
  let n = 0;
  const r = await run(() => (n++ === 0 ? new TypeError("fetch failed") : ok(binding("Q1", "Tower", 90, 300))), [prop("P2048")]);
  assert.ok(r.sleeps.includes(5000));
  assert.equal(r.rows.length, 1);
});

test("running out of time counts as a timeout", async () => {
  const slow = (url, opts) => new Promise((_, reject) => opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const res = await runQuery("SELECT 1", { fetchImpl: slow, sleep: async () => {}, userAgent: "t", timeoutMs: 20 });
  assert.equal(res.ok, false);
  assert.equal(res.kind, "timeout");
});

test("it says who is calling, and sends the contact in the user agent", async () => {
  const seen = [];
  const res = await runQuery("SELECT 1", { fetchImpl: async (url, opts) => (seen.push(opts.headers["User-Agent"]), ok()), sleep: async () => {}, userAgent: "CleanSweepGame/0.1 (contact: https://github.com/x/y)" });
  assert.equal(res.ok, true);
  assert.match(seen[0], /contact: https:\/\/github\.com\/x\/y/);
});

test("the command line still works offline: --dry-run shows both queries for every kind of fact", () => {
  const out = execFileSync("node", ["scripts/harvest.mjs", "--dry-run"], { cwd: root, env: { ...process.env, HARVEST_CONTACT: "test" }, encoding: "utf8" });
  assert.equal((out.match(/full query/g) || []).length, PROPERTIES.length);
  assert.equal((out.match(/lighter query/g) || []).length, PROPERTIES.length);
});
