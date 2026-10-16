# Adding facts

## The checklist

1. Find a reliable source. Prefer the owner or operator (NPS, the Eiffel Tower site, NASA), then an encyclopedia, then a reputable news outlet. Avoid content farms and forums.
2. Confirm the number in at least one source. For anything people argue about (animal weights, capacities, heights with and without antenna), pick one clear definition and put it in the phrase.
3. Convert to the base unit: metres, kilograms, kilometres per hour, whole years (BC is negative), plain counts.
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

## Hinge objects

A hinge is one entity with facts in two or more categories. More categories means more puzzles it can anchor. Aim for objects with three to five.

Use `family` to group things that are the same object, for example the Statue of Liberty, its copper skin and its foundation. A puzzle never includes two items from one family, except the hinge itself.

## Good gaps

The generator needs neighbours within 1.15x to 4x of each other. A category with big empty stretches, such as speed between 3,500 and 27,000 km/h, makes some chains impossible. Fill the gaps rather than adding more of the same size.

## Dates

- Whole years only. There is no year 0, so 1 BC is -1.
- Use `approx: true` for dates that are estimates, like the building of the Great Pyramid.
- Pick the event date the source states, and say which in the phrase: "the first flight", "the opening", "the sinking".

## Harvesting candidates

**No terminal needed:** on GitHub, open the **Actions** tab, pick **Harvest candidate facts**, press **Run workflow** and wait a minute or two. The run page shows a summary (how many candidates, which pairs of categories they could bridge, the best known ones), and the full list is a download at the bottom of the page called `harvest-candidates` (kept for 30 days). It is manual only and read-only: it never changes the repository or the game.

To run it on your own machine instead:

`HARVEST_CONTACT="you@example.com" npm run harvest` writes `data/harvest.json` from Wikidata. Wikidata asks scripts to identify themselves, so set `HARVEST_CONTACT` to an email or URL. Each entry has a suggested phrase and label, the value converted to our base units, and a Wikidata link. Treat it as a shopping list:

1. Sort by `categories`. Take objects with three or more first.
2. For each fact, find a second source and confirm the number. Wikidata often mixes variants (a 747-100 against a 747-400).
3. Rewrite the suggested phrase so the definition is clear.
4. Copy it into `facts.json` with the real source URL and a `checkedOn` date.
5. Entries with `needsReview` (BC dates) need the year offset checked by hand.

## Candidates

If you cannot verify a fact yet, put it in `data/candidates.json` with a `needs` note. It will never be used in a puzzle. Move it to `facts.json` once it has a source and a check date.


## How well known is it? (`fame`)

Every object has a `fame` rating, set in `build_data.py` (the `FAME` table near the end). The game picks well-known objects much more often.

| Rating | Means | Examples |
|---|---|---|
| 3 | Nearly everyone knows it | Titanic, Big Ben, a Routemaster bus, an Olympic pool, a snooker table |
| 2 | Most people know it | the Hubble telescope, Cutty Sark, the Apollo Lunar Module |
| 1 | Enthusiasts only | the Seikan Tunnel, the Panzer VIII Maus, the Parker Solar Probe |

Rating 1 objects are used only as an occasional "Deep cut" question (the 3rd to 7th question, at most one per puzzle), with a scoring bonus, and never as a hinge. They need a clue, and the linter checks for one. Anything not listed in the table counts as 3. Be honest when rating: a good test is whether a friend who is not a fan of the subject could say roughly what it is. Prefer adding rating 3 objects. The linter prints the familiarity mix and the share of days with a deep cut, and warns if enthusiast objects pass 12% of questions, everyday objects fall under 40%, or deep cuts fall under 25% of days.


## A fact needs neighbours

Neighbouring questions must have values between 1.15 and 4 times apart, so a fact with nothing within 4x of it (a golf ball's weight, the seats at Wembley) can never be asked, however well it is sourced. Before adding a very small, very large or very slow fact, check there are a few facts in its category within 4x either side, or add bridging facts first. A simulated 1,000 days shows which facts never appear. If an unreachable fact is well known, add it to the `WARM` list in `build_data.py`: it becomes a reserved warm-up, used as the starting point of a puzzle with an easy first question. If it is not well known, park it in `data/candidates.json` with a note.
