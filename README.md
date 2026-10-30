# Clean Sweep

A daily sweep of seven higher-or-lower questions. The aim is a **Clean Sweep**: all seven right. Each answer you reveal becomes the starting point for the next question. Every so often a **bridge object** carries the chain from one category into another, anywhere in the chain.

Categories: length, weight, date, how many, speed.

There are two more games on the same site: **Mystery Thing** and **Line Up** (see below), joined by a small switcher under each title.

## How a puzzle works

1. You see a starting value, for example the Eiffel Tower is 330 m.
2. Is the Boeing 747-400 wingspan longer or shorter? You pick.
3. The true value is revealed and becomes the new starting point.
4. Now and then a question is about a **bridge object**, for example the Titanic's length.
5. The next question starts from that same object in a different category, for example the Titanic sank in 1912. That is the new starting point. There is no separate screen for this.
6. A wrong answer breaks the chain but you keep playing.

A puzzle switches category once to four times (about 34%, 43%, 18% and 4% of days), in any order, so a stretch in one category can be a single question or as many as five. The rules that keep it fair live in `RULES` in `src/engine.js`: no category takes more than 5 of the 7 questions, between 2 and 5 of the answers are "higher", never more than 4 answers in a row go the same way, and any stretch of 3 or more questions has both a higher and a lower answer. Each day starts in a different category (every block of 5 days uses all five), an object never appears on two days running (so the same question never comes two days in a row), an object that appeared recently is picked less often (so the whole pool gets used), a bridge object is not reused within 7 days, and the day after a busy one (three or more switches) has at most two, so two wild days never come back to back.

## Familiarity and deep cuts

Every object has a `fame` rating: 3 for things nearly everyone knows (a snooker table, an Olympic pool, a Routemaster bus, Big Ben), 2 for things most people know, 1 for enthusiast objects. The puzzle generator prefers well-known objects, so most questions are about things players already have a feel for.

Rating 1 objects are kept out of ordinary slots and are never a bridge. Instead, on about 40% of days one question is a **Deep cut** about one of them. It can be any question from the 3rd to the 7th (never the first two, so nobody loses straight away), at most one per puzzle, and some days there is none. It is tagged before the player answers, worth 50% more, and costs nothing extra if missed. A deep-cut object is not reused within 21 days. Ratings live in `FAME` in `build_data.py`. See `docs/adding-facts.md`.

## The ruler

The yellow tape measure shows how close each answer was. Your current value is always in the middle, so the ruler can never hint at the answer. When you answer, the new dot slides out of the middle: the closer the two values, the less far it goes. When you move on, the dot and its figure glide back to the middle to become the next starting point, and the old screen cross-fades into the new one.

The one rule for how far the dot slides is in `src/ruler.js`. The cross-fade between screens is in `src/transition.js`. The animation timings in `styles.css` and `src/transition.js` have to match, and tests check that they do. All of it is skipped for anyone whose phone is set to reduce motion.

## Practice

There are exactly two practice puzzles. They are fixed (the same for everyone, never changing with the date), so they are a practice, a demo to show friends, and a way to test. Both are always on offer in the How to play panel, in any order and as often as you like, and after one finishes the next is offered (1, then 2, then 1 again). They never touch streaks, best scores or player counts, and nothing about them is saved. They have no Share button and no Warm-up or Deep cut badges. The two puzzles are set by `PRACTICE` in `src/engine.js` and frozen in `puzzles/practice-1.json` and `puzzles/practice-2.json`. To change them, run `npm run practice -- --force` (this replaces the frozen files, so only do it before launch).

## How to play, sharing and celebrating

- A "?" button next to the light and dark toggle opens a three-line How to play, with the two practice puzzles. It never opens by itself. Someone new sees a slim one-line note under the title instead ("First time? Tap the ? for a practice round!", with a Got it), and the "?" gets a yellow ring while it shows. The note goes for good once they tap Got it, tap the "?", or answer a question (real or practice), and that is remembered on their device. Anyone who has already played here never sees it.
- On phones, the result card has a **Share result** button that opens the phone's share sheet. **Copy result** is always there too.
- A Clean Sweep (all seven right) sends brooms and sparkles floating up the screen. Anyone whose phone is set to reduce motion does not see it.

## Counting players (optional)

Set `GOATCOUNTER_CODE` in `src/site.js` to switch on GoatCounter. It counts visits, plus two events: `finished` (a daily puzzle was completed) and `clean-sweep` (a perfect 7 out of 7). It does not use cookies or track individuals. Only you can see the dashboard. Practice games and reloads of a finished day are not counted. Leave the code empty to switch it all off. Mystery Thing adds five, each counted once for today's puzzle (never for practice or other days): `mystery-started` (the first guess), `mystery-solved` (found the answer), `mystery-gave-up` (tapped "Show the answer"), `mystery-finished` (the puzzle ended: solved, all six guesses used, or given up) and `mystery-clean-sweep` (solved with every guess green). From them: solve rate = solved / started, give-up rate = gave-up / started, drop-off = started minus finished. Its visits show as the path `/mystery/`.

## Fonts

The fonts are Bricolage Grotesque (headings and labels) and Newsreader (text). They are hosted in `src/fonts`, not loaded from Google, so every visitor sees the same fonts and their address is not shared with Google. They are free to reuse under the SIL Open Font License (see `src/fonts/OFL.txt`). To change them, download the new fonts from fonts.google.com and run `python3 scripts/make-fonts.py` (instructions inside the script).

The logo is a broom on the game's yellow. It is drawn by `python3 scripts/make-icons.py` (needs Pillow and fontTools), which writes the browser-tab icons, the home-screen icons and the picture shown when the link is shared into `src/icons/`, and also pastes the drawing into `index.html` beside the title (a test fails if the two drift apart). The images are in `src` because that folder is already published. Very small sizes get a simpler solid silhouette (`icon-small.svg`) so the tab icon stays clear. To change the logo, edit the shapes in the script and run it.

## Licence

All rights reserved, Michael Major (see `LICENSE`). The fonts are licensed separately, as above.

## Versions

The version number (v1.1, v1.2 and so on) is in `src/version.js` and shows in small type at the bottom of the page. Bump it whenever you publish an update, so you can tell at a glance that the new files are live. Small changes go v1.1 to v1.9, then v2, then v2.1, and so on. Add a line to `CHANGELOG.md` too.

## Warm-ups (switched off from puzzle 7)

Until puzzle 6, about a third of days began with a **Warm-up**: an easy first question that compared one of 14 reserved, well-known facts (a golf ball's weight, the seats at Wembley, the seconds in a day) with something at least 5 times away. They are **off from puzzle 7**: there is no easy opening question any more, no ordinary question is more than 3 times apart (about a third are within 1.5 times, a Close call), and the 14 facts are ordinary facts again, because the pool has grown and each has near neighbours. The machinery is still in the engine. To bring warm-ups back, set `warmChance` in `RULES` (it is 0) and flag facts as `warmup` in the data. Puzzles 1 to 6 keep theirs, and the Warm-up badge still appears on them. The tests keep exercising the machinery on a copy of the data with the 14 facts flagged again.

## Closer in time

About one puzzle in three (35%) has a different kind of date question: **"Is the death of Cleopatra closer in time to the building of the Great Pyramid or the sinking of the Titanic?"** The card is in the middle of the ruler and the two options are buttons, **the earlier one on the left and the later one on the right**, so left and right mean what they mean on any date question. After you answer, both options slide out from the card to their true distances (the nearer one is the answer, in green or red, and the other in grey), and the answer becomes the next card.

- **How it is stored.** It is an ordinary question whose answer is the nearer event, plus a `closer` record on that item: the other option (`rival`), which side the answer is on (`itemOn`) and the two distances in years (`dItem`, `dRival`). The game's right-or-wrong check is the usual one: the right button is the side the answer is on. An older, cached copy of the game would simply show it as a plain "before or after?" question about the answer event, which is still correct.
- **Rules** (`closer*` in `RULES`). Never question 1, never a bridge, at most 2 in a puzzle. Both options are on opposite sides of the card, at least 10 years away, the farther one **1.15 to 1.5 times** as far as the nearer one and at least **15 years** farther (so it is a feel for time, not a test of exact years), both well known (fame 2 or 3), with exact dates (no "about"), from different families from everything else in the puzzle. Nearly nine in ten are Close calls (double points) and the rest, at exactly 1.5 times, are Medium. The score uses that distance ratio instead of the usual gap.
- **No repeats.** A question is remembered as the card plus the two options (either way round), and is never asked again. The other option counts as being on screen for the "same object two days running" rule, and it is listed with its source on the result card.
- **Switching it on or off.** `closerChance` (0.7 per eligible question, which works out at about one puzzle in three) is the one setting. At 0 the game asks no closer questions. The practice puzzles never use them. Puzzles 1 to 6 were published without them.
- **Supply.** There are 147 well-known dated events and about 37,800 possible questions at these distances, from 139 different cards, so this style hardly dents the date supply, and it needs no new facts.

## Scoring

Every question is tagged **before** you answer, by how close the two values are:

| Tag | Gap between the values | Worth |
|---|---|---|
| Close call | under 1.5x | 2x |
| Medium | 1.5x to under 2.2x | 1.5x |
| Easy | 2.2x or more | 1x |

A right answer scores 100 points times its tag, then times a **streak bonus**: each right answer in a row adds 10% more than the last, from 1.0x up to 1.6x.

If a question is a **Deep cut** (an enthusiast-only object, shown with its own badge), it is worth a further 1.5x. A wrong answer scores 0 and resets the streak. The next right answer starts a fresh streak at 1.0x, so a slip costs you the streak bonus but you can still catch up.

The headline score is the **percentage of the day's maximum**, with the points as the small print. The maximum varies from day to day with how many close calls there are, so the percentage keeps every day comparable. With equal difficulty, a perfect run is 100%, "miss the first, then six right" is 82%, "five right then two wrong" is 66%, and "three right, two wrong, two right" is 59%. The rules live in `src/score.js` and are covered by `tests/score.test.mjs`. The tag boundaries (1.5x and 2.2x) split real questions roughly 30%, 34% and 36%.

Neighbouring values are kept close. For puzzles from number 7, no question is more than **3 times** apart: the first question in a stretch may be up to 3x, then 2.5x, 2x and 1.7x, and a bridge question up to 3x (`maxGap` and `hingeMaxGap` in `RULES`). Puzzles 1 to 6 were built under the older, looser limits (4x, tightening to 2x, and 3.1x for a bridge), so a published puzzle is always **validated against the loosest limits ever used** (`maxGapPublished`): tightening the rules for new puzzles can never make an old one invalid. Dates are compared by "years ago", so 1912 against 1889 is close, and Cleopatra against the pyramid is not.

## Mystery Thing

A second daily game on the same site, at `/mystery/`. One hidden object a day and six guesses. The player picks things from a list. Each guess shows how its numbers (two of size, weight, speed and year) compare with the mystery thing's: an arrow points the way, and on Easy and Medium a colour says whether the guess is within double or half (green) or further off (red).

- **Settings.** Easy: the list shrinks as the clues rule things out. Medium (called `normal` in the code): the full list, with colours. Hard: the full list, arrows only, and scores x1.5. A player has **one try a day**: the setting locks at the first guess, and the saved game remembers it (one record per puzzle, `mt:<number>`). The two practice puzzles (the Eiffel Tower, then a giraffe) are fixed, unlimited and never locked.
- **The explanation under the settings** is open on a first visit, folds away to a single word ("Reminder") at the first guess ever, and after that stays however the player last left it (`mt:help` on their device). The "?" panel has the full explanation.
- **Streaks.** Mystery Thing keeps two on the player's device (`mt:stats`): **days tried** (a day counts at the first guess, even if the puzzle is not finished) and **days solved in a row**. An unsolved day, or giving up, ends the solved streak but not the tried one. Missing a whole day ends both (each shows 0 until played again). Practice and earlier puzzles never count, and a day can only be counted once. The result card shows four boxes (day streak, solved in a row, best streak, best score). From a 2-day streak a flame (🔥 5) shows on that game's card under "Today's puzzles"; Clean Sweep leaves its own streak as a note (`streak:cs`) so Mystery Thing's page can show it too. On the day a streak reaches 7, 30 or 100 the result card gets a banner and the brooms and sparkles: "🔥 7 days in a row" or "🔎 7 solved in a row" (only the bigger one, and the solved one on a tie). Streaks are never part of the shared text.
- **The result card** is like Clean Sweep's: "Share result" (the phone's share sheet, where there is one) and "Copy result", the time until the next puzzle, and one button to Clean Sweep. That button is yellow to play it, quiet ("Clean Sweep done") once it is finished, and says "Finish today's Clean Sweep" if it was started. A daily result has no "Play another".
- **Where the facts come from.** The same `data/facts.json` as Clean Sweep. An object is in the game if it has **two or more** of length, weight, speed and date (counts are left out). Objects with `fame` 3 can be the answer, except those named in `NOT_AN_ANSWER` in `mystery/data.js`; anything can be guessed. A clue pair must give a guess list of at least 50 things. Labels that are just the object\'s name ("A black rhinoceros" for its weight) are reworded for the result card ("Black rhinoceros weight") in `mystery/data.js`, so the facts file is not touched. So a fact added for Clean Sweep can add an answer here, and a second number for an object that has only one is the quickest way to add answers.
- **Which answer on which day.** Frozen in `data/mystery-days.json`, like the puzzle files. Day 1 is its `launchDate` (UTC; set it once, before launch). Days already in the file never change, and `npm run generate:ahead` (the weekly job) adds the next 21. A day nobody has frozen yet is worked out the same way for everyone. Every answer comes up once before any comes round again, and the same clue pair rarely comes two days running.
- **The two games see each other.** Each leaves a short note on the player's own device (`status:cs` and `status:mt`, counted only on the day it was written), and the two cards under "Today's puzzles" say Not played, In progress, "Done" with the result, or Not solved. Nothing is sent anywhere (`src/games.js`). The "New" badge on Mystery Thing's card goes away by itself after `MYSTERY_NEW_UNTIL` in that file. The light or dark choice is shared by both pages.
- **Files.** `mystery/logic.js` (rules, scoring, share card, no screen), `data.js` (turns the facts into the game's data), `schedule.js` (which answer when), `ui.js` (the screen), `main.js`, `index.html`, `styles.css`. Tests: `tests/mystery-*.test.mjs` and `tests/games.test.mjs`. `npm run lint:data` also checks the practice puzzles and the frozen days.
- **Trying it by hand.** Open `/mystery/#debug` to show the testing controls (new puzzle, open puzzle N, clear saved games) and the hooks the browser tests use. Without `#debug` they are hidden.
- **Sharing.** The result is copied as a short card (clue icons, one row per guess, points) ending with `cleansweepdaily.fyi/mystery`.
- **Difficulty.** For a player who always guesses something still consistent with the clues, a game takes about 3.4 guesses on Easy, 4.1 on Medium and 4.7 on Hard, and 84% of Hard games are solved within 6 (99% on Easy, 96% on Medium). Measured by a script that plays the game that way; real players will differ.

## Line Up

A third daily game, at `/lineup/`. **Six things** to put in order, for example from the lightest to the heaviest, the oldest to the newest, the slowest to the fastest or the smallest to the biggest. Each puzzle is one kind of measure. The player taps two things to swap them, or drags one (by its dots on a phone; from anywhere on the card with a mouse), then presses Check order. Whatever is in the right place turns green and **locks**; the rest are rearranged, for up to **three tries**. Fewer tries is better, and the real numbers are shown at the end.

- **Points.** Each thing scores its best result over the tries: 100 if it is exactly right on try 1, 60 on try 2, 35 on try 3. A near miss earns part of that: one place out 40%, two out 15%, further out nothing (so 3rd instead of 2nd beats 4th). A clean sweep (everything right on try 1) adds 100. The whole score is then multiplied by how hard the day is: **Easy x1, Medium x1.25, Hard x1.5**, shown as a tag above the board. The most a day can score is 700 x the multiplier (1,050 on a Hard day). The rules are in `POINTS`, `TIER` and `scoreGame` in `lineup/logic.js`. The result card shows the score, how it was made up and "How scoring works"; "best score" is one of its four stats; the share card carries the score ("📊 Line Up #12 ⚡ 2/3 · 560 pts"). Practice puzzles have no tag and no score.
- **How the day's tag is chosen.** From how close the closest two neighbours are (the day's `gap` in `data/lineup-days.json`): Hard under 1.65 times apart (under 15 years for dates), Medium under 2.2 times (under 40 years), otherwise Easy (`TIER_GAPS` in `lineup/logic.js`). That makes about 30% Hard, 40% Medium and 30% Easy.
- **Why six, and why locks.** Telling the player which things are right (the green squares) is what makes it a deduction puzzle and gives the share card its rows. Locking only stops a right thing being moved by accident. `BOARD_SIZE` in `lineup/schedule.js` is the one setting for the board size: change it and redo the practice puzzles in `lineup/logic.js` and the frozen days.
- **How hard it is, measured.** In a simulation of players who track every clue perfectly (so real people will do worse), the share who get a clean sweep went from 72% for an average player with five things, to 63% with six things, to **52% with the harder gaps now in use** (casual players 35%, good players 79%; nearly everyone still solves it in three tries). Once players arrive, `lineup-clean-sweep` against `lineup-finished` is the real number. The dial is `GAP_RANGE` in `lineup/schedule.js`; change it (and `TIER_GAPS`) and only days not yet frozen change.
- **Where the facts come from.** The same `data/facts.json`. Any *verified* size, weight, speed or year of a well-known thing (`fame` 2 or 3) can be an item. A fact is worded on the board from its `phrase` ("the weight of a banana" becomes "A banana"; "the completion of the Eiffel Tower" becomes "Completion of the Eiffel Tower"). Facts with brackets in the phrase, or a few listed in `SKIP` in `lineup/data.js`, are left out. So a fact added for the other games can appear here, and a verified speed for something well known is the quickest way to add variety (speed is the thinnest pool).
- **Which six on which day.** Frozen in `data/lineup-days.json`, like the other games. Day 1 is its `launchDate` (UTC; set it once, before launch). Days already in the file never change, and `npm run generate:ahead` (the weekly job) adds the next 21. The kind of puzzle never repeats two days running, six different things (never two from the same family) are chosen, at least two are well known, and **a board never repeats an earlier one**. A thing is not reused for 25 days unless the pool is too small. The difficulty is random for each day, so no weekday is always the easy one.
- **Tries and locks.** A thing that was right in a try is locked in place and cannot be moved. The page saves the tries and the order after every move (`lu:<number>` on the player's device), so a reload carries on exactly where it was.
- **A first-try win is a clean sweep:** a one-line "🧹 Clean sweep! 🧹" banner, and lots of brooms, soap and sparkles floating up the screen (the same ones as Clean Sweep's, and for a streak milestone too; nothing moves for anyone who prefers less motion).
- **Streaks.** Like Mystery Thing: one for days tried (a day counts at the first check) and one for days solved in a row. The flame goes after the puzzle number ("Puzzle #12 · 🔥 12") and on the result card, from 2 days, and a banner marks the day a streak reaches 7, 30 or 100. The result card shows day streak, solved in a row, best streak and best score. Streaks are never part of the shared text.
- **The result card** has Share result (the phone's share sheet, where there is one) and Copy result, the time until the next puzzle, and two half-width buttons, one for each of the other games.
- **Sharing.** A headline with the puzzle number, the kind of measure, the tries and the score (`📊 Line Up #12 ⚖️ 2/3 · 560 pts`, or `X/3`), one row of green and red squares per try, and `🧹 cleansweepdaily.fyi/lineup`. The icons for the kinds of puzzle are 📏 size, ⚖️ weight, 📅 year and ⚡ speed (never 💨, which means dust in Clean Sweep).
- **Files.** `lineup/logic.js` (rules, locking, points, share card, no screen), `data.js` (turns facts into board items), `schedule.js` (which things when, the difficulty, and `BOARD_SIZE`), `ui.js` (the screen), `main.js`, `index.html`, `styles.css`, and the logo and icons (`icon.svg`, `icon-32.png`, `apple-touch-icon.png`, `icon-512.png`, `social-preview.png`). Tests: `tests/lineup-*.test.mjs`. `npm run lint:data` also checks the practice puzzles, the frozen days and that no board repeats.
- **Trying it by hand.** Open `/lineup/#debug` to show the testing controls (open puzzle N, clear saved games) and the hooks the browser tests use.
- **Counting players.** Events `lineup-started` (the first check), `lineup-solved`, `lineup-finished` (solved, or all three tries used), `lineup-clean-sweep` (solved on the first try) and `lineup-streak-7`, `-30`, `-100`.

## The three games together

Under each title is the same narrow **switcher**: three small boxes, one for each game, each a link to that game, with the page you are on filled and underlined in yellow. A small icon in each box says how today's puzzle went there: a green tick (done), an orange dot (in progress), an empty ring (not played), a coral cross (finished without solving). The names shorten to "Sweep" and "Mystery" on phones narrower than 440 px. There are no scores or streaks in the switcher; each game shows its own flame after its own puzzle number and on its result card. Each box has a hover tip and a screen-reader label ("Mystery Thing, in progress").

Each result card ends with **two half-width buttons, one for each of the other two games** (so the player chooses where to go next). A game that is not finished is a yellow "Play ..." or "Finish ..." button; a finished one is an outline button with its tick or cross. Every game's share card ends with 🧹 and its address. Copying goes through one routine for all three games (`copyText` in `src/games.js`): the browser's clipboard first, then the older copy command with a hidden box (many in-app browsers still allow it), and only if both fail a text box with the result, already selected, appears just under the Copy button so it can be copied by hand.

Each game leaves a short note on the player's own device (`status:cs`, `status:mt`, `status:lu`, counted only on the day it was written) and reads the others', so the icons and buttons agree everywhere. Nothing is sent anywhere (`src/games.js`). The "New" tags go away by themselves (`MYSTERY_NEW_UNTIL`, `LINEUP_NEW_UNTIL` in that file). The light or dark choice is shared by all three. The counter also records `started` and `streak-7`, `-30`, `-100` for Clean Sweep, `switch-to-clean-sweep`, `switch-to-mystery` and `switch-to-lineup` for taps on a switcher box or a result-card button (so you can see which way people move between games), and `all-three-done`, once on the day a player has finished all three games.

## Run it

Needs Node 20 or newer. There are no dependencies.

```
npm run serve      # http://localhost:8080
npm test           # unit tests
npm run lint:data  # checks every fact and generates three years of puzzles (about 30 seconds)
npm run build      # writes dist/index.html, dist/mystery/index.html and dist/lineup/index.html, each one self-contained file
HARVEST_CONTACT="you@example.com" npm run harvest   # needs network: pulls candidate facts from Wikidata
```

## Project layout

```
index.html, styles.css     the page
mystery/                   the second game, Mystery Thing (see its section)
lineup/                    the third game, Line Up (see its section)
src/engine.js              rules, puzzle generator, validation (pure, no DOM)
src/format.js              number, date and question text
src/store.js               saved progress, daily lock, streaks (storage is injected)
src/ui.js                  rendering and game flow
src/main.js                loads data and starts the game
src/games.js               the two games showing each other's progress, the New badge, visitor counting
data/facts.json            the production fact pool
data/candidates.json       facts that are NOT verified, never used in puzzles
data/mystery-days.json     Mystery Thing: which answer is on which day, frozen
data/lineup-days.json      Line Up: which five things on which day, frozen
puzzles/N.json             published puzzles, frozen (created by npm run generate)
scripts/                   lint, generate, build, serve (lint-mystery, lint-lineup, mystery-days and lineup-days are for the other two games)
tests/                     node:test suites
docs/adding-facts.md       how to add and verify facts
```

## Facts

Every fact has a status:

- `verified`: checked against a source. Needs an http(s) `source` and a `checkedOn` date.
- `definitional`: true by definition or arithmetic, such as 24 x 60 minutes in a day. Needs a `basis`.
- `wikidata`: taken from Wikidata and **not checked against a second source**. This is a deliberate choice for a fun game where roughly right is enough: a player only needs to be able to guess roughly right. The `source` must be the fact's Wikidata page (`https://www.wikidata.org/wiki/Q123`), and it needs a `checkedOn` date. The result screen links to it.

- `unchecked`: a standard or typical figure that was **not** checked against a page, such as a coin's size from the Royal Mint, a ball's diameter from its sport's rules, or the weight of a horse. It is roughly right, which is enough here. The `source` is a few words, not a link ("ITF rules", "typical figure"), and the result screen shows those words as plain text. It needs a `checkedOn` date.

Anything else lives in `data/candidates.json` and is never used. The linter fails if a candidate leaks into `facts.json`. See `docs/adding-facts.md`.

## Growing the fact pool

Hand-adding facts is slow. The **Harvest candidate facts** button under the **Actions** tab on GitHub (no terminal needed), or `npm run harvest` on your own machine, queries Wikidata for famous objects (many language editions) that have a height, length, mass, speed, capacity or date, and writes `data/harvest.json`. Objects with three or more categories make the best hinges. It also collects the dates of **events** (a battle, an eruption, a discovery, a film's release, the start or end of a war) and the **birth and death of the most famous people**. These have a date and nothing else, so they are kept even though they are in only one category. People must be on 120 or more language editions, so only the very famous come back. When Wikidata lists more than one date for the same thing, the candidate is marked `needsReview` with the dates it found. Start, end and discovery dates are **off by default**: the first live run showed them to be mostly noise (bare years treated as things, geological ages, disputed discoveries), and dates are the category with the most facts already. Wikidata gives up on slow queries (7 of the 16 kinds timed out on that first run, including weights and heights), so the Run workflow page has a box called **only**: type the property ids of just the kinds you want (for example `P2067` for weights, or `P2048,P2043` for heights and lengths) and a smaller run is much more likely to get through. The summary page tells you which ids to type to retry whatever was skipped. On the command line it is `--only P2067,P2048`, and it also works for the kinds that are off by default.

Everything it writes is a **candidate**. Nothing reaches a puzzle until a person checks the number against a second source and moves it into `data/facts.json` with a source and a check date. Wikidata contains errors, and BC dates in particular need a manual look. Run `node scripts/harvest.mjs --dry-run` to see the queries without any network access.

## Daily puzzles and freezing

Puzzle #1 is `RULES.launchDate` (see `LAUNCH.md`: set it once, before launch). The day changes at **00:00 UTC** for everyone, so friends in different time zones share the same puzzle number. If `puzzles/<number>.json` exists the game uses it. Otherwise it generates the puzzle live from the facts and the puzzle number.

Live generation is deterministic, but it changes if the fact pool changes. So before a day goes live, freeze it:

```
npm run generate -- --from 1 --days 30
```

Review the files in a pull request and commit them. A weekly GitHub Action (`generate-puzzles.yml`) does this for you: it freezes the next 21 days and opens a pull request for review. A frozen puzzle stores every item inside it, so later edits to `facts.json` never alter a published day.

### Questions are not repeated

A **question** is two objects compared in one category, whichever way round: the Eiffel Tower against Big Ben is the same question as Big Ben against the Eiffel Tower. The game remembers every question in the saved puzzles (up to 1,100 days back) and tries not to ask one again until the others have been used. The freezing script builds that memory by reading every file in `puzzles/`, so **the weekly pull request must be merged before the next Monday's run**, or the run cannot see those questions (the rule that stops an object appearing two days running has the same need).

A new puzzle is built in steps. Its first tries refuse any question that was ever asked, then any asked in the last 365 days. After that questions are only *preferred*: never asked first, then those asked longest ago (over 365 days, over 180, over 60). Nothing here can stop a puzzle from building: the refusals are lifted long before the tries run out, and the rule only changes the order in which questions are tried. The settings are `pairTiers`, `pairTierAttempts`, `pairBudget`, `pairOldAges` and `pairMemoryDays` in `RULES`.

In a simulated run from puzzle #1 the first repeated question comes at about **day 855** (day 17 without the rule). None of the first year's questions repeat one asked before, then none in year two and about 8% in year three. Tightening the step limits in 3.7 cut the number of possible questions by about a fifth, and the new facts more than made up for it: there are about 14,500 different ordinary questions (and about 37,800 possible "closer in time" questions, see below), so how long the game stays fresh depends on the facts. Count (about 1,050 questions, 2.2 years of supply), weight (about 1,380, 2.8 years) and speed (about 1,590, 2.9 years) run dry first; length has about 4,000, which is 7.9 years, and dates about 6,500, which is 12.3 years. Facts added to the thin categories help most, and the number of questions grows faster than the number of facts. The data check simulates three years in a row (it takes about 30 seconds), prints these figures, and warns if the first repeat comes before day 180 or more than 5% of the first year's questions repeat.

What the rule costs: about 8% of bridge objects are not used as a bridge in a year (about 5% without it), because an object with few possible partners uses up its few questions, and the share of questions on objects nearly everyone knows is about 4 points lower (58% against 62%). Questions are about as hard as before (weight questions are slightly easier).

## Known limits

- The pool has 392 objects (205 date facts, 254 length, 111 count, 202 weight, 129 speed), 272 of them multi-category, 204 of which were used as a bridge in a simulated year. In that year no bridge repeats inside a week, all 20 possible switches between categories appear, and the busiest bridges are a bridge on 10 to 12 days. A bridge object comes back after a median of about 54 days, so adding more multi-category objects is the best way to keep the game fresh. About 69% of questions use objects nearly everyone knows, 26% objects most people know, and 5% enthusiast objects. 26 of the 338 everyday objects appear on fewer than 2 days in the first simulated year, and about 9% on average over three years (the data check warns above 12%). Only 11 bridge objects (4%) are never used as a bridge in any of three simulated years (the limit is 8%): with this many bridges, some go unused in any one year just by chance. The data check also prints how many times an average fact in each category is asked about in a year (speed 4.2, count 4.3, weight 2.4, date 2.6, length 2.0): the categories with the highest numbers are the ones that most need new facts, and a low number means a category has more facts than it needs. There are no warm-ups (see below), 35% of puzzles have a "closer in time" question, and 46% of days include a Deep cut. The linter checks all of this and warns when it slips.
- **The ends of a scale can only be reached through a bridge.** A stretch of questions walks from one object to its neighbours, each within a few times the size of the last, and it cannot be more than 5 questions long. So a light or a tiny or a huge object is only asked if a bridge object (one with numbers in two categories) sits near it, or if a puzzle happens to start on it. Nothing lighter than 100 g is a bridge. In a three-year simulation five new facts at that end (three coins, a battery and a CD) were asked on 0 days, and the older ones there (the table tennis ball, the shuttlecock and the egg) on fewer than 2 days a year. Add facts at the ends of a scale as objects with two numbers (a coin's weight and its diameter, for example), never as a single number. Giving each of those a size (a coin's diameter, a ball's diameter) in 3.7 made them bridges, and all of them are now asked. Facts that were checked but cannot yet be asked wait in `data/candidates.json`.
- **An object can hold more than one number in the same category.** The Eiffel Tower has its steps and its rivets, and the Titanic several lengths, dates and counts. Write each extra number as its own entry with `"object": "<the id of the main object>"` and exactly one fact. An extra shares its object's family (so the two never appear in the same puzzle), takes its fame, hint and clue unless it sets its own, and counts as the same object for the "no object two days running" and freshness rules. It never bridges (it holds one fact): the object bridges through its main numbers. The data check fails if the object does not exist, and warns if the extra repeats a number the object already has. Notes and wording should be metric (kg, m, km/h).
- Puzzles published before v3 have two halves (`c1`, `c2`, `seg1`, `seg2` and a `hinge`). The game and the linter convert them when they load them (`normalizePuzzle` in `src/engine.js`), so those files never need touching.
- Dates use a fixed "now" of 2026 (`RULES.nowYear`). Update it each year and re-run the linter. Frozen puzzles are unaffected.
- The ruler for dates is linear, so a segment that spans millennia crowds its modern points.
- Streaks and the daily lock live in the browser's `localStorage`. Clearing it resets them. Mystery Thing's one try a day works the same way: a private window or cleared browser data gives another go.

## Launching

See `LAUNCH.md` for the one-time checklist.

## Deploying

The game lives at **https://cleansweepdaily.fyi** (the share card's last line, and the link-preview tags in `index.html`, use it). `.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`. `.github/workflows/ci.yml` runs the tests and the data linter on every pull request. `.github/workflows/generate-puzzles.yml` runs every Monday.
