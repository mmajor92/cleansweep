// Rendering and game flow. The only module that touches the DOM.
import { CATEGORIES, RULES, correctPick, streaks, shareText, nextPuzzleTime } from "./engine.js";
import { valueParts, valueText, differenceText, questionText } from "./format.js";
import { questionDeep, questionRatios, scoreRun, tierFor, SCORING } from "./score.js";
import { loadState, saveState, recordPick, completeDay, currentStreak, dayRecord, prune } from "./store.js";

/**
 * env: {
 *   root: { tabs, meta, chain, card },
 *   storage: Storage | null,
 *   todayNum: number,
 *   dailyPuzzle: puzzle,
 *   practicePuzzle: () => puzzle
 * }
 */
export function mountGame(env) {
  const { root, storage, todayNum } = env;
  let store = prune(loadState(storage), todayNum);
  let P = null;
  let S = null;

  const itemAt = (q) =>
    q < P.n1
      ? { cat: P.c1, seg: P.seg1, item: P.seg1.items[q] }
      : { cat: P.c2, seg: P.seg2, item: P.seg2.items[q - P.n1] };

  /* ---------- state ---------- */
  function begin(mode) {
    P = mode === "daily" ? env.dailyPuzzle : env.practicePuzzle();
    S = { mode, q: 0, picks: [], results: [], phase: "ask", last: null, prev: P.seg1.anchor, revealed: [P.seg1.anchor.value], ratios: questionRatios(P), deep: questionDeep(P) };
    if (mode === "daily") {
      const rec = dayRecord(store, todayNum);
      if (rec) replay(rec.picks);
    }
    render();
  }

  function restart() {
    S = { mode: S.mode, q: 0, picks: [], results: [], phase: "ask", last: null, prev: P.seg1.anchor, revealed: [P.seg1.anchor.value], ratios: questionRatios(P), deep: questionDeep(P) };
    render();
  }

  function replay(picks) {
    for (let k = 0; k < picks.length; k++) {
      const { item } = itemAt(k);
      S.results.push(picks[k] === correctPick(item, S.prev));
      S.picks.push(picks[k]);
      if (k === P.n1 - 1) {
        S.prev = P.seg2.anchor;
        S.revealed = [P.seg2.anchor.value];
      } else {
        S.prev = item;
        S.revealed.push(item.value);
      }
    }
    S.q = picks.length;
    S.phase = S.q >= RULES.chainLength ? "done" : S.q === P.n1 ? "hinge" : "ask";
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
    const { item } = itemAt(S.q);
    const ok = pick === correctPick(item, S.prev);
    S.picks.push(pick);
    S.results.push(ok);
    S.last = { ok };
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
      } else if (S.q === P.n1 - 1) {
        S.phase = "hinge";
        S.prev = P.seg2.anchor;
        S.revealed = [P.seg2.anchor.value];
        S.q += 1;
      } else {
        S.revealed.push(item.value);
        S.prev = item;
        S.q += 1;
        S.phase = "ask";
      }
    } else if (S.phase === "hinge") {
      S.phase = "ask";
    }
    render();
    if (finishedNow) afterFinish();
  }

  /* ---------- ruler ---------- */
  function pos(cat, v, vals) {
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    let p;
    if (CATEGORIES[cat].scale === "log") {
      const lo = mn * 0.8;
      const hi = mx * 1.25;
      p = (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
    } else {
      p = mx === mn ? 0.5 : (v - mn) / (mx - mn);
    }
    return 14 + 72 * p;
  }

  function rulerHTML(cat, seg, showNew, newItem, wrong) {
    const vals = [seg.anchor.value, ...seg.items.map((i) => i.value)];
    const pts = [];
    S.revealed.slice(0, -1).forEach((v) => {
      pts.push(`<div class="mark-pt old" style="left:${pos(cat, v, vals)}%"><span class="dot"></span></div>`);
    });
    const pv = S.revealed[S.revealed.length - 1];
    pts.push(
      `<div class="mark-pt prev" style="left:${pos(cat, pv, vals)}%"><span class="dot"></span>` +
        `<span class="tag above"><b>${valueText(cat, S.prev)}</b>${S.prev.label}</span></div>`
    );
    if (showNew) {
      pts.push(
        `<div class="mark-pt new${wrong ? " wrong" : ""}" style="left:${pos(cat, newItem.value, vals)}%"><span class="dot"></span>` +
          `<span class="tag below"><b>${valueText(cat, newItem)}</b>${newItem.label}</span></div>`
      );
    }
    return `<div class="ruler" aria-hidden="true"><div class="axis"></div>${pts.join("")}</div>`;
  }

  /* ---------- views ---------- */
  function bigHTML(cat, it) {
    const p = valueParts(cat, it);
    const hint = it.hint ? `<p class="hintline">${it.hint.charAt(0).toUpperCase() + it.hint.slice(1)}.</p>` : "";
    return `<p class="big">${p.num}${p.unit ? ` <small>${p.unit}</small>` : ""}</p><p class="name">${it.label}</p>${hint}`;
  }

  function tierBadge(q) {
    const t = tierFor(S.ratios[q]);
    const worth = t.mult === 1 ? "worth 1x" : t.mult === 2 ? "worth double" : "worth 1.5x";
    const deep = S.deep[q]
      ? ` <span class="tier deep">Deep cut</span> <span class="tierworth">+${Math.round((SCORING.deepCut - 1) * 100)}% for an expert question</span>`
      : "";
    const warm = q === 0 && P.warmUp ? ` <span class="tier warm">Warm-up</span> <span class="tierworth">an easy start</span>` : "";
    return `<p class="tierrow"><span class="tier ${t.key}">${t.label}</span> <span class="tierworth">${worth}</span>${warm}${deep}</p>`;
  }

  function askHTML() {
    const { cat, seg, item } = itemAt(S.q);
    const c = CATEGORIES[cat];
    const first = S.q === 0 || S.q === P.n1;
    return (
      `<p class="kicker">${c.name} (question ${S.q + 1} of ${RULES.chainLength})</p>` +
      `<p class="kicker">${first ? "Starting point" : "Last answer"}</p>` +
      bigHTML(cat, S.prev) +
      rulerHTML(cat, seg, false) +
      tierBadge(S.q) +
      `<p class="ask">${questionText(cat, c.words, item, S.prev)}</p>` +
      (item.clue ? `<p class="clue">(${item.clue})</p>` : "") +
      `<div class="choices">` +
      `<button class="choice" data-pick="down">${c.buttons[0]}</button>` +
      `<button class="choice" data-pick="up">${c.buttons[1]}</button>` +
      `</div>`
    );
  }

  function verdictHTML(ok, sc) {
    const d = sc.detail[S.q];
    const note = ok
      ? `${d.tier.label} x${d.difficulty}${d.deep ? `, deep cut x${SCORING.deepCut}` : ""}, sweep x${d.multiplier.toFixed(1)}`
      : "Sweep broken. Your next right answer starts a new one";
    return (
      `<p class="verdict ${ok ? "ok" : "miss"}"><span class="mark">${ok ? "&#10003;" : "&#10005;"}</span>` +
      `${ok ? "Swept" : "Left in the dust"} <span class="pts">+${d.points}</span></p>` +
      `<p class="ptsnote">${note}. Score so far: ${sc.total.toLocaleString("en-GB")}</p>`
    );
  }

  function revealHTML() {
    const { cat, seg, item } = itemAt(S.q);
    const c = CATEGORIES[cat];
    const label = S.q === RULES.chainLength - 1 ? "See result" : S.q === P.n1 - 1 ? "Continue" : "Next question";
    return (
      verdictHTML(S.last.ok, scoreRun(S.ratios, S.results, S.deep)) +
      bigHTML(cat, item) +
      rulerHTML(cat, seg, true, item, !S.last.ok) +
      `<p class="diff">${differenceText(cat, c.words, item, S.prev)}</p>` +
      (item.note ? `<p class="fact">${item.note}</p>` : "") +
      `<div class="row"><button class="btn" id="next">${label}</button></div>`
    );
  }

  function hingeHTML() {
    const from = P.seg1.items[P.n1 - 1];
    const c1 = CATEGORIES[P.c1];
    const c2 = CATEGORIES[P.c2];
    return (
      `<p class="kicker">Hinge: switching from ${c1.name.toLowerCase()} to ${c2.name.toLowerCase()}</p>` +
      `<p class="subject">${P.hinge.name}</p>` +
      `<p class="hingeline">You just placed ${from.phrase}. Here is a free fact about it, and your new starting point.</p>` +
      `<div style="margin-top:16px">${bigHTML(P.c2, P.seg2.anchor)}</div>` +
      `<div class="row"><button class="btn" id="next">Start the ${c2.name.toLowerCase()} questions</button></div>`
    );
  }

  // One emoji per question, the same as the share card: a broom for right, a puff of dust for wrong.
  function gridHTML() {
    return S.results.map((r) => (r ? "\u{1F9F9}" : "\u{1F4A8}")).join("");
  }

  function doneHTML() {
    const st = streaks(S.results);
    const sc = scoreRun(S.ratios, S.results, S.deep);
    const msg = st.longest === RULES.chainLength ? "A Clean Sweep! \u2728" : sc.pct >= 80 ? "Great sweep." : sc.pct >= 60 ? "Solid sweep." : sc.pct >= 40 ? "Not bad." : "Tomorrow, sweep again.";
    const facts = [P.seg1.anchor, ...P.seg1.items, P.seg2.anchor, ...P.seg2.items];
    const list = facts
      .map((f) => {
        const src = /^https?:/.test(f.source) ? `<a href="${f.source}" target="_blank" rel="noopener noreferrer">source</a>` : f.source;
        return `<li>${f.label}: ${valueText(f.cat, f)} (${src})</li>`;
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
      `<p class="kicker">${CATEGORIES[P.c1].name} to ${CATEGORIES[P.c2].name}</p>` +
      `<p class="score">${sc.pct}<small>%</small></p>` +
      `<p class="name">${sc.total.toLocaleString("en-GB")} of ${sc.max.toLocaleString("en-GB")} points. ${msg}</p>` +
      `<p class="name">Longest sweep ${st.longest}. Cleaned ${st.correct} of ${RULES.chainLength}.</p>` +
      `<p class="grid-out" aria-hidden="true">${gridHTML()}</p>` +
      stats +
      `<div class="row">` +
      (canShare()
        ? `<button class="btn" id="share">Share result</button><button class="btn quiet" id="copy">Copy result</button>`
        : `<button class="btn" id="copy">Copy result</button>`) +
      (daily
        ? `<button class="btn quiet" data-mode="practice">Practice puzzle</button>`
        : `<button class="btn quiet" id="again">Play again</button><button class="btn quiet" data-mode="practice">New practice puzzle</button>`) +
      `</div>` +
      (daily ? `<p class="lockline">Today's puzzle is done. A new one arrives at ${nextPuzzleTime().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} your time (midnight UTC).</p>` : "") +
      `<p class="toast" id="toast"></p>` +
      `<details class="facts"><summary>How scoring works</summary>` +
      `<ul class="how"><li>Each right answer scores 100 points.</li><li>Easy x1, Medium x1.5, Close call x2. You see the tag first.</li><li>Deep cut (some days): x1.5 on top.</li><li>Each right answer in a row adds 10%.</li><li>A wrong answer scores 0 and breaks your sweep.</li><li>Your score is a % of the day's maximum.</li></ul></details>` +
      `<details class="facts"><summary>Facts in this puzzle</summary><ul>${list}</ul></details>`
    );
  }

  /* ---------- chrome ---------- */
  function renderTop() {
    root.tabs.innerHTML =
      `<button class="tab" data-mode="daily" aria-pressed="${S.mode === "daily"}">Today's puzzle</button>` +
      `<button class="tab" data-mode="practice" aria-pressed="${S.mode === "practice"}">Practice</button>`;
    root.meta.textContent = S.mode === "daily" ? `Puzzle #${todayNum}` : "Practice";
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

  function render() {
    renderTop();
    renderChain();
    let focus = null;
    if (S.phase === "done") {
      root.card.innerHTML = doneHTML();
      focus = "#again, #copy";
    } else if (S.phase === "hinge") {
      root.card.innerHTML = hingeHTML();
      focus = "#next";
    } else if (S.phase === "ask") {
      root.card.innerHTML = askHTML();
      focus = ".choice";
    } else {
      root.card.innerHTML = revealHTML();
      focus = "#next";
    }
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
    if (t.dataset.mode) return begin(t.dataset.mode);
    if (t.dataset.pick) return answer(t.dataset.pick);
    if (t.id === "next") return advance();
    if (t.id === "again") return restart();
    if (t.id === "copy") return copyResult();
    if (t.id === "share") return shareResult();
  });

  begin("daily");
}
