import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY, completeDay, currentStreak, emptyState, loadState, prune, recordPick, saveState } from "../src/store.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
};

test("load returns an empty state for missing or corrupt data", () => {
  assert.deepEqual(loadState(memory()), emptyState());
  const s = memory();
  s.setItem(STORAGE_KEY, "{not json");
  assert.deepEqual(loadState(s), emptyState());
  assert.deepEqual(loadState(null), emptyState());
});

test("picks are saved and restored", () => {
  const s = memory();
  const state = emptyState();
  recordPick(state, 5, "up");
  recordPick(state, 5, "down");
  assert.equal(saveState(s, state), true);
  assert.deepEqual(loadState(s).days[5].picks, ["up", "down"]);
});

test("a finished day is locked", () => {
  const state = emptyState();
  recordPick(state, 5, "up");
  completeDay(state, 5, [true, false, true, true, true, true, true]);
  recordPick(state, 5, "down"); // ignored
  assert.equal(state.days[5].picks.length, 1);
  assert.equal(state.days[5].done, true);
});

test("completing twice does not double count", () => {
  const state = emptyState();
  completeDay(state, 5, [true, true, true, true, true, true, true]);
  completeDay(state, 5, [true, true, true, true, true, true, true]);
  assert.equal(state.stats.played, 1);
});

test("streak grows on consecutive days and resets after a gap", () => {
  const state = emptyState();
  const r = [true, true, true, true, true, true, true];
  completeDay(state, 10, r);
  completeDay(state, 11, r);
  completeDay(state, 12, r);
  assert.equal(state.stats.streak, 3);
  assert.equal(currentStreak(state, 12), 3);
  assert.equal(currentStreak(state, 13), 3); // still alive the next morning
  assert.equal(currentStreak(state, 14), 0); // a missed day breaks it
  completeDay(state, 15, r);
  assert.equal(state.stats.streak, 1);
  assert.equal(state.stats.bestStreak, 3);
});

test("distribution counts correct answers", () => {
  const state = emptyState();
  completeDay(state, 1, [true, true, true, true, true, false, false]);
  completeDay(state, 2, [true, true, true, true, true, false, false]);
  assert.equal(state.stats.distribution[5], 2);
});

test("saveState reports failure instead of throwing", () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error("full"); } };
  assert.equal(saveState(broken, emptyState()), false);
});

test("prune drops old days only", () => {
  const state = emptyState();
  state.days[1] = { picks: [], done: true, results: [] };
  state.days[90] = { picks: [], done: true, results: [] };
  prune(state, 100);
  assert.deepEqual(Object.keys(state.days), ["90"]);
});
