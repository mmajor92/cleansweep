// Line Up: the page. All the rules of the game are in logic.js; this file is the screen.
import { CAT, PRACTICE, TIER, TRIES, scoreGame, byKey, countdownText, dayNumber, fmtValue, isOver, lockedPositions, practicePuzzle, puzzleFor, rightPlaces, shareText, solvedTry } from "./logic.js";
import { breakStreak, bumpStreak, clearStatus, copyText, countEvent, flameText, maybeAllDone, MILESTONES, milestoneText, nextButtonsHTML, paintCards, pickMilestone, streakNow, utcDay, withFlame, writeStatus } from "../src/games.js";

const NF = new Intl.NumberFormat("en-GB");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** env.storage is the device's localStorage, or null when the browser will not allow it (the game still works, it just cannot save). */
export function mountLineUp(env) {
  const storage = env.storage || null;
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return storage ? storage.getItem(k) : null; } catch (e) { return null; } }, set(k, v) { try { if (storage) storage.setItem(k, v); } catch (e) { /* storage can be empty or blocked */ } } };

  let puzzle = null; // today's puzzle, or a practice one
  let tries = []; // the orders already checked, each a list of ids, one for each thing
  let order = []; // the order on screen now
  let locked = new Set(); // positions that were right in a try: those things stay put
  let sel = null; // the thing picked up by a tap, waiting to be swapped
  let recDay = ""; // the day the saved game was started
  let note = ""; // the line under the button
  let suppressClickUntil = 0; // a drag ends with a click we must ignore
  let cdTimer = null;

  const isToday = () => !!puzzle && puzzle.daily && puzzle.no === dayNumber();
  const over = () => isOver(tries, puzzle.solution);
  const itemOf = (id) => puzzle.items.find((x) => x.id === id);

  // ---- saving: one record per daily puzzle, "lu:<number>" ----
  const readRecord = (no, p) => {
    try {
      const t = JSON.parse(store.get("lu:" + no) || "null");
      if (!t || !Array.isArray(t.t)) return null;
      const ids = new Set(p.start);
      const ok = (a) => Array.isArray(a) && a.length === p.start.length && a.every((id) => ids.has(id)) && new Set(a).size === a.length;
      return { t: t.t.filter(ok).slice(0, TRIES), c: ok(t.c) ? t.c : null, d: typeof t.d === "string" ? t.d : "" };
    } catch (e) { return null; }
  };
  function normalise() { // locked things sit in their right places; the others keep their order in the places that are left
    const lockedIds = new Set([...locked].map((i) => puzzle.solution[i]));
    const rest = order.filter((id) => !lockedIds.has(id));
    order = puzzle.solution.map((_, i) => (locked.has(i) ? puzzle.solution[i] : rest.shift()));
  }
  function load() {
    tries = []; order = puzzle.start.slice(); recDay = ""; sel = null; note = "";
    if (puzzle.daily) { const rec = readRecord(puzzle.no, puzzle); if (rec) { tries = rec.t; recDay = rec.d; if (rec.c) order = rec.c; } }
    locked = lockedPositions(tries, puzzle.solution);
    normalise();
  }
  function save() { if (puzzle.daily) { if (!recDay) recDay = utcDay(); store.set("lu:" + puzzle.no, JSON.stringify({ t: tries, c: order, d: recDay })); } }

  // ---- streaks and stats, kept on this device. "Tried" counts the days you checked an order, "solved" the days you got it right. ----
  const readStats = () => {
    const none = { t: null, s: null, played: 0, best: 0, fin: "" };
    try { const v = JSON.parse(store.get("lu:stats") || "null"); if (v && typeof v === "object") return { ...none, ...v }; } catch (e) { /* start again */ }
    return none;
  };
  function syncStats() {
    const p = puzzleFor(dayNumber());
    const rec = readRecord(p.no, p);
    const day = utcDay();
    if (!rec || !rec.t.length || (rec.d && rec.d !== day)) return;
    const st = readStats();
    const hadToday = st.t && st.t.last === day;
    st.t = bumpStreak(st.t, day);
    if (!hadToday && MILESTONES.includes(st.t.n)) countEvent("lineup-streak-" + st.t.n); // a streak reached 7, 30 or 100 days today
    const n = solvedTry(rec.t, p.solution);
    if (n || rec.t.length >= TRIES) {
      st.s = n ? bumpStreak(st.s, day) : st.s && st.s.last === day ? st.s : breakStreak(st.s, day); // an unsolved day ends the solved streak
      if (st.fin !== day) { st.fin = day; st.played += 1; st.best = Math.max(st.best || 0, scoreGame(p, rec.t).points); }
    }
    store.set("lu:stats", JSON.stringify(st));
  }
  function statsHTML() {
    const st = readStats();
    const box = (n, what) => '<div class="stat"><b>' + n + "</b><span>" + what + "</span></div>";
    return '<div class="stats">' + box(streakNow(st.t), "day streak") + box(streakNow(st.s), "solved in a row") + box(st.t ? st.t.best : 0, "best streak") + box(NF.format(st.best || 0), "best score") + "</div>";
  }
  const flameChip = () => { const n = streakNow(readStats().t); return n >= 2 ? ' <span class="fl">' + flameText(n) + "</span>" : ""; }; // the flame on the result card
  const milestoneToday = () => { const st = readStats(); return pickMilestone(st.t, st.s); };
  const milestoneBanner = () => { const m = isToday() ? milestoneToday() : null; return m ? '<p class="sweep">' + milestoneText(m, "\uD83D\uDCCA") + "</p>" : ""; };

  // ---- the three rows under "Today's puzzles": this page writes a note about today's puzzle, and reads the other games' ----
  function ownStatus() {
    const p = puzzleFor(dayNumber());
    const rec = readRecord(p.no, p);
    if (!rec || !rec.t.length) return null;
    const n = solvedTry(rec.t, p.solution);
    if (n) return { s: "done", t: "Done \u00b7 " + n + "/" + TRIES };
    return { s: rec.t.length >= TRIES ? "lost" : "play", t: "" };
  }
  const nextGameHTML = () => nextButtonsHTML(storage, "lu", "../");
  function updateTabs() {
    const mine = ownStatus();
    if (mine) writeStatus(storage, "lu", mine.s, mine.t);
    else clearStatus(storage, "lu");
    paintCards(storage);
    maybeAllDone(storage);
    const nx = $("nextgames");
    if (nx) nx.outerHTML = nextGameHTML();
  }

  // ---- the board ----
  function renderBoard() {
    const done = over();
    const list = done ? puzzle.solution : order;
    $("board").innerHTML = list.map((id, i) => {
      const it = itemOf(id);
      const lk = done || locked.has(i);
      const right = done ? '<span class="val">' + esc(fmtValue(puzzle.cat, it.value, it.approx)) + "</span>" : lk ? '<span class="lockic" aria-hidden="true">\uD83D\uDD12</span>' : '<button class="grip" type="button" tabindex="-1" aria-label="Drag ' + esc(it.text) + '">\u22EE\u22EE</button>';
      return '<li class="card' + (lk ? " locked" : "") + (id === sel ? " sel" : "") + '" data-id="' + esc(id) + '" data-i="' + i + '"' + (lk ? "" : ' tabindex="0"') + '><span class="pos">' + (i + 1) + '</span><span class="txt">' + esc(it.text) + "</span>" + right + "</li>";
    }).join("");
  }
  function renderHistory() {
    $("hist").innerHTML = tries.map((t, n) => '<div class="h"><b>Try ' + (n + 1) + '</b><span class="sq" aria-label="' + rightPlaces(t, puzzle.solution).filter(Boolean).length + ' of ' + puzzle.solution.length + ' right">' + rightPlaces(t, puzzle.solution).map((ok) => '<i class="' + (ok ? "ok" : "") + '"></i>').join("") + "</span></div>").join("");
  }
  function render() {
    updateTabs();
    const c = CAT[puzzle.cat];
    $("puzzleno").textContent = puzzle.daily ? withFlame("Puzzle #" + puzzle.no, streakNow(readStats().t)) : "Practice " + puzzle.practice + " of " + PRACTICE.length;
    $("tier").innerHTML = puzzle.daily ? '<span class="tier ' + puzzle.tier + '">' + TIER[puzzle.tier].name + ' day</span><span class="tiernote">worth \u00d7' + TIER[puzzle.tier].mult + "</span>" : "";
    $("prompt").innerHTML = '<span class="ic" aria-hidden="true">' + c.icon + "</span>" + c.prompt;
    $("promptsub").textContent = over() ? "The right order, with the real numbers." : c.hint + ". Tap two to swap them, or drag one.";
    $("endtop").textContent = "\u2191 " + c.ends[0];
    $("endbottom").textContent = c.ends[1] + " \u2193";
    $("tries").textContent = over() ? "" : "Try " + (tries.length + 1) + " of " + TRIES;
    $("checkrow").hidden = over();
    $("msg").textContent = note;
    renderBoard();
    renderHistory();
    renderEnd();
  }

  // ---- moving things ----
  const freePositions = () => order.map((_, i) => i).filter((i) => !locked.has(i));
  function swapPositions(a, b) { [order[a], order[b]] = [order[b], order[a]]; }
  function moveAmongFree(from, to) { // lift the thing at "from" and put it at "to"; the other free things shuffle along, locked ones never move
    const free = freePositions();
    const a = free.indexOf(from), b = free.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    const ids = free.map((i) => order[i]);
    const [x] = ids.splice(a, 1);
    ids.splice(b, 0, x);
    free.forEach((pos, k) => { order[pos] = ids[k]; });
  }
  function pick(i) { // a tap: pick a thing up, or swap it with the one already picked up
    if (over() || locked.has(i)) return;
    const id = order[i];
    if (sel === null) sel = id;
    else if (sel === id) sel = null;
    else { swapPositions(order.indexOf(sel), i); sel = null; save(); note = ""; }
    renderBoard();
    $("msg").textContent = note;
  }
  const board = $("board");
  board.addEventListener("click", (e) => {
    if (Date.now() < suppressClickUntil) return;
    const li = e.target.closest(".card");
    if (li) pick(Number(li.dataset.i));
  });
  board.addEventListener("keydown", (e) => {
    const li = e.target.closest(".card");
    if (!li || over()) return;
    const i = Number(li.dataset.i);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(i); const again = board.querySelector('[data-i="' + i + '"]'); if (again) again.focus(); }
    else if (e.key === "Escape") { sel = null; renderBoard(); const again = board.querySelector('[data-i="' + i + '"]'); if (again) again.focus(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const free = freePositions();
      const at = free.indexOf(i);
      const to = free[at + (e.key === "ArrowUp" ? -1 : 1)];
      if (at < 0 || to === undefined) return;
      if (sel === order[i]) { moveAmongFree(i, to); save(); } // a picked-up thing moves; with nothing picked up the arrows just move the focus
      renderBoard();
      const again = board.querySelector('[data-i="' + to + '"]');
      if (again) again.focus();
    }
  });
  function attachDrag(li, e, threshold) { // threshold 0: lift at once (the dots); otherwise lift once the pointer has moved that many pixels
    const from = Number(li.dataset.i);
    const cards = [...board.children];
    const rects = cards.map((c) => c.getBoundingClientRect());
    const free = freePositions();
    const startX = e.clientX, startY = e.clientY;
    let target = from, dragging = false;
    try { li.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    const lift = () => { dragging = true; li.classList.add("drag"); };
    if (!threshold) lift();
    const move = (ev) => {
      const dy = ev.clientY - startY;
      if (!dragging) { if (Math.hypot(ev.clientX - startX, dy) < threshold) return; lift(); }
      li.style.transform = "translateY(" + dy + "px)";
      const cy = rects[from].top + rects[from].height / 2 + dy;
      let best = from, bd = Infinity;
      for (const i of free) { const d = Math.abs(cy - (rects[i].top + rects[i].height / 2)); if (d < bd) { bd = d; best = i; } }
      if (best !== target) { cards[target].classList.remove("over"); target = best; if (best !== from) cards[best].classList.add("over"); }
    };
    const up = () => {
      li.removeEventListener("pointermove", move);
      li.removeEventListener("pointerup", up);
      li.removeEventListener("pointercancel", up);
      if (!dragging) return; // a plain click: the click handler picks the thing up
      suppressClickUntil = Date.now() + 350;
      if (target !== from) { moveAmongFree(from, target); sel = null; save(); note = ""; }
      render();
    };
    li.addEventListener("pointermove", move);
    li.addEventListener("pointerup", up);
    li.addEventListener("pointercancel", up);
  }
  board.addEventListener("pointerdown", (e) => {
    if (over()) return;
    const li = e.target.closest(".card");
    if (!li || li.classList.contains("locked")) return;
    if (e.target.closest(".grip")) { e.preventDefault(); attachDrag(li, e, 0); } // the dots: a drag at once, so a finger can still scroll the page from anywhere else
    else if (e.pointerType === "mouse" && e.button === 0) attachDrag(li, e, 6); // a laptop: drag from anywhere on the card; a click without moving still picks up and swaps
  });

  // ---- checking an order ----
  function check() {
    if (over()) return;
    const last = tries.length ? tries[tries.length - 1] : puzzle.start;
    if (order.every((id, i) => id === last[i])) { note = "Move something first, then check."; $("msg").textContent = note; return; }
    tries.push(order.slice());
    const right = rightPlaces(order, puzzle.solution);
    right.forEach((ok, i) => { if (ok) locked.add(i); });
    sel = null;
    save();
    syncStats();
    const count = right.filter(Boolean).length;
    if (puzzle.daily && isToday() && tries.length === 1) countEvent("lineup-started"); // the first check of today's puzzle, counted once
    note = over() ? "" : count + " in the right place. They are locked now. Move the rest.";
    if (over() && puzzle.daily && isToday()) {
      const n = solvedTry(tries, puzzle.solution);
      if (n) countEvent("lineup-solved");
      countEvent("lineup-finished");
      if (n === 1) countEvent("lineup-clean-sweep");
    }
    render();
    if (over() && (solvedTry(tries, puzzle.solution) === 1 || (isToday() && milestoneToday()))) celebrate();
    const e = $("end"); if (over() && e && e.scrollIntoView) e.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  $("check").addEventListener("click", check);

  /** Brooms, soap and sparkles float up the screen, like Clean Sweep's. Nothing moves for anyone who has asked for less motion. */
  function celebrate() {
    if (globalThis.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = document.createElement("div");
    box.className = "party";
    box.setAttribute("aria-hidden", "true");
    const faces = ["\uD83E\uDDF9", "\u2728", "\uD83E\uDDF9", "\uD83E\uDDFC"];
    for (let i = 0; i < 44; i++) {
      const sp = document.createElement("span");
      sp.textContent = faces[i % faces.length];
      sp.style.left = Math.random() * 94 + "%";
      sp.style.animationDelay = Math.random() * 1.2 + "s";
      sp.style.fontSize = 24 + Math.random() * 24 + "px";
      box.appendChild(sp);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4800);
  }

  // ---- the result card ----
  // When the browser will not let the page copy, the text is shown just under the buttons, already selected, so it can be copied by hand.
  const COPYFAIL = '<div class="copyfail" id="copyfail" hidden><p>Your browser would not copy it for you. Select this text and copy it:</p><textarea class="copybox" id="copytext" readonly aria-label="Result text"></textarea></div>';
  function showCopy(t) {
    const box = $("copyfail"), ta = $("copytext");
    if (!box || !ta) return;
    ta.value = t;
    ta.rows = t.split("\n").length + 1;
    box.hidden = false;
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, t.length); } catch (err) { /* some browsers have no such call */ }
  }
  const canShare = () => typeof navigator !== "undefined" && !!navigator && typeof navigator.share === "function";
  const shareButtons = () => (canShare()
    ? '<button class="btn primary" id="share" type="button">Share result</button><button class="btn" id="copy" type="button">Copy result</button>'
    : '<button class="btn primary" id="copy" type="button">Copy result</button>');
  const stopCountdown = () => { if (cdTimer !== null) { clearInterval(cdTimer); cdTimer = null; } };
  function tickCountdown() {
    const el = $("countdown");
    if (!el) return stopCountdown();
    if (puzzle.daily && puzzle.no !== dayNumber()) { el.innerHTML = '<button class="link" id="today" type="button">Today\u2019s puzzle is ready</button>'; return stopCountdown(); }
    el.textContent = "Next puzzle in " + countdownText() + ".";
  }
  /** The score on the result card: the big number, how it was made up, and how scoring works. */
  function scoreHTML() {
    const r = scoreGame(puzzle, tries), T = TIER[r.tier];
    const line = (k, v) => "<dt>" + k + "</dt><dd>" + v + "</dd>";
    return '<div class="score"><p class="big">' + NF.format(r.points) + "<small>points</small></p>" +
      '<dl class="calc">' + line("Things in the right place", NF.format(r.raw - r.bonus)) + (r.bonus ? line("Clean sweep bonus", "+" + r.bonus) : "") + line(T.name + " day", "\u00d7" + r.mult) + "</dl>" +
      "<details><summary>How scoring works</summary><ul><li>Each thing scores for the try it was right on: 100 on the first, 60 on the second, 35 on the third.</li>" +
      "<li>A thing one place out earns 40% of that, two places out 15%.</li><li>A clean sweep adds 100.</li><li>Then the day counts: Easy \u00d71, Medium \u00d71.25, Hard \u00d71.5. You see which before you start.</li></ul></details></div>";
  }
  function renderEnd() {
    stopCountdown();
    const el = $("end");
    if (!over()) { el.innerHTML = ""; return; }
    const n = solvedTry(tries, puzzle.solution);
    const head = '<div class="end">' + milestoneBanner() + (n === 1 && puzzle.daily ? '<p class="sweep">\uD83E\uDDF9 Clean sweep! \uD83E\uDDF9</p>' : "") +
      "<h2>" + (n ? "Lined up in " + n + (n === 1 ? " try." : " tries.") : "Not this time.") + flameChip() + "</h2>" + (n ? "" : '<p class="res">The right order is above.</p>');
    let tail;
    if (puzzle.practice) {
      const next = (puzzle.practice % PRACTICE.length) + 1;
      tail = '<div class="btns"><button class="btn primary" type="button" data-practice="' + next + '">Practice puzzle ' + next + '</button><button class="btn" id="today" type="button">Back to today\u2019s puzzle</button></div><p class="note2">Practice puzzles do not count towards your score.</p>';
    } else {
      tail = (isToday() ? scoreHTML() + statsHTML() : "") + '<div class="btns">' + shareButtons() + "</div>" + COPYFAIL + (isToday() ? '<p class="lockline" id="countdown">Next puzzle in ' + countdownText() + ".</p>" : '<button class="link" id="today" type="button">Back to today\u2019s puzzle</button>') + (isToday() ? nextGameHTML() : "");
    }
    el.innerHTML = head + tail + "</div>";
    if (puzzle.daily && isToday() && $("countdown")) cdTimer = setInterval(tickCountdown, 30000);
  }
  function say(t) { note = t; $("msg").textContent = t; }
  $("end").addEventListener("click", (e) => {
    const pr = e.target.closest("[data-practice]");
    if (pr) return newPuzzle(practicePuzzle(Number(pr.dataset.practice)));
    const id = e.target.id;
    if (id === "today") newPuzzle(puzzleFor(dayNumber()));
    else if (id === "copy") {
      const t = shareText(puzzle, tries);
      copyText(t).then((ok) => { if (ok) e.target.textContent = "Copied"; else showCopy(t); });
    } else if (id === "share") {
      const t = shareText(puzzle, tries);
      Promise.resolve(navigator.share({ text: t })).catch((err) => { // closing the share sheet is not an error
        if (err && err.name === "AbortError") return;
        copyText(t).then((ok) => { const b = $("copy"); if (ok && b) b.textContent = "Copied"; else if (!ok) showCopy(t); });
      });
    }
  });

  function newPuzzle(p) {
    puzzle = p;
    load();
    render();
    if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
  }

  // ---- the "?" panel, the first-time note, and the two practice puzzles ----
  const seen = () => store.get("lu:seen") === "1";
  function showNote() { const on = !seen(); $("firsttime").hidden = !on; $("helpbtn").classList.toggle("nudge", on); }
  function markSeen() { store.set("lu:seen", "1"); showNote(); }
  function toggleHelp(open) { const h = $("help"); const want = open === undefined ? h.hidden : open; h.hidden = !want; $("helpbtn").setAttribute("aria-expanded", String(want)); if (want) markSeen(); }
  $("helpbtn").addEventListener("click", () => toggleHelp());
  $("helpclose").addEventListener("click", () => toggleHelp(false));
  $("firsttimeclose").addEventListener("click", markSeen);
  $("help").addEventListener("click", (e) => { const b = e.target.closest("[data-practice]"); if (b) { toggleHelp(false); newPuzzle(practicePuzzle(Number(b.dataset.practice))); } });

  // ---- testing controls (shown only when the address ends in #debug) ----
  $("pzgo").addEventListener("click", () => { const n = Math.max(1, Math.min(999, Number($("pzno").value) || 1)); newPuzzle(puzzleFor(n)); });
  $("pzno").addEventListener("keydown", (e) => { if (e.key === "Enter") $("pzgo").click(); });
  $("clear").addEventListener("click", () => {
    try { if (storage) for (const k of Object.keys(storage)) if (k.startsWith("lu:")) storage.removeItem(k); } catch (e) { /* nothing stored, or storage blocked */ }
    newPuzzle(puzzleFor(dayNumber()));
    showNote();
    say("Saved games cleared.");
  });
  $("partybtn").addEventListener("click", celebrate);

  // Coming back to this tab (for example after playing another game), show how that went.
  if (typeof document.addEventListener === "function") document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") updateTabs(); });
  puzzle = puzzleFor(dayNumber());
  load();
  syncStats(); // a player who finished before streaks were counted gets today counted straight away
  render();
  showNote();
  if (/debug/.test((globalThis.location && globalThis.location.hash) || "")) {
    $("tools").hidden = false;
    globalThis.__lu = { state: () => ({ puzzle, tries, order, locked: [...locked] }), score: () => scoreGame(puzzle, tries), setOrder: (ids) => { order = ids.slice(); normalise(); save(); render(); }, check, practicePuzzle, puzzleFor, dayNumber, newPuzzle, fmtValue, byKey };
  }
}
