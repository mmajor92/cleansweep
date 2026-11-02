import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { VERSION } from "../src/version.js";

// v1.1 to v1.9, then v2, v2.1 and so on, then v3 ... v3.19. From v4 the rule is: v4.0, v4.1 ... v4.19, then v5.0 (and so on).
const LABEL = /^v[1-9][0-9]*(\.([0-9]|1[0-9]))?$/;

test("the version label is valid: after the dot it is 0 to 19, and the update after v4.19 is v5.0", () => {
  assert.match(VERSION, LABEL, `"${VERSION}" is not a valid version label`);
  for (const ok of ["v1.1", "v2", "v3.9", "v3.10", "v3.19", "v4.0", "v4.1", "v4.19", "v5.0"]) assert.match(ok, LABEL);
  for (const bad of ["v4.20", "v3.", "3.10", "v03", "v4.1.1", "v4.100"]) assert.doesNotMatch(bad, LABEL);
});

test("the changelog has an entry for the current version, and it is the newest one", () => {
  const log = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const first = log.match(/^## (v[0-9.]+)/m);
  assert.ok(first, "no version heading in CHANGELOG.md");
  assert.equal(first[1], VERSION, `the newest changelog entry is ${first[1]} but the version is ${VERSION}`);
});
