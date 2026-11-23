import { CONFIG } from './config.js';
import { setModel, summarize, verdict, closestFund, terms, fmtUSD, fmtX, fundTotal, TONE } from './fund.js';
import { buildDeck, loadSeen, saveSeen } from './deck.js';
import { drawCard, shareText } from './share.js';
import { runTrip, skipTrip } from './trip.js';
import { eraLine } from './eras.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const NAMES = ['Hindsight Capital', 'Rewind Ventures', 'Second Look Partners', 'Paradox Capital', 'Déjà Vu Ventures',
  'Back Again Capital', 'Early Light Partners', 'Long Way Round Ventures', 'Foresight Fund', 'Yesterday Capital'];
const MANDATE = { all: 'Generalist', frontier: 'Frontier tech', yc: 'YC Demo Day' };
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON = { // simple generic glyphs, not brand logos
  chat: svg('M4 20l1.4-4A8 8 0 1 1 8.6 19z M9 10.5c.5 2 2.2 3.8 4.4 4.4l1.3-1.2 2 .9-.5 1.9c-4.4.2-8.4-3.8-8.2-8.2l1.9-.5.9 2z'),
  msg: svg('M4 5h16v11H9l-5 4z'),
  x: svg('M5 4l14 16M19 4L5 20'),
  in: svg('M5 9v10M5 5v.5M10 19v-6a3 3 0 0 1 6 0v6M10 10v9M4 3h16v18H4z'),
  mail: svg('M3 6h18v12H3z M3 7l9 6 9-6'),
  link: svg('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
};

const G = {
  companies: [], model: null, bench: null, notes: [],
  fund: '', mandate: 'all', relaxed: false,
  deals: [], rounds: [], i: 0, locked: false, seen: loadSeen(),
  t0: 0, pausedAt: 0, raf: 0,
  trips: 0, // games finished this visit: the first gets the full time-machine scenes, replays a short version
};

/* ---------- boot ---------- */
init();
async function init() {
  const ph = NAMES[Math.floor(Math.random() * NAMES.length)];
  $('#fundName').placeholder = ph;
  $('#ruleSecs').textContent = `${CONFIG.timerMs / 1000} seconds`;
  try {
    const [cs, fd] = await Promise.all([fetch('data/companies.json').then((r) => r.json()), fetch('data/fund.json').then((r) => r.json())]);
    G.companies = cs.companies.map((c) => (c.yc && !c.src ? { ...c, src: `https://www.ycombinator.com/companies/${c.id}` } : c));
    G.model = fd.model; G.bench = fd.benchmarks; G.notes = fd.notes || [];
    setModel(fd.model);
    const priced = G.companies.filter((c) => c.v).length;
    $('#homeStats').textContent = `${G.companies.length.toLocaleString('en-US')} real startups · ${priced} with a sourced valuation or exit · ${cs.years}`;
  } catch (e) {
    $('#homeStats').textContent = 'Could not load the deal flow. Refresh to try again.';
    $('#btnStart').disabled = true;
    return;
  }
  $('#setup').addEventListener('submit', (e) => { e.preventDefault(); start(); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  $('#footHow').addEventListener('click', (e) => {
    const how = $('#how');
    if (how) { e.preventDefault(); how.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  document.body.classList.toggle('playing', id === 'play' || id === 'trip' || id === 'reveal');
  window.scrollTo({ top: 0 });
}

/* ---------- game ---------- */
async function start() {
  if (!$('#trip').hidden) return;
  G.fund = ($('#fundName').value.trim() || $('#fundName').placeholder).slice(0, 26);
  G.mandate = (document.querySelector('input[name="mandate"]:checked') || {}).value || 'all';
  G.relaxed = $('#relaxed').checked;
  G.deals = buildDeck(G.companies, G.mandate, G.seen);
  G.rounds = []; G.i = 0; G.reserveUsed = false;
  $('#hudFund').textContent = G.fund;
  $('#timer').classList.toggle('off', G.relaxed);
  $('#tape').innerHTML = G.deals.map(() => '<li></li>').join('');
  // the trip back: into the machine, back to the year of the oldest deal
  show('trip');
  await runTrip('out', { fund: G.fund, from: Math.min(...G.deals.flat().map((c) => c.y)), to: CONFIG.now, full: G.trips === 0 });
  show('play');
  nextDeal();
}

function nextDeal() {
  if (G.i >= G.deals.length) return finish();
  G.locked = false;
  const pair = G.deals[G.i];
  $('#hudN').textContent = G.i + 1;
  $('#hudN').nextElementSibling.textContent = `/${G.deals.length}`;
  const invested = G.rounds.filter((r) => r.pick != null).length * CONFIG.check;
  $('#hudCash').textContent = fmtUSD(CONFIG.fundSize - invested);
  $('#hudRes').classList.toggle('used', G.reserveUsed);
  $('#hudRes').innerHTML = G.reserveUsed ? 'Reserve <b>used</b>' : `Reserve <b>${fmtUSD(CONFIG.reserve)}</b>`;
  $('#dd').hidden = G.reserveUsed; $('#ddBox').checked = false;
  [...$('#tape').children].forEach((li, k) => li.classList.toggle('now', k === G.i));
  $('#askQ').textContent = G.i === G.deals.length - 1 ? 'Last check. Which one?' : 'Which one gets your $1M?';
  // the world that year (the earlier of the two founding years)
  const [y0, y1] = [Math.min(pair[0].y, pair[1].y), Math.max(pair[0].y, pair[1].y)];
  $('#era').innerHTML = `<b>It’s ${y0}${y1 > y0 ? `–${String(y1).slice(-2)}` : ''}.</b>${eraLine(y0).map((s) => `<span>${esc(s)}</span>`).join('')}`;
  // the price: said once when both cost about the same, on each card (with the gap flagged) when they don't
  const [ta, tb] = pair.map(terms), ratio = Math.max(ta.post, tb.post) / Math.min(ta.post, tb.post);
  const samePrice = ratio < 1.25;
  $('#dealPrice').hidden = !samePrice;
  if (samePrice) $('#dealPrice').innerHTML = `Both valued at about <b>${fmtUSD((ta.post + tb.post) / 2)}</b> · your $1M buys about <b>${pctOf(((ta.own + tb.own) / 2))}</b> of either`;
  const priceNote = (i) => (samePrice ? null : { ratio, pricier: (i ? tb.post : ta.post) > (i ? ta.post : tb.post) });
  $('#pair').innerHTML = card(pair[0], 0, priceNote(0)) + '<div class="vs" aria-hidden="true"><b>OR</b></div>' + card(pair[1], 1, priceNote(1));
  for (const b of document.querySelectorAll('#pair .card')) b.addEventListener('click', () => choose(+b.dataset.i));
  startTimer();
}

const pctOf = (own) => { const p = own * 100; return `${p >= 1 ? p.toFixed(1) : p.toFixed(2)}%`; };
const CASH = { L: 'Light', M: 'Medium', H: 'Heavy' };

// A card: the pitch, then how the business works (who pays, how it makes money, how much cash it needs),
// then the price in plain words. `price` is null when both cards cost about the same (shown once above them).
function card(c, i, price) {
  const key = i ? 'B' : 'A';
  const chips = [`<span class="chip chip-key">${key}</span>`, `<span class="chip chip-year">${c.y}</span>`];
  if (c.b) chips.push(`<span class="chip chip-yc">YC ${esc(c.b)}</span>`);
  if (c.s) chips.push(`<span class="chip">${esc(c.s)}</span>`);
  const T = terms(c);
  const facts = c.w ? `<dl class="card-facts">
      <div><dt>Who pays</dt><dd>${esc(c.w)}</dd></div>
      <div><dt>Makes money</dt><dd>${esc(c.m)}</dd></div>
      <div><dt>Cash needed</dt><dd><span class="cash cash-${c.k}">${CASH[c.k] || ''}</span><span class="why">${esc(c.kw || '')}</span></dd></div>
    </dl>` : '';
  const priceTxt = price
    ? `<span class="card-price">Valued at <b>${fmtUSD(T.post)}</b>${T.firstRound ? ' (first round)' : ''} · $1M buys <b>${pctOf(T.own)}</b>${price.pricier ? `<span class="pricier">${price.ratio >= 10 ? Math.round(price.ratio) : price.ratio.toFixed(1)}x the price</span>` : ''}</span>`
    : '';
  return `<button class="card" type="button" data-i="${i}" aria-label="Option ${key}, ${c.y}: ${esc(c.p)}">
    <div class="card-top">${chips.join('')}</div>
    <p class="card-pitch">${esc(c.p)}</p>
    ${facts}
    <div class="card-meta"><span class="card-meta-l">${priceTxt}${c.l ? `<span class="card-loc">${esc(c.l)}</span>` : ''}</span><span class="card-cta">Back this ${ARROW}</span></div>
  </button>`;
}

function startTimer() {
  cancelAnimationFrame(G.raf);
  const bar = $('#timer i'), tl = $('#askT'), timer = $('#timer');
  timer.classList.remove('warn', 'crit'); tl.classList.remove('warn', 'crit');
  bar.style.transform = 'scaleX(1)';
  if (G.relaxed) { tl.textContent = ''; return; }
  G.t0 = performance.now(); G.pausedAt = 0;
  const total = CONFIG.timerMs;
  const tick = (now) => {
    if (G.locked) return;
    if (G.pausedAt) { G.raf = requestAnimationFrame(tick); return; }
    const left = Math.max(0, total - (now - G.t0));
    bar.style.transform = `scaleX(${left / total})`;
    const secs = Math.ceil(left / 1000);
    if (tl.textContent !== `${secs}s`) tl.textContent = `${secs}s`;
    const warn = left <= 6000, crit = left <= 3000;
    timer.classList.toggle('warn', warn && !crit); timer.classList.toggle('crit', crit);
    tl.classList.toggle('warn', warn && !crit); tl.classList.toggle('crit', crit);
    if (left <= 0) return missDeal();
    G.raf = requestAnimationFrame(tick);
  };
  G.raf = requestAnimationFrame(tick);
}
function onVisibility() {
  if (G.relaxed || G.locked || $('#play').hidden) return;
  if (document.hidden) G.pausedAt = performance.now();
  else if (G.pausedAt) { G.t0 += performance.now() - G.pausedAt; G.pausedAt = 0; }
}

function choose(idx) {
  if (G.locked || $('#play').hidden) return;
  G.locked = true;
  cancelAnimationFrame(G.raf);
  const pair = G.deals[G.i];
  const dd = !G.reserveUsed && $('#ddBox').checked;
  if (dd) G.reserveUsed = true;
  G.rounds.push({ pair, pick: idx, dd });
  const cards = document.querySelectorAll('#pair .card');
  cards.forEach((el, k) => {
    el.disabled = true;
    if (k === idx) { el.classList.add('picked'); el.insertAdjacentHTML('beforeend', `<span class="stamp${dd ? ' stamp-dd' : ''}">${dd ? 'DOUBLED DOWN · $2M' : 'BACKED · $1M'}</span>`); }
    else el.classList.add('passed');
  });
  const li = $('#tape').children[G.i]; li.classList.remove('now'); li.classList.add('done'); if (dd) li.classList.add('dd');
  G.i++;
  setTimeout(nextDeal, REDUCED ? 250 : 480);
}

function missDeal() {
  G.locked = true;
  const pair = G.deals[G.i];
  G.rounds.push({ pair, pick: null });
  document.querySelectorAll('#pair .card').forEach((el) => { el.disabled = true; el.classList.add('passed'); });
  $('#pair').insertAdjacentHTML('beforeend', '<p class="missed-note">Too slow. Both rounds closed without you. The $1M sits in cash.</p>');
  const li = $('#tape').children[G.i]; li.classList.remove('now'); li.classList.add('miss');
  G.i++;
  setTimeout(nextDeal, REDUCED ? 400 : 1300);
}

function onKey(e) {
  const k = e.key.toLowerCase();
  if (!$('#trip').hidden) { // Enter, Space or Esc skips the time machine
    if (k === 'enter' || k === ' ' || k === 'escape') { e.preventDefault(); skipTrip(); }
    return;
  }
  if ($('#play').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  if (k === 'a' || k === '1' || k === 'arrowleft') { e.preventDefault(); choose(0); }
  if (k === 'b' || k === '2' || k === 'arrowright') { e.preventDefault(); choose(1); }
  if (k === 'd' && !G.reserveUsed && !G.locked) { e.preventDefault(); $('#ddBox').checked = !$('#ddBox').checked; }
}

/* ---------- the trip home ---------- */
async function finish() {
  cancelAnimationFrame(G.raf);
  saveSeen(G.seen, G.deals.flat().map((c) => c.id));
  G.deals.flat().forEach((c) => G.seen.add(c.id));
  const S = summarize(G.rounds);
  const years = G.deals.flat().map((c) => c.y);
  S.vintage = `${Math.min(...years)}–${String(Math.max(...years)).slice(-2)}`;
  show('trip');
  await runTrip('home', { fund: G.fund, from: Math.min(...years), to: CONFIG.now, full: G.trips === 0 });
  G.trips++;
  await reveal(S);
  renderResults(S);
}

/* ---------- reveal: the ten picks flip one by one, biggest bet last ---------- */
function revealCard(p, k) {
  const c = p.c, s = p.s, m = s.multiple;
  const r = s.kind === 'paper' && s.basis === 'priced' && m !== 1 ? 'r-paper' : m >= 10 ? 'r-big' : m > 1.05 ? 'r-win' : m < 0.95 ? 'r-loss' : 'r-flat';
  const front = c
    ? `<span class="chip chip-year">${c.y}${c.b ? ` · YC ${esc(c.b)}` : ''}</span><p>${esc(c.p)}</p>`
    : '<span class="chip chip-year">Missed</span><p>The clock ran out on this deal.</p>';
  const [t, tc] = c ? TAG[c.o] || TAG.small : ['Cash', 'tag-cash'];
  const back = `<span class="tag ${tc}">${t}</span><b class="nm">${c ? esc(c.n) : 'Uninvested'}</b>
    <span class="val"><b>${fmtX(m)}</b><small>${fmtUSD(s.check || CONFIG.check)} → ${fmtUSD(s.value)}${s.kind === 'paper' && s.basis === 'priced' ? ' on paper' : ''}</small></span>${s.dd ? '<span class="dd-tag">Doubled down</span>' : ''}`;
  return `<div class="flip" style="--d:${k}"><div class="flip-in"><div class="face front">${front}</div><div class="face back ${r}">${back}</div></div></div>`;
}

async function reveal(S) {
  const V = verdict(S, G.bench);
  const order = S.picks.slice();
  let bi = 0;
  order.forEach((p, k) => { if (p.s.value > order[bi].s.value) bi = k; });
  order.push(order.splice(bi, 1)[0]); // save the biggest bet for last
  const grid = $('#rvGrid'), totalEl = $('#rvTotal'), multEl = $('#rvMult'), eyebrow = $('#rvEyebrow');
  const next = $('#rvNext'), skip = $('#rvSkip'), vEl = $('#rvVerdict');
  grid.innerHTML = order.map(revealCard).join('');
  totalEl.textContent = '$0'; totalEl.className = ''; totalEl.style.color = ''; multEl.textContent = '0x';
  eyebrow.textContent = `${CONFIG.now} · opening the books`; eyebrow.classList.remove('hush');
  vEl.hidden = true; next.hidden = true; skip.hidden = false;
  show('reveal');

  let skipped = false;
  const waiters = new Set();
  const sleep = (ms) => new Promise((r) => {
    if (skipped || REDUCED) return r();
    const t = setTimeout(() => { waiters.delete(done); r(); }, ms);
    const done = () => { clearTimeout(t); r(); };
    waiters.add(done);
  });
  skip.onclick = () => { skipped = true; waiters.forEach((f) => f()); waiters.clear(); };
  grid.onclick = () => { if (!next.hidden) return; skip.onclick(); }; // tap the cards to jump to the end

  let shown = 0, raf = 0;
  const setTotal = (to, animate) => {
    cancelAnimationFrame(raf);
    const from = shown; shown = to;
    const paint = (v) => {
      totalEl.textContent = fmtUSD(v);
      multEl.textContent = `${fmtX(v / fundTotal())} of the ${fmtUSD(fundTotal())}`;
      totalEl.classList.toggle('up', v >= fundTotal());
    };
    if (!animate || skipped || REDUCED) return paint(to);
    const t0 = performance.now(), D = 280;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
      paint(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  await sleep(250);
  const cards = [...grid.children];
  let running = 0;
  for (let k = 0; k < order.length; k++) {
    const p = order[k], el = cards[k];
    if (k === order.length - 1 && order.length > 1 && !skipped) {
      eyebrow.textContent = p.s.multiple >= 3 ? 'And the one that decides your fund…' : 'And your last hope…';
      eyebrow.classList.add('hush');
      el.classList.add('next');
      await sleep(650);
      el.classList.remove('next');
    }
    el.classList.add('on');
    running += p.s.value;
    const m = p.s.multiple;
    if (!skipped && !REDUCED) {
      if (m >= 10) {
        el.classList.add('boom');
        totalEl.classList.add('flash'); setTimeout(() => totalEl.classList.remove('flash'), 700);
        try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(35); } catch { /* not supported */ }
      } else if (m === 0 && p.c) el.classList.add('thud');
    }
    await sleep(120);
    setTotal(running, true);
    await sleep(k === order.length - 1 ? 350 : 110);
  }
  setTotal(S.gross, false);
  totalEl.classList.remove('up', 'down'); totalEl.style.color = V.tone; // the tier's colour, not just up or down
  eyebrow.textContent = `${CONFIG.now} · the books are closed`; eyebrow.classList.remove('hush');
  vEl.style.setProperty('--tone', V.tone);
  vEl.innerHTML = `<p class="verdict-tier ${V.cls}">${V.tier}</p><p>${fmtX(S.netTvpi)} net to your LPs. ${esc(V.line)}</p>`;
  vEl.hidden = false; skip.hidden = true; next.hidden = false;
  next.focus({ preventScroll: true });
  if (next.getBoundingClientRect().bottom > innerHeight) vEl.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
  await new Promise((r) => {
    const go = () => { document.removeEventListener('keydown', onEnter); r(); };
    const onEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    next.onclick = go;
    document.addEventListener('keydown', onEnter);
  });
}

/* ---------- results ---------- */
const TAG = {
  ipo: ['IPO', 'tag-ipo'], acquired: ['Acquired', 'tag-acq'], acquihire: ['Acquihire', 'tag-acq'],
  private: ['Private', 'tag-priv'], small: ['Private', 'tag-priv'], dead: ['Shut down', 'tag-dead'],
};
function basisNote(s) {
  return {
    undisclosed: 'Price undisclosed, so we count your money back.',
    acquihire: 'Team bought, product shut: a quarter of your money back.',
    cost: 'No public valuation, so it is held at cost.',
    assumed: 'Exit value not reported, so we count your money back.',
  }[s.basis] || '';
}
function row(c, s, i, max, label) {
  if (!c) {
    return `<li class="row" style="animation-delay:${i * 60}ms"><div class="row-name"><span class="tag tag-cash">Missed</span>Deal ${label}: the clock ran out</div>
      <div class="row-ret flat"><b>${fmtUSD(s.value)}</b><small>cash, 1x</small></div>
      <div class="row-became">Both rounds closed without you. The money sat in cash.</div></li>`;
  }
  const [t, cls] = TAG[c.o] || TAG.small;
  const m = s.multiple;
  const rc = s.kind === 'paper' && m !== 1 ? 'paper' : m > 1.05 ? 'up' : m < 0.95 ? 'down' : 'flat';
  const w = max > 0 ? Math.max(2, (Math.log10(1 + m) / Math.log10(1 + max)) * 100) : 0;
  const src = safeUrl(c.src);
  const name = src ? `<a href="${esc(src)}" target="_blank" rel="noopener">${esc(c.n)}</a>` : esc(c.n);
  const note = basisNote(s);
  return `<li class="row" style="animation-delay:${i * 60}ms">
    <div class="row-name"><span class="tag ${cls}">${t}</span>${name}${s.dd ? '<span class="dd-tag">Doubled down</span>' : ''}<span class="chip chip-year">${c.y}</span>${c.b ? `<span class="chip chip-yc">YC ${esc(c.b)}</span>` : ''}</div>
    <div class="row-ret ${rc}"><b>${fmtUSD(s.value)}</b><small>${s.dd ? '$2M in · ' : ''}${fmtX(m)}${s.kind === 'paper' && s.basis === 'priced' ? ' on paper' : ''}</small></div>
    <div class="row-became">${esc(c.bc || '')}${note ? ` <span class="fine">${note}</span>` : ''}</div>
    <div class="row-pitch">Pitched as: “${esc(c.p)}”</div>
    <div class="row-bar"><i data-w="${w.toFixed(1)}"></i></div></li>`;
}

function peerLine(peer, x) {
  const funds = G.bench.funds || [];
  if (!funds.length) return '';
  const src = (f) => `<small>Net multiple as reported by ${esc(f.lp)}, as of ${esc(f.as_of)}.${safeUrl(f.source) ? ` <a href="${esc(f.source)}" target="_blank" rel="noopener">Source</a>` : ''}</small>`;
  const full = (f) => (f.fund.toLowerCase().startsWith(f.firm.split(' ')[0].toLowerCase()) ? f.fund : `${f.firm} ${f.fund}`);
  const name = (f) => `<b>${esc(full(f))}</b>${/\b(19|20)\d{2}\b/.test(f.fund) ? '' : ` (${f.vintage})`}`;
  if (peer && Math.abs(Math.log(peer.net_tvpi / Math.max(x, 0.01))) <= Math.log(1.35)) {
    return `<p class="peer">You performed like ${name(peer)}: ${fmtX(peer.net_tvpi)} net.${src(peer)}</p>`;
  }
  const sorted = funds.slice().sort((a, b) => a.net_tvpi - b.net_tvpi);
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  if (x < lo.net_tvpi) return `<p class="peer">Worse than every real fund in our sample of ${funds.length}. The weakest, ${name(lo)}, still made ${fmtX(lo.net_tvpi)} net.${src(lo)}</p>`;
  if (x > hi.net_tvpi) return `<p class="peer">Better than every real fund in our sample of ${funds.length}. The best, ${name(hi)}, made ${fmtX(hi.net_tvpi)} net.${src(hi)}</p>`;
  return peer ? `<p class="peer">Nearest real fund: ${name(peer)}, ${fmtX(peer.net_tvpi)} net.${src(peer)}</p>` : '';
}

async function renderResults(S) {
  const V = verdict(S, G.bench);
  const peer = closestFund(S.netTvpi, G.bench.funds);
  const picks = S.picks.slice().sort((a, b) => b.s.value - a.s.value);
  const max = Math.max(...picks.map((p) => p.s.multiple), ...S.passes.map((p) => p.s.multiple), 1);
  const passes = S.passes.slice().sort((a, b) => b.s.value - a.s.value);
  const q = G.bench.quartiles;
  const lo = 0.3, hi = Math.max(12, q.top_decile * 3, S.netTvpi * 1.15);
  const pos = (x) => Math.max(0, Math.min(100, ((Math.log(Math.max(x, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 100));
  const ticks = [[1, '1x'], [q.median, 'median'], [q.top_quartile, 'top 25%'], [q.top_decile, 'top 10%']];
  const ga = S.gotAway;
  const up = S.gross >= fundTotal();
  // the benchmark bar in tier colours: each band starts where that verdict starts
  const bands = [[lo, TONE.wiped], [0.5, TONE.lost], [1, TONE.below], [q.median, TONE.above], [q.top_quartile, TONE.tq], [q.top_decile, TONE.td]];
  const barBg = `linear-gradient(90deg, ${bands.map(([x, c], i) => { const a = pos(x), b = i + 1 < bands.length ? pos(bands[i + 1][0]) : 100; return `${c} ${Math.max(0, a + (i ? 0.6 : 0)).toFixed(1)}%, ${c} ${Math.max(0, b - 0.6).toFixed(1)}%`; }).join(', ')})`;

  $('#results').style.setProperty('--tone', V.tone);
  $('#results').innerHTML = `
    <div class="res-head">
      <p class="eyebrow">Fund I · vintage ${esc(S.vintage)} · ${MANDATE[G.mandate]}</p>
      <h2 class="res-fund">${esc(G.fund)}</h2>
      <div class="res-big"><span class="res-money"><span class="from">${fmtUSD(fundTotal())}</span><span class="arrow">→</span><span class="to" id="resTo">${fmtUSD(REDUCED ? S.gross : 0)}</span></span></div>
      <div class="res-chips">
        <span class="stat-chip"><b class="tone">${fmtX(S.netTvpi)}</b><span>net to your LPs</span></span>
        <span class="stat-chip"><b>${fmtX(S.dpi)}</b><span>cash back (DPI)</span></span>
        <span class="stat-chip"><b>${S.right}/${S.decided}</b><span>right calls</span></span>
        <span class="stat-chip"><b>${fmtX(S.coinNet)}</b><span>coin flip, same deals</span></span>
      </div>
    </div>
    <div class="res-grid">
      <div class="stack res-main">
        <section class="panel res-block">
          <h3>Your portfolio</h3>
          <p class="sub">What your ${S.picks.length} checks became, best first. ${S.paper > 0 ? `${fmtUSD(S.paper)} of it is still on paper.` : ''}</p>
          <ul class="port">${picks.map((p, i) => row(p.c, p.s, i, max, G.rounds.indexOf(p.round) + 1)).join('')}</ul>
          <details class="more"><summary>The ${passes.length} you passed on</summary>
            <ul class="port">${passes.map((p, i) => row(p.c, p.s, i, max)).join('')}</ul>
          </details>
        </section>
        <section class="panel res-block how" id="how">
          <h3>How the math works</h3>
          <ul>${G.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
          <p class="src">Company outcomes link to their sources (tap a name). Benchmark: ${esc(G.bench.label)}${safeUrl(G.bench.source) ? ` · <a href="${esc(G.bench.source)}" target="_blank" rel="noopener">source</a>` : ''}.</p>
        </section>
      </div>
      <aside class="stack res-top">
        <section class="panel res-block verdict">
          <p class="verdict-tier ${V.cls}">${V.tier}</p>
          <p class="sub" style="margin:0">${esc(V.line)}</p>
          <div class="scale" aria-hidden="true">
            <div class="scale-bar" style="background:${barBg}"></div>
            ${ticks.map(([x, l], k) => `<div class="scale-tick${k % 2 ? ' low' : ''}" style="left:${pos(x)}%"><span>${l}</span></div>`).join('')}
            <div class="scale-you" style="left:${pos(S.netTvpi)}%"><b>You ${fmtX(S.netTvpi)}</b><i></i></div>
          </div>
          ${peerLine(peer, S.netTvpi)}
        </section>
        ${ga ? `<section class="panel res-block gotaway">
          <p class="eyebrow">The one that got away</p>
          <h3>${esc(ga.c.n)}</h3>
          <p class="sub" style="margin:0">${esc(ga.c.bc || '')}</p>
          <p class="cost">${ga.chosen ? `You backed ${esc(ga.chosen.n)} instead.` : 'You let the clock run out.'} That $1M would be worth <b>${fmtUSD(ga.s.value)}</b>.</p>
        </section>` : ''}
      </aside>
      <aside class="stack res-bottom">
        <section class="panel res-block">
          <h3>Share your fund</h3>
          <p class="sub">Post it and dare people to beat it.</p>
          <img class="share-prev" id="sharePrev" alt="Your fund's result card" />
          <div class="share-btns">
            <button class="btn btn-go" id="btnShare" type="button">Share your fund</button>
          </div>
          <div class="share-to" aria-label="Share to">
            <a class="share-ch" id="shWhatsApp" target="_blank" rel="noopener">${ICON.chat}WhatsApp</a>
            <a class="share-ch" id="shSMS">${ICON.msg}Messages</a>
            <a class="share-ch" id="shX" target="_blank" rel="noopener">${ICON.x}X</a>
            <button class="share-ch" id="btnLinkedIn" type="button">${ICON.in}LinkedIn</button>
            <a class="share-ch" id="shMail">${ICON.mail}Email</a>
            <button class="share-ch" id="shCopy" type="button">${ICON.link}Copy link</button>
          </div>
          <button class="btn btn-ghost btn-small share-dl" id="btnDownload" type="button">Download the card image</button>
        </section>
        <div class="again">
          <button class="btn btn-go" id="btnAgain" type="button">${V.again} <span class="fine" style="color:inherit;opacity:.7">new companies</span></button>
          <button class="btn btn-ghost" id="btnHome" type="button">Change mandate</button>
        </div>
      </aside>
    </div>`;
  show('results');

  // count up + bars
  const toEl = $('#resTo');
  if (!REDUCED) {
    const t0 = performance.now(), D = 1300;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
      toEl.textContent = fmtUSD(S.gross * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  requestAnimationFrame(() => setTimeout(() => {
    document.querySelectorAll('#results .row-bar i').forEach((i) => { i.style.width = `${i.dataset.w}%`; });
  }, 80));

  $('#btnAgain').addEventListener('click', start);
  $('#btnHome').addEventListener('click', () => show('home'));

  // share card
  const cv = await drawCard(G.fund, S, V);
  const url = cv.toDataURL('image/png');
  $('#sharePrev').src = url;
  const text = shareText(G.fund, S, V);
  const file = await new Promise((r) => cv.toBlob((b) => r(b ? new File([b], 'time-machine-fund.png', { type: 'image/png' }) : null), 'image/png'));
  $('#btnDownload').addEventListener('click', () => {
    const a = document.createElement('a'); a.href = url; a.download = 'time-machine-fund.png'; a.click();
  });
  $('#btnLinkedIn').addEventListener('click', async () => {
    await copy(text);
    toast('Result copied. Paste it into your post.');
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://${CONFIG.site}/`)}`, '_blank', 'noopener');
  });
  // one tap to wherever people talk: WhatsApp, Messages (iMessage/SMS), X, email, or a copied link
  const link = `https://${CONFIG.site}/`, bare = text.replace(/\s*Can you beat it\? https?:\/\/\S+$/, ' Can you beat it?');
  $('#shWhatsApp').href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  $('#shSMS').href = `sms:?&body=${encodeURIComponent(text)}`;
  $('#shX').href = `https://x.com/intent/tweet?text=${encodeURIComponent(bare)}&url=${encodeURIComponent(link)}`;
  $('#shMail').href = `mailto:?subject=${encodeURIComponent(`Can you beat my Time Machine Fund?`)}&body=${encodeURIComponent(text)}`;
  $('#shCopy').addEventListener('click', async () => { await copy(text); toast('Copied. Paste it anywhere.'); });
  $('#btnShare').addEventListener('click', async () => {
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
      if (navigator.share) { await navigator.share({ text, url: `https://${CONFIG.site}/` }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    await copy(text);
    toast('Result copied to your clipboard.');
  });
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    t.remove();
  }
}
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.role = 'status'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
