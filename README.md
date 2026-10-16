# Clean Sweep

A daily sweep of seven higher-or-lower questions. The aim is a **Clean Sweep**: all seven right. Each answer you reveal becomes the starting point for the next question. Halfway through, a **hinge object** switches the game from one category to another.

Categories: length, weight, date, how many, speed.

## How a puzzle works

1. You see a starting value, for example the Eiffel Tower is 330 m.
2. Is the Boeing 747-400 wingspan longer or shorter? You pick.
3. The true value is revealed and becomes the new starting point.
4. The last question of the first half is about the hinge object, for example the Titanic's length.
5. The hinge then reveals that same object in the next category, for example the Titanic sank in 1912. That is the new starting point.
6. A wrong answer breaks the chain but you keep playing.

## Familiarity and deep cuts

Every object has a `fame` rating: 3 for things nearly everyone knows (a snooker table, an Olympic pool, a Routemaster bus, Big Ben), 2 for things most people know, 1 for enthusiast objects. The puzzle generator prefers well-known objects, so most questions are about things players already have a feel for.

Rating 1 objects are kept out of ordinary slots and are never a hinge. Instead, on about 40% of days one question is a **Deep cut** about one of them. It can be any question from the 3rd to the 7th (never the first two, so nobody loses straight away), at most one per puzzle, and some days there is none. It is tagged before the player answers, worth 50% more, and costs nothing extra if missed. A deep-cut object is not reused within 21 days. Ratings live in `FAME` in `build_data.py`. See `docs/adding-facts.md`.

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

Neighbouring values are kept close: at most 4x apart for the first question in a half, tightening to 2x. The hinge question may be up to 3.1x from its neighbour. Dates are compared by "years ago", so 1912 against 1889 is close, and Cleopatra against the pyramid is not.

## Run it

Needs Node 20 or newer. There are no dependencies.

```
npm run serve      # http://localhost:8080
npm test           # unit tests
npm run lint:data  # checks every fact and generates a year of puzzles
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

Anything else lives in `data/candidates.json` and is never used. The linter fails if a candidate leaks into `facts.json`. See `docs/adding-facts.md`.

## Growing the fact pool

Hand-adding facts is slow. `npm run harvest` queries Wikidata for famous objects (many language editions) that have a height, length, mass, speed, capacity or date, and writes `data/harvest.json`. Objects with three or more categories make the best hinges.

Everything it writes is a **candidate**. Nothing reaches a puzzle until a person checks the number against a second source and moves it into `data/facts.json` with a source and a check date. Wikidata contains errors, and BC dates in particular need a manual look. Run `node scripts/harvest.mjs --dry-run` to see the queries without any network access.

## Daily puzzles and freezing

Puzzle #1 is `RULES.launchDate` (see `LAUNCH.md`: set it once, before launch). The day changes at **00:00 UTC** for everyone, so friends in different time zones share the same puzzle number. If `puzzles/<number>.json` exists the game uses it. Otherwise it generates the puzzle live from the facts and the puzzle number.

Live generation is deterministic, but it changes if the fact pool changes. So before a day goes live, freeze it:

```
npm run generate -- --from 1 --days 30
```

Review the files in a pull request and commit them. A weekly GitHub Action (`generate-puzzles.yml`) does this for you: it freezes the next 21 days and opens a pull request for review. A frozen puzzle stores every item inside it, so later edits to `facts.json` never alter a published day.

## Known limits

- The pool has 162 objects, 80 of them multi-category, about 68 of which can act as hinges. In a simulated year a hinge repeats inside a week on 0 days, 64 hinges get used, the busiest appears 17 days, and about 325 distinct facts appear. About 60% of questions use objects nearly everyone knows, 34% objects most people know, and 6% enthusiast objects. 33% of days open with a Warm-up and 46% include a Deep cut. The linter warns when it slips.
- Dates use a fixed "now" of 2026 (`RULES.nowYear`). Update it each year and re-run the linter. Frozen puzzles are unaffected.
- The ruler for dates is linear, so a segment that spans millennia crowds its modern points.
- Streaks and the daily lock live in the browser's `localStorage`. Clearing it resets them.

## Launching

See `LAUNCH.md` for the one-time checklist.

## Deploying

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`. `.github/workflows/ci.yml` runs the tests and the data linter on every pull request. `.github/workflows/generate-puzzles.yml` runs every Monday.
