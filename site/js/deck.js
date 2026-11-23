// Builds the 10 deals the way venture really works: one or two companies that matter, hidden among
// failures, survivors and well-funded traps.
//
// Fairness: the two cards in a deal must look alike on the surface (both YC or both not, founded within two
// years, similar pitch length, same kind of entry terms, both or neither showing a city), so the only way to
// pick well is to judge the idea. scripts/simulate.mjs checks that surface "tells" stay near a coin flip.
// Fun: every deal has a real difference at stake (no dead-vs-dead coin flips).
const SEEN_KEY = 'tmf-seen-v1';

export function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
export function saveSeen(seen, ids) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...ids].slice(-1500))); } catch { /* private mode */ }
}

// mulberry32: an even 0–1 spread. (The old xorshift took `% 1e9` of a 32-bit number, which made R() < 0.5
// come up 53% of the time and quietly put the better company on the left more often.)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WIN = new Set(['legend', 'unicorn', 'solid']);
const CASH = { L: 1, M: 2, H: 3 }; // cash needed, as shown on the card
export const LOSE = new Set(['dead', 'acquihire']);

// Tuned so random clicking can't build a great fund but judgement pays; scripts/test.mjs checks it.
// Simulated (Nov 2026, Generalist, double-down included):
//   random clicking:           ~44% lose money, ~9% top decile, ~2% reach 10x, median ~1.3x
//   real thought (~70% right): ~22% lose money, ~28% top decile, median ~2.5x
//   all 10 right:              never loses money (a "winner" always pays 3x or more)
// AI play-test on 20 fresh games (mixed modes), long run at each profile's hit rate:
//   careless 50% lose / 12% top decile · casual 36% / 14% · professional 25% / 19% · smart outsider 19% / 24% · sharp VC 15% / 21%
export const MIX = {
  winners: [[1, 0.5], [2, 0.5]],                         // companies that matter in a deck of 20
  winTier: [['solid', 0.94], ['unicorn', 0.05], ['legend', 0.01]], // mostly solid wins; giants are rare, so a random clicker rarely lucks into one
  winnersLean: [[1, 1]],                                 // decks with few modest winners (frontier: mostly giants) hide exactly one
  hype: 0.45,                                            // chance the losing side is a well-funded failure
};

// Two cards look alike when they share source (YC or not), frontier flag, whether a city shows and the kind
// of entry terms, were founded within 2 years, and have pitches within 12 characters of each other.
const same = (a, b) => !!a.yc === !!b.yc && !!a.f === !!b.f && !!a.l === !!b.l && !!a.e === !!b.e;
const alike = (a, b) => same(a, b) && Math.abs(a.y - b.y) <= 2 && Math.abs(a.p.length - b.p.length) <= 12;

export function buildDeck(all, mandate, seen, seed = Date.now(), mix = MIX) {
  const R = rng(seed);
  const pool = all.filter((c) => mandate === 'all' || (mandate === 'frontier' ? c.f : c.yc));
  const used = new Set();
  const avail = (c) => !used.has(c.id);
  const take = (list) => {
    const fresh = list.filter((c) => avail(c) && !seen.has(c.id));
    const src = fresh.length ? fresh : list.filter(avail);
    if (!src.length) return null;
    const c = src[Math.floor(R() * src.length)];
    used.add(c.id);
    return c;
  };
  const weighted = (w) => {
    let r = R() * w.reduce((t, [, p]) => t + p, 0);
    for (const [v, p] of w) { if ((r -= p) <= 0) return v; }
    return w[w.length - 1][0];
  };
  const takeFresh = (list) => (list.some((c) => avail(c) && !seen.has(c.id)) ? take(list) : null);
  const tier = (t) => pool.filter((c) => c.t === t);
  // Where the two cards differ (year, pitch length), a coin flip decides which side the partner must be on.
  // The flip is made once per deal, before any company is drawn, and kept until that deal is filled: if the
  // flip were redrawn after every failed match, cards at the edges (the longest pitches, say) would only ever
  // fit one way, and a visible difference would start to point at the winner.
  // k: how the partner's cash need compares (less, same, more), drawn evenly, so "needs more cash" never points at the winner
  const flip = () => ({ y: R() < 0.5 ? 1 : -1, l: R() < 0.5 ? 1 : -1, k: [-1, 0, 1][Math.floor(R() * 3)] });
  const partner = (a, cands, dir, freshOnly = false) => {
    // Same year is fine (and common). Pitch lengths must differ the way the flip says: if an exact tie could
    // count for either side, ties soak up more of one direction than the other and the flip stops being fair.
    const side = (d, s) => d === 0 || Math.sign(d) === s;
    let ok = cands.filter((c) => avail(c) && c.id !== a.id && alike(a, c) && side(c.y - a.y, dir.y) && Math.sign(c.p.length - a.p.length) === dir.l
      && Math.sign((CASH[c.k] || 2) - (CASH[a.k] || 2)) === dir.k);
    const unseen = ok.filter((c) => !seen.has(c.id)); // companies this player hasn't met yet come first
    if (unseen.length || freshOnly) ok = unseen;
    if (!ok.length) return null;
    const sameCat = ok.filter((c) => c.cat === a.cat);
    const close = (list) => list.filter((c) => Math.abs(c.y - a.y) <= 1);
    return take(close(sameCat)) || take(sameCat) || take(close(ok)) || take(ok);
  };
  const losers = pool.filter((c) => LOSE.has(c.t));
  const hyped = losers.filter((c) => c.h);
  const loserFor = (a, dir, fresh) => (R() < mix.hype && partner(a, hyped, dir, true)) || partner(a, losers, dir, fresh);
  // survivors: still alive (held at cost), sold for an undisclosed price, or returned less than 3x
  const survivors = tier('small');

  const deals = [];
  const lean = mix.winnersLean && tier('solid').length < 15;
  const nWin = weighted(lean ? mix.winnersLean : mix.winners);
  // A thin tier (the frontier deck has only a few modest winners) is drawn less, so it isn't drawn over and over.
  const winTier = mix.winTier.map(([t, w]) => [t, w * Math.min(1, tier(t).length / 15)]);
  // For the first tries only unseen partners count (so replays stay fresh); after that, anything that fits.
  // Every game must hide at least one winner. If the flip can't be met after many tries (small decks), it is
  // drawn again: rare, and still a fair coin.
  for (let k = 0, tries = 0, dir = flip(); k < nWin && tries < 400; tries++) {
    if (tries && tries % 80 === 0) dir = flip();
    const a = take(tier(weighted(winTier)));
    if (!a) continue;
    const fresh = tries < 60;
    const b = loserFor(a, dir, fresh);
    // A company with no match at all is set aside for this game (or it would be redrawn forever).
    if (b) { deals.push([a, b]); k++; dir = flip(); } else used.delete(a.id);
  }
  // Routine deals: a failure (sometimes a well-funded one) against a survivor that looks like it.
  // The failure is drawn first: young failures are scarce, so matching survivors to failures keeps years even.
  // On replays, a fresh plain failure beats a well-funded one the player has already seen.
  for (let tries = 0, dir = flip(); deals.length < 10 && tries < 300; tries++) {
    const b = (R() < mix.hype && takeFresh(hyped)) || take(losers);
    if (!b) break;
    const fresh = tries < 100;
    const a = partner(b, survivors, dir, fresh);
    if (a) { deals.push([a, b]); dir = flip(); } else if (fresh) used.delete(b.id);
  }
  for (let i = deals.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [deals[i], deals[j]] = [deals[j], deals[i]]; }
  return deals.map((p) => (R() < 0.5 ? p : [p[1], p[0]]));
}
