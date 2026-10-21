// "Closer in time": a date question that shows the card and two other events, one earlier and one later, and asks which the card is closer to.
import test from "node:test";
import assert from "node:assert/strict";
import { RULES, closerKey, closerRatio, correctPick, generate, generateDaily, generatePractice, generateSeries, objectsOf, pairsOf, questionsOf, validatePuzzle, yearsBetween } from "../src/engine.js";
import { closerDifferenceText, closerQuestion, closerSides, displayName } from "../src/format.js";
import { closerPositions } from "../src/ruler.js";
import { questionRatios, scoreRun, tierFor } from "../src/score.js";
import { answersFor, entities, openPage } from "./page.mjs";

const series = generateSeries(7, 240, entities).filter(Boolean);
const closers = series.flatMap((p) => questionsOf(p).filter((q) => q.item.closer).map((q) => ({ p, q })));

test("closer-in-time questions appear in about one puzzle in three, never as question 1, at most two to a puzzle", () => {
  const withOne = series.filter((p) => questionsOf(p).some((q) => q.item.closer)).length / series.length;
  assert.ok(withOne > 0.25 && withOne < 0.45, `${Math.round(withOne * 100)}% of puzzles have one`);
  for (const p of series) {
    const cl = questionsOf(p).filter((q) => q.item.closer);
    assert.ok(cl.length <= RULES.closerMax, `puzzle ${p.seed}: ${cl.length} closer questions`);
    assert.ok(cl.every((q) => q.q >= 1), "a closer question was question 1");
    assert.ok(cl.every((q) => q.cat === "date" && !q.bridge), "a closer question outside the date category, or a bridge");
  }
});

test("every closer question is fair: opposite sides of the card, the answer nearer, distances 1.15 to 1.5 times apart and 15 years or more apart, both options well known and exact", () => {
  assert.ok(closers.length > 60, `only ${closers.length} to check`);
  for (const { p, q } of closers) {
    const it = q.item;
    const r = it.closer.rival;
    assert.deepEqual(validatePuzzle(p), [], `puzzle ${p.seed}`);
    assert.notEqual(it.value > q.prev.value, r.value > q.prev.value, "both options on the same side of the card");
    const dI = yearsBetween(q.prev.value, it.value);
    const dR = yearsBetween(q.prev.value, r.value);
    assert.equal(dI, it.closer.dItem);
    assert.equal(dR, it.closer.dRival);
    assert.ok(dI < dR, "the answer is not the nearer option");
    assert.ok(dI >= RULES.closerMinYears, `an option only ${dI} years from the card`);
    assert.ok(dR - dI >= RULES.closerMinDiffYears, `the distances differ by only ${dR - dI} years: ${it.label} and ${r.label}`);
    assert.ok(dR / dI >= RULES.closerMinRatio && dR / dI <= RULES.closerMaxRatio, `the distances are ${(dR / dI).toFixed(2)} times apart`);
    assert.ok(it.fame >= 2 && r.fame >= 2, "an obscure option");
    assert.ok(!it.approx, "an approximate date as the answer");
    assert.equal(it.closer.itemOn, it.value > q.prev.value ? "up" : "down");
  }
});

test("the game's existing answer check works for a closer question: the right button is the side the nearer event is on", () => {
  for (const { q } of closers) {
    const right = correctPick(q.item, q.prev);
    assert.equal(right, q.item.value > q.prev.value ? "up" : "down");
    assert.equal(right === "up" ? closerSides(q.item).right : closerSides(q.item).left, q.item, "the answer is on the wrong button");
    assert.ok(closerSides(q.item).left.value < closerSides(q.item).right.value, "the earlier event must be on the left");
  }
});

test("a closer question is scored by its distance ratio: nearly all are Close calls worth double (only a ratio of exactly 1.5 is Medium)", () => {
  let close = 0;
  for (const { p, q } of closers) {
    const ratios = questionRatios(p);
    assert.equal(ratios[q.q], closerRatio(q.item));
    if (tierFor(ratios[q.q]).key === "close") close++;
  }
  assert.ok(close / closers.length > 0.8, `${close} of ${closers.length} are Close calls`);
  const { p, q } = closers[0];
  const ratios = questionRatios(p);
  const sc = scoreRun(ratios.slice(0, q.q + 1), Array(q.q + 1).fill(true), []);
  assert.equal(sc.detail[q.q].difficulty, tierFor(ratios[q.q]).mult);
});

test("the other option counts as shown: it is among the puzzle's objects, and no object or family appears twice", () => {
  for (const { p, q } of closers.slice(0, 80)) {
    assert.ok(objectsOf(p).has(q.item.closer.rival.ent), "the other option is not among the puzzle's objects");
    const fams = [p.legs[0].anchor, ...questionsOf(p).map((x) => x.item), ...questionsOf(p).filter((x) => x.item.closer).map((x) => x.item.closer.rival)].map((x) => x.family);
    assert.equal(new Set(fams).size, fams.length, `puzzle ${p.seed} repeats an object`);
  }
});

test("a closer question is remembered and not asked again, whichever way round its options are", () => {
  const { p, q } = closers[0];
  const key = closerKey(q.prev, q.item, q.item.closer.rival);
  assert.ok(key.startsWith("closer:"));
  assert.equal(key, closerKey(q.prev, q.item.closer.rival, q.item), "the key must not depend on the order of the options");
  assert.ok(pairsOf(p).includes(key), "pairsOf does not list it");
  for (let seed = p.seed; seed < p.seed + 25; seed++) {
    const again = generate(seed, entities, { pairs: [pairsOf(p)] });
    if (!again) continue;
    for (const x of questionsOf(again).filter((y) => y.item.closer)) assert.notEqual(closerKey(x.prev, x.item, x.item.closer.rival), key, `seed ${seed} asked the same question again`);
  }
});

test("the validator rejects a closer question that breaks a rule", () => {
  const { p, q } = closers.find((x) => x.q.item.closer.dRival / x.q.item.closer.dItem < 1.5 && x.q.item.fame >= 2);
  const mutate = (fn) => {
    const c = JSON.parse(JSON.stringify(p));
    const it = questionsOf(c)[q.q].item;
    fn(it, questionsOf(c)[q.q].prev);
    return validatePuzzle(c);
  };
  assert.deepEqual(validatePuzzle(p), []);
  assert.ok(mutate((it, prev) => (it.closer.rival.value = prev.value + (it.value > prev.value ? 1 : 1) * Math.abs(it.value - prev.value))).length > 0, "same side of the card");
  assert.ok(mutate((it) => (it.closer.rival.value = it.value + (it.closer.itemOn === "up" ? -1 : 1) * 5000)).length > 0, "far too far apart");
  assert.ok(mutate((it) => (it.closer.dRival = it.closer.dItem)).length > 0, "stored distances that do not match");
  assert.ok(mutate((it) => (it.closer.itemOn = it.closer.itemOn === "up" ? "down" : "up")).length > 0, "answer on the wrong side");
  assert.ok(mutate((it) => (it.closer.rival.fame = 1)).length > 0, "an obscure option");
  assert.ok(mutate((it) => { it.closer.dRival = it.closer.dItem + 5; it.closer.rival.value = it.closer.itemOn === "up" ? it.value - 0 : it.value; }).length > 0, "distances that differ by only a few years");
  assert.ok(mutate((it) => (it.closer.rival.status = "guess")).length > 0, "an option with a status we do not allow");
});

test("the practice puzzles never use the new question, so they stay as they were", () => {
  for (const n of [1, 2]) assert.ok(questionsOf(generatePractice(n, entities)).every((x) => !x.item.closer), `practice ${n}`);
});

test("the wording: the card, then the two options in time order, and the reveal gives both distances", () => {
  const item = { phrase: "the sinking of the Titanic", label: "Titanic sinks", value: 1912, closer: { itemOn: "up", dItem: 1941, dRival: 2530, rival: { phrase: "the building of the Great Pyramid", label: "Great Pyramid built", value: -2560 } } };
  const prev = { phrase: "the death of Cleopatra", value: -30 };
  assert.equal(closerQuestion(item, prev), "Is the death of Cleopatra closer in time to the building of the Great Pyramid or the sinking of the Titanic?");
  assert.equal(closerSides(item).left.label, "Great Pyramid built");
  assert.equal(closerSides(item).right.label, "Titanic sinks");
  assert.equal(closerDifferenceText(item, prev), "The sinking of the Titanic is closer: 1,941 years from the death of Cleopatra, against 2,530 for the building of the Great Pyramid.");
});

test("on the ruler the earlier option goes left and the later one right, each by its distance in years, the nearer one nearer the middle", () => {
  const up = closerPositions({ closer: { itemOn: "up", dItem: 50, dRival: 100 } });
  assert.ok(up.item > 50 && up.rival < 50, "the later option goes right, the earlier left");
  assert.ok(Math.abs(up.rival - 12) < 1e-9, "the farther option goes out to 12%");
  assert.ok(Math.abs(up.item - 69) < 1e-9, "the nearer one goes half as far (19 out of 38)");
  const down = closerPositions({ closer: { itemOn: "down", dItem: 50, dRival: 100 } });
  assert.ok(Math.abs(down.item - 31) < 1e-9 && Math.abs(down.rival - 88) < 1e-9, "mirrored");
});

test("a whole game with a closer question plays through the screens: the question, the buttons, the two dots, and the result card", async () => {
  let day = -1;
  for (let n = 1; n <= 150 && day < 0; n++) if (questionsOf(generateDaily(n, entities)).some((x) => x.item.closer)) day = n - 1;
  assert.ok(day >= 0, "no puzzle with a closer question in the first 150 days");
  const page = await openPage({ dayOffset: day });
  const P = generateDaily(day + 1, entities);
  const qs = questionsOf(P);
  const { picks } = answersFor(P);
  let seenAsk = false;
  let seenReveal = false;
  for (let q = 0, guard = 0; !/class="score"/.test(page.card()) && guard < 80; guard++) {
    const html = page.card();
    if (/data-pick="up"/.test(html)) {
      const it = qs[q].item;
      if (it.closer) {
        const s = closerSides(it);
        assert.ok(html.includes(closerQuestion(it, qs[q].prev)), "the question is not the closer-in-time wording");
        assert.ok(html.includes(`data-pick="down">${s.left.label}</button>`) && html.includes(`data-pick="up">${s.right.label}</button>`), "the buttons are not the two events");
        assert.ok(html.includes(`<span class="endcap l">&larr; ${s.left.label}</span>`), "the ruler's end captions are not the two events");
        seenAsk = true;
      } else assert.ok(!html.includes("closer in time"), "an ordinary question worded as closer in time");
      page.click({ pick: picks[q] });
      if (it.closer) {
        const reveal = page.card();
        assert.equal((reveal.match(/class="mark-pt new slide /g) || []).length, 2, "the reveal should slide out two dots");
        assert.ok(/mark-pt new slide far/.test(reveal) && /mark-pt new slide near/.test(reveal), "one dot is the closer one and one is the far one");
        assert.ok(reveal.includes(closerDifferenceText(it, qs[q].prev)), "the reveal does not give both distances");
        seenReveal = true;
      }
      q++;
    } else page.click({}, "next");
  }
  assert.ok(seenAsk && seenReveal);
  const done = page.card();
  const list = /Facts in this puzzle<\/summary><ul>([\s\S]*?)<\/ul>/.exec(done)[1];
  for (const x of qs.filter((y) => y.item.closer)) assert.ok(list.includes(displayName("date", { ...x.item.closer.rival, cat: "date" })), `the result card leaves out ${x.item.closer.rival.label}`);
});
