import test from "node:test";
import assert from "node:assert/strict";
import { VERSION } from "../src/version.js";

test("the version label is v1.1 to v1.9, then v2, v2.1 and so on", () => {
  assert.match(VERSION, /^v[1-9][0-9]*(\.[1-9])?$/, `"${VERSION}" is not a valid version label`);
});
