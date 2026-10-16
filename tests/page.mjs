// A pretend web page that runs the real built game, so tests can play it. Not a test itself.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { RULES, buildEntities, correctPick, questionsOf } from "../src/engine.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { stdio: "ignore" });
export const pageHtml = readFileSync(join(root, "dist/index.html"), "utf8");
export const entities = buildEntities(JSON.parse(readFileSync(join(root, "data/facts.json"), "utf8")));

/** Opens the game on the launch day (puzzle 1), plus dayOffset days. `store` is the browser's saved data. */
export async function openPage({ store = {}, dayOffset = 0 } = {}) {
  const [y, m, d] = RULES.launchDate.split("-").map(Number);
  const at = Date.UTC(y, m - 1, d + dayOffset, 12);
  const els = {};
  let handler;
  const hiddenInHtml = (id) => new RegExp(`<[^>]*id="${id}"[^>]*\\bhidden\\b`).test(pageHtml);
  const classes = (id) => new Set(((new RegExp(`<[^>]*id="${id}"[^>]*class="([^"]*)"|<[^>]*class="([^"]*)"[^>]*id="${id}"`).exec(pageHtml) || [])[1] || (new RegExp(`<[^>]*class="([^"]*)"[^>]*id="${id}"`).exec(pageHtml) || [])[1] || "").split(" ").filter(Boolean));
  const practiceButtons = [1, 2].map((n) => ({ n, listeners: {}, addEventListener(t, h) { this.listeners[t] = h; } }));
  const el = (id) => {
    if (els[id]) return els[id];
    const cls = classes(id);
    return (els[id] = {
      innerHTML: "", textContent: "", hidden: hiddenInHtml(id), style: {}, attrs: {}, listeners: {},
      classList: { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)), contains: (c) => cls.has(c) },
      setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {}, querySelector: () => ({ focus() {}, style: {} }),
      querySelectorAll: (sel) => (sel === "[data-practice]" ? practiceButtons : []),
      addEventListener(t, h) { this.listeners[t] = h; },
    });
  };
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
    navigator: {},
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(pageHtml.split("<script>").pop().split("</script>")[0], sandbox);
  await new Promise((r) => setTimeout(r, 20));
  const click = (dataset, id) => handler({ target: { closest: () => ({ dataset: dataset || {}, id: id || "" }) } });
  return { els, store, click, card: () => els.card.innerHTML, meta: () => els.meta.textContent };
}

/** The right answer for every question of a puzzle, and where each question starts from. */
export function answersFor(P) {
  const qs = questionsOf(P);
  return { items: qs.map((x) => x.item), starts: qs.map((x) => x.prev), picks: qs.map((x) => correctPick(x.item, x.prev)) };
}

/** Plays the puzzle that is on screen to the result card, answering everything correctly. Returns every screen seen. */
export function playThrough(page, P) {
  const { picks } = answersFor(P);
  const questions = [];
  const reveals = [];
  let q = 0;
  for (let guard = 0; !/class="score"/.test(page.card()) && guard < 80; guard++) {
    if (/data-pick="up"/.test(page.card())) {
      questions.push(page.card());
      page.click({ pick: picks[q++] });
      reveals.push(page.card());
    } else page.click({}, "next");
  }
  return { questions, reveals, done: /class="score"/.test(page.card()) };
}
