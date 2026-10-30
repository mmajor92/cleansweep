// Freezes the next days of Line Up into data/lineup-days.json, the way scripts/mystery-days.mjs does for Mystery Thing.
// Days that are already in the file are never changed; new ones are added at the end.
// Usage: node scripts/lineup-days.mjs [--days 21]   (how many days ahead of today to cover)
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPool } from "../lineup/data.js";
import { extendPuzzles } from "../lineup/schedule.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const FILE = join(root, "data/lineup-days.json");
const NOTE = "Which six things are on which day of Line Up, in the order they first appear on the board. Day 1 is launchDate (UTC). gap is how close the closest two neighbours are: times apart for sizes, weights and speeds, years apart for dates (the difficulty, chosen at random for each day). Days already here are never changed: scripts/lineup-days.mjs only adds new ones at the end. launchDate must not change once the game is live.";

export function formatDays(file) {
  const rows = file.days.map((d) => `    ${JSON.stringify({ cat: d.cat, ids: d.ids, gap: d.gap })}`).join(",\n");
  return `{\n  "note": ${JSON.stringify(file.note)},\n  "launchDate": ${JSON.stringify(file.launchDate)},\n  "days": [\n${rows}\n  ]\n}\n`;
}

const arg = process.argv.indexOf("--days");
const ahead = arg > -1 ? Number(process.argv[arg + 1]) : 21;
if (!Number.isFinite(ahead) || ahead < 1) throw new Error("--days needs a number, for example --days 21");

let file;
try {
  file = JSON.parse(await readFile(FILE, "utf8"));
} catch (e) {
  file = { note: NOTE, launchDate: process.env.LINEUP_LAUNCH || "2026-10-30", days: [] };
}
const facts = JSON.parse(await readFile(join(root, "data/facts.json"), "utf8"));
const pool = buildPool(facts.entities);
const [y, m, d] = file.launchDate.split("-").map(Number);
const todayNo = Math.max(1, Math.floor((Date.now() - Date.UTC(y, m - 1, d)) / 864e5) + 1);
const before = file.days.length;
file.days = extendPuzzles(file.days, pool, todayNo + ahead);
file.note = NOTE;
await writeFile(FILE, formatDays(file));
console.log(`Line Up: ${file.days.length} days frozen (${file.days.length - before} added), covering puzzle #${todayNo} (today) and ${file.days.length - todayNo} days after it. Day 1 is ${file.launchDate}.`);
