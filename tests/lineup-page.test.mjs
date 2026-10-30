// Line Up: the page and how it is wired into the site. These checks need no browser.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const html = read("lineup/index.html"), ui = read("lineup/ui.js"), main = read("lineup/main.js");
const idsIn = (text) => new Set([...text.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));

test("every element the code asks for exists in the page (or is drawn by the code itself)", () => {
  const drawn = new Set([...idsIn(ui), ...[...ui.matchAll(/id=\\?"([A-Za-z0-9_-]+)\\?"/g)].map((m) => m[1])]);
  const asked = [...ui.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g), ...main.matchAll(/getElementById\("([A-Za-z0-9_-]+)"\)/g)].map((m) => m[1]);
  assert.ok(asked.length > 25);
  const missing = [...new Set(asked)].filter((id) => !idsIn(html).has(id) && !drawn.has(id) && id !== "nextgames"); // nextgames is drawn by the shared module
  assert.deepEqual(missing, [], `asked for but not in the page: ${missing.join(", ")}`);
});

test("every file is valid JavaScript, and the page loads its code as a module with nothing from other sites", () => {
  for (const f of ["data", "schedule", "logic", "ui", "main"]) execFileSync(process.execPath, ["--check", new URL(`../lineup/${f}.js`, import.meta.url).pathname]);
  assert.match(html, /<script type="module" src="main.js"><\/script>/);
  assert.ok(!/<script[^>]+src="https?:/i.test(html) && !/<link[^>]+href="https?:/i.test(html));
  assert.ok(!/fonts\.googleapis|gstatic/.test(html + read("lineup/styles.css")), "fonts come from this site, not Google");
});

test("the logo and icons exist, and the page points at them: five navy bars on the yellow tile", () => {
  for (const f of ["icon.svg", "icon-32.png", "apple-touch-icon.png", "icon-512.png", "social-preview.png"]) assert.ok(existsSync(new URL("../lineup/" + f, import.meta.url)), f);
  const svg = read("lineup/icon.svg");
  assert.equal((svg.match(/<rect /g) || []).length, 6, "the tile and five bars");
  assert.ok(svg.includes("#FFC21A") && svg.includes("#11253A"), "yellow tile, navy bars");
  for (const href of ["icon.svg", "icon-32.png", "apple-touch-icon.png"]) assert.ok(html.includes(`href="${href}"`), href);
  assert.match(html, /<meta property="og:url" content="https:\/\/cleansweepdaily\.fyi\/lineup\/">/);
  assert.match(html, /og:image" content="https:\/\/cleansweepdaily\.fyi\/lineup\/social-preview\.png"/);
  assert.equal((html.match(/<rect /g) || []).length, 5, "the header logo has five bars");
});

test("the three pages have the same switcher: three boxes in order, with the right links, an icon in each, and the page you are on marked", () => {
  const pages = { "index.html": ["./", "mystery/", "lineup/", 0], "mystery/index.html": ["../", "./", "../lineup/", 1], "lineup/index.html": ["../", "../mystery/", "./", 2] };
  for (const [file, [a, b, c, cur]] of Object.entries(pages)) {
    const page = read(file);
    const boxes = [...page.matchAll(/<a class="swb( cur)?" data-g="(cs|mt|lu)" href="([^"]*)"( aria-current="page")?>/g)];
    assert.deepEqual(boxes.map((m) => m[2]), ["cs", "mt", "lu"], file);
    assert.deepEqual(boxes.map((m) => m[3]), [a, b, c], file);
    assert.deepEqual(boxes.map((m) => !!m[1] && !!m[4]), [0, 1, 2].map((i) => i === cur), file);
    for (const id of ["gs-cs", "gs-mt", "gs-lu", "newbadge", "newbadge-lu", "games"]) assert.ok(idsIn(page).has(id), `${file} has no #${id}`);
    assert.match(page, /<nav class="sw" id="games" aria-label="Switch game">/);
    for (const name of ["Clean Sweep", "Mystery Thing", "Line Up", "Sweep", "Mystery"]) assert.ok(page.includes(`>${name}<`), `${file} lacks the name ${name}`);
    assert.ok(!/gamerow|gf-cs|gf-mt|gf-lu/.test(page), `${file}: the old rows are gone`);
  }
});

test("the switcher is the same in all three stylesheets: 44 px tall boxes, short names on a phone, and a tick, dot, ring and cross", () => {
  for (const f of ["styles.css", "mystery/styles.css", "lineup/styles.css"]) {
    const css = read(f);
    assert.match(css, /\.swb \{[^}]*min-height: 44px/, f);
    assert.match(css, /@media \(max-width: 439px\) \{ \.swn \.full \{ display: none; \}/, f);
    for (const k of ["done", "play", "none", "lost"]) assert.ok(css.includes(".st." + k), `${f} has no .st.${k}`);
    assert.match(css, /\.swnew\[hidden\]/, f);
    assert.ok(!/\.gamerow|\.gflame/.test(css), `${f}: the old rows are gone`);
  }
  const clamp = (f) => (/^h1 \{[^}]*clamp\(([^)]*)\)/m.exec(read(f)) || [])[1];
  assert.equal(clamp("mystery/styles.css"), clamp("lineup/styles.css"), "the two titles are sized the same, so the switcher does not jump between games");
});

test("the ? panels do not spell out the icons (the switcher is plain), and every game counts a tap on the switcher", () => {
  for (const f of ["index.html", "mystery/index.html", "lineup/index.html"]) assert.ok(!read(f).includes("swhelp") && !read(f).includes("The boxes under the title"), f);
  for (const f of ["src/main.js", "mystery/main.js", "lineup/main.js"]) assert.match(read(f), /wireSwitcher\(\)/, f);
});

test("the switcher icons cannot be resized by another style: no padding, and Mystery Thing's no-matches style has its own name", () => {
  for (const f of ["styles.css", "mystery/styles.css", "lineup/styles.css"]) {
    assert.match(read(f), /\.st \{[^}]*width: 15px; height: 15px; padding: 0;/, f);
    assert.ok(!/^\.(none|done|play|lost)\s*\{/m.test(read(f)), `${f} has a plain .none/.done/.play/.lost style that would hit the icons`);
  }
  assert.ok(read("mystery/styles.css").includes(".nomatch {") && read("mystery/ui.js").includes('<li class="nomatch">'));
});

test("the testing controls are hidden unless the address ends in #debug", () => {
  assert.match(html, /id="tools"[^>]*\bhidden\b/);
  assert.ok(/if \(\/debug\//.test(ui) && ui.indexOf("globalThis.__lu") > ui.indexOf("/debug/"), "the hooks must be inside the #debug check");
});

test("the words players see", () => {
  assert.ok(html.includes(">Check order<"));
  for (const w of ["Move something first", "They are locked now", "Share result", "Copy result", "Not this time", "Clean sweep!", "Next puzzle in ", "Practice puzzles do not count", "best score", "How scoring works", "points", "Things in the right place", "Clean sweep bonus", "day streak", "solved in a row", "best streak"]) assert.ok(ui.includes(w), w);
  assert.ok(!/Play another/.test(ui), "a daily puzzle has no Play another");
  assert.match(ui, /nextButtonsHTML\(storage, "lu", "\.\.\/"\)/, "two buttons, one for each of the other games");
});

test("the counts: started at the first check, solved, finished, clean sweep, a streak milestone, each only for today's puzzle", () => {
  for (const name of ["lineup-started", "lineup-solved", "lineup-finished", "lineup-clean-sweep"]) assert.ok(ui.includes(`countEvent("${name}")`), name);
  assert.match(ui, /countEvent\("lineup-streak-" \+ st\.t\.n\)/);
  assert.match(ui, /if \(puzzle\.daily && isToday\(\) && tries\.length === 1\) countEvent\("lineup-started"\)/);
  assert.match(ui, /if \(over\(\) && puzzle\.daily && isToday\(\)\)/);
});

test("no long dashes in anything players read, and no streak or flame can get into the shared text", () => {
  for (const f of ["lineup/index.html", "lineup/ui.js", "lineup/logic.js", "lineup/data.js", "lineup/main.js", "src/games.js"]) assert.ok(!/[\u2014\u2013]/.test(read(f)), `${f} has a long dash`);
  assert.ok(!/streak|\uD83D\uDD25/i.test(read("lineup/logic.js").slice(read("lineup/logic.js").indexOf("export function shareText"), read("lineup/logic.js").indexOf("export function countdownText"))));
});

test("the site is deployed with the lineup folder, and the weekly job freezes Line Up's days too", () => {
  assert.match(read(".github/workflows/pages.yml"), /cp -r [^\n]*\blineup\b[^\n]* _site\//);
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["generate:ahead"], /lineup-days\.mjs/);
  assert.match(pkg.scripts["lint:data"], /lint-lineup\.mjs/);
  assert.match(read("scripts/build.mjs"), /dist\/lineup\/index\.html/);
});

test("a first-try win is a clean sweep: lots of brooms and sparkles, and the way to move things works from anywhere on a card with a mouse", () => {
  assert.match(ui, /for \(let i = 0; i < 44; i\+\+\)/, "plenty of them");
  assert.ok(ui.includes('"\\uD83E\\uDDF9"') && ui.includes("\\u2728"), "brooms and sparkles");
  assert.ok(!ui.includes("Perfect!") && !ui.includes("lineup-perfect"));
  assert.match(ui, /e\.pointerType === "mouse" && e\.button === 0\) attachDrag\(li, e, 6\)/, "a mouse drags from anywhere, after moving a few pixels");
  assert.match(ui, /attachDrag\(li, e, 0\)/, "the dots lift at once");
  assert.match(read("lineup/styles.css"), /@media \(hover: hover\) and \(pointer: fine\) \{ \.card:not\(\.locked\) \{ cursor: grab;/);
});

test("the page says six things everywhere it says how many", () => {
  assert.ok(html.includes("Put the six things in order") && html.includes("Put six things in order"));
  assert.ok(!/\bfive things\b|\bPut five\b/i.test(html + ui + read("lineup/logic.js") + read("lineup/data.js")), "no leftover five");
});
