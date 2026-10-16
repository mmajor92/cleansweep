// Entry point. Loads facts, picks today's puzzle, and starts the game.
import { PRACTICE, buildEntities, generateDaily, generatePractice, puzzleNumber, validatePuzzle } from "./engine.js";
import { mountGame } from "./ui.js";
import { VERSION } from "./version.js";
import { GOATCOUNTER_CODE } from "./site.js";

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    s.setItem("cleansweep:probe", "1");
    s.removeItem("cleansweep:probe");
    return s;
  } catch (e) {
    return null; // private mode or blocked: the game works, it just cannot save
  }
}

// Optional visitor counting. Does nothing unless a GoatCounter code is set in src/site.js.
function loadCounter() {
  if (!GOATCOUNTER_CODE || !document.head || typeof document.createElement !== "function") return;
  try {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", `https://${GOATCOUNTER_CODE}.goatcounter.com/count`);
    document.head.appendChild(s);
  } catch (e) {
    /* counting is optional */
  }
}

// The "How to play" panel: shown the first time someone visits, and any time they tap the question mark.
function setupHelp() {
  const panel = document.getElementById("help");
  const open = document.getElementById("helpbtn");
  const close = document.getElementById("helpclose");
  if (!panel || !open || !open.addEventListener) return;
  const KEY = "cleansweep:help";
  const seen = () => {
    try {
      return globalThis.localStorage.getItem(KEY) === "1";
    } catch (e) {
      return true; // storage blocked: do not nag on every visit
    }
  };
  const remember = () => {
    try {
      globalThis.localStorage.setItem(KEY, "1");
    } catch (e) {
      /* it will just show again next time */
    }
  };
  const show = () => {
    panel.hidden = false;
    open.setAttribute("aria-expanded", "true");
  };
  const hide = () => {
    panel.hidden = true;
    open.setAttribute("aria-expanded", "false");
    remember();
  };
  open.addEventListener("click", () => (panel.hidden ? show() : hide()));
  const practice = document.getElementById("practicebtn");
  if (practice && practice.addEventListener) practice.addEventListener("click", hide);
  if (close && close.addEventListener) close.addEventListener("click", hide);
  if (!seen()) show();
}

// Light and dark mode. With no saved choice the page follows the phone's own setting.
function setupTheme() {
  const btn = document.getElementById("theme");
  const html = document.documentElement;
  if (!btn || !html || !btn.addEventListener) return;
  const KEY = "cleansweep:theme";
  const systemDark = () => typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = () => html.getAttribute("data-theme") || (systemDark() ? "dark" : "light");
  const show = () => {
    const dark = current() === "dark";
    btn.textContent = dark ? "\uD83C\uDF19" : "\u2600\uFE0F"; // the icon shows the mode you are in: moon for dark, sun for light
    const label = dark ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  };
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    try {
      globalThis.localStorage.setItem(KEY, next);
    } catch (e) {
      /* the choice just will not be remembered */
    }
    show();
  });
  show();
}

async function start() {
  setupTheme();
  setupHelp();
  loadCounter();
  const ver = document.getElementById("ver");
  if (ver) ver.textContent = VERSION;
  const root = {
    tabs: document.getElementById("tabs"),
    meta: document.getElementById("meta"),
    chain: document.getElementById("chain"),
    card: document.getElementById("card"),
    practiceBox: document.getElementById("practicebox"),
    practiceBtn: document.getElementById("practicebtn"),
  };
  try {
    const inlined = globalThis.__CLEANSWEEP_FACTS__;
    const facts = inlined || (await loadJSON("data/facts.json"));
    const entities = buildEntities(facts);
    const num = puzzleNumber(new Date());

    // A published puzzle file wins, so adding facts later never changes a past day.
    let daily = null;
    if (!inlined) {
      try {
        const frozen = await loadJSON(`puzzles/${num}.json`);
        if (validatePuzzle(frozen).length === 0) daily = frozen;
      } catch (e) {
        /* no file for today: fall through to live generation */
      }
    }
    daily = daily || generateDaily(num, entities);
    if (!daily) throw new Error("could not build a puzzle");

    // The two fixed practice puzzles: the same for everyone, never changing with the date.
    const practicePuzzles = [];
    for (let n = 1; n <= PRACTICE.length; n++) {
      let p = null;
      if (!inlined) {
        try {
          const frozen = await loadJSON(`puzzles/practice-${n}.json`);
          if (validatePuzzle(frozen).length === 0) p = frozen;
        } catch (e) {
          /* no frozen file: rebuild the same puzzle from its fixed seed */
        }
      }
      p = p || generatePractice(n, entities);
      if (p) practicePuzzles.push(p);
    }
    mountGame({ root, storage: safeStorage(), todayNum: num, dailyPuzzle: daily, practicePuzzles });
  } catch (err) {
    root.card.innerHTML = `<p class="ask">Sorry, the puzzle could not load.</p><p class="fact">${String(err.message || err)}</p>`;
  }
}

start();
