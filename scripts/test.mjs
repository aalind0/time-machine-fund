// Full check of the game: node scripts/test.mjs   (N=2000 games per player per mode by default)
// Checks the data, redoes the money math by hand, checks every deck is fair, then plays thousands of
// games with different kinds of players (careless, thoughtful, sharp, perfect, always wrong, AFK, and
// players who follow a surface rule like "always pick YC"). Exits with code 1 if any check fails.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = await import(path.join(root, 'site/js/fund.js'));
const { buildDeck, WIN, LOSE } = await import(path.join(root, 'site/js/deck.js'));
const { shareText } = await import(path.join(root, 'site/js/share.js'));
const { CONFIG } = await import(path.join(root, 'site/js/config.js'));
const cs = JSON.parse(fs.readFileSync(path.join(root, 'site/data/companies.json'))).companies;
const fd = JSON.parse(fs.readFileSync(path.join(root, 'site/data/fund.json')));
F.setModel(fd.model);
const Q = fd.benchmarks.quartiles;
const N = +process.env.N || 2000;
const FUND = CONFIG.fundSize + (CONFIG.reserve || 0); // 10 deals plus the double-down reserve
const LPS = FUND * (1 + CONFIG.feesPct); // what LPs commit, fees included

let failed = 0, passed = 0;
const check = (name, ok, detail = '') => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const info = (s) => console.log(`        ${s}`);
const section = (t) => console.log(`\n${t}`);
const pc = (x) => `${Math.round(x * 100)}%`;
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const q = (arr, p) => arr[Math.floor(p * (arr.length - 1))];
function rng(seed) { // mulberry32, so every run gives the same numbers
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const val = (c) => F.stake(c).value;
const CASHN = { L: 1, M: 2, H: 3 };
const MODES = { all: 'Generalist', frontier: 'Frontier tech', yc: 'YC only' };
// SEED=<number> replays with other decks; the real game seeds from the clock, e.g. SEED=$(date +%s000)
const SEED = +process.env.SEED || 0;
const seedOf = (mode, g) => SEED + g * 7919 + 13 + { all: 0, frontier: 1, yc: 2 }[mode] * 1e6;

// ─────────────────────────────────────────────────────────────────────────────────────────────
section('1. Data');
check('every company has a unique id', new Set(cs.map((c) => c.id)).size === cs.length, `${cs.length} companies`);
{
  // Two startups can share a name (YC has had two Chariots, seven years apart); the same name founded within
  // three years is almost always one company counted twice.
  // Two separate YC directory entries are two companies by definition.
  const seen = new Map(), dup = [], namesakes = [];
  for (const c of cs) {
    const k = c.n.toLowerCase().trim();
    for (const o of seen.get(k) || []) (Math.abs(o.y - c.y) <= 3 && !(o.yc && c.yc) ? dup : namesakes).push(`${c.n} ${o.y}/${c.y}`);
    seen.set(k, [...(seen.get(k) || []), c]);
  }
  check('no company is in the game twice', !dup.length, dup.join(', '));
  if (namesakes.length) info(`different companies that share a name: ${namesakes.join(', ')}`);
}
{
  const bad = cs.filter((c) => !c.id || !c.n || !c.p || !c.s || !c.o || !c.t || !c.cat || !Number.isInteger(c.y));
  check('every card has a name, pitch, sector, year and outcome', !bad.length, bad.map((c) => c.n || c.id).join(', '));
}
{
  const bad = cs.filter((c) => c.y < 2012 || c.y > CONFIG.now);
  check(`every company was founded 2012–${CONFIG.now}`, !bad.length, bad.map((c) => `${c.n} ${c.y}`).join(', '));
  const young = cs.filter((c) => c.y >= 2025 && c.o === 'small');
  check('2025+ companies are only in the game when their fate is known', !young.length, young.map((c) => c.n).join(', '));
}
{
  const leak = cs.filter((c) => {
    const core = c.n.replace(/\s*\(.*?\)\s*/g, '').replace(/[.,]?\s+(inc|ai|labs?|technologies|hq)\.?$/i, '').trim();
    return core.length >= 4 && new RegExp(`\\b${core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(c.p);
  });
  check('no pitch gives away the company name', !leak.length, leak.map((c) => `${c.n}: ${c.p}`).join(' | '));
  const SPOIL = /\b(unicorn|decacorn|ipo|went public|publicly traded|acquired by|was acquired|shut down|shutting down|bankrupt\w*|defunct|collapsed|wound down|insolven\w*|scandal\w*|billion-dollar|valued at)\b/i; // not "fraud": anti-fraud products say it
  const sp = cs.filter((c) => SPOIL.test(c.p));
  check('no pitch gives away the outcome', !sp.length, sp.map((c) => `${c.n}: ${c.p}`).join(' | '));
}
{
  const unsourced = cs.filter((c) => c.v && !c.src);
  check('every valuation used in the math has a source link', !unsourced.length, unsourced.map((c) => c.n).join(', '));
  const hypeBad = cs.filter((c) => c.h && !LOSE.has(c.t));
  check('only failures are flagged as well-funded traps', !hypeBad.length, hypeBad.map((c) => c.n).join(', '));
  const noFacts = cs.filter((c) => !c.w || !c.m || !['L', 'M', 'H'].includes(c.k) || !c.kw);
  check('every card says who pays, how it makes money and how much cash it needs', !noFacts.length, `${noFacts.length} missing: ${noFacts.slice(0, 6).map((c) => c.n).join(', ')}`);
  const longFacts = cs.filter((c) => (c.w || '').length > 24 || (c.m || '').length > 26 || (c.kw || '').length > 26);
  check('the facts are short enough to read at a glance', !longFacts.length, longFacts.slice(0, 5).map((c) => `${c.w} | ${c.m} | ${c.kw}`).join(' · '));
}
{
  const wrong = cs.filter((c) => {
    const m = val(c) / CONFIG.check;
    if (!Number.isFinite(m) || m < 0) return true;
    if (WIN.has(c.t)) return m < 3;
    if (LOSE.has(c.t)) return m >= 1;
    return m >= 3 || (m < 0.5 && !(c.v && c.o === 'private')); // survivors: under 3x (a priced paper mark may sit below cost)
  });
  check('winners pay 3x or more, failures less than the check, survivors in between', !wrong.length,
    wrong.slice(0, 12).map((c) => `${c.n} [${c.t}] ${(val(c) / CONFIG.check).toFixed(2)}x`).join(', '));
}
{
  const L = cs.map((c) => c.p.length).sort((a, b) => a - b);
  info(`pitch length: shortest ${L[0]}, 5% ${q(L, 0.05)}, median ${q(L, 0.5)}, 95% ${q(L, 0.95)}, longest ${L.at(-1)} characters`);
  const t = {}; cs.forEach((c) => (t[c.t] = (t[c.t] || 0) + 1));
  info(`by fate: ${Object.entries(t).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
section('2. Money math, redone by hand');
{
  // An independent copy of the stated model, written from the "How the math works" notes.
  const M = fd.model;
  const seedPost = (y) => {
    const p = M.seedPre;
    let pre;
    if (y <= p[0].y) pre = p[0].v;
    else if (y >= p.at(-1).y) pre = p.at(-1).v;
    else { const i = p.findIndex((a, k) => k < p.length - 1 && y >= a.y && y <= p[k + 1].y); pre = p[i].v + (p[i + 1].v - p[i].v) * (y - p[i].y) / (p[i + 1].y - p[i].y); }
    return pre / (1 - M.seedDilution);
  };
  const kept = (v) => {
    let n = Math.max(0, Math.min(M.laterRounds.length, 2 * Math.log10(v / 20e6))), k = 1;
    for (const d of M.laterRounds) { const part = Math.max(0, Math.min(1, n)); k *= 1 - d * part; n -= part; }
    return k;
  };
  const mine = (c) => {
    const own = Math.min(M.maxOwnership, CONFIG.check / (c.e || seedPost(c.y)));
    if (c.o === 'dead') return 0;
    if (c.v && ['ipo', 'acquired', 'acquihire', 'private'].includes(c.o)) return c.v * own * kept(c.v) * (c.k === 'H' ? (M.heavyKeep ?? 1) : 1);
    if (c.o === 'acquired') return CONFIG.check * M.undisclosedAcq;
    if (c.o === 'acquihire') return CONFIG.check * M.acquihire;
    return CONFIG.check;
  };
  const off = cs.filter((c) => !close(mine(c), val(c)));
  check('every company\'s payout matches a second, independent calculation', !off.length, off.slice(0, 8).map((c) => c.n).join(', '));
  const amp = cs.find((c) => c.id === 'amplitude');
  if (amp) {
    // By hand: 2012 seed pre $4.53M (between $3.2M in 2010 and $5.2M in 2013) → post $5.67M → $1M buys 17.6%, capped at 10%.
    // $7.1B exit → 2·log10(7.1B/20M) = 5.1 later rounds → kept 0.8·0.84·0.88·0.9·0.9·0.99 = 47.4% → 10% × 47.4% × $7.1B ≈ $336.7M.
    check('worked example: Amplitude ($1M in 2012, listed at $7.1B) pays about $336.7M', Math.abs(val(amp) - 336.7e6) < 0.1e6, F.fmtUSD(val(amp)));
  }
  const over = cs.filter((c) => F.terms(c).own > fd.model.maxOwnership + 1e-12);
  check(`no stake is ever above ${fd.model.maxOwnership * 100}%`, !over.length);
  check('bigger exits never pay less (dilution can\'t flip the order)', [3e7, 1e8, 1e9, 1e10, 1e11].every((v, i, a) => !i || v * F.retention(v) > a[i - 1] * F.retention(a[i - 1])));

  // fund-level bookkeeping on random games
  const R = rng(7);
  let bad = 0;
  for (let g = 0; g < N; g++) {
    const deck = buildDeck(cs, 'all', new Set(), seedOf('all', g));
    const rounds = deck.map((pair) => ({ pair, pick: R() < 0.1 ? null : R() < 0.5 ? 0 : 1 }));
    const S = F.summarize(rounds);
    const gross = rounds.reduce((t, r) => t + (r.pick == null ? CONFIG.check : val(r.pair[r.pick])), 0) + (CONFIG.reserve || 0); // reserve unused: cash
    const carry = Math.max(0, gross - LPS) * CONFIG.carry;
    const ok = close(S.gross, gross) && close(S.carry, carry) && close(S.net, gross - carry) && close(S.netTvpi, (gross - carry) / LPS)
      && close(S.cash + S.paper, S.gross) && S.dpi >= 0 && S.dpi <= S.netTvpi + 1e-9 && S.right <= S.decided && S.decided <= 10
      && S.picks.length === 10 && Number.isFinite(S.netTvpi) && Number.isFinite(S.coinNet);
    if (!ok) bad++;
  }
  check(`fund totals add up in ${N} random games (gross, 20% carry, fees, net, cash vs paper)`, !bad, `${bad} games off`);

  const deck = buildDeck(cs, 'all', new Set(), 1);
  const afk = F.summarize(deck.map((pair) => ({ pair, pick: null })));
  check('letting every timer run out returns the money uninvested: 0.83x, "Lost money"', close(afk.netTvpi, FUND / LPS) && F.verdict(afk, fd.benchmarks).tier === 'Lost money', F.fmtX(afk.netTvpi));
  const dead = cs.filter((c) => c.o === 'dead').slice(0, 20);
  const decks0 = [...Array(40)].map((_, g) => buildDeck(cs, 'all', new Set(), seedOf('all', g) + 77));
  const zero = F.summarize([...Array(10)].map((_, i) => ({ pair: [dead[2 * i], dead[2 * i + 1]], pick: 0 })));
  check('ten dead companies = only the unused reserve back, "Wiped out"', zero.gross === (CONFIG.reserve || 0) && F.verdict(zero, fd.benchmarks).tier === 'Wiped out');
  // a double-down puts the reserve in at the same price: that company's payout counts twice, and no reserve is left in cash
  const winDeal = decks0.find((d) => d.some((p) => p.some((c) => WIN.has(c.t))));
  if (winDeal) {
    const i = winDeal.findIndex((p) => p.some((c) => WIN.has(c.t))), w = winDeal[i].findIndex((c) => WIN.has(c.t));
    const base = winDeal.map((pair, k) => ({ pair, pick: k === i ? w : 0 }));
    const plain = F.summarize(base), doubled = F.summarize(base.map((r, k) => (k === i ? { ...r, dd: true } : r)));
    check('doubling down on a winner adds its payout again (and uses up the reserve)', close(doubled.gross - plain.gross, val(winDeal[i][w]) - (CONFIG.reserve || 0)), `+${F.fmtUSD(doubled.gross - plain.gross)}`);
  }

  const tierAt = (x) => F.verdict({ netTvpi: x, net: x * LPS }, fd.benchmarks).tier;
  const ladder = [[0.2, 'Wiped out'], [0.7, 'Lost money'], [1.2, 'Below median'], [Q.median, 'Above median'], [Q.top_quartile, 'Top quartile'],
    [Q.top_decile, 'Top decile'], [10, 'Fund of the decade'], [25, 'Legendary']];
  const wrongTier = ladder.filter(([x, t]) => tierAt(x) !== t);
  check('verdicts sit at the right lines (median 1.89x, top quartile 2.53x, top decile 4.08x, 10x, 25x)', !wrongTier.length, wrongTier.map(([x, t]) => `${x}→${tierAt(x)} not ${t}`).join(', '));
  const fmt = [[F.fmtX(0), '0x'], [F.fmtX(2.534), '2.53x'], [F.fmtX(25), '25x'], [F.fmtX(312.4), '312x'], [F.fmtUSD(1.5e9), '$1.5B'], [F.fmtUSD(12e6), '$12M'], [F.fmtUSD(250e3), '$250K']];
  const badFmt = fmt.filter(([a, b]) => a !== b);
  check('numbers print correctly ($1.5B, $12M, 2.53x, 0x …)', !badFmt.length, badFmt.map(([a, b]) => `${a} vs ${b}`).join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
section(`3. Decks (${N} per mode)`);
const decks = {};
for (const mode of Object.keys(MODES)) {
  const t0 = performance.now();
  decks[mode] = [...Array(N)].map((_, g) => buildDeck(cs, mode, new Set(), seedOf(mode, g)));
  const ms = (performance.now() - t0) / N;
  const D = decks[mode];
  const inMode = (c) => mode === 'all' || (mode === 'frontier' ? c.f : c.yc);
  let size = 0, dupe = 0, out = 0, flat = 0, unlike = 0, left = 0, pairs = 0, traps = 0;
  const wins = {};
  for (const deck of D) {
    if (deck.length !== 10) size++;
    const flatIds = deck.flat().map((c) => c.id);
    if (new Set(flatIds).size !== 20) dupe++;
    if (!deck.flat().every(inMode)) out++;
    const w = deck.flat().filter((c) => WIN.has(c.t)).length;
    wins[w] = (wins[w] || 0) + 1;
    for (const [a, b] of deck) {
      pairs++;
      if (val(a) === val(b)) flat++;
      if (val(a) > val(b)) left++;
      if (a.h || b.h) traps++;
      const alike = !!a.yc === !!b.yc && !!a.f === !!b.f && !!a.l === !!b.l && !!a.e === !!b.e && Math.abs(a.y - b.y) <= 2 && Math.abs(a.p.length - b.p.length) <= 12;
      if (!alike) unlike++;
    }
  }
  console.log(`  ${MODES[mode]}`);
  check('every game has exactly 10 deals', !size, `${size} short`);
  check('no company shows up twice in one game', !dupe);
  check('every card fits the mandate', !out);
  if (mode === 'frontier') {
    // judged from what the player reads: deep-tech words, and no app-style pitch without them
    const cards = [...new Map(D.flat().flat().map((c) => [c.id, c])).values()];
    const DEEPISH = /hardware|neural|augmented reality|air capture|robot|drone|satellite|rocket|space|orbit|aircraft|jet|supersonic|hypersonic|launch|chip|silicon|semiconductor|processor|accelerator|asic|gpu|quantum|fusion|nuclear|reactor|batter|hydrogen|carbon|co2|solar|geothermal|electric|ev\b|graphite|cement|steel|material|chemical|microbe|enzyme|protein|antibod|gene|genom|dna|rna|crispr|cell|therap|drug|medicine|molecul|cancer|tumor|biolog|bio|vaccine|virus|bacteri|diagnos|blood|sequenc|implant|neuro|brain|nerve|exoskeleton|surgical|lab|model|foundation|llm|inference|compute|self-driving|driverless|autonomous|lidar|3d[- ]print|laser|nano|radio|radar|defen[cs]e|military|humanoid|reprogramm|wafer|photonic|fermentation|meat|insect|tracer|imaging|stimulation|heat|power|fuel|seaglider|weather|tokamak|plasma/i;
    const odd = cards.filter((c) => !DEEPISH.test(`${c.p} ${c.s}`));
    check('frontier cards are all deep tech (robots, space, chips, energy, bio, AI models…)', !odd.length, odd.slice(0, 8).map((c) => `${c.n}: ${c.p}`).join(' | '));
    const appy = cards.filter((c) => /\b(marketplace|crm|saas|chatbot|for (sales|marketing|recruit\w*|hr|landlords|restaurants)|sales (reps|emails|teams))\b/i.test(c.p));
    check('no frontier card is an app or marketplace', !appy.length, appy.slice(0, 8).map((c) => `${c.n}: ${c.p}`).join(' | '));
    info(`${cards.length} different frontier companies across these games`);
  }
  if (mode === 'yc') {
    const notYC = D.flat().flat().filter((c) => !c.yc || !c.b);
    check('every YC card is a YC company with its batch on the card', !notYC.length, notYC.slice(0, 5).map((c) => c.n).join(', '));
  }
  if (mode === 'all') {
    const mixF = D.flat().flat().some((c) => c.f) && D.flat().flat().some((c) => !c.f), mixY = D.flat().flat().some((c) => c.yc) && D.flat().flat().some((c) => !c.yc);
    check('the generalist fund sees everything: frontier and not, YC and not', mixF && mixY);
  }
  check('every deal has a real difference (no coin flips between two equal outcomes)', !flat, `${flat} flat deals`);
  check('the two cards in every deal look alike (source, year, pitch length, terms)', !unlike, `${unlike} of ${pairs}`);
  check('the better company sits on the left about half the time', Math.abs(left / pairs - 0.5) < 0.03, pc(left / pairs));
  const oneOrTwo = ((wins[1] || 0) + (wins[2] || 0)) / N;
  check('every game hides 1 or 2 real winners', oneOrTwo === 1, Object.entries(wins).map(([k, v]) => `${k} winner${k === '1' ? '' : 's'}: ${pc(v / N)}`).join(', '));
  check('building a game is instant', ms < 25, `${ms.toFixed(1)} ms`);
  info(`well-funded traps in ${pc(traps / pairs)} of deals`);
  // The deals that decide the fund are the ones with a winner in them: no surface rule may work there either.
  const big = D.flat().filter(([a, b]) => WIN.has(a.t) || WIN.has(b.t));
  const rule = (f) => { let h = 0, n = 0; for (const [a, b] of big) { const s = f(a, b); if (!s) continue; n++; if ((s > 0) === (val(a) > val(b))) h++; } return n ? h / n : 0.5; };
  const R0 = { 'longer pitch': rule((a, b) => a.p.length - b.p.length), 'newer company': rule((a, b) => a.y - b.y), 'pricier round': rule((a, b) => F.terms(a).post - F.terms(b).post), 'less cash needed': rule((a, b) => CASHN[b.k] - CASHN[a.k]) };
  check('in the deals with a winner, no surface rule finds it more than 60% of the time', Object.values(R0).every((x) => x > 0.4 && x < 0.6),
    Object.entries(R0).map(([k, x]) => `${k} ${pc(x)}`).join(', '));
}

section('4. Playing again (the game remembers what you have seen)');
for (const mode of Object.keys(MODES)) {
  let seen = new Set(), firstRepeat = null, repeats10 = 0, short = 0;
  const games = 60;
  const all = new Set();
  for (let g = 0; g < games; g++) {
    const deck = buildDeck(cs, mode, seen, seedOf(mode, g) + 5);
    if (deck.length !== 10) short++;
    const ids = deck.flat().map((c) => c.id);
    const rep = ids.filter((id) => all.has(id)).length;
    if (rep && firstRepeat == null) firstRepeat = g + 1;
    if (g < 10) repeats10 += rep;
    ids.forEach((id) => all.add(id));
    seen = new Set([...seen, ...ids].slice(-1500)); // same cap as saveSeen
  }
  // Frontier is a much smaller deck (strict deep tech only, ~65 failures), so repeats come sooner there.
  const fresh = mode === 'frontier' ? 3 : 5;
  check(`${MODES[mode]}: ${fresh} games in a row show ${fresh * 20} different companies`, firstRepeat == null || firstRepeat > fresh,
    `first repeat in game ${firstRepeat ?? `>${games}`}, ${repeats10} repeated cards over 10 games, ${all.size} different companies in ${games} games`);
  check(`${MODES[mode]}: still a full 10-deal game after ${games} games in a row`, !short, `${short} short`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
section(`5. Players (${N} games each, same decks for every player)`);
const better = (pair) => (val(pair[0]) >= val(pair[1]) ? 0 : 1);
const byRule = (f) => (pair, R) => { const s = f(pair[0], pair[1]); return s ? (s > 0 ? 0 : 1) : R() < 0.5 ? 0 : 1; };
const skill = (p) => (pair, R) => (R() < p ? better(pair) : 1 - better(pair));
const PLAYERS = {
  'No thought (coin flip)': skill(0.5),
  'Always picks the left card': () => 0,
  'Always picks the right card': () => 1,
  'Always picks the YC company': byRule((a, b) => (a.yc || 0) - (b.yc || 0)),
  'Always picks the older company': byRule((a, b) => b.y - a.y),
  'Always picks the newer company': byRule((a, b) => a.y - b.y),
  'Always picks the longer pitch': byRule((a, b) => a.p.length - b.p.length),
  'Always picks the pricier round': byRule((a, b) => F.terms(a).post - F.terms(b).post),
  'Always picks the cheaper round': byRule((a, b) => F.terms(b).post - F.terms(a).post),
  'Always picks the one needing less cash': byRule((a, b) => CASHN[b.k] - CASHN[a.k]),
  'Always picks the one needing more cash': byRule((a, b) => CASHN[a.k] - CASHN[b.k]),
  'Always picks the consumer one': byRule((a, b) => (/consumer|people|users|individuals|parents|patients|drivers|students|gamers|homeowners/i.test(a.w) ? 1 : 0) - (/consumer|people|users|individuals|parents|patients|drivers|students|gamers|homeowners/i.test(b.w) ? 1 : 0)),
  'Some thought (6 in 10 right)': skill(0.6),
  'Real thought (7 in 10 right)': skill(0.7),
  'Sharp (85% right)': skill(0.85),
  'Perfect hindsight (10 of 10)': (pair) => better(pair),
  'Always wrong (0 of 10)': (pair) => 1 - better(pair),
  'Lets the timer run out': () => null,
  'Careless and slow (coin flip, misses 3)': (pair, R) => (R() < 0.3 ? null : R() < 0.5 ? 0 : 1),
};
const DD_SKILL = { 'Some thought (6 in 10 right)': 0.3, 'Real thought (7 in 10 right)': 0.55, 'Sharp (85% right)': 0.75, 'Perfect hindsight (10 of 10)': 1 };
const results = {};
for (const mode of Object.keys(MODES)) {
  results[mode] = {};
  console.log(`  ${MODES[mode]}`);
  console.log(`        ${'player'.padEnd(42)} lose $  wiped  ≥top¼   10x+   median   worst    best`);
  for (const [name, play] of Object.entries(PLAYERS)) {
    const R = rng(name.length * 131 + mode.length);
    const xs = [], tiers = {};
    const qDD = DD_SKILL[name] ?? 0; // how often they put the double-down on a winner they hold
    for (const deck of decks[mode]) {
      const rounds = deck.map((pair) => ({ pair, pick: play(pair, R) }));
      const live = rounds.map((r, k) => k).filter((k) => rounds[k].pick != null);
      if (live.length) {
        const held = live.filter((k) => WIN.has(rounds[k].pair[rounds[k].pick].t));
        const k = held.length && R() < qDD ? held[Math.floor(R() * held.length)] : live[Math.floor(R() * live.length)];
        rounds[k].dd = true;
      }
      const S = F.summarize(rounds);
      xs.push(S.netTvpi);
      const t = F.verdict(S, fd.benchmarks).tier;
      tiers[t] = (tiers[t] || 0) + 1;
    }
    xs.sort((a, b) => a - b);
    const r = {
      lose: xs.filter((x) => x < 1).length / N, wiped: xs.filter((x) => x < 0.5).length / N,
      tq: xs.filter((x) => x >= Q.top_quartile).length / N, td: xs.filter((x) => x >= Q.top_decile).length / N, ten: xs.filter((x) => x >= 10).length / N,
      med: q(xs, 0.5), worst: xs[0], best: xs.at(-1), tiers, finite: xs.every(Number.isFinite),
    };
    results[mode][name] = r;
    console.log(`        ${name.padEnd(42)} ${pc(r.lose).padStart(5)} ${pc(r.wiped).padStart(6)} ${pc(r.tq).padStart(6)} ${pc(r.ten).padStart(6)} ${F.fmtX(r.med).padStart(8)} ${F.fmtX(r.worst).padStart(7)} ${F.fmtX(r.best).padStart(7)}`);
  }
}

for (const mode of Object.keys(MODES)) {
  const P = results[mode];
  const coin = P['No thought (coin flip)'];
  console.log(`\n  ${MODES[mode]}: checks`);
  check('random clicking loses money 40–60% of the time', coin.lose >= 0.4 && coin.lose <= 0.6, pc(coin.lose));
  check('random clicking rarely builds a top-decile fund (at most ~1 game in 8)', coin.td <= 0.13, pc(coin.td));
  check('random clicking almost never builds a 10x fund (lucky exceptions only)', coin.ten <= 0.06, pc(coin.ten));
  const pos = ['Always picks the left card', 'Always picks the right card'].map((k) => P[k].lose);
  check('which side a card is on tells you nothing', pos.every((x) => Math.abs(x - coin.lose) < 0.05), pos.map(pc).join(' / '));
  const rules = Object.keys(P).filter((k) => /^Always picks the (YC|older|newer|longer|pricier|cheaper|one needing|consumer)/.test(k));
  const cheat = rules.filter((k) => P[k].lose < coin.lose - 0.08);
  check('no surface rule (YC, age, pitch length, price) beats a coin flip by much', !cheat.length,
    rules.map((k) => `${k.replace('Always picks the ', '')} ${pc(P[k].lose)}`).join(', '));
  const ladder = ['No thought (coin flip)', 'Some thought (6 in 10 right)', 'Real thought (7 in 10 right)', 'Sharp (85% right)', 'Perfect hindsight (10 of 10)'].map((k) => P[k]);
  check('every step of better judgement loses money less often', ladder.every((r, i) => !i || r.lose < ladder[i - 1].lose || r.lose === 0), ladder.map((r) => pc(r.lose)).join(' → '));
  check('…and makes more money (median)', ladder.every((r, i) => !i || r.med > ladder[i - 1].med), ladder.map((r) => F.fmtX(r.med)).join(' → '));
  const real = P['Real thought (7 in 10 right)'];
  check('thoughtful players usually beat the typical fund', real.med >= Q.median, `median ${F.fmtX(real.med)} vs ${F.fmtX(Q.median)}`);
  const sharp = P['Sharp (85% right)'];
  check('sharp players can still lose (no sure thing): 5–25% lose money', sharp.lose >= 0.05 && sharp.lose <= 0.25, pc(sharp.lose));
  check('sharp players can make a lot: top decile at least 1 time in 4', sharp.td >= 0.25, pc(sharp.td));
  check('thinking players reach top decile at least twice as often as random clicking', real.td >= 2 * coin.td, `${pc(real.td)} vs ${pc(coin.td)}`);
  check('thinking players typically end up with far more than random clicking (median at least 1.6x higher)', real.med >= 1.6 * coin.med, `${F.fmtX(real.med)} vs ${F.fmtX(coin.med)}`);
  const perfect = P['Perfect hindsight (10 of 10)'];
  check('getting all 10 right never loses money', perfect.lose === 0, `${pc(perfect.lose)} lose, worst ${F.fmtX(perfect.worst)}`);
  const wrong = P['Always wrong (0 of 10)'];
  check('getting all 10 wrong always loses money', wrong.lose === 1, pc(wrong.lose));
  const afk = P['Lets the timer run out'];
  check('running out the clock always loses money; even a coin flip makes money far more often', afk.lose === 1 && coin.lose < 0.6, `idle always ${F.fmtX(afk.med)}`);
  check('no result is NaN or infinite', Object.values(P).every((r) => r.finite));
  const reached = new Set(Object.values(P).flatMap((r) => Object.keys(r.tiers)));
  const tiers = ['Wiped out', 'Lost money', 'Below median', 'Above median', 'Top quartile', 'Top decile', 'Fund of the decade', 'Legendary'];
  const missing = tiers.filter((t) => !reached.has(t));
  check('every verdict, from "Wiped out" to "Legendary", can happen', !missing.length, missing.length ? `never: ${missing.join(', ')}` : '');
  const coinTiers = coin.tiers;
  info(`coin-flip verdicts: ${tiers.map((t) => `${t} ${pc((coinTiers[t] || 0) / N)}`).join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
section('6. Results screen text');
{
  const R = rng(99), bad = [];
  for (let g = 0; g < Math.min(1000, N); g++) {
    const deck = decks.all[g];
    const S = F.summarize(deck.map((pair) => ({ pair, pick: R() < 0.1 ? null : R() < 0.5 ? 0 : 1 })));
    const V = F.verdict(S, fd.benchmarks);
    const txt = [V.tier, V.line, V.again, shareText('Fund I', S, V), F.fmtUSD(S.gross), F.fmtX(S.netTvpi), F.fmtX(S.coinNet)].join(' ');
    if (/NaN|undefined|Infinity|null|\[object/.test(txt)) bad.push(txt);
  }
  check(`verdict lines and the share text never show NaN / undefined (${Math.min(1000, N)} games)`, !bad.length, bad[0] || '');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
