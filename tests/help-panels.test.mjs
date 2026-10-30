// The "?" panels of all three games, and where a refused copy shows the text. No browser needed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const GAMES = { "Clean Sweep": ["index.html", "styles.css"], "Mystery Thing": ["mystery/index.html", "mystery/styles.css"], "Line Up": ["lineup/index.html", "lineup/styles.css"] };
const helpOf = (file) => /<div class="help" id="help" hidden>([\s\S]*?)<button class="btn[^"]*" id="helpclose"/.exec(read(file))[1];

test("no ? panel has the long 'Want to try one first?' paragraph, but each keeps its two labelled practice buttons and the grey line above them", () => {
  for (const [name, [html, css]] of Object.entries(GAMES)) {
    const help = helpOf(html);
    assert.ok(!/Want to try one first|There are two practice puzzles|you can play them as often as you like/.test(help), `${name} still has the practice paragraph`);
    const box = /<div class="practice" id="practicebox">([\s\S]*?)<\/div>\s*$/.exec(help);
    assert.ok(box, `${name} keeps the practice box`);
    assert.deepEqual([...box[1].matchAll(/data-practice="([12])"[^>]*>([^<]*)</g)].map((m) => m[2]), ["Practice 1", "Practice 2"], name);
    assert.ok(!/<p[ >]/.test(box[1]), `${name}: nothing but the buttons inside the box`);
    assert.match(read(css), /\.practice \{[^}]*border-top: 2px solid var\(--line\)/, `${name}: the grey line above the practice buttons stays`);
  }
});

test("Mystery Thing's ? panel: a white intro, six short numbered steps (one for each thing to know), and a white once-a-day line", () => {
  const help = helpOf("mystery/index.html");
  const intros = [...help.matchAll(/<p class="intro">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(intros, [
    "A mystery thing is hidden in the list. Tap one to guess it, or type to find it.",
    "You get one try a day: your difficulty locks when you make your first guess.",
  ]);
  const steps = [...help.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.deepEqual(steps, [
    "Each guess shows how its numbers compare with the mystery thing\u2019s. An arrow points the way: up means higher or later, down means lower or earlier.",
    "Green means your guess is within double or half. Red is further off.",
    "<b>Easy</b> shrinks the list for you as you guess, removing anything it can\u2019t be.",
    "<b>Medium</b> doesn\u2019t shrink the list, but does show the colours.",
    "<b>Hard</b> does neither.",
    "Use the clues to rule things out. You have six guesses. Closer guesses, and fewer of them, score more.",
  ]);
  assert.ok(!/class="small"/.test(help), "no grey paragraphs: the difficulty lines are steps now");
  assert.ok(!/setting|main measurement|<b>Size<\/b>|<b>Year<\/b>|e\.g\.|Practice puzzles are unlimited|Easy and Medium add/.test(help), "the old wording is gone");
  assert.ok(help.indexOf("You get one try a day") > help.indexOf("</ol>"), "the once-a-day line comes after the steps");
});

test("Line Up's ? panel: no how-to-drag detail, and the kinds of measure and the daily rule in two short lines", () => {
  const help = helpOf("lineup/index.html");
  const steps = [...help.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(steps[0], "Put the six things in order, as it says above them. Tap one thing and then another to swap them, or drag one.");
  assert.ok(!/by its dots|from anywhere on it with a mouse/.test(help));
  const small = [...help.matchAll(/<p class="small">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(small.slice(0, 2), [
    "Each puzzle is one kind of measure: <b>size</b> (a length or a height), <b>weight</b>, <b>speed</b> or <b>year</b>.",
    "How close together the six things are changes from day to day. You get one puzzle a day.",
  ]);
  assert.ok(small[2].startsWith("<b>Points.</b>") && !/Practice puzzles are unlimited/.test(help));
});

test("a refused copy shows the text in a box under the buttons (hidden until needed), in Mystery Thing and Line Up, and never above the board", () => {
  for (const f of ["mystery/ui.js", "lineup/ui.js"]) {
    const ui = read(f);
    assert.ok(ui.includes("'<div class=\"btns\">' + shareButtons() + \"</div>\" + COPYFAIL"), `${f}: the box sits right after the buttons`);
    assert.ok(ui.includes('<div class="copyfail" id="copyfail" hidden>') && ui.includes('<textarea class="copybox" id="copytext" readonly'), `${f}: a real text box, like Clean Sweep's`);
    assert.equal((ui.match(/(?<!function )say\(t\)/g) || []).length, 0, `${f}: share text is never shown through the line above the board`);
    assert.equal((ui.match(/(?<!function )showCopy\(t\)/g) || []).length, 2, `${f}: shown only when copying failed (after a copy, and after a share that failed)`);
    assert.equal((ui.match(/copyText\(t\)/g) || []).length, 2, `${f}: both go through the shared copy routine first`);
    assert.match(ui, /ta\.select\(\)/, `${f}: the text is selected for them`);
  }
  assert.match(read("src/ui.js"), /copyText\(text\)\.then/, "Clean Sweep uses the same routine");
  for (const f of ["mystery/styles.css", "lineup/styles.css"]) assert.match(read(f), /\.copyfail\[hidden\] \{ display: none; \}/, f);
});

test("Clean Sweep's 'Copied' line and its fallback text sit right under the buttons, above the countdown", () => {
  const ui = read("src/ui.js");
  assert.ok(ui.indexOf('<p class="toast" id="toast">') < ui.indexOf('<p class="lockline" id="countdown">'), "the toast comes straight after the buttons");
  assert.match(ui, /insertAdjacentElement\(toast \? "afterend" : "beforeend", ta\)/);
  assert.ok(ui.includes("Select the text below and copy it."));
});
