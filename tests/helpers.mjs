import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEntities } from "../src/engine.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
export const rawFacts = JSON.parse(readFileSync(join(root, "data/facts.json"), "utf8"));
export const entities = buildEntities(rawFacts);

// Warm-ups are OFF in the game: no fact is reserved. These 14 facts used to be, and flagging them again in a copy of the data lets the tests keep
// exercising the warm-up code (for as long as somebody might switch it back on with RULES.warmChance).
export const OLD_WARM = [["wembley", "count"], ["colosseum", "count"], ["londoneye", "speed"], ["curiosity", "speed"], ["evergiven", "count"], ["mini", "count"], ["cleopatra", "date"], ["secday", "count"], ["minyear", "count"], ["golfball", "weight"], ["tennisball", "weight"], ["cricketball", "weight"], ["footballball", "weight"], ["tortoise", "speed"]];
const rawWarm = JSON.parse(JSON.stringify(rawFacts));
for (const [id, cat] of OLD_WARM) rawWarm.entities.find((e) => e.id === id).facts[cat].warmup = true;
export const warmEntities = buildEntities(rawWarm);
