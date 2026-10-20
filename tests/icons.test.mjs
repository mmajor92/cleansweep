// The logo: the browser-tab icons, the home-screen icons, the picture shown when the link is shared, and the broom in the page header.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "styles.css"), "utf8");
const svg = readFileSync(join(root, "src", "icons", "icon.svg"), "utf8").trim();
const small = readFileSync(join(root, "src", "icons", "icon-small.svg"), "utf8").trim();
const pages = readFileSync(join(root, ".github", "workflows", "pages.yml"), "utf8");

const pngSize = (file) => {
  const b = readFileSync(join(root, file));
  assert.equal(b.subarray(1, 4).toString(), "PNG", `${file} is not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const tag = (name, key) => (new RegExp(`<meta ${name}="${key}" content="([^"]*)"`).exec(html) || [])[1];

test("every icon the page points to exists, and the ones that are pictures have the right size", () => {
  const links = [...html.matchAll(/<link rel="(icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[2]);
  assert.ok(links.length >= 3, "an SVG icon, a PNG icon and an Apple icon");
  assert.ok(links.includes("src/icons/icon-small.svg"), "the browser tab uses the simple silhouette, which stays clear at 16 and 32 pixels");
  for (const href of links) assert.ok(existsSync(join(root, href)), `${href} is missing`);
  assert.deepEqual(pngSize("src/icons/icon-32.png"), [32, 32]);
  assert.deepEqual(pngSize("src/icons/icon-192.png"), [192, 192]);
  assert.deepEqual(pngSize("src/icons/icon-512.png"), [512, 512]);
  assert.deepEqual(pngSize("src/icons/apple-touch-icon.png"), [180, 180]);
});

test("the icons live under src, which the deploy already copies, so they really go live", () => {
  const hrefs = [...html.matchAll(/(?:<link rel="(?:icon|apple-touch-icon)" href|property="og:image" content)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 4, "the three icon links and the share picture");
  for (const h of hrefs.filter((x) => !x.startsWith("https://"))) assert.ok(h.startsWith("src/icons/"), `${h} would not be deployed`);
  assert.match(pages, /cp -r src data _site\//, "the deploy copies the src folder");
});

test("the link-preview picture: a 1200 by 630 image with an absolute address, so messaging apps can show it", () => {
  assert.deepEqual(pngSize("src/icons/social-preview.png"), [1200, 630]);
  const image = tag("property", "og:image");
  assert.match(image, /^https:\/\/mmajor92\.github\.io\/cleansweep\/src\/icons\/social-preview\.png$/);
  assert.ok(existsSync(join(root, image.replace("https://mmajor92.github.io/cleansweep/", ""))), "the file behind the address exists");
  assert.equal(tag("property", "og:title"), "Clean Sweep");
  assert.equal(tag("property", "og:description"), tag("name", "description"), "the share text matches the page description");
  assert.equal(tag("property", "og:url"), "https://mmajor92.github.io/cleansweep/");
  assert.equal(tag("name", "twitter:card"), "summary_large_image");
});

test("the broom in the page header is the same drawing as the icon, and is hidden from screen readers (the title says it all)", () => {
  const header = /<h1>(<svg[\s\S]*?<\/svg>)Clean Sweep<\/h1>/.exec(html);
  assert.ok(header, "the header has the broom before the title");
  assert.match(header[1], /aria-hidden="true"/);
  const plain = (s) => s.replace(/ class="logo" aria-hidden="true" focusable="false"/, "").replace(/ role="img" aria-label="Clean Sweep: a broom"/, "");
  assert.equal(plain(header[1]), plain(svg), "regenerate with scripts/make-icons.py and paste the new drawing into index.html");
  assert.match(css, /\.logo \{ width: 0\.95em; height: 0\.95em;/);
});

test("the logo uses the game's own colours, so a change to the palette is noticed", () => {
  const tape = /--tape: (#[0-9A-Fa-f]{6})/.exec(css)[1].toUpperCase();
  const ink = /--ink: (#[0-9A-Fa-f]{6})/.exec(css)[1].toUpperCase();
  assert.ok(svg.toUpperCase().includes(tape), `the logo background should be ${tape}`);
  assert.ok(svg.toUpperCase().includes(ink), `the broom should be ${ink}`);
});

test("the images stay small: what a browser fetches on every visit is tiny, and the bigger ones are only fetched when needed", () => {
  const size = (f) => statSync(join(root, "src", "icons", f)).size;
  assert.ok(size("icon-32.png") < 5_000, "the tab icon is fetched by some browsers on every visit");
  assert.ok(small.length < 4_000, "so is the tab SVG");
  for (const f of ["icon-192.png", "apple-touch-icon.png"]) assert.ok(size(f) < 40_000, f);
  assert.ok(size("icon-512.png") < 100_000, "only fetched when someone installs the game to their home screen");
  assert.ok(size("social-preview.png") < 200_000, "only fetched by a messaging app when the link is shared");
  assert.ok(svg.length < 9000, `the inline broom is ${svg.length} bytes: keep it small, it is in every page load`);
  assert.ok(small.length < svg.length / 2, "the tab version is much simpler than the full drawing");
});
