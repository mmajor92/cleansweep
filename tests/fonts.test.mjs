import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const FONTS = ["bricolage-grotesque.woff", "newsreader.woff", "newsreader-italic.woff"];

test("the three font files exist, are real WOFF files, and are small", async () => {
  for (const name of FONTS) {
    const buf = await readFile(join(root, "src/fonts", name));
    assert.equal(buf.subarray(0, 4).toString("latin1"), "wOFF", `${name} is not a WOFF file`);
    assert.ok(buf.length < 250 * 1024, `${name} is ${Math.round(buf.length / 1024)} KB, which is too big`);
  }
});

test("the page never loads fonts from Google", async () => {
  for (const file of ["index.html", "styles.css"]) {
    const text = await readFile(join(root, file), "utf8");
    assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(text), `${file} still points at Google Fonts`);
  }
});

test("the CSS declares both fonts and points at files that exist", async () => {
  const css = await readFile(join(root, "styles.css"), "utf8");
  for (const family of ["Bricolage Grotesque", "Newsreader"]) {
    assert.ok(new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*"${family}"`).test(css), `no @font-face for ${family}`);
  }
  const urls = [...css.matchAll(/url\("(src\/fonts\/[^"]+)"\)/g)].map((m) => m[1]);
  assert.equal(urls.length, FONTS.length);
  for (const u of urls) await stat(join(root, u)); // throws if a file is missing
});

test("the fonts' licence and the project licence are in the repository", async () => {
  const ofl = await readFile(join(root, "src/fonts/OFL.txt"), "utf8");
  assert.ok(/Bricolage Grotesque/.test(ofl) && /Newsreader/.test(ofl) && /SIL OPEN FONT LICENSE/.test(ofl));
  const licence = await readFile(join(root, "LICENSE"), "utf8");
  assert.ok(/Copyright \(c\) 2026 Michael Major/.test(licence));
});
