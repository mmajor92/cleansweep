// Harvest candidate facts from Wikidata. Needs network access, so run it on your own machine.
//
//   HARVEST_CONTACT="you@example.com" node scripts/harvest.mjs   write data/harvest.json
//   node scripts/harvest.mjs --dry-run       print the queries and exit
//   node scripts/harvest.mjs --min-links 80 --limit 300 --min-categories 3
//
// Output is a list of CANDIDATES. Nothing is added to facts.json automatically.
// Review each one, check it against a second source, then copy it into data/facts.json
// with status "verified", a source URL and a checkedOn date. See docs/adding-facts.md.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROPERTIES, buildQuery, mergeRows, parseBindings } from "./lib/wikidata.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const minLinks = Number(arg("--min-links", 50));
const limit = Number(arg("--limit", 400));
const minCategories = Number(arg("--min-categories", 2));
const out = arg("--out", join(root, "data", "harvest.json"));
const ENDPOINT = "https://query.wikidata.org/sparql";
// Wikidata asks scripts to say who is calling. Set HARVEST_CONTACT to an email address or a URL.
// It is read from the environment, so nothing personal is ever committed to the repository.
const CONTACT = process.env.HARVEST_CONTACT;
const USER_AGENT = `CleanSweepGame/0.1 (fact candidate harvester; contact: ${CONTACT})`;

if (args.includes("--dry-run")) {
  for (const p of PROPERTIES) console.log(`# ${p.cat} / ${p.pid} (${p.kind})\n${buildQuery(p, { minLinks, limit })}\n`);
  process.exit(0);
}

if (!CONTACT) {
  console.error('Set HARVEST_CONTACT first, for example:  HARVEST_CONTACT="you@example.com" npm run harvest');
  console.error("Wikidata asks scripts to identify themselves, and may block anonymous ones.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(query, attempt = 1) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" } });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || attempt * 5000;
    console.log(`  HTTP ${res.status}, retrying in ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return run(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`Wikidata returned HTTP ${res.status}`);
  return res.json();
}

const rows = [];
for (const prop of PROPERTIES) {
  process.stdout.write(`Querying ${prop.cat} (${prop.pid}, ${prop.kind})... `);
  const json = await run(buildQuery(prop, { minLinks, limit }));
  const parsed = parseBindings(json, prop);
  rows.push(...parsed);
  console.log(`${parsed.length} rows`);
  await sleep(2000); // be polite to the public endpoint
}

const entities = mergeRows(rows, { minCategories });
const result = {
  generatedOn: new Date().toISOString().slice(0, 10),
  note: "CANDIDATES from Wikidata. Not verified. Never used by the game until moved into facts.json.",
  params: { minLinks, limit, minCategories },
  count: entities.length,
  entities,
};
await writeFile(out, JSON.stringify(result, null, 2) + "\n");
const hinges3 = entities.filter((e) => e.categories >= 3).length;
console.log(`Wrote ${entities.length} candidate objects (${hinges3} with 3 or more categories) to ${out}`);
console.log("Next: review the top entries, verify each fact with a second source, then add to data/facts.json.");
