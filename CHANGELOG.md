# Changelog

The version number is in `src/version.js` and shows at the bottom of the page. Change both together.

## v3.2
- **The same question never comes two days running.** Sunday's and Monday's puzzles (#3 and #4) shared two identical questions, and the generator had nothing to stop it: across a simulated year, about 1 day in 9 repeated a fact from the day before and nearly half repeated some object. Now an object that appears in one day's puzzle cannot appear in the next day's. It cost almost nothing: questions about objects everyone knows dip by a point or two (to about 55%), and a bridge object comes back after about 27 days instead of 25. Over a simulated year there are no repeats at all.
- **Objects that appeared recently are picked less often, so the whole pool gets used.** Until now the same well-known objects came round again and again while others were almost never seen. An object that appeared yesterday is now picked at about a sixth of its normal rate, rising back to normal over 45 days (`freshDays` and `freshFloor` in `RULES`). Over a simulated year, everyday objects seen on fewer than 5 days drop from 19 to 10 (of 143), objects reused from the last 7 days drop by about a quarter, and nothing else moves: questions about objects everyone knows stay at about 55%, and warm-ups, Deep cuts and bridge returns are unchanged. It is a real but modest gain: what is left is mostly objects with a single fact (a deck of cards, days in a week), which can only appear next to a value within 4x of theirs, so the cure there is more facts near those values.
- The rule is a setting (`noRepeatDays` in `RULES`, 1 by default). It is a strict preference for the first 300 tries and then lifted as a last resort, so a puzzle always builds.
- **Puzzles 6 to 24 were rebuilt under the rule.** Puzzles 1 to 5 stay exactly as they were played or are being played. Puzzles 22 to 24 are new, so the pending "Add upcoming puzzles" pull request is not needed.
- The weekly job and the freezing script now read the previous day's saved puzzle, so the first puzzle of every new batch also avoids it. The data check fails if two saved puzzles from #5 on share an object, and checks the same over a whole simulated year. It also reports how many everyday objects appear on fewer than 5 days a year, and warns if that is more than 12%. Its "bridge objects never used" warning now scales with the size of the pool (6%) instead of a fixed count.
- Tests grew from 199 to 211, including one that runs the real freezing script and checks that switching the new rules off is caught.

## v3.1
- **Six new objects, found with the harvest button, and two new facts for the SR-71.** The Douglas DC-3 (first flight, typical passengers, top speed, maximum takeoff weight, length), the Tiger I tank (entering service, crew, road speed, combat weight, length), the Sydney Opera House (opening, Concert Hall seats, length), and Old Trafford, the Stade de France and the Berlin Olympic Stadium (opening and capacity). The SR-71 gains its crew and length, and now has a hint and a clue. That is 21 new facts, each read in at least two places. The SR-71's weight was left out because the sources disagree.
- **The pool grows from 162 to 168 objects, and bridge objects from 77 to 83.** Count + speed goes from 19 to 22, weight + count from 24 to 26, weight + speed from 24 to 26. A bridge object now returns after a median of 25 days.
- Puzzles already saved are not affected. The new objects can appear from puzzle 22 onwards.

## v3
- **The chain can now switch category at any point, and more than once.** Until now every puzzle was two halves joined by one bridge. A puzzle now switches category once to four times (about 34%, 43%, 18% and 4% of days), anywhere in the chain, so a stretch in one category can be a single question or as many as five. The game's look and feel are unchanged: a switch is the same glide the halfway point always had, just not always at the halfway point.
- **New rules keep it fair.** No category takes more than 5 of the 7 questions. Between 2 and 5 answers are "higher". Never more than 4 answers in a row go the same way, and any stretch of 3 or more questions has both a higher and a lower answer. Difficulty (close call, medium, easy) comes out the same as before.
- **Bridges:** a bridge object is not reused within 7 days (the generator now tries many plans before accepting a recent one, so this holds every day). Famous bridges still come round more often. Each day starts in a different category: every block of 5 days uses all five. Pacing: the day after a busy one (three or more switches) has at most two, so two wild days never come back to back.
- **The next puzzles use it from puzzle 3.** Puzzles 1 and 2 stay as they are (they are the older two-half shape, which the game still reads). Puzzles 3 to 21 were rebuilt before anyone could have played them.
- **New practice puzzles.** Practice 1 has one switch (speed, then how many, through Usain Bolt). Practice 2 has two (date, how many, then weight) and ends on a Deep cut. Both use only objects nearly everyone knows.
- **How to play** has one new sentence about the same object carrying you into a different kind of measure.
- **Clearer starting values.** A date under 1000 now shows its era ("80 AD", not a bare "80"; BC already showed), and the line under a date's big figure uses the question's own wording ("Opening of the Colosseum", "Sealing of Magna Carta") instead of a short label that was sometimes just a name. A date whose wording is too long (over 45 characters) keeps its short label. The ruler label above the dot no longer repeats "about" or "c.", since the big figure already says it, but keeps its unit so you can see the measure change at a switch. These apply to every puzzle, including the older two-half ones.
- **Under the hood:** a puzzle is now a list of "legs" (stretches in one category) joined by bridges instead of two halves and one hinge. `normalizePuzzle` converts older puzzle files on load, so they keep working. The data linter, freezing script and practice script were updated, and the tests grew from 174 to 199. They include games played through the real page with one, two and four switches, reloading the page at every point of those games, and the real puzzles 1 and 2 (still in the older shape) played, resumed part-way and finished, so nobody who is mid-game when v3 goes live loses their place.

## v2.2
- **"How to play" no longer opens by itself,** so it does not take over the screen or feel compulsory. It is still one tap away behind the "?".
- **A slim one-line note** under the title tells someone new: "First time? Tap the ? for a practice round!", with a small "Got it". The "?" has a still yellow ring while the note is showing.
- The note goes for good when someone taps Got it, taps the "?", or answers a question (in the real game or in practice), and that is remembered on their device. Anyone who already pressed "Got it" on the old panel, or who has already played a game here, never sees it.
- The "Got it" button is small, so the area you can tap around it is bigger than it looks (about 46 pixels tall).
- **14 new sourced facts on nine well-known objects,** so more of them can bridge between categories: second facts for the cheetah, peregrine falcon, Usain Bolt, giraffe, hippo and African bush elephant (weight, speed and length), and a length for the humpback, sperm and blue whales. Bridge objects go from 67 to 76, and the thin pairs grow (weight + speed 16 to 21, length + speed 21 to 26, length + weight 30 to 39). Puzzles already frozen are not affected.
- **12 more sourced facts on eight famous objects, aimed at the thinnest pairs of categories:** the Boeing 747-400 (maximum takeoff weight, cruise speed, typical seats), the A380 (typical seats), the An-225 (wheels), the Space Shuttle (orbital speed, orbiter length), Queen Mary 2 (displacement), a Steinway concert grand piano (weight, length), Usain Bolt (Olympic golds) and the giraffe (neck vertebrae). Bridge objects go from 76 to 77, and count + speed grows from 13 to 19, weight + count from 17 to 24 and weight + speed from 21 to 24.
- **A "Harvest candidate facts" button** under Actions on GitHub. It runs the Wikidata harvester in the cloud and saves the list of candidates as a download, with a short summary on the run page. Manual only, read-only, and it never touches the game.
- **The harvest button copes with Wikidata being slow.** Its queries now start from the fact itself (the height, the mass) rather than from fame, which Wikidata can answer far faster. A query that times out is never repeated: a lighter one is tried instead (a sample of the best known), and if that fails too, that kind of fact is skipped and the others carry on. The run page says what came back and what was skipped. The game itself is unchanged. The capacity query was also fixed after the first live run found nothing for it: a plain count has no "normalised" value, so it now asks for the value as entered (to be confirmed by the next run).
- The practice-puzzle test now checks the frozen practice files for friendliness, because the two practice seeds were chosen against the launch pool and any new fact can change what a regeneration picks. The frozen files, which players see, are unchanged.

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
