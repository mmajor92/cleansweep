// Checks Mystery Thing's data, the way scripts/lint.mjs checks Clean Sweep's: the practice puzzles, the frozen days, and how long the game stays fresh.
// Usage: node scripts/lint-mystery.mjs [--strict]   (--strict makes warnings fail too)
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_CATS, MIN_POOL, buildData } from "../mystery/data.js";
import { PRACTICE } from "../mystery/logic.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const facts = JSON.parse(await readFile(join(root, "data/facts.json"), "utf8"));
const file = JSON.parse(await readFile(join(root, "data/mystery-days.json"), "utf8"));
const { objs, secrets } = buildData(facts.entities);
const byId = Object.fromEntries(objs.map((o) => [o.id, o]));
const secretById = Object.fromEntries(secrets.map((s) => [s.id, s]));
const pool = (cs) => objs.filter((o) => cs.every((c) => o.c[c]));
const key = (cs) => cs.join("+");

// ---- the answers ----
if (secrets.length < 60) warn(`only ${secrets.length} possible answers: fewer than two months before one comes round again (aim for 60 or more)`);

// ---- the two practice puzzles ----
for (const [i, p] of PRACTICE.entries()) {
  const o = byId[p.id];
  if (!o) err(`practice ${i + 1}: "${p.id}" is not in the game (or has fewer than two of size, weight, speed and year)`);
  else if (!p.cs.every((c) => o.c[c])) err(`practice ${i + 1}: ${o.name} has no ${p.cs.filter((c) => !o.c[c]).join(" or ")} number`);
  else if (pool(p.cs).length < MIN_POOL) err(`practice ${i + 1}: only ${pool(p.cs).length} things have both clues (needs ${MIN_POOL})`);
}

// ---- the frozen days ----
const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(file.launchDate || "");
if (!m || Number.isNaN(Date.UTC(+m[1], +m[2] - 1, +m[3]))) err(`launchDate "${file.launchDate}" is not a date like 2026-10-27`);
if (!Array.isArray(file.days) || file.days.length === 0) err("data/mystery-days.json has no days");
const days = Array.isArray(file.days) ? file.days : [];
const todayNo = m ? Math.max(1, Math.floor((Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5) + 1) : 1;
let sameRun = 0;
days.forEach((d, i) => {
  const no = i + 1;
  const live = no >= todayNo; // today and the future must be right; a past day only needs to read sensibly
  const say = live ? err : warn;
  const s = secretById[d.id];
  if (!Array.isArray(d.cs) || d.cs.length !== 2 || !d.cs.every((c) => DATA_CATS.includes(c))) return err(`day ${no}: the clue pair is not two of ${DATA_CATS.join(", ")}`);
  if (!byId[d.id]) return say(`day ${no}: "${d.id}" is not in the game any more`);
  if (!s) say(`day ${no}: ${byId[d.id].name} can no longer be an answer`);
  else if (!s.pairs.some((p) => key(p) === key(d.cs))) say(`day ${no}: ${byId[d.id].name} cannot have the clues ${key(d.cs)} (not enough things have both)`);
  const back = Math.min(secrets.length - 1, i);
  for (let j = Math.max(0, i - back); j < i; j++) if (days[j].id === d.id) say(`day ${no}: ${byId[d.id].name} was already the answer on day ${j + 1}`);
  if (i > 0 && key(days[i - 1].cs) === key(d.cs)) sameRun++;
});
if (days.length > 1 && sameRun / (days.length - 1) > 0.12) warn(`the same clue pair comes two days running on ${sameRun} of ${days.length - 1} days`);
const ahead = days.length - todayNo;
if (ahead < 0) warn(`the frozen days ran out ${-ahead} day(s) ago: the page works the days out itself, but run "npm run generate:ahead"`);
else if (ahead < 7) warn(`only ${ahead} frozen day(s) after today: the weekly job should add more`);

// ---- report ----
const used = {};
days.forEach((d) => (used[key(d.cs)] = (used[key(d.cs)] || 0) + 1));
console.log(`Mystery Thing data check`);
console.log(`  ${objs.length} objects with two or more numbers, ${secrets.length} possible answers (about ${(secrets.length / 30.4).toFixed(1)} months before one repeats)`);
console.log(`  ${days.length} frozen days from ${file.launchDate}; today is puzzle #${todayNo}; ${Math.max(0, ahead)} frozen after today`);
console.log(`  clue pairs used so far: ${Object.entries(used).map(([k, v]) => `${k} ${v}`).join(", ")}`);
for (const w of warnings) console.log(`  warning: ${w}`);
for (const e of errors) console.log(`  ERROR: ${e}`);
if (errors.length || (strict && warnings.length)) {
  console.log(`FAILED (${errors.length} errors, ${warnings.length} warnings)`);
  process.exit(1);
}
console.log(`OK (${warnings.length} warnings)`);
