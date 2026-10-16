import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEntities } from "../src/engine.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
export const rawFacts = JSON.parse(readFileSync(join(root, "data/facts.json"), "utf8"));
export const entities = buildEntities(rawFacts);
