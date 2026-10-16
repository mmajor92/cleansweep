import test from "node:test";
import assert from "node:assert/strict";
import { GOATCOUNTER_CODE } from "../src/site.js";

test("the GoatCounter code is empty (counting off) or a plain site code", () => {
  assert.match(GOATCOUNTER_CODE, /^$|^[a-z0-9][a-z0-9-]{1,}$/, `"${GOATCOUNTER_CODE}" is not a valid GoatCounter code`);
});
