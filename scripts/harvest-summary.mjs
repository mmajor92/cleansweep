// Turn a harvest.json file into a short Markdown summary for the GitHub run page.
//   node scripts/harvest-summary.mjs path/to/harvest.json
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CATS = ["length", "weight", "date", "count", "speed"];
const plain = (s) => String(s).toLowerCase().replace(/^(the|a|an) /, "").trim();

/** Pairs of categories, so we can see which thin pairs a harvest could feed. */
export function pairCounts(entities) {
  const counts = {};
  for (const e of entities) {
    const cats = CATS.filter((c) => e.facts && e.facts[c]);
    for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) counts[`${cats[i]} + ${cats[j]}`] = (counts[`${cats[i]} + ${cats[j]}`] || 0) + 1;
  }
  return counts;
}

/** Build the Markdown. `gameNames` is the list of object names already in the game (to flag repeats). */
export function summarise(result, gameNames = [], top = 25) {
  const inGame = new Set(gameNames.map(plain));
  const entities = result.entities || [];
  const fresh = entities.filter((e) => !inGame.has(plain(e.label)));
  const lines = [];
  lines.push("## Harvest candidates", "");
  lines.push(`Asked Wikidata on ${result.generatedOn}. Settings: at least ${result.params.minLinks} Wikimedia pages, up to ${result.params.limit} rows per kind of fact, at least ${result.params.minCategories} categories.`, "");
  lines.push(`**${entities.length} candidate objects**, of which **${entities.length - fresh.length} look like they are already in the game** (matched by name, so a few repeats may be missed).`, "");
  lines.push("These are candidates only. Each one needs a source and a second check before it goes into the game.", "");
  lines.push("### How many categories each candidate has", "", "| Categories | Candidates |", "|---|---|");
  const byCount = {};
  for (const e of fresh) byCount[e.categories] = (byCount[e.categories] || 0) + 1;
  for (const k of Object.keys(byCount).sort()) lines.push(`| ${k}${Number(k) >= 4 ? "+" : ""} | ${byCount[k]} |`);
  lines.push("", "### Pairs of categories the new candidates could bridge", "", "| Pair | Candidates |", "|---|---|");
  for (const [pair, n] of Object.entries(pairCounts(fresh)).sort((a, b) => b[1] - a[1])) lines.push(`| ${pair} | ${n} |`);
  lines.push("", `### The ${Math.min(top, fresh.length)} best known new candidates`, "", "| Object | Categories | Wikidata |", "|---|---|---|");
  for (const e of fresh.slice(0, top)) lines.push(`| ${e.label} | ${CATS.filter((c) => e.facts[c]).join(", ")} | [${e.qid}](https://www.wikidata.org/wiki/${e.qid}) |`);
  lines.push("", "The full list is in the download at the bottom of this page (called harvest-candidates).");
  return lines.join("\n") + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/harvest-summary.mjs path/to/harvest.json");
    process.exit(1);
  }
  const root = join(fileURLToPath(import.meta.url), "..", "..");
  let names = [];
  try {
    names = JSON.parse(readFileSync(join(root, "data", "facts.json"), "utf8")).entities.map((e) => e.name);
  } catch (e) {
    /* without the game's names we just cannot flag repeats */
  }
  process.stdout.write(summarise(JSON.parse(readFileSync(file, "utf8")), names));
}
