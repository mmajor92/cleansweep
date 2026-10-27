import test from "node:test";
import assert from "node:assert/strict";
import { VERSION } from "../src/version.js";

test("the version label is v1.1 to v1.9, then v2, v2.1 and so on, then v3 (and the number after the dot can pass 9: v3.10)", () => {
  assert.match(VERSION, /^v[1-9][0-9]*(\.[1-9][0-9]*)?$/, `"${VERSION}" is not a valid version label`);
  for (const ok of ["v1.1", "v2", "v3.9", "v3.10", "v3.12"]) assert.match(ok, /^v[1-9][0-9]*(\.[1-9][0-9]*)?$/);
  for (const bad of ["v3.0", "v3.", "3.10", "v03", "v3.10.1"]) assert.doesNotMatch(bad, /^v[1-9][0-9]*(\.[1-9][0-9]*)?$/);
});
