# Changelog

The version number is in `src/version.js` and shows at the bottom of the page. Change both together.

## v2.1
- **Practice is always available.** Both practice puzzles are on offer in the "?" panel (Practice 1 and Practice 2), whether or not you have played them or finished today's puzzle. They are the same two puzzles every time, so they work as a practice, a demo to show friends, and a way to test.
- After a practice puzzle, the buttons are the next practice puzzle (1, then 2, then 1 again) and "Back to today's puzzle". There is still no practice button on today's result card, and no Share button for practice.
- Practice still counts for nothing: it never touches your streak, scores or player counts, and nothing about it is saved any more.

## v2
- **The ruler no longer gives anything away.** It used to be drawn to fit the whole half, so its shape hinted at which way the answer lay (in 44% of questions the answer was certain, if you noticed). Now your current value is always in the middle, and nothing on the ruler depends on anything you have not seen yet.
- **New movement.** After you answer, the new dot slides out of the middle. The closer the two values, the less far it goes: a close call moves a clear distance, an easy one nearly to the end. When you move on, the old starting dot fades while the green or red dot (and its figure) glide to the middle together, the figure rising from under the dot to above it. It settles to its usual colour as it arrives. At the halfway point (for example height to weight) the same happens, and the figure changes as it goes. It all runs at one speed and ease, with no overshoot.
- **One smooth movement between screens.** The top slot (the verdict, then the tier), the big answer and the ruler stay put. The old screen cross-fades into the new one, the big answer only fades when it actually changes, and the card eases to its new height without cutting anything off.
- **The ruler labels show only the figure.** The name stays in the big answer at the top.
- **Layout.** The tier row ("Close call, worth double") takes the verdict's place at the top of the question screen, and the points note moved below the ruler. The "Last answer" caption is gone.
- **Hints** show with the big answer on the reveal and on the two starting questions. A hint left over from a reveal fades out, and the hint line keeps its space even when it is empty, so nothing moves.
- **Practice puzzles no longer show the Warm-up and Deep cut badges.** The daily puzzles still do.
- **Fixed:** "about 1 tonnes" now reads "about 1 tonne".
- **Code:** one ruler (the experiments are gone), the ruler's one rule in `src/ruler.js`, the cross-fade in `src/transition.js`, and new tests, including one that plays a whole game and checks every screen.
- This includes everything from v1.6 to v1.9 (below).

## v1.9
- The "Date (question 3 of 7)" line above each question is gone. The chain at the top shows where you are.
- The "Hinge" screen between the two halves is gone. After the last question of the first half, "Next question" goes straight to the next question, which shows the new starting point.
- The "new puzzle arrives at 1:00 your time (midnight UTC)" line is now a countdown: "Next puzzle in 6h 12m". It updates by itself, stays right when the clocks change, and when the time comes it says "A new puzzle is ready" with a "Play it" link.

## v1.8
- The fonts (Bricolage Grotesque and Newsreader) are now hosted on the site itself, in `src/fonts`, instead of being loaded from Google. The look is the same, on every device, and visitors' addresses are no longer sent to Google. Total size is about 285 KB, loaded once and then cached.
- A `LICENSE` file: all rights reserved, Michael Major. The fonts keep their own licence in `src/fonts/OFL.txt`.
- The share card now ends with `tinyurl.com/cleansweepdaily`.
- A test checks that the page never loads fonts from Google again.

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
