// Freezes the next days of Mystery Thing into data/mystery-days.json, the way scripts/generate.mjs freezes Clean Sweep puzzles.
// Days that are already in the file are never changed; new ones are added at the end.
// Usage: node scripts/mystery-days.mjs [--days 21]   (how many days ahead of today to cover)
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildData } from "../mystery/data.js";
import { extendDays } from "../mystery/schedule.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const FILE = join(root, "data/mystery-days.json");
const NOTE = "Which mystery thing is on which day, and which two clues come with it. Day 1 is launchDate (UTC). Days already here are never changed: scripts/mystery-days.mjs only adds new ones at the end. launchDate must not change once the game is live.";

export function formatDays(file) {
  const rows = file.days.map((d) => `    ${JSON.stringify({ id: d.id, cs: d.cs })}`).join(",\n");
  return `{\n  "note": ${JSON.stringify(file.note)},\n  "launchDate": ${JSON.stringify(file.launchDate)},\n  "days": [\n${rows}\n  ]\n}\n`;
}

const arg = process.argv.indexOf("--days");
const ahead = arg > -1 ? Number(process.argv[arg + 1]) : 21;
if (!Number.isFinite(ahead) || ahead < 1) throw new Error("--days needs a number, for example --days 21");

let file;
try {
  file = JSON.parse(await readFile(FILE, "utf8"));
} catch (e) {
  file = { note: NOTE, launchDate: process.env.MYSTERY_LAUNCH || "2026-10-27", days: [] };
}
const facts = JSON.parse(await readFile(join(root, "data/facts.json"), "utf8"));
const { secrets } = buildData(facts.entities);
const [y, m, d] = file.launchDate.split("-").map(Number);
const today = Date.now();
const todayNo = Math.max(1, Math.floor((today - Date.UTC(y, m - 1, d)) / 864e5) + 1);
const target = todayNo + ahead;
const before = file.days.length;
file.days = extendDays(file.days, secrets, target);
file.note = NOTE;
await writeFile(FILE, formatDays(file));
console.log(`Mystery Thing: ${file.days.length} days frozen (${file.days.length - before} added), covering puzzle #${todayNo} (today) and ${file.days.length - todayNo} days after it. Day 1 is ${file.launchDate}.`);
