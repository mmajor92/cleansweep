// Plays a whole game in a pretend page and checks what every screen contains, so a missing piece of a screen is caught.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { RULES, buildEntities, correctPick, generateDaily } from "../src/engine.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { stdio: "ignore" });
const page = readFileSync(join(root, "dist/index.html"), "utf8");
const facts = JSON.parse(readFileSync(join(root, "data/facts.json"), "utf8"));

async function playOneGame() {
  const [y, m, d] = RULES.launchDate.split("-").map(Number);
  const at = Date.UTC(y, m - 1, d, 12);
  const P = generateDaily(1, buildEntities(facts));
  const items = [...P.seg1.items, ...P.seg2.items];
  const starts = [];
  let prev = P.seg1.anchor;
  for (let q = 0; q < 7; q++) {
    starts.push(prev);
    prev = q === P.n1 - 1 ? P.seg2.anchor : items[q];
  }
  const els = {};
  let handler;
  const el = (id) =>
    (els[id] ||= { innerHTML: "", textContent: "", hidden: false, style: {}, setAttribute() {}, appendChild() {}, querySelector: () => ({ focus() {}, style: {} }), addEventListener() {} });
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) {
      if (a.length === 0) super(at);
      else super(...a);
    }
    static now() {
      return at;
    }
  }
  const sandbox = {
    console, Intl, Math, JSON, Date: FakeDate, Object, Array, Set, Map, Number, String, Error, Promise,
    setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, matchMedia: () => ({ matches: false }),
    document: { body: { appendChild() {} }, documentElement: { getAttribute: () => null, setAttribute() {} }, getElementById: el, addEventListener: (t, h) => t === "click" && (handler = h), createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }), execCommand: () => true },
    navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(page.split("<script>").pop().split("</script>")[0], sandbox);
  await new Promise((r) => setTimeout(r, 20));
  const click = (dataset, id) => handler({ target: { closest: () => ({ dataset: dataset || {}, id: id || "" }) } });
  const questions = [];
  const reveals = [];
  let q = 0;
  for (let guard = 0; !/class="score"/.test(els.card.innerHTML) && guard < 80; guard++) {
    const html = els.card.innerHTML;
    if (/data-pick="up"/.test(html)) {
      questions.push({ html, start: starts[q], q });
      click({ pick: correctPick(items[q], starts[q]) });
      reveals.push(els.card.innerHTML);
      q++;
    } else click({}, "next");
  }
  return { P, questions, reveals, done: /class="score"/.test(els.card.innerHTML) };
}

const game = await playOneGame();

test("a whole game can be played to the result screen", () => {
  assert.ok(game.done);
  assert.equal(game.questions.length, 7);
});

test("every reveal screen has, from the top: the verdict slot, the big answer, the ruler, the points note, the explanation and the button", () => {
  for (const [i, html] of game.reveals.entries()) {
    const at = (needle) => html.indexOf(needle);
    const order = [at('class="topslot"'), at('class="big"'), at('class="ruler"'), at('class="ptsnote"'), at('class="diff"'), at('id="next"')];
    assert.ok(order.every((n) => n >= 0), `reveal ${i + 1} is missing a piece: ${order}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order, `reveal ${i + 1} is in the wrong order`);
    assert.ok(/class="topslot"><p class="verdict/.test(html), `reveal ${i + 1}: the verdict should be in the top slot`);
  }
});

test("every question screen has, from the top: the tier slot, the big answer, the ruler, the question and the answer buttons, with no caption", () => {
  for (const { html, q } of game.questions) {
    const at = (needle) => html.indexOf(needle);
    const order = [at('class="topslot"'), at('class="big"'), at('class="ruler"'), at('class="ask"'), at('data-pick="down"')];
    assert.ok(order.every((n) => n >= 0), `question ${q + 1} is missing a piece: ${order}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order, `question ${q + 1} is in the wrong order`);
    assert.ok(/class="topslot"><p class="tierrow/.test(html), `question ${q + 1}: the tier should be in the top slot`);
    assert.ok(!/Starting point|Last answer|\(question \d of 7\)/.test(html), `question ${q + 1} still has a caption`);
  }
});

test("the big answer, the hint line and the ruler are in the same order on the reveal and the question, so nothing at the top moves", () => {
  const spine = (html) => ["topslot", "big", "name", "hintline", "ruler"].map((c) => html.indexOf(`class="${c}`));
  for (const html of game.reveals.concat(game.questions.map((x) => x.html))) {
    const idx = spine(html);
    assert.ok(idx.every((n) => n >= 0), "a piece of the spine is missing");
    assert.deepEqual([...idx].sort((a, b) => a - b), idx);
    assert.equal((html.match(/class="hintline/g) || []).length, 1, "exactly one hint line, even when it is empty, so its space is always kept");
  }
});

test("the ruler labels show only the figure: the name is in the big answer at the top", () => {
  for (const html of game.reveals.concat(game.questions.map((x) => x.html))) {
    for (const m of html.matchAll(/class="tag (?:rider|above)[^"]*">(.*?)<\/span>/g)) {
      assert.match(m[1], /^(<b>[^<]+<\/b>|<b class="fig-old">[^<]+<\/b><b class="fig-new">[^<]+<\/b>)$/, `a ruler label has more than the figure: ${m[1]}`);
    }
  }
});

test("a hint shows on the two starting questions, and after a reveal it is still there, fading out, so nothing moves", () => {
  for (const { html, q, start } of game.questions) {
    const isStart = q === 0 || q === game.P.n1;
    const text = (/class="hintline[^"]*">([^<]*)</.exec(html) || [])[1];
    if (isStart) assert.equal(!!text, !!start.hint, `starting question ${q + 1}`);
    else if (text) {
      assert.ok(/class="hintline ghost"/.test(html), `question ${q + 1}: the hint left over from the reveal should be fading out`);
      assert.ok(start.hint, `question ${q + 1}: a hint with no object hint`);
    }
  }
});

test("after every answer the old dot fades and the answer's dot moves to the middle, even at the halfway point", () => {
  game.questions.forEach(({ html, q }) => {
    const gliding = /mark-pt prev glide-in/.test(html);
    assert.equal(gliding, q !== 0, `question ${q + 1}`);
    if (gliding) {
      assert.ok(/mark-pt leaving/.test(html), "the old starting dot fades out");
      assert.equal((html.match(/class="tag rider/g) || []).length, 1, "exactly one figure travels with the dot");
      assert.equal(/class="fig-old"/.test(html), q === game.P.n1, "only at the halfway point does the figure change as it goes");
    }
  });
});

test("at the halfway point the old dot shows its figure in the old category, not the new one", () => {
  const half = game.questions.find((x) => x.q === game.P.n1).html;
  const oldFig = /mark-pt leaving[\s\S]*?<b>([^<]*)<\/b>/.exec(half)[1];
  const unit = /fig-new">[^<]*?(kg|tonnes?|km\/h| m)/.exec(half);
  assert.ok(unit, "the new figure should have its new category's unit");
  assert.ok(!/kg|tonnes?|km\/h/.test(oldFig), `the old dot's figure "${oldFig}" should not be written in the new category`);
});
