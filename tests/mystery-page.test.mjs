// Mystery Thing: the page and how it is wired into the site. These checks need no browser.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const html = read("mystery/index.html");
const ui = read("mystery/ui.js");
const main = read("mystery/main.js");
const idsIn = (text) => new Set([...text.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));
const pageIds = idsIn(html);

test("every element the code asks for exists in the page (or is drawn by the code itself)", () => {
  const drawn = idsIn(ui); // ids that ui.js writes into its own HTML strings (the list, the buttons on the end card)
  const asked = [...ui.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g), ...main.matchAll(/getElementById\("([A-Za-z0-9_-]+)"\)/g)].map((m) => m[1]);
  assert.ok(asked.length > 30);
  const missing = [...new Set(asked)].filter((id) => !pageIds.has(id) && !drawn.has(id));
  assert.deepEqual(missing, [], `asked for but not in the page: ${missing.join(", ")}`);
});

test("every file is valid JavaScript, and the page loads its code as a module with nothing from other sites", () => {
  for (const f of ["logic", "data", "schedule", "ui", "main"]) execFileSync(process.execPath, ["--check", new URL(`../mystery/${f}.js`, import.meta.url).pathname]);
  assert.match(html, /<script type="module" src="main.js"><\/script>/);
  assert.ok(!/<script[^>]+src="https?:/i.test(html) && !/<link[^>]+href="https?:/i.test(html), "the page must not load anything from another site");
  assert.match(html, /<link rel="stylesheet" href="styles.css">/);
  assert.ok(!/fonts\.googleapis|gstatic/.test(html + read("mystery/styles.css")), "fonts come from this site, not Google");
});

test("the page has a title, a description, share-card tags that point at /mystery/, and keeps the theme chosen on Clean Sweep", () => {
  assert.match(html, /<title>Mystery Thing<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{20,}">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/cleansweepdaily\.fyi\/mystery\/">/);
  assert.match(html, /localStorage\.getItem\("cleansweep:theme"\)/);
  assert.match(main, /"cleansweep:theme"/);
});

test("the two games link to each other, with a status line and a New badge on each card", () => {
  const cs = read("index.html");
  for (const [name, page, href] of [["Clean Sweep", cs, 'href="mystery/"'], ["Mystery Thing", html, 'href="../"']]) {
    assert.ok(page.includes(href), `${name} should link to the other game with ${href}`);
    for (const id of ["gs-cs", "gs-mt", "newbadge"]) assert.ok(idsIn(page).has(id), `${name} page has no #${id}`);
  }
  assert.ok(cs.includes('aria-current="page"') && html.includes('aria-current="page"'));
  assert.match(cs, /Today\u2019s puzzles/);
  assert.match(html, /Today\u2019s puzzles/);
});

test("the testing controls are hidden unless the address ends in #debug", () => {
  assert.match(html, /id="tools"[^>]*\bhidden\b/);
  assert.match(ui, /\/debug\/\.test\(/);
  assert.ok(/if \(\/debug\//.test(ui) && ui.indexOf("globalThis.__mt") > ui.indexOf("/debug/"), "the debug hooks must be inside the #debug check");
});

test("the wording the players see: the lock note is short, and the game says nothing it should not", () => {
  assert.match(ui, /Locked to " \+ MODE_LABEL\[mode\] \+ \(isToday\(\) \? " for today" : ""\)/);
  assert.ok(!/Choose again tomorrow/.test(ui), "the lock note should be as short as it can be");
  assert.ok(!/Done \\u00b7 not solved/.test(ui), "an unsolved game says just Not solved");
});

test("no long dashes in anything players read (the house style is a plain hyphen or a full stop)", () => {
  for (const f of ["mystery/index.html", "mystery/ui.js", "mystery/logic.js", "mystery/main.js", "src/games.js"]) assert.ok(!/[\u2014\u2013]/.test(read(f)), `${f} has a long dash`);
});

test("the site is deployed with the mystery folder, and the weekly job freezes Mystery Thing's days too", () => {
  assert.match(read(".github/workflows/pages.yml"), /cp -r [^\n]*\bmystery\b[^\n]* _site\//);
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["generate:ahead"], /mystery-days\.mjs/);
  assert.match(pkg.scripts["lint:data"], /lint-mystery\.mjs/);
  assert.match(read(".github/workflows/generate-puzzles.yml"), /npm run generate:ahead/);
});

test("the result card: Share and Copy like Clean Sweep, a countdown, one button to the other game, and no Play another on a daily result", () => {
  assert.match(ui, /Share result/);
  assert.match(ui, /Copy result/);
  assert.match(ui, /navigator\.share/);
  assert.match(ui, /Next puzzle in /);
  assert.ok(!/Next: Clean Sweep/.test(ui) && !/Seven higher-or-lower/.test(ui), "the sentence above the Clean Sweep button should be gone");
  for (const label of ["Play today\\u2019s Clean Sweep", "Finish today\\u2019s Clean Sweep", "\\u2713 Clean Sweep done"]) assert.ok(ui.includes(label), label);
  const daily = ui.slice(ui.indexOf("puzzle.daily\n          ?"), ui.indexOf(": '<div class=\"btns\"><button class=\"btn primary\" id=\"copy\""));
  assert.ok(daily.includes("shareButtons()") && !daily.includes("another"), "a daily result must not offer Play another");
});

test("the Reminder under the settings: a single word to open it, remembered between visits, folded away by the first guess", () => {
  assert.match(html, /<button class="remind" id="remind"[^>]*>Reminder<\/button>/);
  assert.match(ui, /"mt:help"/);
  assert.match(ui, /if \(store\.get\("mt:help"\) === null\) store\.set\("mt:help", "closed"\)/);
});

test("the status words are short: Not played, with no 'yet', anywhere", () => {
  for (const f of ["index.html", "mystery/index.html", "src/games.js", "README.md"]) assert.ok(!read(f).includes("Not played yet"), `${f} still says Not played yet`);
});

test("streaks: a flame line on each card, a stats row on the result card, a banner at a milestone, and never in the text people share", () => {
  const cs = read("index.html"), logic = read("mystery/logic.js");
  for (const [name, page] of [["Clean Sweep", cs], ["Mystery Thing", html]]) for (const id of ["gf-cs", "gf-mt", "games"]) assert.ok(idsIn(page).has(id), `${name} page has no #${id}`);
  for (const w of ["day streak", "solved in a row", "best streak", "best score"]) assert.ok(ui.includes(w), w);
  assert.match(ui, /milestoneBanner\(\)/);
  assert.match(ui, /syncStats\(\)/);
  assert.ok(!/\uD83D\uDD25|\u{1F525}|streak/i.test(logic), "the share card is built in logic.js and must not mention streaks");
});

test("the streak row is set apart from the puzzle's result by a line above it", () => {
  const css = read("mystery/styles.css");
  assert.match(css, /\.stats \{[^}]*border-top: 2px solid var\(--line\)/);
});

test("the five counts: started at the first guess, solved, gave up, finished, and clean sweep, each only for today's puzzle", () => {
  for (const name of ["mystery-started", "mystery-solved", "mystery-gave-up", "mystery-finished", "mystery-clean-sweep"]) assert.ok(ui.includes(`countEvent("${name}")`), name);
  assert.match(ui, /if \(guesses\.length === 1 && isToday\(\)\) countEvent\("mystery-started"\)/);
  assert.match(ui, /if \(guesses\[guesses\.length - 1\] === puzzle\.secret\.id\) countEvent\("mystery-solved"\)/);
  assert.match(ui, /if \(isToday\(\)\) \{ countEvent\("mystery-gave-up"\); countEvent\("mystery-finished"\)/);
});
