// The cross-fade between one screen and the next. When a screen is replaced, a faded copy of the old one stays on top
// for a moment while the new one fades in, and the card eases to its new height. Nothing vanishes abruptly.
//
// The ruler is left out of the copy, because it keeps moving on its own, and so is the big answer when it has not changed
// (after a reveal, the next question shows the same answer at the top, so it simply stays put).
// The DOM it needs is passed in, so it can be tested without a browser.

export const TRANSITION = {
  fadeMs: 330, // the old screen fades out
  fadeInMs: 350, // the new screen fades in
  heightMs: 350, // the card eases to its new height
};

const KEYS = ["big", "name"]; // the two lines of the big answer
const has = (el, c) => !!(el && el.classList && el.classList.contains(c));
const keyOf = (el) => KEYS.find((k) => has(el, k)) || null;
const skipped = (el) => has(el, "ruler") || has(el, "hintline"); // the ruler moves on its own; the hint line fades itself

const usable = (r) => !!r && Number.isFinite(r.left) && Number.isFinite(r.top) && r.width > 0 && r.height > 0;

function stripIds(el) {
  if (el.removeAttribute) el.removeAttribute("id");
  if (el.querySelectorAll) el.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
}

/** Called just before a screen is replaced. Takes faded-copy material and the card's current height. Null if not possible. */
export function captureScreen(card) {
  try {
    if (!card || typeof card.getBoundingClientRect !== "function" || !card.children || !card.children.length) return null;
    const height = card.getBoundingClientRect().height;
    if (!(height > 0)) return null;
    const items = [];
    for (const child of Array.from(card.children)) {
      if (skipped(child)) continue;
      const box = child.getBoundingClientRect();
      if (!usable(box)) continue;
      const clone = child.cloneNode(true);
      stripIds(clone);
      items.push({ clone, box, key: keyOf(child), html: child.outerHTML });
    }
    return { height, items };
  } catch (e) {
    return null;
  }
}

/** Called straight after the new screen has been drawn. Returns { cleanup }. If anything fails, the new screen is just shown. */
export function playTransition(cap, { card, doc, timer = (fn, ms) => setTimeout(fn, ms) }) {
  const made = [];
  const undo = [];
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    made.forEach((el) => el.remove && el.remove());
    undo.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        /* nothing to undo */
      }
    });
  };
  try {
    const now = Array.from(card.children);
    // The big answer is only cross-faded if it actually changed (an answer reveal, or the halfway point).
    const unchanged = KEYS.every((k) => {
      const before = cap.items.find((i) => i.key === k);
      const after = now.find((c) => has(c, k));
      return !!before && !!after && before.html === after.outerHTML;
    });
    const stays = (el) => unchanged && KEYS.some((k) => has(el, k));

    // 1. A faded copy of the old screen, fading out on top.
    cap.items.forEach((it) => {
      if (unchanged && it.key) return;
      Object.assign(it.clone.style, {
        position: "fixed",
        left: `${it.box.left}px`,
        top: `${it.box.top}px`,
        width: `${it.box.width}px`,
        margin: "0",
        pointerEvents: "none",
        zIndex: "40",
      });
      doc.body.appendChild(it.clone);
      made.push(it.clone);
      it.clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TRANSITION.fadeMs, easing: "ease", fill: "both" });
    });

    // 2. The new screen fades in underneath.
    now.forEach((el) => {
      if (skipped(el) || stays(el) || typeof el.animate !== "function") return;
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TRANSITION.fadeInMs, easing: "ease" });
    });

    // 3. The card eases to its new height. Only the bottom edge is clipped, so nothing is cut off at the top or sides.
    const after = card.getBoundingClientRect().height;
    if (typeof card.animate === "function" && after > 0 && Math.abs(after - cap.height) >= 3) {
      const clip = card.style.clipPath;
      card.style.clipPath = "inset(-300px -300px 0 -300px)";
      undo.push(() => {
        card.style.clipPath = clip;
      });
      const a = card.animate([{ height: `${cap.height}px` }, { height: `${after}px` }], { duration: TRANSITION.heightMs, easing: "ease" });
      a.onfinish = cleanup;
      a.oncancel = cleanup;
    }

    timer(cleanup, Math.max(TRANSITION.fadeMs, TRANSITION.heightMs) + 60);
  } catch (e) {
    cleanup();
  }
  return { cleanup };
}
