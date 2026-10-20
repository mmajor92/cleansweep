// Harvest candidate facts from Wikidata. Needs network access, so run it on your own machine (or with the
// "Harvest candidate facts" button under Actions on GitHub).
//
//   HARVEST_CONTACT="you@example.com" node scripts/harvest.mjs   write data/harvest.json
//   node scripts/harvest.mjs --dry-run       print the queries and exit
//   node scripts/harvest.mjs --min-links 80 --limit 300 --min-categories 3
//   node scripts/harvest.mjs --only P2067,P2048   ask for only these kinds (property ids), including ones that are off by default
//
// Output is a list of CANDIDATES. Nothing is added to facts.json automatically.
// Review each one, check it against a second source, then copy it into data/facts.json
// with status "verified", a source URL and a checkedOn date. See docs/adding-facts.md.
//
// If Wikidata is too busy for one kind of fact, that kind is skipped (the others carry on) and the output says which.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildQuery, mergeRows, selectProperties } from "./lib/wikidata.mjs";
import { harvestAll } from "./lib/harvest-run.mjs";

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
let selected;
try {
  selected = selectProperties(arg("--only", ""));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
// Wikidata asks scripts to say who is calling. Set HARVEST_CONTACT to an email address or a URL.
// It is read from the environment, so nothing personal is ever committed to the repository.
const CONTACT = process.env.HARVEST_CONTACT;
const USER_AGENT = `CleanSweepGame/0.1 (fact candidate harvester; contact: ${CONTACT})`;

if (args.includes("--dry-run")) {
  for (const p of selected) {
    console.log(`# ${p.cat} / ${p.pid} (${p.kind}) - full query\n${buildQuery(p, { minLinks, limit })}\n`);
    console.log(`# ${p.cat} / ${p.pid} (${p.kind}) - lighter query, used if the full one times out\n${buildQuery(p, { minLinks, limit, sample: true })}\n`);
  }
  process.exit(0);
}

if (!CONTACT) {
  console.error('Set HARVEST_CONTACT first, for example:  HARVEST_CONTACT="you@example.com" npm run harvest');
  console.error("Wikidata asks scripts to identify themselves, and may block anonymous ones.");
  process.exit(1);
}

const { rows, skipped, queries } = await harvestAll({ properties: selected, minLinks, limit, userAgent: USER_AGENT, log: (line) => console.log(line) });

if (rows.length === 0) {
  console.error("\nNothing came back from Wikidata for any kind of fact, so there is nothing to save. Try again later.");
  process.exit(1);
}

const entities = mergeRows(rows, { minCategories });
const result = {
  generatedOn: new Date().toISOString().slice(0, 10),
  note: "CANDIDATES from Wikidata. Not verified. Never used by the game until moved into facts.json.",
  params: { minLinks, limit, minCategories },
  count: entities.length,
  queries,
  skipped,
  entities,
};
await writeFile(out, JSON.stringify(result, null, 2) + "\n");
const hinges3 = entities.filter((e) => e.categories >= 3).length;
console.log(`\nWrote ${entities.length} candidate objects (${hinges3} with 3 or more categories) to ${out}`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length} of ${selected.length} kinds of fact because Wikidata was too slow or refused:`);
  for (const s of skipped) console.log(`  ${s.cat} (${s.pid}, ${s.kind}): ${s.reason}`);
  console.log("Run it again later to fill the gaps.");
}
console.log("Next: review the top entries, verify each fact with a second source, then add to data/facts.json.");
