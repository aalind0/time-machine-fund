// The shareable result card (1080x1350, LinkedIn/Instagram portrait), drawn on a canvas.
import { CONFIG } from './config.js';
import { fmtUSD, fmtX, fundTotal } from './fund.js';

const C = {
  bg: '#07080b', panel: '#11131a', line: '#262a37', ink: '#f3f5f9', ink2: '#c9cedb', muted: '#8c93a6',
  dim: '#5f6679', accent: '#c8ff2e', time: '#ffb22e', loss: '#ff5d5d', gain: '#3ddc8f',
};
const SANS = '"Inter Tight", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export async function drawCard(fund, S, V) {
  try {
    await Promise.all([
      document.fonts.load(`700 40px ${SANS}`), document.fonts.load(`600 40px ${SANS}`),
      document.fonts.load(`700 40px ${MONO}`), document.fonts.load(`500 40px ${MONO}`),
    ]);
  } catch { /* fallback fonts are fine */ }
  const W = 1080, H = 1350, P = 84;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  // grid + glow
  g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
  for (let y = 0; y <= H; y += 60) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
  const glow = g.createRadialGradient(W / 2, -60, 40, W / 2, -60, 900);
  glow.addColorStop(0, 'rgba(200,255,46,0.20)'); glow.addColorStop(.5, 'rgba(255,178,46,0.06)'); glow.addColorStop(1, 'rgba(7,8,11,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  // header
  dial(g, P + 18, P + 16, 17);
  g.fillStyle = C.ink; g.font = `700 30px ${SANS}`; g.textBaseline = 'middle';
  g.fillText('Time Machine Fund', P + 48, P + 17);

  // fund name
  g.textBaseline = 'alphabetic';
  g.fillStyle = C.muted; g.font = `500 24px ${MONO}`;
  g.fillText(`FUND I · VINTAGE ${S.vintage}`, P, 238);
  g.fillStyle = C.ink; g.font = `700 64px ${SANS}`;
  fitText(g, fund, P, 312, W - 2 * P, 64, SANS, 700);

  // the number
  const up = S.netTvpi >= 1;
  g.font = `700 50px ${MONO}`; g.fillStyle = C.dim;
  g.fillText(`${fmtUSD(fundTotal())} →`, P, 420);
  g.font = `700 150px ${MONO}`; g.fillStyle = V.tone || (up ? C.accent : C.loss);
  fitText(g, fmtUSD(S.gross), P - 6, 560, W - 2 * P, 150, MONO, 700);

  // stats row
  const stats = [[fmtX(S.netTvpi), 'net to LPs'], [`${S.right}/${S.decided}`, 'right calls'], [fmtX(S.dpi), 'cash back (DPI)']];
  const bw = (W - 2 * P - 2 * 20) / 3;
  stats.forEach(([v, l], i) => {
    const x = P + i * (bw + 20), y = 616;
    roundRect(g, x, y, bw, 130, 20); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.line; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.ink; g.font = `700 48px ${MONO}`; g.fillText(v, x + 26, y + 70);
    g.fillStyle = C.muted; g.font = `500 22px ${SANS}`; g.fillText(l, x + 26, y + 106);
  });

  // verdict
  g.fillStyle = V.tone || C.ink;
  g.font = `700 52px ${SANS}`; g.fillText(V.tier, P, 846);

  // best pick + got away
  const best = S.picks.filter((p) => p.c).sort((a, b) => b.s.value - a.s.value)[0];
  let y = 930;
  if (best && best.s.value > CONFIG.check) {
    line(g, 'BEST PICK', `${best.c.n} · ${fmtX(best.s.multiple)}`, y, C.gain); y += 92;
  }
  if (S.gotAway) {
    line(g, 'THE ONE THAT GOT AWAY', `${S.gotAway.c.n} · ${fmtX(S.gotAway.s.multiple)}`, y, C.time); y += 92;
  }

  // footer
  g.fillStyle = C.line; g.fillRect(P, H - 150, W - 2 * P, 2);
  g.fillStyle = C.ink2; g.font = `600 30px ${SANS}`; g.fillText('Can you beat it?', P, H - 92);
  g.fillStyle = C.muted; g.font = `500 26px ${MONO}`;
  const site = CONFIG.site;
  g.fillText(site, W - P - g.measureText(site).width, H - 92);
  return cv;

  function line(gg, label, text, yy, color) {
    gg.fillStyle = color; gg.font = `600 22px ${MONO}`; gg.fillText(label, P, yy);
    gg.fillStyle = C.ink; gg.font = `600 40px ${SANS}`;
    fitText(gg, text, P, yy + 50, W - 2 * P, 40, SANS, 600);
  }
}

function fitText(g, text, x, y, maxW, size, fam, weight) {
  let s = size;
  g.font = `${weight} ${s}px ${fam}`;
  while (g.measureText(text).width > maxW && s > 18) { s -= 2; g.font = `${weight} ${s}px ${fam}`; }
  g.fillText(text, x, y);
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function dial(g, cx, cy, r) {
  g.strokeStyle = C.accent; g.lineWidth = 3.5; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx, cy - r * .55); g.lineTo(cx, cy); g.lineTo(cx + r * .45, cy + r * .3); g.stroke();
}

export function shareText(fund, S, V) {
  const parts = [`My Time Machine Fund "${fund}" turned ${fmtUSD(fundTotal())} into ${fmtUSD(S.gross)} (${fmtX(S.netTvpi)} net to LPs, ${V.tier.toLowerCase()}).`];
  if (S.gotAway) parts.push(`The one that got away: ${S.gotAway.c.n}.`);
  parts.push(`Can you beat it? https://${CONFIG.site}`);
  return parts.join(' ');
}
