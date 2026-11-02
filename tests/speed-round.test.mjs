// The speed round (v4.0): the new facts are in, with a source and a date, and the left-out ones stay out.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPool } from "../lineup/data.js";

const facts = JSON.parse(readFileSync(new URL("../data/facts.json", import.meta.url), "utf8"));
const byId = new Map(facts.entities.map((e) => [e.id, e]));
const NEW = ["baumgartner", "thrustssc", "badmintonsmash", "tornadowind", "windgust", "veyron", "ferrarif40", "mclarenf1", "baseballpitch", "footballkick", "wildebeest", "hare", "pronghorn", "springbok", "quarterhorse", "hummingbird", "agerars", "tgv", "golfdrive", "luge", "slapshot", "skydiver", "tsunami", "flyingscotsman", "teslaplaid", "motogp", "indy500", "bloodhound", "bluebirdk7", "formularossa", "patricia", "kingdaka"];
const UPGRADED = ["motorwaylimit", "fourminutemile", "wolf", "human", "lion", "zebra", "polarbear", "modelt", "chimp", "bison", "voyager2", "neptune", "f14", "spitfire", "hindenburg", "horse", "galapagos", "narrowboat", "f16", "f22", "f35", "newhorizons", "juno", "bullet", "halley", "a320", "tiger", "walrus", "swift"];

test("every new thing has a verified speed, a link and a date", () => {
  assert.equal(NEW.length, 32);
  for (const id of NEW) {
    const s = byId.get(id)?.facts.speed;
    assert.ok(s, id + " is missing");
    assert.equal(s.status, "verified", id);
    assert.match(s.source, /^https:\/\//, id);
    assert.match(s.checkedOn, /^2026-10-\d\d$/, id);
    assert.ok(Number.isFinite(s.value) && s.value > 0 && s.unit === "km/h", id);
  }
});

test("the 29 speed facts that were not yet verified are now verified, with a link", () => {
  assert.equal(UPGRADED.length, 29);
  for (const id of UPGRADED) {
    const s = byId.get(id).facts.speed;
    assert.equal(s.status, "verified", id);
    assert.match(s.source, /^https:\/\//, id);
  }
});

test("the disputed fish speeds and the speed of light are left out on purpose", () => {
  for (const id of ["sailfish", "swordfish", "lightspeed", "sunorbit"]) assert.ok(!byId.has(id), id + " should not be in");
});

test("Line Up has a much bigger pool of speeds to draw on (it was 52)", () => {
  const speeds = buildPool(facts.entities).filter((p) => p.cat === "speed");
  assert.ok(speeds.length >= 100, "only " + speeds.length + " speeds in the pool");
});
