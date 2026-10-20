// Data linter. Run with: node scripts/lint.mjs [--days 365] [--strict]
// Fails (exit 1) on errors. With --strict, warnings also fail.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, CATEGORY_KEYS, PRACTICE, RULES, buildEntities, generateSeries, normalizePuzzle, objectsOf, questionsOf, validatePuzzle } from "../src/engine.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const daysArg = args.indexOf("--days");
const DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : 365;

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const MIN_PER_CATEGORY = 12;
const MIN_HINGES = 12; // objects with facts in two or more categories: the only ones that can be bridges
const MAX_HINGE_SHARE = 0.2; // one bridge object may be a bridge on at most 20% of days
const MAX_REPEAT_WINDOW = 7; // warn when a bridge repeats inside this many days
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["verified", "definitional"];

const read = async (p) => JSON.parse(await readFile(join(root, p), "utf8"));

// ---------- 1. Schema and fact quality ----------
const raw = await read("data/facts.json");
if (raw.schema !== 1) err("facts.json: schema must be 1");
if (!Array.isArray(raw.entities) || !raw.entities.length) err("facts.json: no entities");

const ids = new Set();
const labels = new Set();
for (const e of raw.entities || []) {
  const where = `entity "${e.id}"`;
  if (!e.id || !/^[a-z0-9]+$/.test(e.id)) err(`${where}: id must be lowercase letters and digits`);
  if (ids.has(e.id)) err(`${where}: duplicate id`);
  ids.add(e.id);
  if (!e.name) err(`${where}: missing name`);
  if (e.object !== undefined) {
    // an extra number: one more fact about an object that is already in the game
    const parent = (raw.entities || []).find((x) => x.id === e.object);
    if (e.object === e.id || !parent) err(`${where}: object "${e.object}" is not another entity in facts.json (an extra number belongs to an object that is already there)`);
    else if (parent.object !== undefined) err(`${where}: object "${e.object}" is itself an extra: point at the main object`);
    if (Object.keys(e.facts || {}).length !== 1) err(`${where}: an extra number holds exactly one fact`);
    else if (parent) {
      const [c, f] = Object.entries(e.facts)[0];
      const p = parent.facts && parent.facts[c];
      const same = p && (c === "date" ? p.value === f.value : Math.abs(Math.log(p.value / f.value)) < 0.01); // within 1%. For dates only the same year counts: two dates a year or two apart are different events
      if (same) warn(`${where}: ${c} ${f.value} is the same as the ${c} already on "${e.object}" (${p.value}): the same number twice?`);
    }
  }
  if (!e.facts || !Object.keys(e.facts).length) err(`${where}: no facts`);
  for (const key of ["hint", "clue"]) {
    if (e[key] === undefined) continue;
    if (typeof e[key] !== "string" || !e[key].trim()) err(`${where}: ${key} must be a non-empty string`);
    else {
      if (e[key].length > 80) err(`${where}: ${key} is longer than 80 characters`);
      if (/[\u2014\u2013]/.test(e[key])) err(`${where}: ${key} contains a dash character`);
      if (/[.!?]$/.test(e[key].trim())) warn(`${where}: ${key} should not end with punctuation (the game adds it)`);
    }
  }
  if (e.hint && !e.clue) warn(`${where}: has a hint but no clue, so players see nothing before answering`);
  for (const [cat, f] of Object.entries(e.facts || {})) {
    const at = `${where} / ${cat}`;
    if (!CATEGORIES[cat]) {
      err(`${at}: unknown category`);
      continue;
    }
    for (const key of ["phrase", "label", "status", "source"]) {
      if (typeof f[key] !== "string" || !f[key].trim()) err(`${at}: missing ${key}`);
    }
    if (typeof f.value !== "number" || !Number.isFinite(f.value)) err(`${at}: value must be a number`);
    else if (cat === "date") {
      if (!Number.isInteger(f.value) || f.value === 0) err(`${at}: a date must be a whole year, and there is no year 0`);
    } else if (f.value <= 0) err(`${at}: value must be positive`);
    if (typeof f.approx !== "boolean") err(`${at}: approx must be true or false`);
    if (!STATUSES.includes(f.status)) err(`${at}: status must be one of ${STATUSES.join(", ")}`);
    if (f.status === "verified") {
      if (!/^https?:\/\//.test(f.source || "")) err(`${at}: verified facts need an http(s) source`);
      if (!ISO.test(f.checkedOn || "")) err(`${at}: verified facts need checkedOn as YYYY-MM-DD`);
    }
    if (f.status === "definitional") {
      if (f.source !== "definition") err(`${at}: definitional facts must use source "definition"`);
      if (!f.basis) err(`${at}: definitional facts need a basis`);
    }
    if (f.label && f.label.length > 40) warn(`${at}: label is long (${f.label.length} characters)`);
    if (f.phrase && f.phrase.length > 120) warn(`${at}: phrase is long (${f.phrase.length} characters)`);
    for (const key of ["phrase", "label", "note"]) {
      if (typeof f[key] === "string" && /[\u2014\u2013]/.test(f[key])) err(`${at}: ${key} contains a dash character, use a hyphen or rewrite`);
    }
    if (cat !== "date" && f.phrase && !/^(the|a|an|usain)\b/i.test(f.phrase) && cat !== "speed") {
      warn(`${at}: phrase should start with "the", "a" or "an"`);
    }
    const key = `${cat}:${f.label}`;
    if (labels.has(key)) err(`${at}: duplicate label "${f.label}"`);
    labels.add(key);
    if (f.unit !== undefined) {
      const expected = { length: "m", weight: "kg", speed: "km/h", date: "year", count: "" }[cat];
      if (f.unit !== expected) err(`${at}: unit should be "${expected}"`);
    }
  }
}

// ---------- 2. Pool size ----------
const entities = buildEntities(raw);
const perCat = Object.fromEntries(CATEGORY_KEYS.map((c) => [c, entities.filter((e) => e.facts[c]).length]));
for (const c of CATEGORY_KEYS) {
  if (perCat[c] < MIN_PER_CATEGORY) err(`only ${perCat[c]} usable ${c} facts (need ${MIN_PER_CATEGORY})`);
}
const hingeIds = entities.filter((e) => Object.keys(e.facts).length >= 2).map((e) => e.id); // an extra number holds one fact, so it is never a bridge
if (hingeIds.length < MIN_HINGES) err(`only ${hingeIds.length} bridge objects (need ${MIN_HINGES})`);

// ---------- 3. Candidates must never leak into production ----------
const cands = await read("data/candidates.json");
for (const c of cands.entities || []) {
  if (ids.has(c.id)) err(`candidate "${c.id}" is also in facts.json: remove it from candidates.json`);
}

// ---------- 4. Generate a run of days and check every rule ----------
const series = generateSeries(1, DAYS, entities);
const pairs = {}; // category switches: "length>weight" and so on
const hinges = {}; // how many days each object is a bridge
const factUse = {};
const lastHinge = []; // one array of bridge ids per day
const switchesPerDay = {};
let repeats = 0;
let yesterdaysObjects = null;
series.forEach((p, i) => {
  const day = i + 1;
  if (!p) return err(`day ${day}: no puzzle could be generated`);
  const todays = objectsOf(p);
  if (yesterdaysObjects) {
    const again = [...todays].filter((id) => yesterdaysObjects.has(id));
    if (again.length) err(`day ${day}: ${again.join(", ")} also appeared the day before`);
  }
  yesterdaysObjects = todays;
  for (const problem of validatePuzzle(p)) err(`day ${day}: ${problem}`);
  if (p.slack > 1) warn(`day ${day}: needed relaxed gap rules (slack ${p.slack})`);
  p.legs.slice(1).forEach((leg, k) => {
    const key = `${p.legs[k].cat}>${leg.cat}`;
    pairs[key] = (pairs[key] || 0) + 1;
  });
  switchesPerDay[p.bridges.length] = (switchesPerDay[p.bridges.length] || 0) + 1;
  for (const id of p.bridges) hinges[id] = (hinges[id] || 0) + 1;
  for (const it of [p.legs[0].anchor, ...questionsOf(p).map((x) => x.item)]) {
    factUse[`${it.cat}:${it.ent}`] = (factUse[`${it.cat}:${it.ent}`] || 0) + 1;
  }
  const recent = new Set(lastHinge.slice(-MAX_REPEAT_WINDOW).flat());
  if (p.bridges.some((id) => recent.has(id))) repeats++;
  lastHinge.push(p.bridges);
});
const generated = series.filter(Boolean);
// How evenly is the pool used? An everyday object (rated 2 or 3) that almost never appears is wasted research.
const appearDays = {};
for (const p of generated) for (const id of objectsOf(p)) appearDays[id] = (appearDays[id] || 0) + 1;
const everyday = entities.filter((e) => e.fame >= 2 && e.object === e.id); // objects, counted once however many numbers they hold
const rarelySeen = everyday.filter((e) => (appearDays[e.id] || 0) < 5);
const almostNever = everyday.filter((e) => (appearDays[e.id] || 0) < 2); // about once a year or less: the research is wasted
if (almostNever.length / everyday.length > 0.12) {
  warn(`${almostNever.length} of ${everyday.length} everyday objects appear on fewer than 2 days a year (${almostNever.map((e) => e.id).slice(0, 12).join(", ")}${almostNever.length > 12 ? ", ..." : ""}): their facts may not fit next to any other, so add facts or objects with similar values`);
}
const allPairs = CATEGORY_KEYS.flatMap((a) => CATEGORY_KEYS.filter((b) => b !== a).map((b) => `${a}>${b}`));
for (const k of allPairs) if (!pairs[k]) err(`the switch ${k} never appears in ${DAYS} days`);
for (const [id, n] of Object.entries(hinges)) {
  if (n / DAYS > MAX_HINGE_SHARE) warn(`bridge "${id}" is on ${Math.round((100 * n) / DAYS)}% of days (limit ${MAX_HINGE_SHARE * 100}%)`);
}
if (repeats / DAYS > 0.1) warn(`a bridge repeats within ${MAX_REPEAT_WINDOW} days on ${Math.round((100 * repeats) / DAYS)}% of days: add more bridge objects`);
const fameOf = Object.fromEntries(entities.map((e) => [e.id, e.fame]));
const neverHinge = hingeIds.filter((id) => !hinges[id] && fameOf[id] >= 2); // enthusiast objects may rarely or never be a bridge
if (neverHinge.length / hingeIds.length > 0.06) warn(`${neverHinge.length} of ${hingeIds.length} bridge objects never used in a year (a few missing by chance is normal in a big pool): ${neverHinge.join(", ")}`);

// Familiarity mix: how well do ordinary players know the objects in the questions?
const mix = { 3: 0, 2: 0, 1: 0 };
for (const [key, n] of Object.entries(factUse)) mix[fameOf[key.split(":")[1]] || 2] += n;
const mixTotal = mix[3] + mix[2] + mix[1] || 1;
const mixPct = (f) => Math.round((100 * mix[f]) / mixTotal);
if (mix[1] / mixTotal > 0.12) warn(`enthusiast-only objects are ${mixPct(1)}% of questions (limit 12%): rate fewer objects 1 or add more familiar ones`);
if (mix[3] / mixTotal < 0.4) warn(`only ${mixPct(3)}% of questions use objects nearly everyone knows (aim for 40% or more): add more everyday objects`);

// Deep cuts: enthusiast-only objects, at most one per puzzle, never question 1 or 2.
const deepDays = series.filter((p) => p && p.deepCut).length;
const deepPct = Math.round((100 * deepDays) / DAYS);
if (deepDays / DAYS < 0.2) warn(`deep cuts appear on only ${deepPct}% of days (aim for 20% or more): add more rating 1 objects`);
if (deepDays / DAYS > 0.7) warn(`deep cuts appear on ${deepPct}% of days (limit 70%)`);
for (const e of entities) if (e.fame === 1 && !e.clue) warn(`"${e.id}" is rated 1 (a deep cut) but has no clue, so players have nothing to go on`);

// Warm-ups: puzzles that open from a reserved, unreachable fact with an easy first question.
const warmDays = series.filter((p) => p && p.warmUp).length;
const warmPct = Math.round((100 * warmDays) / DAYS);
const warmUsed = new Set(series.filter((p) => p && p.warmUp).map((p) => p.legs[0].anchor.ent));
const warmFacts = entities.filter((e) => Object.values(e.facts).some((f) => f.warmup));
for (const e of warmFacts) if (!warmUsed.has(e.id)) warn(`reserved warm-up fact "${e.id}" was never used in ${DAYS} days`);
if (warmDays / DAYS < 0.15) warn(`warm-ups appear on only ${warmPct}% of days (aim for 15% or more): flag more unreachable facts as warm-ups`);
if (warmDays / DAYS > 0.6) warn(`warm-ups appear on ${warmPct}% of days (limit 60%)`);

// ---------- 5. Published puzzles ----------
// Puzzles published before v3 have two halves; normalizePuzzle turns them into the same shape as new ones, so every check below applies to both.
let published = 0;
let publishedOld = 0;
const allFacts = (p) => p.legs.flatMap((leg) => [leg.anchor, ...leg.items]);
try {
  const files = (await readdir(join(root, "puzzles"))).filter((f) => /^\d+\.json$/.test(f));
  const ordered = [];
  for (const f of files.sort((a, b) => parseInt(a) - parseInt(b))) {
    published++;
    const raw = await read(`puzzles/${f}`);
    if (!raw.legs) publishedOld++;
    const p = normalizePuzzle(raw);
    ordered.push({ f, p });
    for (const problem of validatePuzzle(raw)) err(`puzzles/${f}: ${problem}`);
    for (const it of allFacts(p)) {
      if (!STATUSES.includes(it.status)) err(`puzzles/${f}: "${it.label}" is not a verified or definitional fact`);
    }
  }
  // The two fixed practice puzzles.
  for (let n = 1; n <= PRACTICE.length; n++) {
    let raw = null;
    try {
      raw = await read(`puzzles/practice-${n}.json`);
    } catch (e) {
      warn(`puzzles/practice-${n}.json is missing: run "npm run practice" (the game rebuilds it from its seed, but the frozen copy keeps it fixed for good)`);
    }
    if (!raw) continue;
    for (const problem of validatePuzzle(raw)) err(`puzzles/practice-${n}.json: ${problem}`);
    for (const it of allFacts(normalizePuzzle(raw))) {
      if (!STATUSES.includes(it.status)) err(`puzzles/practice-${n}.json: "${it.label}" is not a verified or definitional fact`);
    }
  }

  // Cooldowns must hold across the published files too.
  const lastSeen = { bridge: {}, deep: {}, warm: {} };
  for (const { f, p } of ordered) {
    const n = parseInt(f);
    // No object two days running. Puzzles before noRepeatFrom were published before the rule existed.
    const before = ordered.find((x) => parseInt(x.f) === n - 1);
    if (before && n >= RULES.noRepeatFrom) {
      const earlier = objectsOf(before.p);
      const again = [...objectsOf(p)].filter((id) => earlier.has(id));
      if (again.length) err(`puzzles/${f}: ${again.join(", ")} also appeared in puzzle ${n - 1}`);
    }
    const deep = p.legs.flatMap((l) => l.items).find((x) => x.fame === 1);
    const checks = [
      ...p.bridges.map((id) => ["bridge", id, RULES.hingeCooldown]),
      ["deep", deep ? deep.ent : null, RULES.spiceCooldown],
      ["warm", p.warmUp ? p.legs[0].anchor.ent : null, RULES.warmCooldown],
    ];
    for (const [kind, id, cooldown] of checks) {
      if (!id) continue;
      if (lastSeen[kind][id] !== undefined && n - lastSeen[kind][id] <= cooldown) {
        err(`puzzles/${f}: ${kind} "${id}" was also used in puzzle ${lastSeen[kind][id]} (cooldown ${cooldown} days)`);
      }
      lastSeen[kind][id] = n;
    }
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}

// ---------- Report ----------
const line = (s) => console.log(s);
line("Clean Sweep data check");
line(`  entities: ${entities.length} usable, ${hingeIds.length} bridge objects`);
line(`  facts per category: ${CATEGORY_KEYS.map((c) => `${c} ${perCat[c]}`).join(", ")}`);
line(`  days generated: ${generated.length}/${DAYS}, category switches covered: ${Object.keys(pairs).length}/20`);
line(`  switches per day: ${Object.keys(switchesPerDay).sort().map((k) => `${k}: ${Math.round((100 * switchesPerDay[k]) / DAYS)}%`).join(", ")}`);
line(`  everyday objects seen on fewer than 2 days a year: ${almostNever.length} of ${everyday.length} (fewer than 5 days: ${rarelySeen.length})`);
{
  // Is a category oversupplied? If a fact is asked about only a few times a year, that category has more facts than it needs.
  const asked = {}, facts = {};
  for (const p of generated) for (const q of questionsOf(p)) asked[q.cat] = (asked[q.cat] || 0) + 1;
  for (const e of entities) for (const c of CATEGORY_KEYS) if (e.facts[c] && !e.facts[c].warmup) facts[c] = (facts[c] || 0) + 1;
  line(`  times an average fact is asked about in a year: ${CATEGORY_KEYS.map((c) => `${c} ${((asked[c] || 0) / (facts[c] || 1)).toFixed(1)}`).join(", ")}`);
}
line(`  published puzzle files checked: ${published} (${publishedOld} still in the older two-half format)`);
const topHinges = Object.entries(hinges).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(", ");
line(`  busiest bridges: ${topHinges}`);
line(`  warm-up days: ${warmPct}% (easy opening question from a reserved fact), ${warmFacts.length} reserved facts`);
line(`  deep-cut days: ${deepPct}% (one later question about an enthusiast-only object)`);
line(`  question mix by familiarity: everyone knows ${mixPct(3)}%, most people ${mixPct(2)}%, enthusiasts ${mixPct(1)}%`);
for (const w of warnings.slice(0, 40)) line(`  warning: ${w}`);
if (warnings.length > 40) line(`  ... and ${warnings.length - 40} more warnings`);
for (const e of errors.slice(0, 60)) line(`  ERROR: ${e}`);
if (errors.length > 60) line(`  ... and ${errors.length - 60} more errors`);
const failed = errors.length > 0 || (strict && warnings.length > 0);
line(failed ? `FAILED (${errors.length} errors, ${warnings.length} warnings)` : `OK (${warnings.length} warnings)`);
process.exit(failed ? 1 : 0);
