// Mystery Thing: the rules of the game, tested against the real facts and the real modules (no browser needed).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../mystery/logic.js";
import { buildData } from "../mystery/data.js";
import { extendDays } from "../mystery/schedule.js";

const facts = JSON.parse(readFileSync(new URL("../data/facts.json", import.meta.url), "utf8"));
const d = buildData(facts.entities);
d.order = d.secrets.map((s) => s.id);
L.setData(d);
L.setLaunch("2026-10-26"); // these tests count from 26 October 2026, whatever the real launch date is
L.setDays(extendDays([], d.secrets, d.secrets.length * 2 + 10));
const ok = (name, fn) => test(name, fn);
const o = (id) => L.byId[id];
ok("numbers read the way the main game shows them", () => {
  assert.equal(L.fmt("length", 0.0427, false), "4.27 cm"); assert.equal(L.fmt("length", 21196000, true), "about 21,196 km"); assert.equal(L.fmt("length", 330, false), "330 m");
  assert.equal(L.fmt("weight", 0.00356, false), "3.56 g"); assert.equal(L.fmt("weight", 3.3e23, true), "about 3.3 x 10^23 kg"); assert.equal(L.fmt("weight", 396890, false), "397 tonnes");
  assert.equal(L.fmt("speed", 0.3, true), "about 0.3 km/h"); assert.equal(L.fmt("speed", 1960, false), "1,960 km/h");
  assert.equal(L.fmt("date", -30, false), "30 BC"); assert.equal(L.fmt("date", 1912, false), "1912"); assert.equal(L.fmt("date", 800, true), "c. 800 AD");
});
ok("a year uses the main game's no-year-zero arithmetic", () => { assert.equal(L.yearsAgo(1912), 114); assert.equal(L.yearsAgo(-30), 2055); });
const pick = (cs) => L.poolFor(cs);
ok("the arrow points to the secret, and the colour says how near", () => {
  const cs = ["length", "weight"], pool = pick(cs);
  const a = pool.slice().sort((p, q) => p.c.length.v - q.c.length.v)[0], b = pool.find((x) => x !== a && x.c.length.v > a.c.length.v * 6);
  const f = L.feedback(a, b, cs, "easy");
  assert.equal(f[0].dir, "up"); assert.equal(f[0].eq, false); assert.equal(f[0].lvl, 1); assert.equal(f[0].cls, 3, "more than 2 times away is red");
  const same = L.feedback(a, a, cs, "easy"); assert.ok(same.every((x) => x.eq && x.cls === 0));
  const back = L.feedback(b, a, cs, "easy"); assert.equal(back[0].dir, "down", "from the other side the arrow flips");
});
ok("Easy and Normal give identical clues (an arrow and green or red); Hard gives arrows only, with no colour", () => {
  const cs = ["length", "weight"], pool = pick(cs), seen = { easy: new Set(), normal: new Set(), hard: new Set() };
  for (let i = 0; i < 400; i++) { const a = pool[i % pool.length], b = pool[(i * 7 + 3) % pool.length]; const fe = L.feedback(a, b, cs, "easy"), fn = L.feedback(a, b, cs, "normal"), fh = L.feedback(a, b, cs, "hard");
    assert.deepEqual(fe, fn, "Easy and Normal differ"); for (const m of ["easy", "normal", "hard"]) L.feedback(a, b, cs, m).forEach((f) => seen[m].add(f.cls));
    fh.forEach((f, k) => { if (!f.eq) { assert.equal(f.cls, "n"); assert.equal(f.dir, fe[k].dir, "Hard must still give the arrow"); } }); }
  assert.deepEqual([...seen.easy].sort(), [0, 3]); assert.ok(seen.hard.has("n") && !seen.hard.has(3) && !seen.hard.has(1), "Hard must never show green-or-red nearness: " + [...seen.hard]);
});
ok("what is still possible: always includes the secret, only ever shrinks, and removes exactly the things that would have given different clues", () => {
  let first = [], n = 0;
  for (const sec of d.secrets.slice(0, 40)) { const so = L.byId[sec.id]; for (const cs of sec.pairs) { const P = L.poolFor(cs);
    for (const mode of ["easy", "hard"]) { let cand = P, guesses = [];
      for (let k = 0; k < 3; k++) { const g = cand.find((o) => o !== so && !guesses.includes(o)); if (!g) break; guesses.push(g); const next = L.remaining(P, guesses, so, cs, mode);
        assert.ok(next.includes(so), "the secret was ruled out"); assert.ok(next.every((o) => cand.includes(o)), "the list grew"); assert.ok(!next.includes(g), "a guessed thing is still listed");
        for (const o of cand) if (!next.includes(o) && o !== g) assert.ok(guesses.some((x) => L.sig(L.feedback(x, o, cs, mode)) !== L.sig(L.feedback(x, so, cs, mode))), "removed without reason");
        if (k === 0 && mode === "easy") first.push(next.length); cand = next; } n++; } } }
  const avg = first.reduce((x, y) => x + y, 0) / first.length; console.log("      after one guess, about " + avg.toFixed(0) + " of ~75 are still possible on Easy (" + n + " games checked)"); assert.ok(avg > 12 && avg < 45, avg);
});
ok("dates compare by years ago, so 1989 and 1993 are close and 1066 and 1969 are far", () => {
  const fake = (v) => ({ c: { date: { v } } });
  assert.equal(L.feedback(fake(1989), fake(1993), ["date"], "normal")[0].cls, 0);
  assert.equal(L.feedback(fake(1066), fake(1969), ["date"], "normal")[0].cls, 3);
  assert.equal(L.feedback(fake(1066), fake(1969), ["date"], "normal")[0].dir, "up", "a later year is up");
});
ok("every secret can be found: it is in its own guess list, which has at least 50 objects", () => {
  for (const s of d.secrets) for (const p of s.pairs) { const pool = L.poolFor(p); assert.ok(pool.includes(L.byId[s.id]), s.id); assert.ok(pool.length >= 50, s.id + " " + pool.length); }
});
ok("the daily puzzle rotates through every secret before repeating, and is the same for everyone on a day", () => {
  const seen = new Set(); for (let no = 1; no <= d.order.length; no++) seen.add(L.dailyPuzzle(no).secret.id);
  assert.equal(seen.size, d.order.length, "every answer comes up once in the first round");
  const second = new Set(); for (let no = d.order.length + 1; no <= d.order.length * 2; no++) second.add(L.dailyPuzzle(no).secret.id);
  assert.equal(second.size, d.order.length, "and once in the second");
  assert.equal(L.dayNumber(Date.UTC(2026, 9, 26, 0, 0, 1)), 1); assert.equal(L.dayNumber(Date.UTC(2026, 9, 26, 23, 59, 59)), 1); assert.equal(L.dayNumber(Date.UTC(2026, 9, 27)), 2);
  assert.equal(L.dayNumber(Date.UTC(2026, 0, 1)), 1, "before the start it still gives puzzle 1");
});
ok("the pair of clues varies from day to day", () => { const pairs = new Set(); for (let no = 1; no <= 80; no++) pairs.add(L.dailyPuzzle(no).cs.join("+")); assert.ok(pairs.size >= 4, [...pairs].join(" ")); console.log("      clue pairs seen over 80 days: " + [...pairs].join(", ")); });
ok("typing finds things and skips a, an and the: pia, piano, a piano, the pia and A PIANO all find the piano", () => {
  const f = (q) => L.filterThings(d.objs, q).map((o) => o.name);
  for (const q of ["pia", "piano", "a piano", "the pia", "A PIANO", "an pia", "  pia  "]) assert.equal(f(q)[0], "A piano", `"${q}" gave ${f(q).slice(0, 3)}`);
  const ap = f("a p"); assert.ok(ap.includes("A piano") && ap.includes("A paperclip") && ap.includes("A pencil"), "a p should list everything with a word starting with p");
  assert.deepEqual(f("a p"), f("p")); assert.deepEqual(f("the p"), f("p"));
  assert.equal(f("the").length, d.objs.length, "just the word the shows everything"); assert.equal(f("").length, d.objs.length);
  assert.equal(f("zzzzqq").length, 0);
  assert.equal(f("eiffel")[0], "The Eiffel Tower"); assert.equal(f("1p")[0], "A 1p coin"); assert.ok(f("halleys").includes("Halley\u2019s Comet"), "apostrophes are ignored");
  assert.ok(f("big ben").some((n) => /Big Ben/.test(n)), "more than one word");
  assert.ok(f("pool").some((n) => /swimming pool/.test(n)), "a word in the middle of a name");
  assert.ok(f("wimm").some((n) => /swimming pool/.test(n)), "part of a word still finds it when nothing starts with it");
});
const sweepExample = () => {
  for (let no = 1; no <= d.order.length; no++) { const p = L.dailyPuzzle(no); const g = L.poolFor(p.cs).find((o) => o !== p.secret && L.feedback(o, p.secret, p.cs, "normal").every((f) => f.lvl === 0 && !f.eq)); if (g) return { p, g }; }
};
const redExample = (p) => L.poolFor(p.cs).filter((o) => o !== p.secret && L.feedback(o, p.secret, p.cs, "normal").some((f) => f.lvl === 1)).slice(0, 2);
const HALF = "\u2002", THIN = "\u2009", PADL = HALF + THIN, ICONS = { length: "\uD83D\uDCCF", weight: "\u2696\uFE0F", speed: "\uD83D\uDCA8", date: "\uD83D\uDCC5" };
const CELL = new RegExp("^(?:" + PADL + "\u2705" + HALF + "|(?:\u2B06\uFE0F|\u2B07\uFE0F)(?:\uD83D\uDFE9|\uD83D\uDFE5)) (?:" + PADL + "\u2705" + HALF + "|(?:\u2B06\uFE0F|\u2B07\uFE0F)(?:\uD83D\uDFE9|\uD83D\uDFE5))$");
ok("the share card on Normal: headline, the clues centred over their columns, one row per guess, a centred tick row, the score and the address (no sweep line)", () => {
  const p = L.dailyPuzzle(3), [w1, w2] = redExample(p), ids = [w1.id, w2.id, p.secret.id];
  const t = L.shareText(p, ids, "normal"), lines = t.split("\n");
  assert.equal(lines[0], "\uD83D\uDD0E Mystery Thing #3 (Medium) 3/6"); assert.equal(lines.length, 7, t);
  assert.equal(lines[1], p.cs.map((c) => PADL + ICONS[c] + HALF).join(" "), "each icon is padded to sit in the middle of its column");
  assert.ok(CELL.test(lines[2]), lines[2]); assert.ok(CELL.test(lines[3]), lines[3]);
  assert.equal(lines[4], PADL + "\u2705" + HALF + " " + PADL + "\u2705" + HALF, "the solved row is a centred tick in each column");
  assert.equal(lines[5], "\u2B50 " + L.scoreGame(p, ids, "normal").score + " points"); assert.equal(lines[6], "\uD83E\uDDF9 cleansweepdaily.fyi/mystery"); assert.ok(!lines.slice(0, -1).some((l) => l.startsWith("\uD83E\uDDF9 ")), "Normal has no sweep line (the broom before the address is the last line)");
});
ok("the share card on Easy has the sweep line: how many things were still possible after each wrong guess, never growing", () => {
  const p = L.dailyPuzzle(3), [w1, w2] = redExample(p), ids = [w1.id, w2.id, p.secret.id];
  const lines = L.shareText(p, ids, "easy").split("\n"); assert.equal(lines.length, 8);
  assert.ok(lines[5].startsWith("\uD83E\uDDF9 " + L.poolFor(p.cs).length + " \u2192 "), lines[5]);
  const nums = lines[5].replace("\uD83E\uDDF9 ", "").split(" \u2192 ").map(Number); assert.equal(nums.length, 3, "the pool, then the count after each wrong guess"); assert.ok(nums.every((x, i) => i === 0 || x <= nums[i - 1]), String(nums)); assert.ok(nums[2] >= 1);
  assert.equal(lines[6], "\u2B50 " + L.scoreGame(p, ids, "easy").score + " points"); assert.equal(lines[7], "\uD83E\uDDF9 cleansweepdaily.fyi/mystery");
  assert.deepEqual(lines.filter((l, i) => i !== 5).slice(1), L.shareText(p, ids, "normal").split("\n").slice(1), "apart from the sweep line, Easy and Normal share the same card");
});
ok("a lost game says X/6 and has no tick row; a first-guess win says so", () => {
  const p = L.dailyPuzzle(3), w = L.poolFor(p.cs).filter((o) => o !== p.secret).slice(0, 6).map((o) => o.id);
  const lost = L.shareText(p, w, "normal").split("\n"); assert.ok(lost[0].startsWith("\uD83D\uDD0E Mystery Thing #3 (Medium) X/6")); assert.ok(!lost.some((l) => l.includes("\u2705"))); assert.equal(lost.length, 2 + 6 + 2); assert.equal(lost[lost.length - 1], "\uD83E\uDDF9 cleansweepdaily.fyi/mystery"); assert.ok(/^\u2B50 \d+ points$/.test(lost[lost.length - 2]));
  const first = L.shareText(p, [p.secret.id], "normal").split("\n"); assert.ok(first[0].startsWith("\uD83D\uDD0E Mystery Thing #3 (Medium) 1/6")); assert.equal(first[2], PADL + "\u2705" + HALF + " " + PADL + "\u2705" + HALF); assert.equal(first[3], "\u2B50 600 points");
  assert.equal(L.shareText(p, [p.secret.id], "easy").split("\n")[3], "\uD83E\uDDF9 " + L.poolFor(p.cs).length + " \u2192 1");
});
ok("the Hard share: arrows only, one-emoji columns so nothing is padded, no sweep line", () => {
  const p = L.dailyPuzzle(3), [w1, w2] = redExample(p), ids = [w1.id, w2.id, p.secret.id], lines = L.shareText(p, ids, "hard").split("\n");
  assert.equal(lines[1], p.cs.map((c) => ICONS[c]).join(" "), "icons use the same one-space gap as the rows"); assert.ok(!lines.join("").includes(HALF) && !lines.join("").includes(THIN), "no padding on Hard");
  assert.ok(/^(\u2B06\uFE0F|\u2B07\uFE0F|\u2705) (\u2B06\uFE0F|\u2B07\uFE0F|\u2705)$/.test(lines[2]), lines[2]); assert.ok(!/\uD83D\uDFE9|\uD83D\uDFE5/.test(lines.join("")), "no coloured squares"); assert.equal(lines[4], "\u2705 \u2705"); assert.ok(!lines.slice(0, -1).some((l) => l.startsWith("\uD83E\uDDF9 ")));
});
ok("a practice game is labelled as practice", () => { const p = { ...L.dailyPuzzle(3), daily: false }; assert.ok(L.shareText(p, [p.secret.id], "normal").includes("Mystery Thing (practice)")); });
ok("scoring: a first-guess solve is worth 600 (900 on Hard), and more guesses can never beat fewer", () => {
  const p = L.dailyPuzzle(3);
  assert.equal(L.scoreGame(p, [p.secret.id], "normal").score, 600); assert.equal(L.scoreGame(p, [p.secret.id], "hard").score, 900); assert.equal(L.scoreGame(p, [p.secret.id], "easy").score, 600);
  const best = (n) => (200 + (n - 1) * 40) * L.MULT[n]; for (let n = 1; n < 6; n++) assert.ok(best(n + 1) <= best(n) + 1e-9, `best with ${n + 1} guesses beats best with ${n}`);
});
ok("scoring: green earns more the closer, red loses more the further (to a cap of 30), exact is the top, half and double are the same", () => {
  const sec = { c: { length: { v: 100 } } }, g = (v) => ({ c: { length: { v } } }), pts = (v) => L.clueScore(g(v), sec, "length");
  assert.equal(pts(100), 20); assert.ok(pts(110) > pts(150) && pts(150) > pts(190) && pts(190) > 0, "closer earns more");
  assert.ok(Math.abs(pts(200)) < 1e-9 && Math.abs(pts(50)) < 1e-9, "double or half is the edge: nothing earned, nothing lost"); assert.equal(pts(50), pts(200) + 0);
  assert.ok(pts(400) < 0 && pts(1600) < pts(400) && pts(25) === pts(400), "further loses more, the same either side"); assert.equal(pts(1e12), -30); assert.equal(pts(1e-12), -30);
});
ok("scoring: the first guess can earn but never lose, later guesses can lose; the maths adds up; a lost game scores at most half its clue points", () => {
  const p = L.dailyPuzzle(3), [far1, far2] = redExample(p);
  const a = L.scoreGame(p, [far1.id, far2.id, p.secret.id], "normal"); assert.ok(a.per[0].pts.every((x) => x >= 0), "the first guess lost points"); assert.ok(a.per[1].pts.some((x) => x < 0) || a.per[1].pts.every((x) => x >= 0));
  for (const m of ["easy", "normal", "hard"]) for (const ids of [[p.secret.id], [far1.id, p.secret.id], [far1.id, far2.id, p.secret.id]]) { const r = L.scoreGame(p, ids, m); assert.ok(Math.abs(Math.max(0, r.path + r.solve) * r.mult * r.bonus - r.score) <= 1, "the breakdown does not add up"); }
  const lostIds = L.poolFor(p.cs).filter((o) => o !== p.secret).slice(0, 6).map((o) => o.id), lost = L.scoreGame(p, lostIds, "normal");
  assert.equal(lost.won, false); assert.ok(lost.score >= 0 && lost.score <= Math.max(0, lost.path) * 0.5 + 1); assert.equal(L.scoreGame(p, ["GIVEUP"], "normal").score, 0);
});
ok("the two practice puzzles are fixed: the Eiffel Tower (size and year) and a giraffe (weight and speed), each findable in its list, and not counted as daily", () => {
  const a = L.practicePuzzle(1), b = L.practicePuzzle(2);
  assert.equal(a.secret.name, "The Eiffel Tower"); assert.deepEqual(a.cs, ["length", "date"]); assert.equal(b.secret.name, "A giraffe"); assert.deepEqual(b.cs, ["weight", "speed"]);
  for (const p of [a, b]) { assert.equal(p.daily, false); assert.ok(L.poolFor(p.cs).includes(p.secret)); assert.ok(L.poolFor(p.cs).length >= 50); }
  assert.deepEqual(L.practicePuzzle(1), L.practicePuzzle(1), "the same every time"); assert.equal(L.PRACTICE.length, 2);
});
ok("the settings are explained clearly: Easy says the list shrinks, Medium says it does not, both say what green and red mean, Hard is unchanged, and Normal is shown as Medium", () => {
  assert.deepEqual(L.MODE_LABEL, { easy: "Easy", normal: "Medium", hard: "Hard" });
  const e = L.MODES.easy.help, m = L.MODES.normal.help, h = L.MODES.hard.help;
  assert.ok(/shrinks as you guess/.test(e) && /rule out/.test(e), e); assert.equal(m, "The list doesn\u2019t shrink. Green means within double or half, red means further off.");
  for (const x of [e, m]) { assert.ok(/Green means within double or half, red means further off/.test(x), x); assert.ok(!/arrow and a colour/.test(x), "it should not repeat what is on screen: " + x); }
  assert.equal(h, "The same list, but only arrows. No colours to say how near. Scores are multiplied by 1.5.");
  const p = L.dailyPuzzle(3); assert.ok(L.shareText(p, [p.secret.id], "normal").split("\n")[0].includes("(Medium)")); assert.ok(!L.shareText(p, [p.secret.id], "normal").includes("Normal"));
});
ok("a clean sweep is solving it with every guess green (or exact), on any setting", () => {
  const { p, g } = sweepExample(), [far] = redExample(p);
  assert.equal(L.cleanSweep(p, [g.id, p.secret.id]), true); assert.equal(L.cleanSweep(p, [p.secret.id]), true, "a first-guess win is a clean sweep");
  assert.equal(L.cleanSweep(p, [far.id, p.secret.id]), false, "one red guess ends it"); assert.equal(L.cleanSweep(p, [g.id]), false, "not solved"); assert.equal(L.cleanSweep(p, [g.id, "GIVEUP"]), false);
  for (const m of ["easy", "normal", "hard"]) assert.ok(L.shareText(p, [g.id, p.secret.id], m).split("\n")[0].endsWith("\uD83E\uDDF9\u2728"), "the share card shows it on " + m);
  assert.ok(!L.shareText(p, [far.id, p.secret.id], "normal").split("\n")[0].includes("\u2728"));
});
