# Clean Sweep

A daily sweep of seven higher-or-lower questions. The aim is a **Clean Sweep**: all seven right. Each answer you reveal becomes the starting point for the next question. Every so often a **bridge object** carries the chain from one category into another, anywhere in the chain.

Categories: length, weight, date, how many, speed.

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

Set `GOATCOUNTER_CODE` in `src/site.js` to switch on GoatCounter. It counts visits, plus two events: `finished` (a daily puzzle was completed) and `clean-sweep` (a perfect 7 out of 7). It does not use cookies or track individuals. Only you can see the dashboard. Practice games and reloads of a finished day are not counted. Leave the code empty to switch it all off.

## Fonts

The fonts are Bricolage Grotesque (headings and labels) and Newsreader (text). They are hosted in `src/fonts`, not loaded from Google, so every visitor sees the same fonts and their address is not shared with Google. They are free to reuse under the SIL Open Font License (see `src/fonts/OFL.txt`). To change them, download the new fonts from fonts.google.com and run `python3 scripts/make-fonts.py` (instructions inside the script).

The logo is a broom on the game's yellow. It is drawn by `python3 scripts/make-icons.py` (needs Pillow and fontTools), which writes the browser-tab icons, the home-screen icons and the picture shown when the link is shared into `src/icons/`, and also pastes the drawing into `index.html` beside the title (a test fails if the two drift apart). The images are in `src` because that folder is already published. Very small sizes get a simpler solid silhouette (`icon-small.svg`) so the tab icon stays clear. To change the logo, edit the shapes in the script and run it.

## Licence

All rights reserved, Michael Major (see `LICENSE`). The fonts are licensed separately, as above.

## Versions

The version number (v1.1, v1.2 and so on) is in `src/version.js` and shows in small type at the bottom of the page. Bump it whenever you publish an update, so you can tell at a glance that the new files are live. Small changes go v1.1 to v1.9, then v2, then v2.1, and so on. Add a line to `CHANGELOG.md` too.

## Warm-ups

Some well-known facts have nothing near them (a golf ball's weight, the seats at Wembley, the seconds in a day), so they can never be chained to a neighbour. They are flagged as reserved warm-up facts in `WARM` in `build_data.py`. On about a third of days the puzzle starts from one of them and the first question compares it with something at least 5 times away, so it is an easy one to get on the board. It is tagged "Warm-up" before the player answers and scores like any Easy question. A warm-up fact is not reused within 14 days and is never asked as an ordinary question.

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

Neighbouring values are kept close: at most 4x apart for the first question in a stretch, tightening to 2x. A bridge question may be up to 3.1x from its neighbour. Dates are compared by "years ago", so 1912 against 1889 is close, and Cleopatra against the pyramid is not.

## Run it

Needs Node 20 or newer. There are no dependencies.

```
npm run serve      # http://localhost:8080
npm test           # unit tests
npm run lint:data  # checks every fact and generates three years of puzzles (about 30 seconds)
npm run build      # writes dist/index.html, one self-contained file
HARVEST_CONTACT="you@example.com" npm run harvest   # needs network: pulls candidate facts from Wikidata
```

## Project layout

```
index.html, styles.css     the page
src/engine.js              rules, puzzle generator, validation (pure, no DOM)
src/format.js              number, date and question text
src/store.js               saved progress, daily lock, streaks (storage is injected)
src/ui.js                  rendering and game flow
src/main.js                loads data and starts the game
data/facts.json            the production fact pool
data/candidates.json       facts that are NOT verified, never used in puzzles
puzzles/N.json             published puzzles, frozen (created by npm run generate)
scripts/                   lint, generate, build, serve
tests/                     node:test suites
docs/adding-facts.md       how to add and verify facts
```

## Facts

Every fact has a status:

- `verified`: checked against a source. Needs an http(s) `source` and a `checkedOn` date.
- `definitional`: true by definition or arithmetic, such as 24 x 60 minutes in a day. Needs a `basis`.
- `wikidata`: taken from Wikidata and **not checked against a second source**. This is a deliberate choice for a fun game where roughly right is enough: a player only needs to be able to guess roughly right. The `source` must be the fact's Wikidata page (`https://www.wikidata.org/wiki/Q123`), and it needs a `checkedOn` date. The result screen links to it.

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

In a simulated run from puzzle #1 the first repeated question comes at about **day 440** (day 17 without the rule). None of the first year's questions repeat one asked before, then about 17% in year two and 58% in year three (57% and 70% without the rule). There are about 7,600 different questions, so how long the game stays fresh depends on the facts: speed (about 540 questions), weight (about 620) and length (about 1,100) run dry first, count has about 1,350 and dates about 4,000. Facts added to the thin categories help most, and the number of questions grows faster than the number of facts. The data check simulates three years in a row (it takes about 30 seconds), prints these figures, and warns if the first repeat comes before day 180 or more than 5% of the first year's questions repeat.

What the rule costs: about 8% of bridge objects are not used as a bridge in a year (about 5% without it), because an object with few possible partners uses up its few questions, and the share of questions on objects nearly everyone knows is about 4 points lower (58% against 62%). Questions are about as hard as before (weight questions are slightly easier).

## Known limits

- The pool has 296 objects (152 date facts, 108 length, 111 count, 118 weight, 75 speed), 126 of them multi-category, 106 of which were used as a bridge in a simulated year. In that year no bridge repeats inside a week, all 20 possible switches between categories appear, and the busiest bridges (the Tiger I, Sputnik 1, Usain Bolt) are a bridge on 15 to 18 days. A bridge object comes back after a median of about 33 days, so adding more multi-category objects is the best way to keep the game fresh. About 59% of questions use objects nearly everyone knows, 36% objects most people know, and 5% enthusiast objects. 21 of the 242 everyday objects appear on fewer than 2 days in the first simulated year, and about 10% on average over three years (the data check warns above 12%, so objects that hold only one number and cannot bridge should be added sparingly). It also prints how many times an average fact in each category is asked about in a year (speed 7.3, length 4.8, count 4.6, weight 4.5, date 3.4): the categories with the highest numbers are the ones that most need new facts, and a low number means a category has more facts than it needs. 36% of days open with a Warm-up and 46% include a Deep cut. The linter checks all of this and warns when it slips.
- **The ends of a scale can only be reached through a bridge.** A stretch of questions walks from one object to its neighbours, each within a few times the size of the last, and it cannot be more than 5 questions long. So a light or a tiny or a huge object is only asked if a bridge object (one with numbers in two categories) sits near it, or if a puzzle happens to start on it. Nothing lighter than 100 g is a bridge. In a three-year simulation five new facts at that end (three coins, a battery and a CD) were asked on 0 days, and the older ones there (the table tennis ball, the shuttlecock and the egg) on fewer than 2 days a year. Add facts at the ends of a scale as objects with two numbers (a coin's weight and its diameter, for example), never as a single number. Facts that were checked but cannot yet be asked wait in `data/candidates.json`.
- **An object can hold more than one number in the same category.** The Eiffel Tower has its steps and its rivets, and the Titanic several lengths, dates and counts. Write each extra number as its own entry with `"object": "<the id of the main object>"` and exactly one fact. An extra shares its object's family (so the two never appear in the same puzzle), takes its fame, hint and clue unless it sets its own, and counts as the same object for the "no object two days running" and freshness rules. It never bridges (it holds one fact): the object bridges through its main numbers. The data check fails if the object does not exist, and warns if the extra repeats a number the object already has. Notes and wording should be metric (kg, m, km/h).
- Puzzles published before v3 have two halves (`c1`, `c2`, `seg1`, `seg2` and a `hinge`). The game and the linter convert them when they load them (`normalizePuzzle` in `src/engine.js`), so those files never need touching.
- Dates use a fixed "now" of 2026 (`RULES.nowYear`). Update it each year and re-run the linter. Frozen puzzles are unaffected.
- The ruler for dates is linear, so a segment that spans millennia crowds its modern points.
- Streaks and the daily lock live in the browser's `localStorage`. Clearing it resets them.

## Launching

See `LAUNCH.md` for the one-time checklist.

## Deploying

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`. `.github/workflows/ci.yml` runs the tests and the data linter on every pull request. `.github/workflows/generate-puzzles.yml` runs every Monday.
