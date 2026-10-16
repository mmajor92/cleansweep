// The "Harvest candidate facts" button on GitHub: manual only, read-only, saves a download and never touches the game.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { summarise, pairCounts } from "../scripts/harvest-summary.mjs";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const yml = readFileSync(join(root, ".github", "workflows", "harvest.yml"), "utf8");

test("it only runs when someone presses the button", () => {
  assert.match(yml, /^on:\n  workflow_dispatch:/m);
  assert.ok(!/schedule:|cron:|^\s+push:|pull_request/m.test(yml), "no schedule and no automatic triggers");
});

test("it can only read the repository, never change it", () => {
  const perms = /^permissions:\n((?:  .+\n)+)/m.exec(yml)[1];
  assert.equal(perms.trim(), "contents: read");
  assert.ok(!/create-pull-request|git commit|git push|contents: write/.test(yml));
});

test("it identifies itself to Wikidata with the repository address, so no email is stored", () => {
  assert.match(yml, /HARVEST_CONTACT: https:\/\/github\.com\/\$\{\{ github\.repository \}\}/);
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(yml.replace(/actions\/[a-z-]+@v\d+/g, "")), "no email address");
});

test("the three settings reach the script through variables, not pasted into the command", () => {
  const runs = yml.split("\n").filter((l) => /^\s+run:|^\s{10,}\S/.test(l)).join("\n");
  assert.ok(!/\$\{\{ inputs\./.test(runs), "inputs are only used in the env block");
  assert.match(yml, /MIN_LINKS: \$\{\{ inputs\.min_links \}\}/);
  assert.match(yml, /case "\$v" in/, "and they are checked to be whole numbers first");
});

test("the list is saved outside the repository and offered as a download that expires", () => {
  assert.match(yml, /--out "\$RUNNER_TEMP\/harvest\.json"/);
  assert.match(yml, /uses: actions\/upload-artifact@v4/);
  assert.match(yml, /retention-days: 30/);
  assert.match(yml, /if-no-files-found: error/);
});

const fixture = {
  generatedOn: "2026-10-17",
  params: { minLinks: 50, limit: 400, minCategories: 2 },
  entities: [
    { qid: "Q1", label: "Boeing 747", links: 120, categories: 3, facts: { length: {}, weight: {}, speed: {} } },
    { qid: "Q2", label: "The Titanic", links: 110, categories: 2, facts: { length: {}, date: {} } },
    { qid: "Q3", label: "Eurostar", links: 60, categories: 2, facts: { count: {}, speed: {} } },
  ],
};

test("the summary counts candidates, flags repeats, and shows the pairs they could bridge", () => {
  const md = summarise(fixture, ["Titanic", "A tennis ball"]);
  assert.match(md, /\*\*3 candidate objects\*\*/);
  assert.match(md, /\*\*1 look like they are already in the game\*\*/);
  assert.match(md, /\| count \+ speed \| 1 \|/);
  assert.match(md, /\| length \+ weight \| 1 \|/);
  assert.ok(!/\| length \+ date \|/.test(md), "the Titanic is already in the game, so its pair is not counted");
  assert.ok(!/\| The Titanic \|/.test(md), "and it is not in the best-known list");
  assert.match(md, /\[Q1\]\(https:\/\/www\.wikidata\.org\/wiki\/Q1\)/);
});

test("pairs are counted once per candidate", () => {
  assert.deepEqual(pairCounts([fixture.entities[0]]), { "length + weight": 1, "length + speed": 1, "weight + speed": 1 });
});

test("an empty harvest still gives a readable summary", () => {
  const md = summarise({ ...fixture, entities: [] });
  assert.match(md, /\*\*0 candidate objects\*\*/);
});
