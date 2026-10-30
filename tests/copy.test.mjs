// The shared copy routine: the browser's clipboard first, the older copy command second, and an honest false if neither works.
import test from "node:test";
import assert from "node:assert/strict";
import { copyText } from "../src/games.js";

function fakeDoc({ exec, execThrows, body = true, createThrows } = {}) {
  const made = [], active = { refocused: 0, focus() { this.refocused++; } };
  const bodyEl = { children: [], appendChild(el) { this.children.push(el); }, removeChild(el) { this.children = this.children.filter((x) => x !== el); } };
  return {
    made, active, bodyEl, body: body ? bodyEl : null, activeElement: active,
    createElement: () => {
      if (createThrows) throw new Error("no");
      const el = { style: {}, attrs: {}, value: "", selected: false, setAttribute(k, v) { this.attrs[k] = v; }, focus() {}, select() { this.selected = true; }, setSelectionRange() {} };
      made.push(el); return el;
    },
    execCommand: exec === undefined ? undefined : () => { if (execThrows) throw new Error("no"); return exec; },
  };
}

test("the browser's own clipboard is used first, and nothing else is touched when it works", async () => {
  let got = null; const doc = fakeDoc({ exec: true });
  assert.equal(await copyText("hello", doc, { clipboard: { writeText: async (t) => { got = t; } } }), true);
  assert.equal(got, "hello"); assert.equal(doc.made.length, 0);
});

test("if the clipboard is refused, the older copy command is tried with a hidden box, which is removed again, and focus goes back", async () => {
  const doc = fakeDoc({ exec: true });
  assert.equal(await copyText("hello\nworld", doc, { clipboard: { writeText: () => Promise.reject(new Error("blocked")) } }), true);
  assert.equal(doc.made.length, 1); assert.equal(doc.made[0].value, "hello\nworld"); assert.equal(doc.made[0].selected, true);
  assert.equal(doc.made[0].attrs.readonly, ""); assert.match(doc.made[0].style.cssText, /opacity:0/);
  assert.equal(doc.bodyEl.children.length, 0, "the hidden box is gone");
  assert.ok(doc.active.refocused >= 1, "focus returns to where it was");
});

test("a clipboard that throws at once, or is missing, goes the same way", async () => {
  assert.equal(await copyText("x", fakeDoc({ exec: true }), { clipboard: { writeText: () => { throw new Error("sync"); } } }), true);
  assert.equal(await copyText("x", fakeDoc({ exec: true }), {}), true);
  assert.equal(await copyText("x", fakeDoc({ exec: true }), null), true);
});

test("when neither way works it says false, never throws, and leaves nothing behind", async () => {
  const refuse = { clipboard: { writeText: () => Promise.reject(new Error("blocked")) } };
  let doc = fakeDoc({ exec: false });
  assert.equal(await copyText("x", doc, refuse), false); assert.equal(doc.bodyEl.children.length, 0);
  doc = fakeDoc({ exec: true, execThrows: true });
  assert.equal(await copyText("x", doc, refuse), false); assert.equal(doc.bodyEl.children.length, 0, "the box is removed even when the command throws");
  assert.equal(await copyText("x", fakeDoc({}), refuse), false, "no copy command at all");
  assert.equal(await copyText("x", fakeDoc({ exec: true, body: false }), refuse), false, "no page body");
  assert.equal(await copyText("x", fakeDoc({ exec: true, createThrows: true }), refuse), false);
  assert.equal(await copyText("x", null, null), false);
  assert.equal(await copyText("x", undefined, undefined), false);
});
