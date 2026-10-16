import test from "node:test";
import assert from "node:assert/strict";
import { slideAt } from "../src/ruler.js";

test("a bigger value lands to the right of the middle, a smaller one to the left", () => {
  assert.ok(slideAt("weight", 617, 1000) > 50);
  assert.ok(slideAt("weight", 617, 274) < 50);
  assert.ok(slideAt("date", 1969, 1994) > 50); // later is to the right
  assert.ok(slideAt("date", 1969, 1912) < 50); // earlier is to the left
});

test("the closer the two values, the closer the dot stays to the middle", () => {
  const close = Math.abs(slideAt("length", 100, 115) - 50);
  const medium = Math.abs(slideAt("length", 100, 200) - 50);
  const wide = Math.abs(slideAt("length", 100, 400) - 50);
  assert.ok(close < medium && medium < wide, `${close} ${medium} ${wide}`);
  assert.ok(Math.abs(wide - 44) < 0.01, "a gap of 3x or more reaches the far end");
});

test("even a close call moves clearly, and nothing goes past the ends of the tape", () => {
  assert.ok(Math.abs(slideAt("weight", 100, 115) - 50) >= 10, "a 1.15x gap should move at least 10 points");
  for (const r of [1.15, 1.5, 2.2, 3, 4, 50, 1e5]) {
    for (const to of [100 * r, 100 / r]) {
      const at = slideAt("speed", 100, to);
      assert.ok(at >= 6 - 1e-9 && at <= 94 + 1e-9, `${r}: ${at}`);
    }
  }
});

test("the distance follows the Close call, Medium and Easy tags", () => {
  const dist = (r) => Math.abs(slideAt("length", 100, 100 * r) - 50);
  assert.ok(dist(1.49) < dist(1.51), "just under Medium is shorter than just over");
  assert.ok(dist(1.49) < dist(2.19) && dist(2.19) < dist(2.21) + 1e-9);
  assert.ok(dist(2.2) > 30, "an Easy gap goes most of the way out");
});

test("a far-away answer (a warm-up) is held at the end of the range, and the move is symmetrical", () => {
  assert.equal(slideAt("count", 86400, 8), 6); // far smaller: held at the left end
  assert.equal(slideAt("count", 8, 86400), 94); // far bigger: held at the right end
  assert.ok(Math.abs(slideAt("speed", 10, 20) - 50 - (50 - slideAt("speed", 20, 10))) < 1e-9);
  assert.equal(slideAt("weight", 5, 5), 50);
});

test("it depends only on the two values, never on anything still to come", () => {
  assert.equal(slideAt("weight", 617, 274), slideAt("weight", 617, 274));
});
