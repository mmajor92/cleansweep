// Mystery Thing: the page. All the rules of the game are in logic.js; this file is the screen.
import { byId, ROUNDS, countdownText, CATS, MODES, MODE_LABEL, PRACTICE, fmt, feedback, poolFor, remaining, norm, filterThings, dayNumber, dailyPuzzle, practicePuzzle, randomPuzzle, MULT, scoreGame, cleanSweep, shareText } from "./logic.js";
import { breakStreak, bumpStreak, clearStatus, countEvent, milestoneText, paintFlames, pickMilestone, readStatus, showNewBadge, statusLine, streakNow, utcDay, writeStatus, writeStreak } from "../src/games.js";

/** env.storage is the device's localStorage, or null when the browser will not allow it (the game still works, it just cannot save). */
export function mountMystery(env) {
  const storage = env.storage || null;
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return storage ? storage.getItem(k) : null; } catch (e) { return null; } }, set(k, v) { try { if (storage) storage.setItem(k, v); } catch (e) { /* storage can be empty or blocked */ } } };
  let mode = store.get("mt:mode");
  if (!MODES[mode]) mode = "normal";
  let puzzle = dailyPuzzle(dayNumber());
  let guesses = [];
  let fresh = false;
  let listScroll = 0;
  // One try a day: a daily puzzle has ONE saved game, and it remembers the setting it was started on. From the first guess the setting is locked.
  const okId = (id) => id === "GIVEUP" || !!byId[id];
  function readRecord(no) {
    let rec = null;
    try { const t = JSON.parse(store.get("mt:" + no) || "null"); if (t && MODES[t.m] && Array.isArray(t.g)) rec = { m: t.m, g: t.g.filter(okId), d: typeof t.d === "string" ? t.d : "" }; } catch (e) { rec = null; }
    if (!rec) for (const m of Object.keys(MODES)) { // games saved by the older version, one per setting: keep the fullest one
      try { const t = JSON.parse(store.get("mt:" + no + ":" + m) || "[]"); if (Array.isArray(t) && t.length && (!rec || t.length > rec.g.length)) rec = { m, g: t.filter(okId), d: "" }; } catch (e) { /* ignore */ }
    }
    return rec && rec.g.length ? rec : null;
  }
  let recDay = ""; // the day the saved game was started
  const load = () => { guesses = []; recDay = ""; if (!puzzle.daily) return; const rec = readRecord(puzzle.no); if (rec) { guesses = rec.g; mode = rec.m; recDay = rec.d; } };
  const save = () => { if (puzzle.daily) { if (!recDay) recDay = utcDay(); store.set("mt:" + puzzle.no, JSON.stringify({ m: mode, g: guesses, d: recDay })); } };
  const locked = () => puzzle.daily && guesses.length > 0;
  const won = () => guesses[guesses.length - 1] === puzzle.secret.id;
  const gaveUp = () => guesses.includes("GIVEUP");
  const over = () => won() || gaveUp() || guesses.length >= ROUNDS;
  const isToday = () => puzzle.daily && puzzle.no === dayNumber();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const words = (c, dir) => "try " + (c === "date" ? (dir === "up" ? "later" : "earlier") : dir === "up" ? "higher" : "lower");
  const lc = (n) => n.replace(/^(The|A|An) /, (m) => m.toLowerCase()); // "was a rifle bullet", not "was A rifle bullet"
  const gobjs = () => guesses.filter((id) => id !== "GIVEUP").map((id) => byId[id]);
  const pool = () => poolFor(puzzle.cs);
  /** The things on the list: on Easy only what is still possible, otherwise everything. */
  const listed = () => (MODES[mode].narrow ? remaining(pool(), gobjs(), puzzle.secret, puzzle.cs, mode) : pool());
  const arrowOf = (f) => (f.eq ? "\u2713" : MODES[mode].dir ? (f.dir === "up" ? "\u25B2" : "\u25BC") : "");

  function tile(c, g, f) {
    const M = MODES[mode];
    const o = g.c[c];
    const bits = f.eq ? ["exact"] : [M.dir ? words(c, f.dir) : "", M.words[f.lvl]].filter(Boolean);
    return '<div class="tile l' + f.cls + '"><span class="k">' + CATS[c].name + '</span><span class="v"><span>' + esc(fmt(c, o.v, o.ap)) + '</span><span class="a" aria-hidden="true">' + arrowOf(f) + '</span></span><span class="w">' + bits.join(", ") + "</span></div>";
  }
  function chips(g) {
    return feedback(g, puzzle.secret, puzzle.cs, mode).map((f) => '<i class="chip l' + f.cls + '" aria-hidden="true">' + arrowOf(f) + "</i>").join("");
  }
  function renderList(done) {
    const wrap = $("listwrap"), head = $("listhead");
    $("find").hidden = done;
    if (done) { wrap.innerHTML = ""; head.innerHTML = ""; return; }
    const M = MODES[mode];
    const all = listed().slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name)));
    const q = $("find").value;
    const items = q.trim() ? filterThings(all, q) : all;
    const topId = q.trim() ? (items.find((o) => !guesses.includes(o.id)) || {}).id : null; // the one Enter will guess
    head.innerHTML = q.trim()
      ? "<b>" + items.length + "</b> of " + all.length + " match." + (topId ? " Enter guesses the top one." : "")
      : (M.narrow ? "<b>" + all.length + "</b> still possible." : "All <b>" + all.length + "</b> options.") + " Tap one to guess it.";
    wrap.innerHTML = '<ul class="list" id="list" aria-label="Things the mystery thing could be">' +
      (items.length ? items.map((o) => { const taken = guesses.includes(o.id); return '<li><button type="button" class="item' + (o.id === topId ? " top" : "") + '" data-id="' + o.id + '"' + (taken ? " disabled" : "") + "><span>" + esc(o.name) + "</span>" + (taken ? '<span class="chips">' + chips(o) + "</span>" : "") + "</button></li>"; }).join("") : '<li class="none">Nothing matches. Clear the box to see them all.</li>') + "</ul>";
    const ul = $("list");
    if (ul && !M.narrow && !q.trim()) ul.scrollTop = listScroll; // Normal and Hard keep your place in the list
  }
  // ---- streaks and stats, kept on this device. "Tried" counts the days you made a guess, "solved" the days you found the answer.
  // They are worked out from today's saved game, so counting twice is impossible: reloading, or finishing, never adds a day twice.
  const readStats = () => {
    const none = { t: null, s: null, played: 0, bestScore: 0, fin: "" };
    try { const v = JSON.parse(store.get("mt:stats") || "null"); if (v && typeof v === "object") return { ...none, ...v }; } catch (e) { /* start again */ }
    return none;
  };
  function syncStats() {
    const p = dailyPuzzle(dayNumber());
    const rec = readRecord(p.no);
    const day = utcDay();
    if (!rec || (rec.d && rec.d !== day)) return; // no game today (a game from an earlier day with the same puzzle, before launch, does not count again)
    const st = readStats();
    st.t = bumpStreak(st.t, day);
    const g = rec.g;
    const won = g[g.length - 1] === p.secret.id;
    if (won || g.includes("GIVEUP") || g.length >= ROUNDS) {
      st.s = won ? bumpStreak(st.s, day) : st.s && st.s.last === day ? st.s : breakStreak(st.s, day); // an unsolved day ends the solved streak
      if (st.fin !== day) { st.fin = day; st.played += 1; st.bestScore = Math.max(st.bestScore, scoreGame(p, g, rec.m).score); }
    }
    store.set("mt:stats", JSON.stringify(st));
    writeStreak(storage, "mt", st.t);
  }
  function statsHTML() {
    const st = readStats();
    const box = (n, what) => '<div class="stat"><b>' + n + "</b><span>" + what + "</span></div>";
    return '<div class="stats">' + box(streakNow(st.t), "day streak") + box(streakNow(st.s), "solved in a row") + box(st.t ? st.t.best : 0, "best streak") + box(st.bestScore, "best score") + "</div>";
  }
  const milestoneToday = () => { const st = readStats(); return pickMilestone(st.t, st.s); };
  const milestoneBanner = () => { const m = isToday() ? milestoneToday() : null; return m ? '<p class="sweep">' + milestoneText(m) + "</p>" : ""; };
  // ---- the Reminder under the settings. Open on a first visit, folded away at the first guess ever, and after that it stays however the player last left it.
  const helpOpen = () => store.get("mt:help") !== "closed";
  function setHelp(open) { store.set("mt:help", open ? "open" : "closed"); renderHelp(); }
  function renderHelp() {
    const open = helpOpen();
    $("modehelp").hidden = !open;
    $("remind").setAttribute("aria-expanded", String(open));
    $("remind").textContent = "Reminder " + (open ? "\u25BE" : "\u25B8");
  }
  // ---- the two cards under "Today's puzzles". This page writes a short note about today's puzzle for Clean Sweep to read, and reads Clean Sweep's.
  // The status comes from the SAVED game for today's puzzle, so it is right whichever puzzle is on screen.
  function ownStatus() {
    const p = dailyPuzzle(dayNumber());
    const rec = readRecord(p.no);
    if (!rec) return null;
    const g = rec.g;
    if (g[g.length - 1] === p.secret.id) return { s: "done", t: "Done \u00b7 " + scoreGame(p, g, rec.m).score + " pts" };
    if (g.includes("GIVEUP") || g.length >= ROUNDS) return { s: "lost", t: "" };
    return { s: "play", t: "" };
  }
  function updateTabs() {
    const mine = ownStatus();
    if (mine) writeStatus(storage, "mt", mine.s, mine.t);
    else clearStatus(storage, "mt");
    const paint = (id, line) => { const el = $(id); el.textContent = line.text; el.classList.toggle("done", line.done); };
    paint("gs-mt", statusLine(mine));
    paint("gs-cs", statusLine(readStatus(storage, "cs")));
    $("newbadge").hidden = !showNewBadge();
    paintFlames(storage);
    const nx = $("nextcs");
    if (nx) { const n = nextGameState(); nx.textContent = n.label; nx.className = "btn" + (n.primary ? " primary" : ""); }
  }
  function render() {
    updateTabs();
    $("puzzleno").textContent = puzzle.daily ? "Puzzle #" + puzzle.no : puzzle.practice ? "Practice " + puzzle.practice + " of " + PRACTICE.length : "Practice puzzle";
    document.querySelectorAll("#modes button").forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.mode === mode)); b.disabled = locked(); });
    $("modehelp").textContent = MODES[mode].help;
    renderHelp();
    $("modelock").textContent = locked()
      ? "\uD83D\uDD12 Locked to " + MODE_LABEL[mode] + (isToday() ? " for today" : "")
      : puzzle.daily ? "You can change this until your first guess." : "Practice: change it as often as you like.";
    const names = puzzle.cs.map((c) => "<b>" + CATS[c].name.toLowerCase() + "</b>");
    $("clue").innerHTML = "The mystery thing is one of " + pool().length + " things that have a " + names.join(" and a ") + ".";
    const done = over();
    $("left").textContent = done ? "" : ROUNDS - guesses.length + " of " + ROUNDS + " guesses left. Solve next guess for \u00D7" + MULT[guesses.length + 1] + ".";
    renderList(done);
    $("rows").innerHTML = gobjs().map((g, i, arr) => {
      const fb = feedback(g, puzzle.secret, puzzle.cs, mode);
      const isNew = fresh && i === arr.length - 1;
      return '<div class="row' + (isNew ? " new" : "") + '"><p class="nm">' + esc(g.name) + '</p><div class="tiles">' + puzzle.cs.map((c, k) => tile(c, g, fb[k])).join("") + "</div></div>";
    }).reverse().join("");
    renderEnd(done);
    if (fresh) { const r = document.querySelector(".row.new"); if (r && r.scrollIntoView) r.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    fresh = false;
  }
  // Share result (the phone's share sheet, where there is one) and Copy result, as in Clean Sweep. A daily puzzle has no Play another.
  const canShare = () => typeof navigator !== "undefined" && !!navigator && typeof navigator.share === "function";
  const shareButtons = () => (canShare()
    ? '<button class="btn primary" id="share" type="button">Share result</button><button class="btn" id="copy" type="button">Copy result</button>'
    : '<button class="btn primary" id="copy" type="button">Copy result</button>');
  // One button to the other game. Yellow to play it, quiet once it is done, and "Finish" if it was started.
  function nextGameState() {
    const cs = readStatus(storage, "cs");
    if (cs && cs.s === "done") return { label: "\u2713 Clean Sweep done", primary: false };
    if (cs && cs.s === "play") return { label: "Finish today\u2019s Clean Sweep", primary: true };
    return { label: "Play today\u2019s Clean Sweep", primary: true };
  }
  const nextGameHTML = () => { const n = nextGameState(); return '<div class="nextgame"><a class="btn' + (n.primary ? " primary" : "") + '" id="nextcs" href="../">' + n.label + "</a></div>"; };
  // "Next puzzle in 6h 37m." counts down while the result is on screen. After midnight it offers the new puzzle instead.
  let cdTimer = null;
  const stopCountdown = () => { if (cdTimer !== null) { clearInterval(cdTimer); cdTimer = null; } };
  function tickCountdown() {
    const el = $("countdown");
    if (!el) return stopCountdown();
    if (puzzle.daily && puzzle.no !== dayNumber()) { el.innerHTML = '<button class="link" id="today" type="button">Today\u2019s puzzle is ready</button>'; return stopCountdown(); }
    el.textContent = "Next puzzle in " + countdownText() + ".";
  }
  function renderEnd(done) {
    stopCountdown();
    const el = $("end");
    if (!done) {
      el.innerHTML = '<div class="links">' + (guesses.length >= 1 ? '<button class="link" id="giveup" type="button">Show the answer</button>' : "") + (isToday() ? "" : '<button class="link" id="today" type="button">Back to today\u2019s puzzle</button>') + "</div>";
      return;
    }
    const s = puzzle.secret;
    const lines = Object.keys(s.c).map((c) => "<dt>" + esc(s.c[c].label) + "</dt><dd>" + esc(fmt(c, s.c[c].v, s.c[c].ap)) + "</dd>").join("");
    const notes = Object.values(s.c).map((x) => x.note).filter(Boolean)[0] || "";
    const sc = scoreGame(puzzle, guesses, mode);
    const sg = (n) => (n < 0 ? "\u2212" : "+") + Math.abs(Math.round(n));
    const calc = "<dt>Clues along the way</dt><dd>" + sg(sc.path) + "</dd>" + (sc.won ? "<dt>Solved it</dt><dd>" + sg(sc.solve) + "</dd><dt>" + gobjs().length + (gobjs().length === 1 ? " guess" : " guesses") + "</dt><dd>\u00D7" + sc.mult + "</dd>" : "<dt>Not solved</dt><dd>\u00D7" + sc.mult + "</dd>") + (sc.bonus !== 1 ? "<dt>Hard setting</dt><dd>\u00D7" + sc.bonus + "</dd>" : "");
    const detail = sc.per.map((x) => "<li>" + esc(x.g.name) + ": " + (x.solved ? "solved, " + sg(sc.solve) : puzzle.cs.map((c, k) => "<span>" + CATS[c].name.toLowerCase() + "</span> " + sg(x.pts[k])).join(", ")) + "</li>").join("");
    const scoreBlock = '<div class="score"><p class="big">' + sc.score + "<small>points</small></p><dl class=\"calc\">" + calc + "</dl><details><summary>How each guess scored</summary><ul>" + detail + "</ul></details></div>";
    el.innerHTML = '<div class="end">' + (cleanSweep(puzzle, guesses) ? '<p class="sweep">\uD83E\uDDF9\u2728 Clean sweep! Every guess was green.</p>' : "") + milestoneBanner() + scoreBlock + '<h2>' + (won() ? "Got it in " + guesses.length + "." : "It was " + esc(lc(s.name)) + ".") + '</h2><p class="res">' + (won() ? "The mystery thing was " + esc(lc(s.name)) + "." : gaveUp() ? "You gave up, so here it is." : "Not this time.") + "</p><dl>" + lines + "</dl>" + (notes ? '<p class="note">' + esc(notes) + "</p>" : "") +
      (puzzle.practice
        ? '<div class="btns"><button class="btn primary" type="button" data-practice="' + (puzzle.practice % PRACTICE.length + 1) + '">Practice puzzle ' + (puzzle.practice % PRACTICE.length + 1) + '</button><button class="btn" id="today" type="button">Back to today\u2019s puzzle</button></div><p class="note2">Practice puzzles do not count towards your score.</p>'
        : (puzzle.daily
          ? (isToday() ? statsHTML() : "") + '<div class="btns">' + shareButtons() + "</div>" + (isToday() ? '<p class="lockline" id="countdown">Next puzzle in ' + countdownText() + ".</p>" : "") + nextGameHTML()
          : '<div class="btns"><button class="btn primary" id="copy" type="button">Copy result</button><button class="btn" id="another" type="button">Play another</button></div>') + (isToday() ? "" : '<button class="link" id="today" type="button">Back to today\u2019s puzzle</button>')) + "</div>";
    if (puzzle.daily && isToday() && $("countdown")) cdTimer = setInterval(tickCountdown, 30000);
  }
  function say(t) { $("msg").textContent = t; }
  /** Brooms and sparkles float up the screen, as in Clean Sweep. Nothing moves for anyone who has asked for less motion. */
  function celebrate() {
    if (globalThis.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = document.createElement("div");
    box.className = "party";
    box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 30; i++) {
      const sp = document.createElement("span");
      sp.textContent = i % 3 === 0 ? "\u2728" : "\uD83E\uDDF9";
      sp.style.left = Math.random() * 94 + "%";
      sp.style.animationDelay = Math.random() * 0.9 + "s";
      sp.style.fontSize = 22 + Math.random() * 20 + "px";
      box.appendChild(sp);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }
  function submit(o) {
    if (!o || over() || guesses.includes(o.id)) return;
    guesses.push(o.id);
    save();
    syncStats();
    if (store.get("mt:help") === null) store.set("mt:help", "closed"); // the first guess ever folds the Reminder away
    fresh = true;
    say("");
    $("find").value = "";
    if (globalThis.matchMedia && matchMedia("(pointer: coarse)").matches) $("find").blur(); // on a phone, put the keyboard away so the new clue is in view
    listScroll = 0;
    render();
    if (over()) { const e = $("end"); if (e && e.scrollIntoView) e.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    if (cleanSweep(puzzle, guesses)) celebrate();
    else if (over() && isToday() && milestoneToday()) celebrate(); // brooms and sparkles for a streak milestone too
    if (over() && isToday()) { countEvent("mystery-finished"); if (cleanSweep(puzzle, guesses)) countEvent("mystery-clean-sweep"); } // counted once, the moment it finishes (not when a finished day is reloaded)
  }
  function newPuzzle(p) { puzzle = p; load(); fresh = false; listScroll = 0; $("find").value = ""; say(""); render(); }

  $("listwrap").addEventListener("click", (e) => { const b = e.target.closest(".item"); if (b && !b.disabled) submit(byId[b.dataset.id]); });
  $("listwrap").addEventListener("scroll", (e) => { if (e.target.id === "list") listScroll = e.target.scrollTop; }, true);
  $("find").addEventListener("input", () => {
    listScroll = 0;
    say("");
    renderList(over());
    const q = $("find").value;
    if (q.trim() && MODES[mode].narrow && !$("list").querySelector(".item") && filterThings(pool(), q).some((o) => !guesses.includes(o.id))) say("Your clues have ruled that one out.");
  });
  $("find").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const top = document.querySelector(".item.top");
    if (top) submit(byId[top.dataset.id]);
    else say($("find").value.trim() ? "Nothing to guess yet. Try a different word, or clear the box." : "Type a name, or tap one in the list.");
  });
  $("modes").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.dataset.mode === mode || locked()) return;
    mode = b.dataset.mode;
    store.set("mt:mode", mode);
    listScroll = 0;
    $("find").value = "";
    say("");
    load();
    render();
  });
  $("end").addEventListener("click", (e) => {
    const pr = e.target.closest("[data-practice]");
    if (pr) return newPuzzle(practicePuzzle(Number(pr.dataset.practice)));
    const id = e.target.id;
    if (id === "giveup") { guesses.push("GIVEUP"); save(); syncStats(); render(); if (isToday()) { countEvent("mystery-finished"); if (milestoneToday()) celebrate(); } }
    else if (id === "another") newPuzzle(randomPuzzle(puzzle.secret.id));
    else if (id === "today") newPuzzle(dailyPuzzle(dayNumber()));
    else if (id === "copy") {
      const t = shareText(puzzle, guesses, mode);
      const done = () => { e.target.textContent = "Copied"; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => say(t));
      else say(t);
    } else if (id === "share") {
      const t = shareText(puzzle, guesses, mode);
      Promise.resolve(navigator.share({ text: t })).catch((err) => { if (!err || err.name !== "AbortError") say(t); }); // closing the share sheet is not an error
    }
  });
  $("newpz").addEventListener("click", () => newPuzzle(randomPuzzle(puzzle.secret.id)));
  const openNo = () => { const n = Math.floor(Number($("pzno").value)); if (n >= 1) newPuzzle(dailyPuzzle(n)); };
  $("pzgo").addEventListener("click", openNo);
  $("pzno").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); openNo(); } });
  // ---- the "?" button, the first-time note, and the two practice puzzles
  const seen = () => store.get("mt:seen") === "1";
  function showNote() { const on = !seen(); $("firsttime").hidden = !on; $("helpbtn").classList.toggle("nudge", on); }
  function markSeen() { store.set("mt:seen", "1"); showNote(); }
  function toggleHelp(open) { const h = $("help"); const want = open === undefined ? h.hidden : open; h.hidden = !want; $("helpbtn").setAttribute("aria-expanded", String(want)); if (want) markSeen(); }
  $("helpbtn").addEventListener("click", () => toggleHelp());
  $("helpclose").addEventListener("click", () => toggleHelp(false));
  $("firsttimeclose").addEventListener("click", markSeen);
  $("help").addEventListener("click", (e) => { const b = e.target.closest("[data-practice]"); if (b) { toggleHelp(false); newPuzzle(practicePuzzle(Number(b.dataset.practice))); } });
  $("partybtn").addEventListener("click", celebrate);
  $("remind").addEventListener("click", () => setHelp(!helpOpen()));
  $("clear").addEventListener("click", () => {
    try { if (storage) for (const k of Object.keys(storage)) if (k.startsWith("mt:") && k !== "mt:mode") storage.removeItem(k); storage.removeItem("streak:mt"); } catch (e) { /* nothing stored, or storage blocked */ }
    newPuzzle(dailyPuzzle(dayNumber()));
    showNote();
    say("Saved games cleared.");
  });
  // Coming back to this tab (for example after playing Clean Sweep), show how that went.
  if (typeof document.addEventListener === "function") document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") updateTabs(); });
  load();
  syncStats(); // a player who finished before streaks existed gets today counted straight away
  render();
  showNote();
  // The testing controls and a few hooks for the browser tests appear only when the address ends in #debug.
  if (/debug/.test((globalThis.location && globalThis.location.hash) || "")) {
    $("tools").hidden = false;
    globalThis.__mt = { practicePuzzle, filterThings, state: () => ({ puzzle, guesses, mode }), submitById: (id) => submit(byId[id]), newPuzzle, randomPuzzle, dailyPuzzle, dayNumber, feedback, fmt };
  }
}
