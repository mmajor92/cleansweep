// Rendering and game flow. The only module that touches the DOM.
import { CATEGORIES, RULES, correctPick, countdownText, gapRatio, normalizePuzzle, puzzleNumber, questionsOf, streaks, shareText } from "./engine.js";
import { slideAt } from "./ruler.js";
import { captureScreen, playTransition } from "./transition.js";
import { valueParts, valueText, figureText, displayName, differenceText, questionText } from "./format.js";
import { questionDeep, questionRatios, scoreRun, tierFor, SCORING } from "./score.js";
import { loadState, saveState, recordPick, completeDay, currentStreak, dayRecord, prune } from "./store.js";

/**
 * env: {
 *   root: { tabs, meta, chain, card },
 *   storage: Storage | null,
 *   todayNum: number,
 *   dailyPuzzle: puzzle,
 *   practicePuzzles: [puzzle, puzzle]   (the two fixed practice puzzles)
 *   onAnswer: () => void                (called whenever a question is answered, real or practice)
 * }
 */
export function mountGame(env) {
  const { root, storage, todayNum } = env;
  let store = prune(loadState(storage), todayNum);
  let P = null; // the puzzle, as a list of stretches ("legs"), each in one category, joined by bridges
  let Q = null; // its 7 questions in order (see questionsOf)
  let S = null;

  const itemAt = (q) => ({ cat: Q[q].cat, item: Q[q].item });

  /* ---------- state ---------- */
  const practiceTotal = () => (env.practicePuzzles || []).length;
  function begin(mode, requested) {
    let practiceNo = 0;
    if (mode === "practice") {
      // The two practice puzzles are always on offer, in any order, as often as you like. They count for nothing and are not saved.
      const total = practiceTotal();
      practiceNo = total ? Math.min(total, Math.max(1, Number(requested) || 1)) : 0;
      if (!practiceNo) mode = "daily";
    }
    P = normalizePuzzle(mode === "daily" ? env.dailyPuzzle : env.practicePuzzles[practiceNo - 1]);
    Q = questionsOf(P);
    S = { mode, practiceNo, q: 0, picks: [], results: [], phase: "ask", last: null, prev: P.legs[0].anchor, revealed: [P.legs[0].anchor.value], ratios: questionRatios(P), deep: questionDeep(P) };
    if (mode === "daily") {
      const rec = dayRecord(store, todayNum);
      if (rec) replay(rec.picks);
    }
    render();
  }

  function replay(picks) {
    for (let k = 0; k < picks.length; k++) {
      const { item } = itemAt(k);
      S.results.push(picks[k] === correctPick(item, S.prev));
      S.picks.push(picks[k]);
      if (Q[k].bridge) {
        S.prev = Q[k].nextAnchor;
        S.revealed = [S.prev.value];
      } else {
        S.prev = item;
        S.revealed.push(item.value);
      }
    }
    S.q = picks.length;
    S.phase = S.q >= RULES.chainLength ? "done" : "ask";
    if (S.phase === "done" && S.mode === "daily") finishDaily();
  }

  function finishDaily() {
    const sc = scoreRun(S.ratios, S.results, S.deep);
    completeDay(store, todayNum, S.results, { total: sc.total, max: sc.max, pct: sc.pct });
    saveState(storage, store);
  }

  // Counting players (optional, only if a GoatCounter code is set in src/site.js). Counts only, nothing personal.
  function countEvent(name) {
    try {
      const gc = globalThis.goatcounter;
      if (gc && typeof gc.count === "function") gc.count({ path: name, title: name, event: true });
    } catch (e) {
      /* counting must never get in the way of the game */
    }
  }

  // A few brooms and sparkles float up the screen for a Clean Sweep. Skipped for people who prefer less motion.
  function sweepFx() {
    try {
      if (!document.body || typeof document.createElement !== "function") return;
      if (typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const layer = document.createElement("div");
      layer.className = "sweepfx";
      layer.setAttribute("aria-hidden", "true");
      const faces = ["\u{1F9F9}", "\u2728", "\u{1F9F9}", "\u{1F9FC}"];
      for (let i = 0; i < 22; i++) {
        const s = document.createElement("span");
        s.textContent = faces[i % faces.length];
        s.style.left = Math.round(4 + Math.random() * 92) + "%";
        s.style.animationDelay = (Math.random() * 0.9).toFixed(2) + "s";
        s.style.animationDuration = (2.2 + Math.random() * 1.4).toFixed(2) + "s";
        s.style.fontSize = 22 + Math.round(Math.random() * 18) + "px";
        layer.appendChild(s);
      }
      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 4800);
    } catch (e) {
      /* the celebration is a bonus: never let it break the game */
    }
  }

  // Runs once, the moment a game is finished live (not when a finished day is reloaded).
  function afterFinish() {
    const perfect = streaks(S.results).longest === RULES.chainLength;
    if (S.mode === "daily") {
      countEvent("finished");
      if (perfect) countEvent("clean-sweep");
    }
    if (perfect) sweepFx();
  }

  function answer(pick) {
    if (env.onAnswer) env.onAnswer();
    const { item } = itemAt(S.q);
    const ok = pick === correctPick(item, S.prev);
    S.picks.push(pick);
    S.results.push(ok);
    S.last = { ok };
    S.lastAt = slideAt(itemAt(S.q).cat, S.prev.value, item.value);
    S.phase = "reveal";
    if (S.mode === "daily") {
      recordPick(store, todayNum, pick);
      saveState(storage, store);
    }
    render();
  }

  function advance() {
    let finishedNow = false;
    if (S.phase === "reveal") {
      const { item } = itemAt(S.q);
      if (S.q === RULES.chainLength - 1) {
        S.phase = "done";
        S.q += 1;
        finishedNow = true;
        if (S.mode === "daily") finishDaily();
      } else if (Q[S.q].bridge) {
        // A bridge: the same object, in a new category. It glides to the middle like any other answer,
        // and its old figure fades out as its new figure fades in.
        S.phase = "ask"; // no separate bridge screen: the next question shows the new starting point
        S.glideOldFig = figureText(itemAt(S.q).cat, S.prev);
        S.glideFigOld = figureText(itemAt(S.q).cat, item);
        S.glideFrom = S.lastAt;
        S.glideOk = !!(S.last && S.last.ok);
        S.prev = Q[S.q].nextAnchor;
        S.revealed = [S.prev.value];
        S.q += 1;
      } else {
        S.revealed.push(item.value);
        S.glideOldFig = figureText(itemAt(S.q).cat, S.prev); // what the old starting dot showed, which fades away
        S.glideFigOld = null;
        S.glideFrom = S.lastAt; // the answer you just saw moves to the middle
        S.glideOk = !!(S.last && S.last.ok); // and keeps its green or red until it arrives
        S.prev = item;
        S.q += 1;
        S.phase = "ask";
      }
    }
    render();
    if (finishedNow) afterFinish();
  }

  /* ---------- ruler ---------- */
  const calmMotion = () => typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The glide ruler. Your current value is always in the middle, labelled above the dot.
  // After you answer, the new dot slides out of the middle with its figure under it.
  // When you move on, the old starting dot fades, and the green or red dot and its label glide to the middle together:
  // the figure rises from under the dot to above it and stays there as the new starting figure.
  // Nothing on it depends on anything you have not seen, so it cannot hint at the answer.
  function rulerHTML(cat, newItem, wrong) {
    const side = (p) => (p < 20 ? " at-l" : p > 80 ? " at-r" : " at-c");
    const fig = (it) => `<b>${figureText(cat, it)}</b>`; // just the figure (no "about"): the name and the "about" are in the big answer at the top
    const calm = calmMotion();
    const from = S.glideFrom; // where the answer dot sat on the reveal screen, if it should now move to the middle
    const gliding = !newItem && !calm && !!S.glideOldFig && from !== null && from !== undefined && Math.abs(from - 50) > 0.5;
    let dots;
    if (gliding) {
      // At the halfway point it is the same object in a new category: its old figure fades out as the new one fades in.
      const figure = S.glideFigOld ? `<b class="fig-old">${S.glideFigOld}</b><b class="fig-new">${figureText(cat, S.prev)}</b>` : fig(S.prev);
      dots =
        `<div class="mark-pt leaving" style="left:50%"><span class="dot"></span><span class="tag above"><b>${S.glideOldFig}</b></span></div>` +
        `<div class="mark-pt prev glide-in ${S.glideOk ? "from-ok" : "from-wrong"}" style="left:${from}%;--from:${from}%"><span class="dot"></span>` +
        `<span class="tag rider${side(from)}">${figure}</span></div>`;
    } else {
      dots = `<div class="mark-pt prev" style="left:50%"><span class="dot"></span><span class="tag above">${fig(S.prev)}</span></div>`;
    }
    let landed = "";
    let caps = "";
    if (newItem) {
      const to = slideAt(cat, S.prev.value, newItem.value);
      landed =
        `<div class="mark-pt new slide${wrong ? " wrong" : ""}" style="left:50%" data-to="${to}"><span class="dot"></span>` +
        `<span class="tag rider${side(to)}">${fig(newItem)}</span></div>`;
    } else {
      const b = CATEGORIES[cat].buttons;
      caps = `<span class="endcap l">&larr; ${b[0]}</span><span class="endcap r">${b[1]} &rarr;</span>`;
    }
    return `<div class="ruler" aria-hidden="true"><div class="axis glide"><div class="ticks"></div></div>${dots}${landed}${caps}</div>`;
  }

  // After the reveal screen is drawn, slide the new dot from your starting point to where the answer is.
  function startSlide() {
    const el = root.card.querySelector(".mark-pt.slide");
    if (!el || !el.getAttribute) return;
    const to = el.getAttribute("data-to");
    const go = () => {
      el.style.left = `${to}%`;
    };
    const calm = typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm || typeof requestAnimationFrame !== "function") return go();
    requestAnimationFrame(() => requestAnimationFrame(go));
  }

  const hintText = (it) => (it && it.hint ? `${it.hint.charAt(0).toUpperCase() + it.hint.slice(1)}.` : "");
  // The big answer, with a hint line that always takes up its space (empty when there is no hint), so the ruler never moves.
  function bigBlockHTML(cat, it, hint = "", hintClass = "") {
    const p = valueParts(cat, it);
    return (
      `<p class="big">${p.num}${p.unit ? ` <small>${p.unit}</small>` : ""}</p><p class="name">${displayName(cat, it)}</p>` +
      `<p class="hintline${hintClass}">${hint}</p>`
    );
  }

  function tierBadge(q) {
    const t = tierFor(S.ratios[q]);
    const worth = t.mult === 1 ? "worth 1x" : t.mult === 2 ? "worth double" : "worth 1.5x";
    const deep = S.deep[q] && S.mode === "daily"
      ? ` <span class="tier deep">Deep cut</span> <span class="tierworth">+${Math.round((SCORING.deepCut - 1) * 100)}% for an expert question</span>`
      : "";
    const warm = q === 0 && P.warmUp && S.mode === "daily" ? ` <span class="tier warm">Warm-up</span> <span class="tierworth">an easy start</span>` : "";
    return `<p class="tierrow"><span class="tier ${t.key}">${t.label}</span> <span class="tierworth">${worth}</span>${warm}${deep}</p>`;
  }

  function askHTML() {
    const { cat, item } = itemAt(S.q);
    const c = CATEGORIES[cat];
    const first = Q[S.q].start;
    // The top slot (the tier, where the verdict was), the big answer and the ruler sit where they did on the reveal.
    // A hint shows on the first question of every stretch. Straight after a reveal it is still there, fading out, so nothing moves.
    const justRevealed = S.glideFrom !== null && S.glideFrom !== undefined;
    const hint = first || justRevealed ? hintText(S.prev) : "";
    return (
      `<div class="topslot">${tierBadge(S.q)}</div>` +
      bigBlockHTML(cat, S.prev, hint, !first && hint ? " ghost" : "") +
      rulerHTML(cat, null, false) +
      `<p class="ask">${questionText(cat, c.words, item, S.prev)}</p>` +
      (item.clue ? `<p class="clue">(${item.clue})</p>` : "") +
      `<div class="choices">` +
      `<button class="choice" data-pick="down">${c.buttons[0]}</button>` +
      `<button class="choice" data-pick="up">${c.buttons[1]}</button>` +
      `</div>`
    );
  }
  function verdictParts(ok, sc) {
    const d = sc.detail[S.q];
    const note = ok
      ? `${d.tier.label} x${d.difficulty}${d.deep && S.mode === "daily" ? `, deep cut x${SCORING.deepCut}` : ""}, sweep x${d.multiplier.toFixed(1)}`
      : "Sweep broken. Your next right answer starts a new one";
    return {
      line:
        `<p class="verdict ${ok ? "ok" : "miss"}"><span class="mark">${ok ? "&#10003;" : "&#10005;"}</span>` +
        `${ok ? "Swept" : "Left in the dust"} <span class="pts">+${d.points}</span></p>`,
      note: `<p class="ptsnote">${note}. Score so far: ${sc.total.toLocaleString("en-GB")}</p>`,
    };
  }
  function revealHTML() {
    const { cat, item } = itemAt(S.q);
    const c = CATEGORIES[cat];
    const label = S.q === RULES.chainLength - 1 ? "See result" : "Next question";
    // The top slot, the big answer and the ruler sit in exactly the same place on the question screen, so nothing jumps.
    const v = verdictParts(S.last.ok, scoreRun(S.ratios, S.results, S.deep));
    return (
      `<div class="topslot">${v.line}</div>` +
      bigBlockHTML(cat, item, hintText(item)) +
      rulerHTML(cat, item, !S.last.ok) +
      v.note +
      `<p class="diff">${differenceText(cat, c.words, item, S.prev)}</p>` +
      (item.note ? `<p class="fact">${item.note}</p>` : "") +
      `<div class="row"><button class="btn" id="next">${label}</button></div>`
    );
  }

  function gridHTML() {
    return S.results.map((r) => (r ? "\u{1F9F9}" : "\u{1F4A8}")).join("");
  }

  function actionsHTML() {
    if (S.mode === "daily") {
      // No practice button here: practice is always in the "?" panel, and this card is for sharing today's result.
      return canShare()
        ? `<button class="btn" id="share">Share result</button><button class="btn quiet" id="copy">Copy result</button>`
        : `<button class="btn" id="copy">Copy result</button>`;
    }
    // Practice goes round in a loop: 1, then 2, then 1 again.
    const next = (S.practiceNo % practiceTotal()) + 1;
    return (
      `<button class="btn" data-mode="practice" data-practice="${next}">Practice puzzle ${next}</button>` +
      `<button class="btn quiet" data-mode="daily">Back to today's puzzle</button>`
    );
  }

  function doneHTML() {
    const st = streaks(S.results);
    const sc = scoreRun(S.ratios, S.results, S.deep);
    const msg = st.longest === RULES.chainLength ? "A Clean Sweep! \u2728" : sc.pct >= 80 ? "Great sweep." : sc.pct >= 60 ? "Solid sweep." : sc.pct >= 40 ? "Not bad." : "Tomorrow, sweep again.";
    const facts = P.legs.flatMap((leg) => [leg.anchor, ...leg.items]);
    const list = facts
      .map((f) => {
        const src = /^https?:/.test(f.source) ? `<a href="${f.source}" target="_blank" rel="noopener noreferrer">source</a>` : f.source;
        return `<li>${displayName(f.cat, f)}: ${valueText(f.cat, f)} (${src})</li>`;
      })
      .join("");
    const daily = S.mode === "daily";
    const stats = daily
      ? `<div class="stats"><div class="stat"><b>${currentStreak(store, todayNum)}</b><span>day streak</span></div>` +
        `<div class="stat"><b>${store.stats.bestStreak}</b><span>best streak</span></div>` +
        `<div class="stat"><b>${store.stats.played}</b><span>played</span></div>` +
        `<div class="stat"><b>${store.stats.bestPct || 0}%</b><span>best score</span></div></div>`
      : "";
    return (
      `<p class="kicker">${daily ? `Puzzle #${todayNum}` : `Practice ${S.practiceNo} of ${practiceTotal()}`}</p>` +
      `<p class="score">${sc.pct}<small>%</small></p>` +
      `<p class="name">${sc.total.toLocaleString("en-GB")} of ${sc.max.toLocaleString("en-GB")} points. ${msg}</p>` +
      `<p class="name">Longest sweep ${st.longest}. Cleaned ${st.correct} of ${RULES.chainLength}.</p>` +
      `<p class="grid-out" aria-hidden="true">${gridHTML()}</p>` +
      stats +
      `<div class="row">` +
      actionsHTML() +
      `</div>` +
      (daily ? `<p class="lockline" id="countdown">Next puzzle in ${countdownText()}.</p>` : `<p class="lockline">Practice puzzles do not count towards your streak or best score.</p>`) +
      `<p class="toast" id="toast"></p>` +
      `<details class="facts"><summary>How scoring works</summary>` +
      `<ul class="how"><li>Each right answer scores 100 points.</li><li>Easy x1, Medium x1.5, Close call x2. You see the tag first.</li><li>Deep cut (some days): x1.5 on top.</li><li>Each right answer in a row adds 10%.</li><li>A wrong answer scores 0 and breaks your sweep.</li><li>Your score is a % of the day's maximum.</li></ul></details>` +
      `<details class="facts"><summary>Facts in this puzzle</summary><ul>${list}</ul></details>`
    );
  }

  /* ---------- chrome ---------- */
  function renderTop() {
    // The only button here is the way back from a practice puzzle. There is no Practice tab.
    root.tabs.innerHTML = S.mode === "daily" ? "" : `<button class="tab" data-mode="daily">Back to today's puzzle</button>`;
    root.meta.textContent = S.mode === "daily" ? `Puzzle #${todayNum}` : `Practice ${S.practiceNo} of ${practiceTotal()}`;
  }

  function renderChain() {
    let html = "";
    for (let i = 0; i < RULES.chainLength; i++) {
      let cls = "link";
      let txt = "";
      const r = S.results[i];
      if (r === true) {
        cls += " ok";
        txt = "\u{1F9F9}";
      } else if (r === false) {
        cls += " miss";
        txt = "\u{1F4A8}";
      } else if (i === S.results.length && S.phase !== "done") cls += " now";
      if (i > 0 && r === true && S.results[i - 1] === true) cls += " joined";
      html += `<span class="${cls}">${txt}</span>`;
    }
    root.chain.innerHTML = html;
    const st = streaks(S.results);
    root.chain.setAttribute("aria-label", `Sweep: ${st.correct} clean of ${S.results.length} answered`);
  }

  // "Next puzzle in 6h 12m", updated every half minute while the result card is on screen.
  let countdownTimer = null;
  function stopCountdown() {
    if (countdownTimer !== null && typeof clearInterval === "function") clearInterval(countdownTimer);
    countdownTimer = null;
  }
  function updateCountdown() {
    const el = document.getElementById("countdown");
    if (!el) return stopCountdown();
    if (puzzleNumber(new Date()) > todayNum) {
      el.innerHTML = `A new puzzle is ready. <button class="linkbtn" id="newpuzzle" type="button">Play it</button>`;
      stopCountdown();
    } else {
      el.textContent = `Next puzzle in ${countdownText()}.`;
    }
  }
  function startCountdown() {
    stopCountdown();
    if (typeof setInterval === "function") countdownTimer = setInterval(updateCountdown, 30000);
  }

  function render() {
    stopCountdown();
    const movie = !calmMotion() ? captureScreen(root.card) : null;
    renderTop();
    renderChain();
    let focus = null;
    if (S.phase === "done") {
      root.card.innerHTML = doneHTML();
      focus = "#share, #copy, .row .btn";
    } else if (S.phase === "ask") {
      root.card.innerHTML = askHTML();
      focus = ".choice";
    } else {
      root.card.innerHTML = revealHTML();
      focus = "#next";
    }
    if (movie && S.phase !== "done") playTransition(movie, { card: root.card, doc: document });
    if (S.phase === "reveal") startSlide();
    if (S.phase === "ask") {
      S.glideFrom = null; // these only play once, straight after the reveal
      S.glideOldFig = null;
    }
    if (S.phase === "done" && S.mode === "daily") startCountdown();
    if (focus && S.results.length > 0) {
      const el = root.card.querySelector(focus);
      if (el) {
        try {
          el.focus({ preventScroll: true });
        } catch (e) {
          el.focus();
        }
      }
    }
  }

  /* ---------- sharing ---------- */
  const resultText = () => shareText(P, S.results, S.mode === "daily" ? todayNum : null, scoreRun(S.ratios, S.results, S.deep));
  const canShare = () => typeof navigator !== "undefined" && !!navigator && typeof navigator.share === "function";

  // The phone's own share sheet (WhatsApp, Messages and so on). Falls back to copying if it is not available.
  function shareResult() {
    try {
      Promise.resolve(navigator.share({ text: resultText() })).catch((err) => {
        if (err && err.name === "AbortError") return; // they closed the sheet: nothing to do
        copyResult();
      });
    } catch (e) {
      copyResult();
    }
  }

  function copyResult() {
    const text = resultText();
    const toast = document.getElementById("toast");
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.className = "copybox";
      ta.rows = 4;
      ta.value = text;
      ta.setAttribute("aria-label", "Result text");
      root.card.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
        toast.textContent = "Copied.";
      } catch (e) {
        toast.textContent = "Select the text above and copy it.";
      }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => (toast.textContent = "Copied."), fallback);
      } else fallback();
    } catch (e) {
      fallback();
    }
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.mode) return begin(t.dataset.mode, t.dataset.practice);
    if (t.dataset.pick) return answer(t.dataset.pick);
    if (t.id === "next") return advance();
    if (t.id === "copy") return copyResult();
    if (t.id === "share") return shareResult();
    if (t.id === "newpuzzle") return globalThis.location && globalThis.location.reload();
  });

  if (typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && countdownTimer !== null) updateCountdown();
    });
  }

  begin("daily");
}
