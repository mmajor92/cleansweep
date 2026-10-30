// Checks Line Up's data, the way scripts/lint-mystery.mjs does for Mystery Thing: the practice puzzles, the frozen days, and how varied the game stays.
// Usage: node scripts/lint-lineup.mjs [--strict]   (--strict makes warnings fail too)
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LU_CATS, buildPool } from "../lineup/data.js";
import { PRACTICE } from "../lineup/logic.js";
import { BOARD_SIZE, inOrder, minGap } from "../lineup/schedule.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const facts = JSON.parse(await readFile(join(root, "data/facts.json"), "utf8"));
const file = JSON.parse(await readFile(join(root, "data/lineup-days.json"), "utf8"));
const pool = buildPool(facts.entities);
const byKey = Object.fromEntries(pool.map((p) => [p.key, p]));

// ---- the pool ----
const perCat = Object.fromEntries(LU_CATS.map((c) => [c, pool.filter((p) => p.cat === c).length]));
for (const c of LU_CATS) if (perCat[c] < 40) warn(`only ${perCat[c]} ${c} items: that kind of puzzle will repeat things often (aim for 40 or more)`);

// ---- the two practice puzzles ----
for (const [i, p] of PRACTICE.entries()) {
  const items = p.ids.map((id) => byKey[id + ":" + p.cat]);
  if (items.some((x) => !x)) err(`practice ${i + 1}: ${p.ids.filter((id) => !byKey[id + ":" + p.cat]).join(", ")} is not a usable ${p.cat} item`);
  else if (new Set(items.map((x) => x.value)).size !== BOARD_SIZE) err(`practice ${i + 1}: two of the ${BOARD_SIZE} tie`);
  else if (minGap(items, p.cat) < (p.cat === "date" ? 40 : 2)) err(`practice ${i + 1}: the closest two are too close for a practice puzzle (${minGap(items, p.cat).toFixed(2)})`);
}

// ---- the frozen days ----
const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(file.launchDate || "");
if (!m || Number.isNaN(Date.UTC(+m[1], +m[2] - 1, +m[3]))) err(`launchDate "${file.launchDate}" is not a date like 2026-10-30`);
const days = Array.isArray(file.days) ? file.days : [];
if (!days.length) err("data/lineup-days.json has no days");
const todayNo = m ? Math.max(1, Math.floor((Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5) + 1) : 1;
days.forEach((d, i) => {
  const no = i + 1;
  const say = no >= todayNo ? err : warn; // today and the future must be right; a past day only needs to read sensibly
  if (!LU_CATS.includes(d.cat)) return err(`day ${no}: "${d.cat}" is not one of ${LU_CATS.join(", ")}`);
  if (!Array.isArray(d.ids) || d.ids.length !== BOARD_SIZE || new Set(d.ids).size !== BOARD_SIZE) return err(`day ${no}: needs ${BOARD_SIZE} different things`);
  const items = d.ids.map((id) => byKey[id + ":" + d.cat]);
  const gone = d.ids.filter((id) => !byKey[id + ":" + d.cat]);
  if (gone.length) return say(`day ${no}: ${gone.join(", ")} can no longer be a ${d.cat} item`);
  if (new Set(items.map((x) => x.value)).size !== BOARD_SIZE) return say(`day ${no}: two of the ${BOARD_SIZE} now have the same value`);
  if (new Set(items.map((x) => x.family)).size !== BOARD_SIZE) say(`day ${no}: two of the ${BOARD_SIZE} are the same thing`);
  const solution = inOrder(items);
  const fixed = items.filter((x, k) => x === solution[k]).length;
  if (fixed > 1) say(`day ${no}: ${fixed} things start in the right place (at most one is allowed)`);
  if (items.filter((x) => x.fame >= 3).length < 2) warn(`day ${no}: fewer than two of the ${BOARD_SIZE} are well known`);
  if (i > 0 && days[i - 1].cat === d.cat) warn(`day ${no}: the same kind of puzzle as the day before`);
  const g = minGap(items, d.cat);
  if (Math.abs(g - d.gap) > 0.02 * Math.max(1, d.gap)) warn(`day ${no}: the stored closeness (${d.gap}) no longer matches the facts (${g.toFixed(2)}): the facts have changed`);
});
const seenBoards = new Map();
days.forEach((d, i) => {
  const key = d.cat + "|" + d.ids.slice().sort().join(",");
  if (seenBoards.has(key)) (i + 1 >= todayNo ? err : warn)(`day ${i + 1}: the same things as day ${seenBoards.get(key)} (a board must never repeat)`);
  else seenBoards.set(key, i + 1);
});
const reuse = days.reduce((n, d, i) => n + d.ids.filter((id) => days.slice(Math.max(0, i - 25), i).some((e) => e.ids.includes(id))).length, 0);
if (days.length > 30 && reuse / (days.length * BOARD_SIZE) > 0.35) warn(`${reuse} of ${days.length * BOARD_SIZE} places reuse a thing from the last 25 days: add more facts, especially speeds`);
const ahead = days.length - todayNo;
if (ahead < 0) warn(`the frozen days ran out ${-ahead} day(s) ago: the page works the days out itself, but run "npm run generate:ahead"`);
else if (ahead < 7) warn(`only ${ahead} frozen day(s) after today: the weekly job should add more`);

// ---- report ----
const used = {};
days.forEach((d) => (used[d.cat] = (used[d.cat] || 0) + 1));
const gaps = days.map((d) => d.gap).sort((a, b) => a - b);
console.log("Line Up data check");
console.log(`  items to put in order: ${LU_CATS.map((c) => `${perCat[c]} ${c}`).join(", ")}`);
console.log(`  ${days.length} frozen days from ${file.launchDate}; today is puzzle #${todayNo}; ${Math.max(0, ahead)} frozen after today`);
console.log(`  kinds of puzzle so far: ${Object.entries(used).map(([k, v]) => `${k} ${v}`).join(", ")}`);
for (const w of warnings) console.log(`  warning: ${w}`);
for (const e of errors) console.log(`  ERROR: ${e}`);
if (errors.length || (strict && warnings.length)) {
  console.log(`FAILED (${errors.length} errors, ${warnings.length} warnings)`);
  process.exit(1);
}
console.log(`OK (${warnings.length} warnings)`);
