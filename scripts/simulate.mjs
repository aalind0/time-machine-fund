// Plays thousands of games to check fairness and difficulty: node scripts/simulate.mjs
// skill = chance of picking the better company in each deal (0.5 = no thought at all).
// "tells" = no-thought strategies that only read the card's surface; none should beat a coin flip by much.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { setModel, summarize, stake, verdict, terms } = await import(path.join(root, 'site/js/fund.js'));
const { buildDeck } = await import(path.join(root, 'site/js/deck.js'));
const cs = JSON.parse(fs.readFileSync(path.join(root, 'site/data/companies.json'))).companies;
const fd = JSON.parse(fs.readFileSync(path.join(root, 'site/data/fund.json')));
setModel(fd.model);
const N = +process.env.N || 4000;
const pct = (a, p) => a[Math.floor(p * (a.length - 1))].toFixed(2);

// 1) tells: accuracy of surface heuristics on deals where the two outcomes differ
const tells = {
  'longer pitch': (a, b) => a.p.length - b.p.length,
  'older company': (a, b) => b.y - a.y,
  'YC card': (a, b) => (a.yc || 0) - (b.yc || 0),
  'pricier entry': (a, b) => terms(a).post - terms(b).post,
  'has a city': (a, b) => (a.l ? 1 : 0) - (b.l ? 1 : 0),
  'frontier tech': (a, b) => (a.f || 0) - (b.f || 0),
};
const hit = Object.fromEntries(Object.keys(tells).map((k) => [k, [0, 0]]));
for (let g = 0; g < N; g++) {
  for (const [a, b] of buildDeck(cs, 'all', new Set(), g * 7919 + 13)) {
    const va = stake(a).value, vb = stake(b).value;
    if (va === vb) continue;
    for (const [k, f] of Object.entries(tells)) {
      const s = f(a, b);
      if (!s) continue;
      hit[k][1]++;
      if ((s > 0) === (va > vb)) hit[k][0]++;
    }
  }
}
console.log('Tells (accuracy when the heuristic has an opinion; 0.50 = no tell):');
for (const [k, [h, n]] of Object.entries(hit)) console.log(`  ${k.padEnd(14)} ${(h / n).toFixed(2)}  (n=${n})`);

// 2) difficulty by skill
console.log('\nDifficulty (net multiple to LPs):');
for (const mandate of ['all', 'frontier', 'yc']) {
  for (const skill of [0.5, 0.6, 0.7, 0.85]) {
    const res = []; const tiers = {};
    for (let g = 0; g < N; g++) {
      const deals = buildDeck(cs, mandate, new Set(), g * 7919 + 13);
      const rounds = deals.map((pair) => {
        const [x, y] = pair.map((c) => stake(c).value);
        const better = x >= y ? 0 : 1;
        return { pair, pick: Math.random() < skill ? better : 1 - better };
      });
      const S = summarize(rounds);
      res.push(S.netTvpi);
      const t = verdict(S, fd.benchmarks).tier;
      tiers[t] = (tiers[t] || 0) + 1;
    }
    res.sort((a, b) => a - b);
    const lose = res.filter((x) => x < 1).length / N;
    const tq = res.filter((x) => x >= fd.benchmarks.quartiles.top_quartile).length / N;
    const big = res.filter((x) => x >= 10).length / N;
    console.log(`  ${mandate.padEnd(8)} skill ${String(skill).padEnd(4)} | lose money ${(lose * 100).toFixed(0).padStart(2)}% | top quartile+ ${(tq * 100).toFixed(0).padStart(2)}% | 10x+ ${(big * 100).toFixed(0).padStart(2)}% | median ${pct(res, 0.5)}x`);
  }
}
