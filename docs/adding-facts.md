# Adding facts

## The checklist

1. Find a reliable source. Prefer the owner or operator (NPS, the Eiffel Tower site, NASA), then an encyclopedia, then a reputable news outlet. Avoid content farms and forums.
2. Confirm the number in at least one source. For anything people argue about (animal weights, capacities, heights with and without antenna), pick one clear definition and put it in the phrase.
3. Convert to the base unit: metres, kilograms, kilometres per hour, whole years (BC is negative), plain counts. Lengths are stored in metres but shown in centimetres under 1 m, metres up to 999 m and kilometres from 1,000 m, so write the Trans-Siberian Railway as `9288000`, not `9288`.
4. Add the fact to `data/facts.json` under an entity.
5. Run `npm run lint:data` and `npm test`.

## Shape of a fact

```json
"length": {
  "phrase": "the height of the Eiffel Tower (with antenna)",
  "label": "Eiffel Tower height",
  "value": 330,
  "unit": "m",
  "approx": false,
  "status": "verified",
  "source": "https://www.toureiffel.paris/en/news/history-and-culture/300-330-meters-story-towers-height",
  "checkedOn": "2026-10-15",
  "note": "A new antenna added 6 m in March 2022."
}
```

- `phrase` is used in the question. It reads as "Is {phrase} longer or shorter than ...". Start with "the", "a" or "an". For dates it reads as "Did {phrase} happen before or after ...", so write an event.
- `label` is short (under 40 characters) and appears on the ruler.
- `approx: true` shows "about" in front of the number. Use it for averages and disputed figures.
- `note` is the one-line fact shown after the answer. Keep it true and short.
- Do not use em dashes or en dashes in any text. The linter rejects them.

## Clues and hints for obscure objects

Add these to the entity (not to a fact) when players might not know the object:

- `clue`: shown **before** the answer, in brackets under the question. It must never give away a record. "an oil tanker" is fine. "the world's longest ship" is not, because it settles the question. Numbers are limited to a year or decade.
- `hint`: shown **after** the answer, under the object's label. This is the place for "the heaviest aircraft ever built".

Both are under 80 characters, written in lowercase, with no final full stop (the game adds one to hints).

## Bridge objects

A bridge is one entity with facts in two or more categories. A puzzle can switch category up to four times, and every switch goes through a bridge: the object is the last question of one stretch and the starting point of the next, in its other category. More categories means more switches it can carry. Aim for objects with three to five. The thinnest pairs of categories (the linter and the changelog show the counts) are where new bridges help most.

Use `family` to group things that are the same object, for example the Statue of Liberty, its copper skin and its foundation. A puzzle never includes two items from one family, except a bridge itself, which appears twice (once in each of its categories).

## Good gaps

The generator needs neighbours within 1.15x to 4x of each other. A category with big empty stretches, such as speed between 3,500 and 27,000 km/h, makes some chains impossible. Fill the gaps rather than adding more of the same size.

## Dates

- Whole years only. There is no year 0, so 1 BC is -1.
- Use `approx: true` for dates that are estimates, like the building of the Great Pyramid.
- Pick the event date the source states, and say which in the phrase: "the first flight", "the opening", "the sinking".
- The game writes years below 1000 as "80 AD" and years before 1 as "44 BC". The line under a date's big figure is the phrase without its leading "the" ("the sealing of Magna Carta" becomes "Sealing of Magna Carta"), so write the phrase as an event. If that line would be over 45 characters, the short `label` is shown instead, so keep the label an event too ("Magna Carta sealed", not "Magna Carta").

## Harvesting candidates

**No terminal needed:** on GitHub, open the **Actions** tab, pick **Harvest candidate facts**, press **Run workflow** and wait a minute or two. The run page shows a summary (how many candidates, which pairs of categories they could bridge, the best known ones), and the full list is a download at the bottom of the page called `harvest-candidates` (kept for 30 days). It is manual only and read-only: it never changes the repository or the game. If Wikidata is busy, some kinds of fact may be skipped. The summary says which, and you can simply run it again later.

To run it on your own machine instead:

`HARVEST_CONTACT="you@example.com" npm run harvest` writes `data/harvest.json` from Wikidata. Wikidata asks scripts to identify themselves, so set `HARVEST_CONTACT` to an email or URL. Each entry has a suggested phrase and label, the value converted to our base units, and a Wikidata link. Treat it as a shopping list:

1. Sort by `categories`. Take objects with three or more first.
2. For each fact, find a second source and confirm the number. Wikidata often mixes variants (a 747-100 against a 747-400).
3. Rewrite the suggested phrase so the definition is clear.
4. Copy it into `facts.json` with the real source URL and a `checkedOn` date.
5. If the run page says some kinds of fact were skipped (Wikidata timed out), press **Run workflow** again and type the ids it lists into the box called **only**: a smaller run is more likely to get through. Entries with `needsReview` need a look by hand: BC dates (the year offset), and dates where Wikidata lists more than one value (the message names them: pick the one the sources agree on, or leave the event out).
6. Dates of events and famous people (`kind` event, start, end, discovery, publication, birth, death) arrive on their own, with one category. They are the source of the dated events in the game. Check the year against two sources, and use the year the event is usually given (for a battle, the year it was fought, not the year of the treaty). Leave out any event whose date historians dispute.
7. Anything that is only one more number about an object that is already in the game (the Eiffel Tower's rivets as well as its steps) is an **extra**: give it `"object": "<id of the object>"` and exactly one fact.

## Candidates

If you cannot verify a fact yet, put it in `data/candidates.json` with a `needs` note. It will never be used in a puzzle. Move it to `facts.json` once it has a source and a check date.


## How well known is it? (`fame`)

Every object has a `fame` rating, set in `build_data.py` (the `FAME` table near the end). The game picks well-known objects much more often.

| Rating | Means | Examples |
|---|---|---|
| 3 | Nearly everyone knows it | Titanic, Big Ben, a Routemaster bus, an Olympic pool, a snooker table |
| 2 | Most people know it | the Hubble telescope, Cutty Sark, the Apollo Lunar Module |
| 1 | Enthusiasts only | the Seikan Tunnel, the Panzer VIII Maus, the Parker Solar Probe |

Rating 1 objects are used only as an occasional "Deep cut" question (the 3rd to 7th question, at most one per puzzle), with a scoring bonus, and never as a bridge. They need a clue, and the linter checks for one. Anything not listed in the table counts as 3. Be honest when rating: a good test is whether a friend who is not a fan of the subject could say roughly what it is. Prefer adding rating 3 objects. The linter prints the familiarity mix and the share of days with a deep cut, and warns if enthusiast objects pass 12% of questions, everyday objects fall under 40%, or deep cuts fall under 25% of days.


## A fact needs neighbours

Neighbouring questions must have values between 1.15 and 3 times apart (a first step up to 3x, then tighter), so a fact with nothing within 3x of it (a golf ball's weight, the seats at Wembley) can never be asked, however well it is sourced. Before adding a very small, very large or very slow fact, check there are a few facts in its category within 3x either side, or give it a second number so that it can bridge (a coin's weight AND its diameter): a single number at the end of a scale is never asked. A simulated three years shows which facts never appear (the data check prints them). Warm-ups are off, so there is no reserved list any more. If a fact cannot be given neighbours or a second number, park it in `data/candidates.json` with a note.
