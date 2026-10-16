// Entry point. Loads facts, picks today's puzzle, and starts the game.
import { buildEntities, generate, generateDaily, puzzleNumber, validatePuzzle } from "./engine.js";
import { mountGame } from "./ui.js";
import { VERSION } from "./version.js";

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
    btn.textContent = dark ? "\u2600\uFE0F" : "\uD83C\uDF19"; // sun to go light, moon to go dark
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
  const ver = document.getElementById("ver");
  if (ver) ver.textContent = VERSION;
  const root = {
    tabs: document.getElementById("tabs"),
    meta: document.getElementById("meta"),
    chain: document.getElementById("chain"),
    caps: document.getElementById("caps"),
    card: document.getElementById("card"),
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

    const practicePuzzle = () => {
      for (let i = 0; i < 20; i++) {
        const p = generate(Math.floor(Math.random() * 1e9), entities);
        if (p) return p;
      }
      return daily;
    };
    mountGame({ root, storage: safeStorage(), todayNum: num, dailyPuzzle: daily, practicePuzzle });
  } catch (err) {
    root.card.innerHTML = `<p class="ask">Sorry, the puzzle could not load.</p><p class="fact">${String(err.message || err)}</p>`;
  }
}

start();
