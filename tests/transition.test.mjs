import test from "node:test";
import assert from "node:assert/strict";
import { TRANSITION, captureScreen, playTransition } from "../src/transition.js";

// ---- a tiny pretend page, just enough to see what the transition asks the browser to do ----
class El {
  constructor(classes = [], rect = { left: 0, top: 0, width: 10, height: 10 }, html = "") {
    this.cls = new Set(classes);
    this.rect = rect;
    this.outerHTML = html || `<div class="${classes.join(" ")}"></div>`;
    this.kids = [];
    this.style = {};
    this.animations = [];
    this.removed = false;
    this.classList = { contains: (c) => this.cls.has(c) };
  }
  get children() {
    return this.kids;
  }
  add(...kids) {
    kids.forEach((k) => this.kids.push(k));
    return this;
  }
  getBoundingClientRect() {
    return this.rect;
  }
  cloneNode() {
    const c = new El([...this.cls], { ...this.rect }, this.outerHTML);
    return c;
  }
  removeAttribute() {}
  animate(frames, opts) {
    const a = { frames, opts };
    this.animations.push(a);
    return a;
  }
  remove() {
    this.removed = true;
  }
}
const box = (left, top, width, height) => ({ left, top, width, height });
const makeDoc = () => {
  const appended = [];
  return { appended, body: { appendChild: (el) => appended.push(el) } };
};
// A reveal screen and a question screen. They share a ruler. The big answer is either the same or different.
const reveal = () =>
  new El(["card"], box(0, 0, 340, 540)).add(
    new El(["topslot"], box(20, 20, 300, 58), "slot-verdict"),
    new El(["big"], box(20, 80, 300, 50), "BIG-1998"),
    new El(["name"], box(20, 132, 300, 24), "NAME-ISS"),
    new El(["hintline"], box(20, 158, 300, 25), ""),
    new El(["ruler"], box(10, 190, 320, 112)),
    new El(["diff"], box(20, 310, 300, 24)),
    new El(["row"], box(20, 480, 300, 50))
  );
const question = (big = "BIG-1998", name = "NAME-ISS", height = 380) => {
  const card = new El(["card"], box(0, 0, 340, height)).add(
    new El(["topslot"], box(20, 20, 300, 58), "slot-tier"),
    new El(["big"], box(20, 80, 300, 50), big),
    new El(["name"], box(20, 132, 300, 24), name),
    new El(["hintline"], box(20, 158, 300, 25), ""),
    new El(["ruler"], box(10, 190, 320, 112)),
    new El(["ask"], box(20, 310, 300, 60))
  );
  card.style = {};
  return card;
};
const timers = () => {
  const list = [];
  return { list, timer: (fn, ms) => list.push({ fn, ms }) };
};

test("capture takes a copy of everything except the ruler and the hint line, and notes the card's height", () => {
  const cap = captureScreen(reveal());
  assert.equal(cap.height, 540);
  assert.deepEqual(cap.items.map((i) => i.html), ["slot-verdict", "BIG-1998", "NAME-ISS", `<div class="diff"></div>`, `<div class="row"></div>`]);
});

test("capture gives up cleanly if there is nothing to measure", () => {
  assert.equal(captureScreen(null), null);
  assert.equal(captureScreen(new El(["card"], box(0, 0, 340, 0)).add(new El(["x"]))), null);
  assert.equal(captureScreen(new El(["card"], box(0, 0, 340, 400))), null, "an empty card has nothing to fade");
});

test("a reveal followed by the same answer: the top slot, the explanation and the button cross-fade, and the answer stays put", () => {
  const cap = captureScreen(reveal());
  const doc = makeDoc();
  const next = question(); // the same big answer
  const t = timers();
  playTransition(cap, { card: next, doc, timer: t.timer });

  // faded copies: the old top slot, explanation and button, but NOT the big answer or the ruler
  assert.equal(doc.appended.length, 3);
  doc.appended.forEach((g) => {
    assert.equal(g.style.position, "fixed");
    assert.deepEqual(g.animations[0].frames, [{ opacity: 1 }, { opacity: 0 }]);
    assert.equal(g.animations[0].opts.duration, TRANSITION.fadeMs);
  });
  // the new screen fades in, except the ruler and the big answer
  const fading = next.kids.filter((k) => k.animations.length);
  assert.deepEqual(fading.map((k) => [...k.cls][0]).sort(), ["ask", "topslot"]);
  fading.forEach((k) => assert.equal(k.animations[0].opts.duration, TRANSITION.fadeInMs));
  assert.equal(next.kids.find((k) => k.cls.has("ruler")).animations.length, 0, "the ruler is left alone");
});

test("when the big answer changes (a reveal, or the halfway point), the old one fades out and the new one fades in", () => {
  const cap = captureScreen(question("BIG-1998", "NAME-ISS", 380));
  const doc = makeDoc();
  const next = new El(["card"], box(0, 0, 340, 540)).add(
    new El(["topslot"], box(20, 20, 300, 58), "slot-verdict"),
    new El(["big"], box(20, 80, 300, 50), "BIG-1969"),
    new El(["name"], box(20, 132, 300, 24), "NAME-CONCORDE"),
    new El(["ruler"], box(10, 190, 320, 112))
  );
  playTransition(cap, { card: next, doc, timer: () => {} });
  assert.equal(doc.appended.length, 4, "the old top slot, big answer, name and question are all copied");
  assert.ok(next.kids.filter((k) => k.cls.has("big") || k.cls.has("name")).every((k) => k.animations.length === 1), "and the new one fades in");
});

test("the card eases to its new height, clipping only the bottom edge, and everything is tidied up", () => {
  const cap = captureScreen(reveal()); // 540 tall
  const doc = makeDoc();
  const next = question("BIG-1998", "NAME-ISS", 380);
  const t = timers();
  playTransition(cap, { card: next, doc, timer: t.timer });
  assert.deepEqual(next.animations[0].frames, [{ height: "540px" }, { height: "380px" }]);
  assert.equal(next.animations[0].opts.duration, TRANSITION.heightMs);
  assert.equal(next.style.clipPath, "inset(-300px -300px 0 -300px)", "nothing is cut off at the top or the sides");
  // when it finishes, the copies go and the clip is lifted
  next.animations[0].onfinish();
  assert.ok(doc.appended.every((g) => g.removed));
  assert.equal(next.style.clipPath, undefined);
  assert.ok(t.list.length >= 1, "and a timer would tidy up anyway");
});

test("a card of the same height is not animated", () => {
  const cap = captureScreen(question("A", "B", 380));
  const next = question("A", "B", 380);
  playTransition(cap, { card: next, doc: makeDoc(), timer: () => {} });
  assert.equal(next.animations.length, 0);
});

test("if anything fails, nothing is left behind and the new screen is simply shown", () => {
  const cap = captureScreen(reveal());
  const doc = { appended: [], body: { appendChild() { throw new Error("no page"); } } };
  const next = question();
  assert.doesNotThrow(() => playTransition(cap, { card: next, doc, timer: () => {} }));
  assert.equal(next.style.clipPath, undefined);
});
