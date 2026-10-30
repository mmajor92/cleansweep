// Line Up: which facts can be put in order, and how each one is worded on the board.
// It uses the same data/facts.json as the other games: any verified size, weight, speed or year of a well-known thing can be an item.

export const LU_CATS = ["length", "weight", "date", "speed"]; // counts are left out: "how many" is another game

// Facts that read oddly on a board, or that people would argue about (the lift speed of a tower, the weight of only part of a statue).
const SKIP = new Set(["burj:speed", "londoneye:speed", "tube:speed", "statue:weight", "marathon:length", "marathon:speed"]);

// "the weight of a banana" -> "A banana". "the speed of the Space Shuttle in orbit" -> "The Space Shuttle in orbit".
const MEASURE = /^the (?:total |body )?(?:weight|length|height|width|top speed|cruising speed|orbital speed|speed) of (.+)$/i;
const upFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The words on a board card for a fact, or null when the fact does not read well on its own (brackets, or too long). */
export function itemText(cat, phrase) {
  let p = (phrase || "").trim();
  if (!p || /\(/.test(p)) return null;
  if (cat === "date") p = p.replace(/^the /i, "");
  else {
    const m = MEASURE.exec(p);
    if (!m) return null;
    p = m[1];
  }
  if (!p || p.length > 38) return null;
  return upFirst(p);
}

/** entities is the "entities" list from data/facts.json. One item for each verified fact of a famous enough thing. */
export function buildPool(entities) {
  const pool = [];
  for (const e of entities) {
    if (e.object || (e.fame || 2) < 2) continue;
    for (const cat of LU_CATS) {
      const f = e.facts[cat];
      if (!f || f.warmup || f.status !== "verified" || !Number.isFinite(f.value) || SKIP.has(e.id + ":" + cat)) continue;
      const text = itemText(cat, f.phrase);
      if (!text) continue;
      pool.push({ key: e.id + ":" + cat, id: e.id, family: e.family || e.id, cat, value: f.value, approx: !!f.approx, fame: e.fame || 2, text });
    }
  }
  return pool;
}
