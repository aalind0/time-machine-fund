// The fund model: simple, stated, and the same for every company.
import { CONFIG } from './config.js';

let M = null; // model inputs from data/fund.json
export function setModel(model) { M = model; }

// Median seed pre-money by year (interpolated between known years, held flat outside them),
// turned into a post-money assuming the seed round sold ~20% of the company.
export function entryPost(year) {
  const pts = M.seedPre;
  if (year <= pts[0].y) return pts[0].v / (1 - M.seedDilution);
  if (year >= pts[pts.length - 1].y) return pts[pts.length - 1].v / (1 - M.seedDilution);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (year >= a.y && year <= b.y) return (a.v + (b.v - a.v) * (year - a.y) / (b.y - a.y)) / (1 - M.seedDilution);
  }
  return pts[0].v;
}

// Bigger outcomes needed more rounds after the seed, and each round dilutes you.
export function roundsAfterSeed(value) {
  return Math.max(0, Math.min(M.laterRounds.length, 2 * Math.log10(value / 20_000_000)));
}
export function retention(value) {
  let keep = 1, n = roundsAfterSeed(value);
  for (const d of M.laterRounds) {
    if (n <= 0) break;
    const part = Math.min(1, n);
    keep *= 1 - d * part;
    n -= part;
  }
  return keep;
}

// The price you pay and the stake you get, shown on the card.
export function terms(c) {
  const post = c.e || entryPost(c.y);
  return { post, own: Math.min(M.maxOwnership, CONFIG.check / post), firstRound: !!c.e };
}

// What a $1M check became. kind: cash (realised) | paper (still private) ; basis explains the number.
export function stake(c) {
  const check = CONFIG.check;
  if (!c) return { value: check, kind: 'cash', basis: 'missed', multiple: 1 };
  const own = Math.min(M.maxOwnership, check / (c.e || entryPost(c.y)));
  // Capital-hungry companies (rockets, fusion, chips, fleets) raise far more along the way, so an early stake
  // is diluted much more by the exit than in a software company of the same size (model: heavyKeep).
  const heavy = c.k === 'H' ? (M.heavyKeep ?? 1) : 1;
  const priced = (v, kind) => {
    const value = v * own * retention(v) * heavy;
    return { value, kind, basis: 'priced', own, multiple: value / check };
  };
  switch (c.o) {
    case 'ipo': return c.v ? priced(c.v, 'cash') : { value: check, kind: 'cash', basis: 'assumed', multiple: 1 };
    case 'acquired': return c.v ? priced(c.v, 'cash') : { value: check * M.undisclosedAcq, kind: 'cash', basis: 'undisclosed', multiple: M.undisclosedAcq };
    case 'acquihire': return c.v ? priced(c.v, 'cash') : { value: check * M.acquihire, kind: 'cash', basis: 'acquihire', multiple: M.acquihire };
    case 'dead': return { value: 0, kind: 'cash', basis: 'dead', multiple: 0 };
    case 'private': return c.v ? priced(c.v, 'paper') : { value: check, kind: 'paper', basis: 'cost', multiple: 1 };
    default: return { value: check, kind: 'paper', basis: 'cost', multiple: 1 }; // small: held at cost
  }
}

// The whole fund: $1M for each of the 10 deals plus the reserve for one double-down.
export const fundTotal = () => CONFIG.fundSize + (CONFIG.reserve || 0);

export function summarize(rounds) {
  // rounds: [{pair:[a,b], pick: 0|1|null, dd?: true}]  dd: doubled down, the reserve went in too (same price)
  const picks = rounds.map((r) => {
    const c = r.pick == null ? null : r.pair[r.pick];
    let s = stake(c);
    if (c && r.dd) s = { ...s, value: s.value * 2, check: CONFIG.check * 2, dd: true };
    return { c, s, round: r };
  });
  const reserveLeft = picks.some((p) => p.s.dd) ? 0 : (CONFIG.reserve || 0); // unused reserve stays in cash
  const gross = picks.reduce((t, p) => t + p.s.value, 0) + reserveLeft;
  const cash = picks.filter((p) => p.s.kind === 'cash').reduce((t, p) => t + p.s.value, 0) + reserveLeft;
  const committed = fundTotal() * (1 + CONFIG.feesPct);
  const carry = Math.max(0, gross - committed) * CONFIG.carry;
  const net = gross - carry;
  const netTvpi = net / committed;
  const dpi = gross > 0 ? (cash / gross) * net / committed : 0;
  // right calls: picked the side that turned out better (ties don't count either way)
  let right = 0, decided = 0, best = 0;
  const passes = [];
  for (const r of rounds) {
    const [x, y] = r.pair.map((c) => stake(c).value);
    best += Math.max(x, y);
    if (r.pick != null) {
      if (x !== y) { decided++; if ((r.pick === 0 ? x : y) > (r.pick === 0 ? y : x)) right++; }
      const other = r.pair[1 - r.pick];
      passes.push({ c: other, s: stake(other), chosen: r.pair[r.pick] });
    } else {
      r.pair.forEach((c) => passes.push({ c, s: stake(c), chosen: null }));
    }
  }
  const gotAway = passes.filter((p) => p.s.value > CONFIG.check * 2).sort((a, b) => b.s.value - a.s.value)[0] || null;
  // a coin flip on the same ten deals (expected value)
  const avgs = rounds.map((r) => (stake(r.pair[0]).value + stake(r.pair[1]).value) / 2); // coin flips everything, doubles down at random
  const coinGross = avgs.reduce((t, v) => t + v, 0) + (CONFIG.reserve ? avgs.reduce((t, v) => t + v, 0) / avgs.length : 0);
  const coinNet = (coinGross - Math.max(0, coinGross - committed) * CONFIG.carry) / committed;
  return {
    coinNet,
    picks, passes, gross, cash, paper: gross - cash, carry, net, netTvpi, dpi,
    grossMultiple: gross / fundTotal(), right, decided, reserveLeft,
    hindsight: best, captured: best > 0 ? gross / best : 0, gotAway,
    missed: rounds.filter((r) => r.pick == null).length,
  };
}

// One colour per verdict, on a single spectrum: red → orange → amber → yellow → green → bright brand green.
// Used for the verdict, the headline number, the "You" marker and the bands of the benchmark bar.
export const TONE = {
  wiped: '#ff4d4d', lost: '#ff7a45', below: '#ffb22e', above: '#e3d84a', tq: '#5fe08a', td: '#c8ff2e',
};
export function verdict(S, bench) {
  const q = bench.quartiles, x = S.netTvpi, back = fmtUSD(S.net);
  const lps = fmtUSD(fundTotal() * (1 + CONFIG.feesPct));
  if (x < 0.5) return { tier: 'Wiped out', cls: 't-wiped', tone: TONE.wiped, again: 'Try to raise Fund II', line: `Your LPs put in ${lps} and got back ${back}. Every fund that misses its winners ends up here.` };
  if (x < 1) return { tier: 'Lost money', cls: 't-lost', tone: TONE.lost, again: 'Try to raise Fund II', line: `Your LPs put in ${lps} and got back ${back}. Close, but the winners got away.` };
  if (x >= 25) return { tier: 'Legendary', cls: 't-top', tone: TONE.td, again: 'Raise Fund II', line: `${fmtX(x)} net. The kind of fund LPs tell stories about.` };
  if (x >= 10) return { tier: 'Fund of the decade', cls: 't-top', tone: TONE.td, again: 'Raise Fund II', line: `More than double the top-decile line (${fmtX(q.top_decile)}). Fund II is oversubscribed.` };
  if (x >= q.top_decile) return { tier: 'Top decile', cls: 't-td', tone: TONE.td, again: 'Raise Fund II', line: 'Better than about 9 in 10 venture funds of a comparable vintage.' };
  if (x >= q.top_quartile) return { tier: 'Top quartile', cls: 't-tq', tone: TONE.tq, again: 'Raise Fund II', line: 'Better than about 3 in 4 venture funds of a comparable vintage.' };
  if (x >= q.median) return { tier: 'Above median', cls: 't-above', tone: TONE.above, again: 'Raise Fund II', line: 'Better than the typical venture fund, but not by much.' };
  return { tier: 'Below median', cls: 't-below', tone: TONE.below, again: 'Try to raise Fund II', line: `You returned the money and a bit more, but less than the typical venture fund (${fmtX(q.median)}).` };
}

// The real fund whose net multiple is closest to yours (log distance).
export function closestFund(netTvpi, funds) {
  if (!funds || !funds.length) return null;
  const t = Math.log(Math.max(netTvpi, 0.05));
  return funds.slice().sort((a, b) => Math.abs(Math.log(a.net_tvpi) - t) - Math.abs(Math.log(b.net_tvpi) - t))[0];
}

export function fmtUSD(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(a >= 1e10 ? 1 : 2).replace(/\.?0+$/, '')}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}
export function fmtX(x) {
  if (x === 0) return '0x';
  if (x >= 100) return `${Math.round(x).toLocaleString('en-US')}x`;
  if (x >= 10) return `${x.toFixed(1).replace(/\.0$/, '')}x`;
  return `${x.toFixed(2).replace(/0$/, '')}x`;
}
