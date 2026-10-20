// The title "Clean Sweep" stays on one line on every phone.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(fileURLToPath(import.meta.url), "..", "..", "styles.css"), "utf8");

test("the title never wraps, and its size scales with the screen on phones", () => {
  const h1 = /\nh1 \{[^}]*\}/.exec(css)[0];
  assert.match(h1, /white-space: nowrap/, "the title must not wrap");
  assert.match(css, /@media \(max-width: 480px\) \{ h1 \{ font-size: clamp\(22px, 8\.6vw, 34px\); \} \}/, "a fluid size on phones");
});

test("no older fixed title size fights the fluid one", () => {
  const fixedInMedia = [...css.matchAll(/@media[^{]*\{([^@]*?)\n\}/g)].map((m) => m[1]).filter((b) => /\bh1 \{ font-size: \d+px; \}/.test(b));
  assert.deepEqual(fixedInMedia, [], "a media rule still sets the title to a fixed pixel size");
});
