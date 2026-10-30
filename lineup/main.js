// Line Up: entry point. Loads the facts and the frozen days, then starts the game.
import { buildPool } from "./data.js";
import { setDays, setLaunch, setPool } from "./logic.js";
import { mountLineUp } from "./ui.js";
import { VERSION } from "../src/version.js";
import { GOATCOUNTER_CODE } from "../src/site.js";
import { startCounter, wireSwitcher } from "../src/games.js";

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    s.setItem("lu:probe", "1");
    s.removeItem("lu:probe");
    return s;
  } catch (e) {
    return null; // private mode or blocked: the game works, it just cannot save
  }
}

// Light and dark mode, shared with the other games: the choice made on any page is used on all of them.
function setupTheme() {
  const btn = document.getElementById("theme");
  const html = document.documentElement;
  if (!btn || !html) return;
  const THEME_KEY = "cleansweep:theme";
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
      globalThis.localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* the choice just will not be remembered */
    }
    show();
  });
  show();
}

async function start() {
  setupTheme();
  startCounter(GOATCOUNTER_CODE);
  wireSwitcher();
  const ver = document.getElementById("ver");
  if (ver) ver.textContent = VERSION;
  try {
    const facts = globalThis.__CLEANSWEEP_FACTS__ || (await loadJSON("../data/facts.json"));
    const days = globalThis.__LINEUP_DAYS__ || (await loadJSON("../data/lineup-days.json"));
    setPool(buildPool(facts.entities));
    setLaunch(days.launchDate);
    setDays(days.days);
    mountLineUp({ storage: safeStorage() });
  } catch (err) {
    const el = document.getElementById("end");
    if (el) el.innerHTML = `<p class="msg">Sorry, today's puzzle could not load.</p><p class="msg">${String(err.message || err)}</p>`;
  }
}

start();
