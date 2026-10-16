// Ask Wikidata for each kind of fact, coping with timeouts. No network of its own: `fetchImpl` and `sleep` are passed in,
// so it can be tested with pretend answers.
import { buildQuery, parseBindings } from "./wikidata.mjs";

export const ENDPOINT = "https://query.wikidata.org/sparql";

const snippet = (text) => String(text || "").replace(/\s+/g, " ").trim().slice(0, 300);

/**
 * Run one query. Returns { ok: true, json } or { ok: false, kind, detail }.
 * - A timeout (HTTP 504, or an error mentioning a timeout, or no answer in time) is NOT retried: the same query would
 *   time out again. The caller tries the lighter query instead.
 * - Rate limiting (429) waits as long as Wikidata says, then tries the same query again, up to twice.
 * - Other server errors and network problems get one more try after 5 seconds.
 * - A bad query (HTTP 400) is not retried, and the reason Wikidata gives is kept so we can fix the query.
 */
export async function runQuery(query, { fetchImpl, sleep, userAgent, endpoint = ENDPOINT, timeoutMs = 70000, log = () => {} }) {
  let rateTries = 0;
  let serverTries = 0;
  for (;;) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${endpoint}?format=json&query=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": userAgent, Accept: "application/sparql-results+json" },
        signal: ctl.signal,
      });
      if (res.ok) return { ok: true, json: await res.json() };
      const status = res.status;
      const body = snippet(await res.text().catch(() => ""));
      if (status === 504 || status === 408 || /timeout|timed out/i.test(body)) {
        return { ok: false, kind: "timeout", detail: `HTTP ${status}: Wikidata gave up because the query was too slow` };
      }
      if (status === 429) {
        if (rateTries++ < 2) {
          const asked = Number(res.headers?.get?.("retry-after"));
          const wait = Math.min((asked > 0 ? asked : 10) * 1000, 60000);
          log(`  HTTP 429 (asked to slow down), waiting ${Math.round(wait / 1000)}s`);
          await sleep(wait);
          continue;
        }
        return { ok: false, kind: "rate-limited", detail: "HTTP 429: Wikidata kept asking us to slow down" };
      }
      if (status === 400) return { ok: false, kind: "bad", detail: `HTTP 400: Wikidata did not accept the query: ${body}` };
      if (status >= 500 && serverTries++ < 1) {
        log(`  HTTP ${status}, trying once more in 5s`);
        await sleep(5000);
        continue;
      }
      return { ok: false, kind: "error", detail: `HTTP ${status}: ${body}` };
    } catch (e) {
      if (e && e.name === "AbortError") {
        return { ok: false, kind: "timeout", detail: `no answer within ${Math.round(timeoutMs / 1000)} seconds` };
      }
      if (serverTries++ < 1) {
        log(`  network problem (${e && e.message}), trying once more in 5s`);
        await sleep(5000);
        continue;
      }
      return { ok: false, kind: "network", detail: `network problem: ${e && e.message}` };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Harvest every property. For each one: the full query first; if that fails, the lighter query (a sample, sorted by fame
 * here); if that fails too, the property is SKIPPED and the others carry on.
 * Returns { rows, skipped, queries } where `queries` says what happened to each property.
 */
export async function harvestAll({
  properties,
  minLinks,
  limit,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = () => {},
  userAgent,
  endpoint = ENDPOINT,
  timeoutMs = 70000,
  pauseMs = 2000,
}) {
  const rows = [];
  const skipped = [];
  const queries = [];
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    const name = `${prop.cat} (${prop.pid}, ${prop.kind})`;
    const failures = [];
    let via = null;
    for (const variant of ["full", "light"]) {
      log(`${name}: asking Wikidata (${variant === "full" ? "full query" : "lighter query"})...`);
      const result = await runQuery(buildQuery(prop, { minLinks, limit, sample: variant === "light" }), { fetchImpl, sleep, userAgent, endpoint, timeoutMs, log });
      if (result.ok) {
        let parsed = parseBindings(result.json, prop);
        if (variant === "light") parsed = parsed.sort((a, b) => b.links - a.links).slice(0, limit);
        rows.push(...parsed);
        queries.push({ cat: prop.cat, pid: prop.pid, kind: prop.kind, via: variant, rows: parsed.length });
        log(`  ${parsed.length} rows`);
        via = variant;
        break;
      }
      failures.push(`${variant === "full" ? "full" : "lighter"} query: ${result.detail}`);
      log(`  ${result.detail}`);
      if (result.kind === "bad") break; // the lighter query would be refused for the same reason
    }
    if (!via) {
      skipped.push({ cat: prop.cat, pid: prop.pid, kind: prop.kind, reason: failures.join(" | ") });
      queries.push({ cat: prop.cat, pid: prop.pid, kind: prop.kind, via: null, rows: 0 });
      log("  skipped, carrying on with the rest");
    }
    if (i < properties.length - 1) await sleep(pauseMs); // be polite to the public endpoint
  }
  return { rows, skipped, queries };
}
