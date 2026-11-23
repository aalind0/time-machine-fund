// Builds site/data/companies.json and site/data/fund.json from:
//   data/raw/yc_all.json            YC directory (yc-oss, public)
//   data/raw/futures_companies.jsonl  companies researched for 1,000 Futures
//   research/out_*.jsonl            outcome research (values only kept when they carry a source)
//   research/benchmarks.json, research/model_inputs.json
// Run: node scripts/build_data.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isFrontier } from './frontier.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const jsonl = (p) => rd(p).split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const Y0 = 2012, Y1 = 2026;
const YOUNG = 2025; // from here on, only companies whose fate is already known (valued, sold or shut down)

/* ---------- inputs ---------- */
const yc = JSON.parse(rd('data/raw/yc_all.json'));
const futures = jsonl('data/raw/futures_companies.jsonl');
const research = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'research')).filter((f) => /^out_.*\.jsonl$/.test(f))) {
  for (const r of jsonl(`research/${f}`)) if (r.slug) research.set(r.slug, r);
}
// Verification patches (research/patch_*.jsonl): each row is {slug, ...fields to override}; applied in file order.
for (const f of fs.readdirSync(path.join(ROOT, 'research')).filter((f) => /^patch_.*\.jsonl$/.test(f)).sort()) {
  for (const p of jsonl(`research/${f}`)) {
    if (!p.slug) continue;
    const { slug, ...fields } = p;
    research.set(slug, { ...(research.get(slug) || { slug }), ...fields });
  }
}

/* ---------- helpers ---------- */
const batchYear = (b) => { const m = /(\d{4})/.exec(b || ''); return m ? +m[1] : 0; };
const batchShort = (b) => {
  const m = /^(Winter|Summer|Spring|Fall) \d{2}(\d{2})$/.exec(b || '');
  return m ? ({ Winter: 'W', Summer: 'S', Spring: 'X', Fall: 'F' }[m[1]] + m[2]) : null;
};
const LOWTECH_SUB = new Set(['Consumer -> Apparel and Cosmetics', 'Consumer -> Food and Beverage', 'Consumer -> Home and Personal']);
const TECHY = /\b(AI|Machine Learning|Hardware|Robotics|SaaS|API|Developer|Software|Marketplace|Fintech|Platform|Data)\b/i;
const SECTOR_LABEL = {
  fintech: 'Fintech', crypto_web3: 'Crypto', ecommerce_marketplace: 'Marketplace', quick_commerce_delivery: 'Delivery',
  mobility_transport: 'Mobility', proptech_realestate: 'Proptech', healthtech: 'Health tech', biotech: 'Biotech', edtech: 'Edtech',
  saas_b2b: 'B2B software', devtools_infra: 'Dev tools', ai_ml: 'AI', consumer_social: 'Social', media_content: 'Media',
  gaming: 'Gaming', foodtech: 'Food tech', hardware_iot: 'Hardware', climate_energy: 'Climate', logistics_supplychain: 'Logistics',
  hrtech_work: 'HR tech', travel_hospitality: 'Travel', legal_govtech: 'Legal & gov', insurtech: 'Insurance', agritech: 'Agtech',
  deeptech_space: 'Deep tech', security: 'Security', adtech_martech: 'Marketing', gig_services_ondemand: 'On-demand',
};
const CAT_OF_SECTOR = {
  fintech: 'fintech', crypto_web3: 'fintech', insurtech: 'fintech', ecommerce_marketplace: 'consumer', quick_commerce_delivery: 'consumer',
  consumer_social: 'consumer', media_content: 'consumer', gaming: 'consumer', foodtech: 'consumer', travel_hospitality: 'consumer',
  gig_services_ondemand: 'consumer', mobility_transport: 'mobility', logistics_supplychain: 'mobility', healthtech: 'health', biotech: 'frontier',
  ai_ml: 'frontier', hardware_iot: 'frontier', deeptech_space: 'frontier', climate_energy: 'frontier', agritech: 'frontier',
  saas_b2b: 'b2b', devtools_infra: 'b2b', hrtech_work: 'b2b', legal_govtech: 'b2b', security: 'b2b', adtech_martech: 'b2b',
  proptech_realestate: 'b2b', edtech: 'consumer',
};
const CAT_OF_INDUSTRY = { B2B: 'b2b', Consumer: 'consumer', Fintech: 'fintech', Healthcare: 'health', Industrials: 'frontier',
  Education: 'consumer', 'Real Estate and Construction': 'b2b', Government: 'b2b' };

function tier(o, v) {
  if (o === 'dead') return 'dead';
  if (o === 'acquihire') return 'acquihire';
  if (v) return v >= 1e10 ? 'legend' : v >= 1e9 ? 'unicorn' : v >= 1e8 ? 'solid' : 'small';
  return 'small';
}
function leaks(text, names) {
  const t = ` ${String(text).toLowerCase()} `;
  return names.filter(Boolean).some((n) => {
    const k = String(n).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
    if (k.length < 3) return false;
    return new RegExp(`[^a-z0-9]${k.replace(/\s+/g, '\\s+')}[^a-z0-9]`).test(t.replace(/[^a-z0-9 ]/g, ' ').replace(/^/, ' ').replace(/$/, ' '));
  });
}
// a pitch must not give the ending away or name a person
const SPOILER = /\b(became|becomes|become|unicorn|decacorn|acquired|acquisition|ipo|went public|go public|going public|founders?|co-founders?|in-house|shut|shutdown|collapsed|bankrupt\w*|failed|folded|valued|valuation|raised|sold to|bought by|spac|listed|delisted|insolven\w*|liquidat\w*|defunct|now part of|merged)\b/i;
const PERSON_POSS = /\b[A-Z][a-z]+(?:-[A-Z][a-z]+)? [A-Z][a-z]+(?:-[A-Z][a-z]+)?['’]s\b/;
const PERSON_BY = /\b(?:by|from)\s+(?:[A-Z][A-Za-z.]*['’]s\s+)?[A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s[A-Z][a-z]+)+\b/;
// hindsight and editorial wording: it tells you how the story ended
const HINDSIGHT = /\b(later|eventually|pivot\w*|pioneer\w*|former|fake|scam|ponzi|pyramid|promis\w*|tout\w*|so-called|co-?creator|co-?founded|since (19|20)\d\d|(second|third)?-?largest|biggest)\b/i;
const CORPORATE = /^[A-Z][\w.&-]*['’]s\b|\b(unit|division|subsidiary|operation in)\b/; // "Alphabet's drone unit", "Deliveroo's operation in Spain"
const PERSON = { test: (s) => PERSON_POSS.test(s) || PERSON_BY.test(s) || HINDSIGHT.test(s) || CORPORATE.test(s) };
// scare quotes ('AI-powered') signal scepticism: keep the words, drop the quotes
const unquote = (s) => String(s || '').replace(/(^|[\s(])['‘"“]([A-Za-z][^'’"”]{0,40})['’"”](?=[\s,.;:)]|$)/g, '$1$2');
const SUB_LABEL = {
  'Engineering, Product and Design': 'Dev tools', 'Consumer Health and Wellness': 'Health', 'Housing and Real Estate': 'Real estate',
  'Human Resources': 'HR tech', 'Supply Chain and Logistics': 'Logistics', 'Finance and Accounting': 'Finance ops',
  'Travel, Leisure and Tourism': 'Travel', 'Drug Discovery and Delivery': 'Drug discovery', 'Aviation and Space': 'Aerospace',
  'Manufacturing and Robotics': 'Robotics', 'Transportation Services': 'Mobility', 'Credit and Lending': 'Lending',
  'Banking and Exchange': 'Banking', 'Asset Management': 'Investing', 'Virtual and Augmented Reality': 'AR/VR',
  'Job and Career Services': 'Careers', 'Office Management': 'Workplace', 'Recruiting and Talent': 'Recruiting',
  'Consumer Electronics': 'Hardware', 'Healthcare IT': 'Health IT', 'Healthcare Services': 'Health services', 'Industrial Bio': 'Bio',
  'Medical Devices': 'Medtech', 'Apparel and Cosmetics': 'Consumer goods', 'Food and Beverage': 'Food', 'Home and Personal': 'Home',
  'Content': 'Media', 'Productivity': 'Productivity', 'Infrastructure': 'Infrastructure', 'Operations': 'Operations',
  'Consumer Finance': 'Consumer finance', 'Real Estate and Construction': 'Real estate', 'Industrials': 'Industrial',
};
const shortSector = (s) => SUB_LABEL[s] || (s && s.length > 18 ? s.split(/,| and /)[0] : s);
const usd = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1).replace(/\.0$/, '')}B` : `$${Math.round(v / 1e6)}M`);
const clip = (s, n) => { s = String(s || '').trim().replace(/\s+/g, ' '); return s.length > n ? `${s.slice(0, n - 1).replace(/[ ,;:.]+\S*$/, '')}…` : s; };
const firstSentence = (s) => { const m = /^(.+?[.!?])(\s|$)/.exec(String(s || '').trim()); return m ? m[1] : String(s || ''); };
const city = (s) => String(s || '').split(/[;,]/)[0].trim();

/* ---------- build ---------- */
// Hand-written and length-evened pitches, keyed by card id (YC slug or f-<id>); manual fixes win.
const readMap = (p) => (fs.existsSync(path.join(ROOT, p)) ? JSON.parse(rd(p)) : {});
const MANUAL = readMap('research/pitch_manual.json');
const FRONTIER_MANUAL = readMap('research/frontier_manual.json'); // { id: true | false } hand fixes to the frontier test
// A company that pivoted shows the pitch it started with, so its sector must be the one it started in too, not what it became.
const SECTOR_MANUAL = readMap('research/sector_manual.json');
const SHORT = { ...readMap('research/pitch_short.json'), ...MANUAL };
const out = new Map();
const stats = { ycSkipYear: 0, ycSkipLowtech: 0, leak: 0, vague: 0, truncated: 0, droppedUnsourced: 0, ipoNoValue: 0, dupe: 0, tooYoung: 0 };
const futByName = new Map(futures.map((c) => [norm(c.name), c]));

// A still-private company is marked at its most recent priced round, not its peak; if the record says the
// valuation fell, use the lower figure.
function currentMark(f) {
  const m = /valu\w*\s+(?:fell|dropped|was cut|was slashed|plunged|sank)[^$]{0,40}\$([\d.]+)\s?(b|bn|billion|m|million)\b/i.exec(f.story || '');
  if (m) return +m[1] * (/^b/i.test(m[2]) ? 1e9 : 1e6);
  const priced = (f.rounds || []).filter((r) => r.post_money_usd && r.year);
  if (priced.length) return priced.sort((a, b) => b.year - a.year || b.post_money_usd - a.post_money_usd)[0].post_money_usd;
  return f.peak_valuation_usd || null;
}

function fromFuture(f) {
  const map = { dead: 'dead', acquihire: 'acquihire', acquired: 'acquired', ipo: 'ipo', private_unicorn: 'private', active: 'private' };
  const o = map[f.outcome] || 'small';
  const v = o === 'ipo' || o === 'acquired' ? f.exit_value_usd : o === 'private' ? currentMark(f) : null;
  const yr = f.ended ? ` in ${f.ended}` : '';
  const head = {
    dead: `Shut down${yr}.`, acquihire: `Sold for parts${yr}.`,
    acquired: v ? `Acquired${yr} for ${usd(v)}.` : `Acquired${yr}; price not disclosed.`,
    ipo: v ? `Went public${yr} at ${usd(v)}.` : `Went public${yr}.`,
    private: v ? `Still private; last valued at ${usd(v)}.` : 'Still private.',
  }[o] || '';
  const story = firstSentence(f.story);
  // a well-funded failure: the kind of company that looked like a sure thing
  const h = (o === 'dead' || o === 'acquihire') && ((f.total_raised_usd || 0) >= 30e6 || (f.peak_valuation_usd || 0) >= 200e6) ? 1 : 0;
  return { o: v || o !== 'private' ? o : 'small', v: v || null, bc: clip(`${head} ${story}`, 200), src: (f.sources || [])[0] || null, h };
}

for (const c of yc) {
  const y = batchYear(c.batch);
  if (y < Y0 || y > Y1) { stats.ycSkipYear++; continue; }
  if (c.nonprofit || c.industry === 'Unspecified') continue;
  const r = research.get(c.slug);
  if (!r && LOWTECH_SUB.has(c.subindustry) && !(c.tags || []).some((t) => TECHY.test(t))) { stats.ycSkipLowtech++; continue; }
  const fut0 = futByName.get(norm(c.name));
  const fut = fut0 && fut0.founded && Math.abs(fut0.founded - y) <= 3 ? fut0 : null; // same name, different era: not the same company
  let o, v = null, bc, src, p, s, hype = 0;
  const dflt = { Inactive: 'dead', Acquired: 'acquired', Public: 'ipo', Active: 'small' }[c.status] || 'small';
  if (r) {
    o = r.outcome || dflt;
    if (r.value_usd && r.source) v = r.value_usd; else if (r.value_usd) stats.droppedUnsourced++;
    bc = r.became; src = r.source || c.url; p = r.pitch_then; s = r.sector;
  } else if (fut) {
    ({ o, v, bc, src, h: hype } = fromFuture(fut)); p = fut.one_liner; s = SECTOR_LABEL[fut.sector];
  } else {
    o = dflt; src = c.url; p = c.one_liner;
    if (!MANUAL[c.slug] && (!p || p.trim().length < 48)) { stats.vague++; continue; } // too thin to judge (and a tell next to a detailed card)
    if (!MANUAL[c.slug] && /…|\.\.\.\s*$/.test(p)) { stats.truncated++; continue; } // the directory cut it off mid-sentence: a tell
  }
  if (o === 'private' && !v) o = 'small';
  if (o === 'small' && v) o = 'private'; // a sourced valuation turns "no valuation" into a paper mark
  if (y >= YOUNG && o === 'small') { stats.tooYoung++; continue; } // too young to have a fate yet
  if (o === 'ipo' && !v) { stats.ipoNoValue++; continue; } // a listing with no recorded value would score as a misleading 1x
  p = MANUAL[c.slug] || clip(unquote(p), 170);
  const domain = (/^(?:https?:\/\/)?(?:www\.)?([^./]+)\./i.exec(c.website || '') || [])[1];
  if (!p || SPOILER.test(p) || PERSON.test(p) || leaks(p, [c.name, ...(c.former_names || []), domain && domain.length >= 4 ? domain : null])) { stats.leak++; continue; }
  const tags = c.tags || [];
  const sub = (c.subindustry || '').split(' -> ').pop();
  out.set(`yc:${c.slug}`, {
    id: c.slug, n: c.name, y, b: batchShort(c.batch), yc: 1,
    p, s: clip((s => s && s[0].toUpperCase() + s.slice(1))(s || shortSector(sub) || tags[0] || c.industry), 22), l: city(c.all_locations),
    o, v, t: tier(o, v), bc: clip(bc || defaultBecame(o, c.status), 200), src, h: hype,
    f: 0, cat: CAT_OF_INDUSTRY[c.industry] || 'b2b', _tags: tags, // f (frontier) is decided below, once the pitch is final
  });
}

// Seed investors could never buy in at a normal seed price here (non-profit start, or no outside VC at all).
// Also corporate projects and spin-outs of big groups, which outsiders couldn't back at seed.
const NOT_SEED_INVESTABLE = new Set(['openai', 'deepseek', 'projectkuiperamazonleo', 'virginorbit', 'oneweb', 'carvana',
  // "licence and hire" exits, where what investors got back is unclear, so the game can't score them fairly
  'characterai', 'inflectionai', 'adept', 'adeptai', 'covariant']);
// If a company's first round was far bigger than a normal seed, the entry price is that round:
// its reported post-money, else ~3x the round size.
function entryOf(fu) {
  const r = (fu.rounds || []).filter((x) => x.year).sort((a, b) => a.year - b.year)[0];
  if (!r || !['pre_seed', 'seed', 'A'].includes(r.stage) || r.year > fu.founded + 2) return null;
  if (r.post_money_usd && r.post_money_usd > 20e6) return r.post_money_usd;
  if (r.amount_usd && r.amount_usd >= 10e6) return r.amount_usd * 3;
  return null;
}

// "Helion" and "Helion Energy" are the same company: compare names without common suffixes.
const core = (s) => norm(String(s).replace(/\(.*?\)/g, '')).replace(/(energy|ai|inc|labs|technologies|technology|robotics|health|hq|app|io|systems|bio|therapeutics|capital|global)$/g, '');
const ycByName = new Map(), ycCores = new Map();
for (const c of out.values()) { ycByName.set(norm(c.n), c); ycCores.set(core(c.n), c); }

for (const fu of futures) {
  const k = `f:${norm(fu.name)}`;
  if (out.has(k) || !fu.founded || fu.founded < Y0 || fu.founded > Y1) continue;
  const twin = ycByName.get(norm(fu.name)) || ycCores.get(core(fu.name));
  if (twin && Math.abs(twin.y - fu.founded) <= 3) { stats.dupe++; continue; }
  if (NOT_SEED_INVESTABLE.has(norm(fu.name))) continue;
  if (fu.sector === 'retail_d2c' || !fu.sector) continue;
  const { o, v, bc, src, h } = fromFuture(fu);
  if (o === 'ipo' && !v) { stats.ipoNoValue++; continue; }
  if (fu.founded >= YOUNG && o === 'small') { stats.tooYoung++; continue; }
  const p = MANUAL[`f-${fu.id}`] || clip(unquote(fu.one_liner), 170);
  if (!p || SPOILER.test(p) || PERSON.test(p) || /\bfirst\b/i.test(p) || leaks(p, [fu.name])) { stats.leak++; continue; }
  const cat = CAT_OF_SECTOR[fu.sector];
  out.set(k, {
    id: `f-${fu.id}`, n: fu.name, y: fu.founded, b: null, yc: 0, e: entryOf(fu),
    p, s: SECTOR_LABEL[fu.sector] || '', l: fu.city || '',
    o, v, t: tier(o, v), bc: clip(bc || defaultBecame(o), 200), src, h,
    f: 0, cat: cat && cat !== 'frontier' ? cat : 'b2b', _tags: [],
  });
}

function defaultBecame(o, status) {
  return {
    dead: 'Shut down.', acquired: 'Acquired; the price was not disclosed.', acquihire: 'The team was acqui-hired; the product shut down.',
    ipo: 'Went public.', small: 'Still independent, with no public valuation.', private: 'Still private.',
  }[o] || (status || '');
}

// Keep every company with a known fate; sample the "still small, no valuation" ones (deterministic) to keep the file light.
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const SMALL_KEEP = 0.28;
// Every card's pitch sits in the same length band, so a longer, richer pitch never hints at the winner.
for (const c of out.values()) {
  const s = SHORT[c.id];
  if (s && (MANUAL[c.id] || (!SPOILER.test(s) && !PERSON.test(s) && !leaks(s, [c.n])))) c.p = unquote(s);
}
// Frontier tech = the core is new technology (AI labs and models, robots, space, chips, energy, biotech…), judged
// from the pitch players see, the sector and YC's own tags (scripts/frontier.mjs, hand fixes in frontier_manual.json).
for (const c of out.values()) {
  c.f = isFrontier({ id: c.id, p: c.p, s: c.s, tags: c._tags }, FRONTIER_MANUAL) ? 1 : 0;
  if (c.f) c.cat = 'frontier';
  delete c._tags;
}
// Card facts: who pays, how it makes money, how much cash it needs (research/cardfacts_*.jsonl). They were written
// from the pitch alone, never from what the company became, so they carry no hindsight. Same pass: plain-English
// rewrites of vague or buzzword pitches, held to the same rules as every other pitch.
const FACTS = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'research')).filter((n) => /^cardfacts_\d+\.jsonl$/.test(n)).sort()) {
  for (const line of rd(`research/${f}`).split('\n')) {
    if (!line.trim()) continue;
    try { const r = JSON.parse(line); FACTS.set(r.id, r); } catch { stats.badFacts = (stats.badFacts || 0) + 1; }
  }
}
for (const c of out.values()) {
  const r = FACTS.get(c.id);
  if (!r) { stats.noFacts = (stats.noFacts || 0) + 1; continue; }
  const k = { light: 'L', medium: 'M', heavy: 'H' }[String(r.cash || '').toLowerCase()];
  if (r.pay && r.model && k) Object.assign(c, { w: clip(r.pay, 24), m: clip(r.model, 26), k, kw: clip(r.why || '', 26) });
  const pl = unquote(String(r.plain || '').trim());
  if (pl && !MANUAL[c.id] && pl.length >= 50 && pl.length <= 85 && !SPOILER.test(pl) && !PERSON.test(pl) && !leaks(pl, [c.n])
    && !/\b(first|leading|pioneer\w*|largest|best)\b/i.test(pl)) { c.p = pl; stats.plain = (stats.plain || 0) + 1; }
}
for (const c of out.values()) if (SECTOR_MANUAL[c.id]) c.s = SECTOR_MANUAL[c.id];
const companies = [...out.values()]
  .filter((c) => c.t !== 'small' || c.f || research.has(c.id) || c.id.startsWith('f-') || hash(c.id) < SMALL_KEEP) // all frontier survivors: that deck is smaller
  .map((c) => {
    if (c.yc && c.src === `https://www.ycombinator.com/companies/${c.id}`) delete c.src; // the client rebuilds YC directory links
    if (!c.b) delete c.b;
    if (!c.l) delete c.l;
    if (!c.v) delete c.v;
    if (!c.e) delete c.e;
    if (!c.h) delete c.h;
    return c;
  })
  .sort((a, b) => a.y - b.y || a.n.localeCompare(b.n));
const count = (f) => companies.reduce((o, c) => ((o[f(c)] = (o[f(c)] || 0) + 1), o), {});

/* ---------- fund model + benchmarks ---------- */
const bench = JSON.parse(rd('research/benchmarks.json'));
const q = bench.quartiles[0];
const funds = new Map();
for (const f of bench.funds || []) {
  if (!f.net_tvpi) continue;
  // same fund reported by two LPs: keep the more recent report
  const roman = (/\b([IVX]+|\d{1,2})\b(?!.*\b([IVX]+|\d{1,2})\b)/.exec(f.fund.replace(/\(.*?\)|-.*$/g, '')) || [])[1] || '';
  const key = `${norm(f.firm)}|${f.vintage}|${/growth/i.test(f.fund) ? 'g' : /opportun/i.test(f.fund) ? 'o' : /seed/i.test(f.fund) ? 's' : 'v'}|${roman}`;
  const prev = funds.get(key);
  if (!prev || String(f.as_of) > String(prev.as_of)) funds.set(key, { ...f, firm: f.firm.replace(/\s*\(.*\)$/, '') });
}
const fund = {
  model: {
    seedPre: [{ y: 2010, v: 3.2e6 }, { y: 2013, v: 5.2e6 }, { y: 2019, v: 8.0e6 }, { y: 2021, v: 9.0e6 }, { y: 2022, v: 10.5e6 }],
    seedDilution: 0.2,
    laterRounds: [0.2, 0.16, 0.12, 0.1, 0.1, 0.1],
    maxOwnership: 0.1, // a $1M check from a $10M seed fund rarely buys more than ~10%
    heavyKeep: 0.5, // capital-hungry companies raise far more, so an early stake ends up about half as big at exit
    undisclosedAcq: 1.0,
    acquihire: 0.25,
  },
  benchmarks: {
    label: q.label, source: q.source,
    quartiles: { median: q.median_tvpi, top_quartile: q.top_quartile_tvpi, top_decile: q.top_decile_tvpi },
    funds: [...funds.values()].map(({ firm, fund: name, vintage, net_tvpi, as_of, lp, source }) => ({
      firm, fund: name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+-\s+.*$/, '').trim(), vintage, net_tvpi, as_of,
      lp: lp.replace(/\s*\(.*\)$/, '').replace(/^Oregon Public Employees Retirement Fund$/, 'Oregon State Treasury'), source,
    })),
  },
  notes: [
    'Each deal is a $1M check at that year\'s typical seed price: the median US seed pre-money valuation (PitchBook: $3.2M in 2010, $5.2M in 2013, $8.0M in 2019, $9.0M in 2021, $10.5M in 2022; years in between interpolated, later years held at 2022), with about 20% of the company sold in the round (Carta).',
    'Your stake is capped at 10%, typical for a $1M check from a small seed fund. If a company\'s first round was far bigger than a normal seed, you buy in at that round instead.',
    'Later rounds dilute you about 20%, 16%, 12%, then 10% each (Carta medians). Bigger outcomes are assumed to have needed more rounds. Capital-hungry companies (marked "Heavy" cash: rockets, fusion, chips, fleets, factories, drug trials) raise far more along the way, so your stake at exit is about half what it would be in a software company of the same size.',
    'Exits are valued at the IPO valuation or the reported acquisition price. Undisclosed price: money back (1x). Acqui-hire: 0.25x. Shut down: zero.',
    'Companies still private are marked at their latest reported valuation, which is paper value, not cash. No valuation on record: held at cost.',
    'The fund is $11M: $1M for each of the 10 deals plus a $1M reserve for one double-down, which buys a second $1M of that company at the same price (real funds keep reserves to back their best bets). An unused reserve, like a missed deal, stays in cash. Net to LPs assumes $13.2M committed ($11M plus 2% a year in fees) and 20% carry on profits.',
    'The deals: each fund sees one or two companies that turned out well (paid back at least 3x on your check; most are solid wins, a few are giants), hidden among failures (some of them very well funded) and survivors. The two cards in a deal always look alike on the surface (same era, similar pitch length, same kind of terms), so only judgement separates them. With no thought, about half of funds lose money; careful players usually beat the typical fund.',
    'Benchmarks: Carta fund data (2017 vintage). Real funds: net multiples that public pension LPs (UC Regents, Washington State Investment Board, Oregon State Treasury, CalPERS) report for funds they hold.',
  ],
};

// Tiers follow what a $1M check actually paid under the fund model, not the headline valuation: a "winner"
// must return at least 3x. A unicorn you could only enter at a $500M first round is not a winner for a seed
// fund, and a $60M acquisition of a 2012 seed deal is. This also means a fund that picks every winner never
// loses money. (Every priced company comes from research, so the small-company sample above is unaffected.)
{
  const { setModel, stake } = await import('../site/js/fund.js');
  setModel(fund.model);
  for (const c of companies) {
    if (c.t === 'dead' || c.t === 'acquihire') continue;
    const m = stake(c).value / 1_000_000;
    c.t = m >= 3 ? (c.v >= 1e10 ? 'legend' : c.v >= 1e9 ? 'unicorn' : 'solid') : 'small';
  }
}

fs.mkdirSync(path.join(ROOT, 'site/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'site/data/companies.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), years: `${Y0}–${Y1}`, companies }));
fs.writeFileSync(path.join(ROOT, 'site/data/fund.json'), JSON.stringify(fund, null, 1));
console.log('companies', companies.length, JSON.stringify({ tier: count((c) => c.t), yc: count((c) => c.yc), frontier: count((c) => c.f), cat: count((c) => c.cat) }));
console.log('frontier tiers', JSON.stringify(companies.filter((c) => c.f).reduce((o, c) => ((o[c.t] = (o[c.t] || 0) + 1), o), {})));
console.log('yc tiers', JSON.stringify(companies.filter((c) => c.yc).reduce((o, c) => ((o[c.t] = (o[c.t] || 0) + 1), o), {})));
console.log(JSON.stringify(stats), 'funds', fund.benchmarks.funds.length, 'size', fs.statSync(path.join(ROOT, 'site/data/companies.json')).size);
if (process.argv.includes('--sample')) {
  for (const c of companies.filter((c) => c.t !== 'small').sort(() => Math.random() - 0.5).slice(0, 14)) console.log(`[${c.t}] ${c.n} ${c.y}${c.b ? ' ' + c.b : ''} | ${c.s} | ${c.p} || ${c.bc}`);
}
