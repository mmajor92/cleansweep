import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TRANSITION } from "../src/transition.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const css = await readFile(join(root, "styles.css"), "utf8");
// The glide ruler's styles, without the reduced-motion copies at the end.
const region = css.slice(css.indexOf("/* the glide ruler."), css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf("/* the glide ruler.")));
const rule = (selector) => {
  const i = region.indexOf(selector + " {");
  assert.ok(i >= 0, `no rule for ${selector}`);
  return region.slice(i, region.indexOf("}", i));
};
const seconds = (text) => [...text.matchAll(/(\d*\.?\d+)s/g)].map((m) => parseFloat(m[1]));
const EASE = "cubic-bezier(0.2, 0.75, 0.25, 1)";

test("the slide to reveal the answer and the move back to the middle share one speed and one ease", () => {
  const slide = rule(".mark-pt.slide");
  const glide = rule(".mark-pt.glide-in");
  assert.ok(slide.includes(EASE) && glide.includes(EASE), "both should use the same ease");
  assert.equal(seconds(glide)[0], seconds(slide)[0], "the move back should take as long as the slide");
  assert.equal(seconds(slide)[0], 0.85);
});

test("everything moves at once: nothing waits for anything else", () => {
  const slideTime = 0.85;
  const parts = [".mark-pt.leaving", ".mark-pt.glide-in", ".mark-pt.glide-in .tag.rider", ".tag.rider .fig-old", ".tag.rider .fig-new"];
  for (const sel of parts) {
    const r = rule(sel);
    assert.ok(r.includes(EASE), `${sel} should use the shared ease`);
    assert.deepEqual(seconds(r), [slideTime], `${sel} should last ${slideTime}s and start straight away (no delay)`);
  }
});

test("the dot settles to its usual colour just as it arrives", () => {
  const [duration, delay] = seconds(rule(".mark-pt.glide-in .dot"));
  assert.ok(Math.abs(delay + duration - 0.85) < 1e-9, `it should finish at 0.85s but finishes at ${delay + duration}`);
});

test("the figure travels with the dot, and lands where a normal figure above a dot sits, so it can simply stay there", () => {
  const keyframes = /@keyframes riseAbove \{([^}]*)\}/.exec(region)[1];
  assert.match(keyframes, /top: -18px/);
  assert.match(keyframes, /translate\(-50%, -100%\) scale\(1\)/);
  assert.match(css, /\.tag\.above \{ bottom: 18px; \}/, "the normal figure above a dot is 18px above it");
  assert.match(css, /\.tag\.below \{ top: 18px; \}/);
  assert.match(rule(".tag.rider"), /top: 18px/, "it starts 18px below the dot, as a figure under a dot does");
  for (const sel of [".tag.rider", ".tag.rider.at-l", ".tag.rider.at-r"]) assert.match(rule(sel), /scale\(1\)/, sel);
});

test("the top slot has a fixed minimum height, so the big answer and the ruler never move between the verdict and the tier", () => {
  assert.match(rule(".topslot"), /min-height: 58px/);
  assert.match(rule(".hintline"), /min-height: 1\.5em/, "the hint line keeps its space even when empty");
});

test("the cross-fade durations in the code are close to the ruler's, so they finish together", () => {
  assert.ok(Math.abs(TRANSITION.fadeMs / 1000 - 0.33) < 1e-9 && TRANSITION.heightMs <= 350);
  assert.ok(TRANSITION.fadeMs / 1000 < 0.85, "the old screen is gone before the dot arrives");
});

test("nothing overshoots: no easing curve in the styles goes past its target", () => {
  for (const m of css.matchAll(/cubic-bezier\(([^)]*)\)/g)) {
    const [, y1, , y2] = m[1].split(",").map((n) => parseFloat(n));
    assert.ok(y1 <= 1 && y2 <= 1, `${m[0]} would overshoot`);
  }
});
