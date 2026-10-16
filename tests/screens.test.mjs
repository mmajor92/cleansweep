// Plays whole games in a pretend page and checks what every screen contains, so a missing piece of a screen is caught.
// It plays puzzles with one, two and four switches of category, so the moments where the chain changes category are covered too.
import test from "node:test";
import assert from "node:assert/strict";
import { generateDaily, questionsOf } from "../src/engine.js";
import { displayName, figureText, valueText } from "../src/format.js";
import { answersFor, entities, openPage } from "./page.mjs";

/** The first day (as an offset from launch day) whose puzzle has each wanted number of switches. */
function pickDays(wanted) {
  const found = {};
  for (let n = 1; n <= 150 && wanted.some((w) => !(w in found)); n++) {
    const switches = generateDaily(n, entities).bridges.length;
    if (wanted.includes(switches) && !(switches in found)) found[switches] = n - 1;
  }
  return wanted.map((w) => {
    assert.ok(w in found, `no puzzle with ${w} switches in the first 150 days`);
    return found[w];
  });
}

async function playOneGame(dayOffset) {
  const page = await openPage({ dayOffset });
  const P = generateDaily(dayOffset + 1, entities);
  const qs = questionsOf(P);
  const { picks, starts } = answersFor(P);
  const questions = [];
  const reveals = [];
  let q = 0;
  for (let guard = 0; !/class="score"/.test(page.card()) && guard < 80; guard++) {
    const html = page.card();
    if (/data-pick="up"/.test(html)) {
      questions.push({ html, start: starts[q], q });
      page.click({ pick: picks[q] });
      reveals.push(page.card());
      q++;
    } else page.click({}, "next");
  }
  return { P, qs, questions, reveals, done: /class="score"/.test(page.card()), final: page.card(), switches: P.bridges.length };
}

const games = [];
for (const day of pickDays([1, 2, 4])) games.push(await playOneGame(day));
const everyScreen = () => games.flatMap((g) => g.reveals.concat(g.questions.map((x) => x.html)));

test("a whole game can be played to the result screen, whatever the number of switches", () => {
  assert.deepEqual(games.map((g) => g.switches), [1, 2, 4]);
  for (const g of games) {
    assert.ok(g.done, `a puzzle with ${g.switches} switches did not reach the result`);
    assert.equal(g.questions.length, 7);
  }
});

test("every reveal screen has, from the top: the verdict slot, the big answer, the ruler, the points note, the explanation and the button", () => {
  for (const g of games) {
    for (const [i, html] of g.reveals.entries()) {
      const at = (needle) => html.indexOf(needle);
      const order = [at('class="topslot"'), at('class="big"'), at('class="ruler"'), at('class="ptsnote"'), at('class="diff"'), at('id="next"')];
      assert.ok(order.every((n) => n >= 0), `reveal ${i + 1} is missing a piece: ${order}`);
      assert.deepEqual([...order].sort((a, b) => a - b), order, `reveal ${i + 1} is in the wrong order`);
      assert.ok(/class="topslot"><p class="verdict/.test(html), `reveal ${i + 1}: the verdict should be in the top slot`);
    }
  }
});

test("every question screen has, from the top: the tier slot, the big answer, the ruler, the question and the answer buttons, with no caption", () => {
  for (const g of games) {
    for (const { html, q } of g.questions) {
      const at = (needle) => html.indexOf(needle);
      const order = [at('class="topslot"'), at('class="big"'), at('class="ruler"'), at('class="ask"'), at('data-pick="down"')];
      assert.ok(order.every((n) => n >= 0), `question ${q + 1} is missing a piece: ${order}`);
      assert.deepEqual([...order].sort((a, b) => a - b), order, `question ${q + 1} is in the wrong order`);
      assert.ok(/class="topslot"><p class="tierrow/.test(html), `question ${q + 1}: the tier should be in the top slot`);
      assert.ok(!/Starting point|Last answer|\(question \d of 7\)/.test(html), `question ${q + 1} still has a caption`);
    }
  }
});

test("the big answer, the hint line and the ruler are in the same order on the reveal and the question, so nothing at the top moves", () => {
  const spine = (html) => ["topslot", "big", "name", "hintline", "ruler"].map((c) => html.indexOf(`class="${c}`));
  for (const html of everyScreen()) {
    const idx = spine(html);
    assert.ok(idx.every((n) => n >= 0), "a piece of the spine is missing");
    assert.deepEqual([...idx].sort((a, b) => a - b), idx);
    assert.equal((html.match(/class="hintline/g) || []).length, 1, "exactly one hint line, even when it is empty, so its space is always kept");
  }
});

test("the ruler labels show only the figure: the name is in the big answer at the top", () => {
  for (const html of everyScreen()) {
    for (const m of html.matchAll(/class="tag (?:rider|above)[^"]*">(.*?)<\/span>/g)) {
      assert.match(m[1], /^(<b>[^<]+<\/b>|<b class="fig-old">[^<]+<\/b><b class="fig-new">[^<]+<\/b>)$/, `a ruler label has more than the figure: ${m[1]}`);
    }
  }
});

test("a hint shows on the first question of every stretch, and after a reveal it is still there, fading out, so nothing moves", () => {
  for (const g of games) {
    for (const { html, q, start } of g.questions) {
      const isStart = g.qs[q].start;
      const text = (/class="hintline[^"]*">([^<]*)</.exec(html) || [])[1];
      if (isStart) assert.equal(!!text, !!start.hint, `starting question ${q + 1} (${g.switches} switches)`);
      else if (text) {
        assert.ok(/class="hintline ghost"/.test(html), `question ${q + 1}: the hint left over from the reveal should be fading out`);
        assert.ok(start.hint, `question ${q + 1}: a hint with no object hint`);
      }
    }
  }
});

test("after every answer the old dot fades and the answer's dot moves to the middle, and the figure only changes as it goes at a switch", () => {
  for (const g of games) {
    g.questions.forEach(({ html, q }) => {
      const gliding = /mark-pt prev glide-in/.test(html);
      assert.equal(gliding, q !== 0, `question ${q + 1}`);
      if (gliding) {
        assert.ok(/mark-pt leaving/.test(html), "the old starting dot fades out");
        assert.equal((html.match(/class="tag rider/g) || []).length, 1, "exactly one figure travels with the dot");
        assert.equal(/class="fig-old"/.test(html), g.qs[q - 1].bridge, `question ${q + 1} (${g.switches} switches): the figure should change on the way only right after a bridge`);
      }
    });
  }
});

test("at every switch the old dot keeps its figure in the old category while the travelling figure changes from the old category to the new one", () => {
  let switches = 0;
  for (const g of games) {
    for (const { html, q } of g.questions) {
      if (q === 0 || !g.qs[q - 1].bridge) continue;
      switches++;
      const before = g.qs[q - 1]; // the question that carried the chain across
      const after = g.qs[q];
      const leaving = /mark-pt leaving[\s\S]*?<b>([^<]*)<\/b>/.exec(html)[1];
      assert.equal(leaving, figureText(before.cat, before.prev), `question ${q + 1}: the old dot's figure should still be in ${before.cat}`);
      assert.ok(html.includes(`<b class="fig-old">${figureText(before.cat, before.item)}</b>`), `question ${q + 1}: the travelling figure should start in ${before.cat}`);
      assert.ok(html.includes(`<b class="fig-new">${figureText(after.cat, after.prev)}</b>`), `question ${q + 1}: the travelling figure should end in ${after.cat}`);
      assert.notEqual(before.cat, after.cat);
    }
  }
  assert.equal(switches, 1 + 2 + 4, "every switch in the three games was checked");
});

test("the result card lists every object in 'Facts in this puzzle', with the same object listed again in its new category at each switch", () => {
  for (const g of games) {
    const list = /Facts in this puzzle<\/summary><ul>([\s\S]*?)<\/ul>/.exec(g.final)[1];
    const entries = list.split("</li>").filter((x) => x.includes("<li>"));
    const expected = g.P.legs.flatMap((l) => [l.anchor, ...l.items]);
    assert.equal(entries.length, 7 + 1 + g.switches, `${g.switches} switches: the first start, 7 questions and one new start per switch`);
    expected.forEach((f, i) => assert.ok(entries[i].includes(`${displayName(f.cat, f)}: ${valueText(f.cat, f)}`), `entry ${i + 1} should be "${f.label}" in ${f.cat}`));
  }
});

test("the ruler label never says 'about', because the big figure above it does, and a big date has its era", () => {
  for (const html of everyScreen()) {
    for (const m of html.matchAll(/class="tag (?:rider|above)[^"]*">(.*?)<\/span>/g)) {
      assert.ok(!/about|c\. /.test(m[1]), `a ruler label repeats the "about": ${m[1]}`);
    }
  }
  const approx = everyScreen().filter((h) => /class="big">about /.test(h));
  assert.ok(approx.length > 0, "the games should include an approximate figure");
});

test("the line under the big figure is the object's display name: for a date, the question's wording", () => {
  for (const g of games) {
    for (const { html, q } of g.questions) {
      const x = g.qs[q];
      assert.ok(html.includes(`class="name">${displayName(x.cat, x.prev)}<`), `question ${q + 1}`);
    }
  }
});

