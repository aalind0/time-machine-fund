# Time Machine Fund: research spec

The game: players see two real startups as they looked when they were young (names hidden) and back one,
ten times. Then we fast-forward and show what each company became. Every number must be real and sourced.

## Company outcome rows: `research/out_<file>.jsonl`, one JSON object per line

```json
{
  "slug": "airbnb",                 // from the todo file
  "name": "Airbnb",
  "batch": "W09",                   // from the todo file
  "outcome": "ipo",                 // ipo | acquired | acquihire | private | dead | small
  "value_usd": 47000000000,         // see "value" below; null when unknown
  "value_kind": "ipo_market_cap",   // ipo_market_cap | acquisition_price | last_private_valuation | null
  "value_year": 2020,
  "acquirer": null,                 // buyer's name when acquired
  "pitch_then": "Rent an air mattress in a local's apartment when hotels sell out during big conferences.",
  "became": "Became the world's biggest home-sharing marketplace; IPO in December 2020.",
  "frontier": false,                // true for AI, robotics, space, chips, biotech, energy/climate hardware, autonomy
  "sector": "travel marketplace",   // 1-3 words
  "source": "https://...",          // backs value_usd and outcome
  "confidence": "high"              // high = primary source or 2+ reputable outlets; medium = one outlet or snippet
}
```

### value
- `ipo`: market cap at IPO (first-day close, or the IPO pricing valuation). Direct listings and SPACs count.
- `acquired`: the reported acquisition price. Undisclosed price: `value_usd: null` (do not guess).
- `private` (still independent, not public): the latest reported private valuation and its year. Unknown: null.
- `acquihire`: team bought, product shut, or price clearly tiny. `value_usd` null unless reported.
- `dead`: shut down. `value_usd: null`. Add the year in `became`.
- `small`: still alive, no reported valuation and no sign of a big outcome. `value_usd: null`.
- USD as plain integers. Convert other currencies at that year's rate.

### pitch_then (the card players see)
- What the company was doing or pitching when it was young (its YC batch, or its first year), in <= 22 words,
  present tense, plain English, no hype.
- NEVER include the company's name, former names, founders' names or the product's brand name.
- If it pivoted, describe the ORIGINAL idea (Twitch started as Justin.tv, 24/7 lifecasting). That is the fun.

### became (shown at the reveal)
- <= 16 words. What happened: the pivot, the exit or the death, with a year.

## Rules
- Real, verifiable facts only. If you can't find a number, null it. Never invent.
- Prefer: company/acquirer press releases, SEC filings, Reuters, Bloomberg, TechCrunch, WSJ, FT, The Information.
- Work efficiently: one or two searches per company is usually enough; use what you already know, then confirm
  the number with a source.
