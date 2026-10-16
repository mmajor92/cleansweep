# Changelog

The version number is in `src/version.js` and shows at the bottom of the page. Change both together.

## v1.7
- The light and dark button now shows the mode you are in: a moon in dark mode and a sun in light mode. Its tooltip and screen-reader label still say what a tap does.

## v1.6
- Header: "Puzzle #1" now sits in italics under the title, and the "?" and light and dark buttons are top right on one row, on phones too.
- The Practice tab is gone. There are now exactly two fixed practice puzzles, the same for everyone and never changing with the date. They are offered inside How to play, each can be played once per device, and they are not offered once today's puzzle is finished. Practice 1 opens with a Warm-up and practice 2 has a Deep cut, so players meet both badges first.
- Practice results do not count towards streaks or best scores, and there is no Share or Copy button for them.
- After a practice puzzle, the only buttons are the next practice (if any) and "Back to today's puzzle". There is no "Play again".
- The result card heading is now "Puzzle #1" (or "Practice 1 of 2"), not the two category names.
- New files: `puzzles/practice-1.json` and `puzzles/practice-2.json`.

## v1.5
- A "?" button next to the light and dark toggle opens a short How to play. It also opens by itself the first time someone visits.
- A Share result button on phones, which opens the phone's own share sheet (WhatsApp, Messages and so on). Copy result is still there.
- A Clean Sweep (all seven right) sends brooms and sparkles floating up the screen. It is skipped for anyone whose phone is set to reduce motion.
- Optional player counting with GoatCounter. It is off until you put a site code in `src/site.js`. See LAUNCH.md.
- This update also includes everything from v1.3 and v1.4 (below).

## v1.4
- The chain at the top is one even row of brooms and dust: no gap in the middle.
- The "Date" and "Weight" labels under the chain are gone.

## v1.3
- The yellow diamond between the two halves of the chain is gone. The halves are now separated by a small gap, so it is just brooms and dust.
- "How scoring works" is now a short list instead of a long paragraph.

## v1.2
- The chain at the top: brooms and dust puffs no longer overlap, and the white pills behind them are gone.
- Light and dark mode toggle, to the left of the puzzle number. It remembers your choice. With no choice made, the page follows your phone's setting.
- A small version number at the bottom of the page.

## v1.1
- The result card and the chain show brooms and dust, matching the share card.
- Category emojis removed from the screens. The names stay.

## v1.0
- Launch: puzzle #1 on Friday 16 October 2026.
