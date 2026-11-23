# Time Machine Fund

You get $10M and a time machine. Back 10 real startups (2012–2026, up to the latest YC batches) two at a time, names hidden, 40 seconds
per deal. Then fast-forward to today and see what your fund is worth, against real venture benchmarks.

**Play it: https://aalind0.github.io/time-machine-fund/**

Beta. A game built on real, sourced company data; the fund math is simplified and this is not investment advice.

## Run it locally

```bash
node server.mjs
```

Then open http://localhost:8010. Node 18+ (for `fetch` in the build scripts).

## Publish

The site is static: everything lives in `site/`, with no build step in production. Commit, then
`sh scripts/publish.sh`: it pushes `site/` to the `gh-pages` branch, which GitHub Pages serves at
https://aalind0.github.io/time-machine-fund/.

## Data

- `scripts/build_data.mjs` builds `site/data/companies.json` and `site/data/fund.json` from the public YC
  directory (yc-oss), companies researched for 1,000 Futures, and `research/out_*.jsonl`. A company's value is
  only used when its research row carries a source. The raw inputs in `data/raw/` are not in the repo (the
  YC directory is the public yc-oss dump, https://yc-oss.github.io/api/companies/all.json); the built files in
  `site/data/` are, so the site runs without them.
- `scripts/test.mjs` is the full check (run it after any data or deck change; exits 1 on a failure). It checks
  the data, redoes the money math by hand, checks every deck is fair, then plays thousands of games with
  different players: careless, thoughtful, sharp, perfect, always wrong, idle, and players who follow a surface
  rule like "always pick YC". `N=4000` plays more games; `SEED=$(date +%s000)` uses different decks.
- `scripts/simulate.mjs` is the quick version: surface tells and difficulty by skill level.
- `research/SPEC.md` is the format for outcome research.

## Visit counts

Anonymous, cookie-free counts with GoatCounter (`site/js/stats.js`, site code in `site/js/config.js`): page views,
funds started (by mandate), funds finished (by result tier) and share clicks. Nothing about the player is sent.

## How the math works

See the "How the math works" panel on the results screen (generated from `site/data/fund.json`).
