// The time machine: a short cartoon before deal 1 (the trip back) and before the reveal (the trip home).
// Every trip: the VC walks in, the machine rattles through the years, the door pops open and they stumble
// out, a little frazzled, into the other era. About 3 s; replays skip the walk-in (about 1.4 s).
//
// The world shows the year, so the jump is obvious:
//   street car   yellow taxi puffing smoke (to 2016) → EV on a charger (2017–22) → robotaxi with eyes (2023+)
//   sidewalk     payphone (to 2014) → EV charger (2018+); a delivery robot (2021+)
//   street light orange sodium (to 2017) → white LED
//   pole         wooden pole with phone wires (to 2015) → 5G mast (2020+)
//   roofs        TV dishes and antennas (to 2016) → solar panels (2019+); glass towers rise, cranes while they go up
//   sky          smoggy orange dusk → clean teal; delivery drones (2019+, parcels from 2021); an air taxi (2025+)
//   billboard    the hype of the day: MOBILE, SHARING, CRYPTO, REMOTE, NFTS, GEN AI, AGENTS;
//                a pasted paper poster until 2018, an LED screen after
//
// The scene is one SVG built once; every frame is a pure function of time, so Skip just draws the last frame.
const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GROUND = 250, MX = 400, INK = '#15121f';
const OL = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const OLt = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`;
const HYPE = [[2012, 'MOBILE'], [2014, 'SHARING'], [2017, 'CRYPTO'], [2020, 'REMOTE'], [2021, 'NFTS'], [2023, 'GEN AI'], [2025, 'AGENTS']];

// [x, width, drawn height, style b brick / c concrete / g glass, [[year, height], ...]]
const TOWERS = [
  [-20, 70, 120, 'c', [[2012, 120]]], [40, 56, 190, 'g', [[2016, 0], [2021, 190]]], [92, 78, 100, 'b', [[2012, 100]]],
  [165, 50, 150, 'c', [[2012, 118], [2017, 150]]], [215, 44, 210, 'g', [[2018, 0], [2023, 210]]], [262, 70, 82, 'b', [[2012, 82]]],
  [318, 52, 232, 'g', [[2014, 0], [2020, 232]]], [440, 62, 176, 'c', [[2012, 128], [2016, 176]]], [505, 108, 78, 'b', [[2012, 78]]],
  [612, 48, 200, 'g', [[2020, 0], [2025, 200]]], [662, 70, 130, 'c', [[2012, 130]]], [735, 46, 182, 'g', [[2015, 0], [2019, 182]]],
  [780, 70, 96, 'b', [[2012, 96]]],
];
const BILLBOARD = 8, OLD_ROOF = [2, 10], SOLAR = [2, 5, 12]; // tower indexes

const rnd = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const f1 = (n) => +n.toFixed(1);
const towerH = (keys, yr) => {
  if (yr <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (yr <= keys[i][0]) return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * (yr - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
  return keys[keys.length - 1][1];
};
// a hand-drawn box: corners nudged, the top edge bowed a little
const wob = (x, y, w, h, s, j = 1.6) => {
  const r = (i) => f1((rnd(s * 17 + i) - 0.5) * 2 * j);
  return `M${f1(x + r(1))} ${GROUND + 4} L${f1(x + r(2))} ${f1(y + r(3))} Q${f1(x + w / 2)} ${f1(y - j + r(4))} ${f1(x + w + r(5))} ${f1(y + r(6))} L${f1(x + w + r(7))} ${GROUND + 4} Z`;
};
// things that exist only in some years: shown from `from` to `to`, popping in and out around those years
const era = (from, to, ax, ay, body) => `<g data-from="${from}" data-to="${to}" data-ax="${ax}" data-ay="${ay}">${body}</g>`;

/* ---------- the cast ---------- */
function vcSVG() {
  const noodle = (d, c, w = 6.2) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 3.6}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const shoe = (x, c) => `<path d="M${x - 8} -0.5 Q${x - 8} -8 ${x - 1} -8 L${x + 6} -7 Q${x + 12} -6 ${x + 12} -0.5 Z" fill="${c}" ${OL}/>`;
  return `<g id="vc"><g id="vBody">
    <g id="vLegB">${noodle('M-3 -42 L-4 -7', '#a8936a')}${shoe(-4, '#dcdce6')}</g>
    <g id="vArmB">${noodle('M-7 -68 Q-12 -56 -9 -46', '#7fb0e6', 5)}<circle cx="-9" cy="-45" r="3.6" fill="#d9a47e" ${OL}/></g>
    <path d="M-12 -72 Q-14 -56 -11 -40 L11 -40 Q13 -56 10 -72 Q0 -76 -12 -72 Z" fill="#a9d3ff" ${OL}/>
    <path d="M-12 -71 Q-14 -56 -11 -40 L-1.5 -40 L-1.5 -60 L-5 -72 Z" fill="#2d3f7c" ${OL}/>
    <path d="M1.5 -60 L1.5 -40 L11 -40 Q13 -56 10 -71 L5 -72 Z" fill="#2d3f7c" ${OL}/>
    <rect x="5" y="-58" width="4" height="2.6" rx="1" fill="#c8ff2e"/>
    <rect x="-11" y="-43" width="22" height="4" fill="#5a3f2a" ${OLt}/>
    <g id="vLegF">${noodle('M2 -42 L3 -7', '#cdb68a')}${shoe(3, '#ffffff')}</g>
    <rect x="-1.5" y="-79" width="6" height="8" fill="#e8b48c" ${OLt}/>
    <ellipse cx="3" cy="-90" rx="14" ry="16" fill="#f4c7a1" ${OL}/>
    <path d="M-6 -80 Q2 -74 12 -77" fill="none" stroke="#d9a47e" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="-8" cy="-88" rx="3.2" ry="4.6" fill="#f4c7a1" ${OL}/>
    <rect x="-10.6" y="-86" width="3.2" height="7.5" rx="1.6" fill="#ffffff" ${OLt}/>
    <g id="vHair"><path d="M-11 -94 Q-12 -110 4 -108 Q18 -107 17 -97 Q11 -101 3 -99 Q-4 -98 -6 -92 Q-9 -90 -11 -94 Z" fill="#3b2416" ${OL}/>
      <path d="M0 -104 Q8 -106 13 -102" fill="none" stroke="#7a4e33" stroke-width="2" stroke-linecap="round"/></g>
    <g id="vHairZap" display="none"><path d="M-12 -92 L-19 -99 L-11 -101 L-14 -111 L-4 -105 L-1 -117 L5 -106 L12 -115 L14 -104 L23 -107 L18 -97 Q9 -101 1 -99 Q-6 -97 -12 -92 Z" fill="#3b2416" ${OL}/>
      <g id="vPuff" opacity=".9"><circle cx="-4" cy="-122" r="7" fill="#d9d6e6" ${OLt}/><circle cx="6" cy="-126" r="8.5" fill="#e9e6f5" ${OLt}/><circle cx="15" cy="-120" r="6" fill="#d9d6e6" ${OLt}/></g></g>
    <circle cx="8" cy="-91" r="6.2" fill="#ffffff" ${OL}/><circle cx="18.5" cy="-91" r="5.6" fill="#ffffff" ${OL}/>
    <circle id="vPupL" cx="9.6" cy="-91" r="1.8" fill="${INK}"/><circle id="vPupR" cx="19.8" cy="-91" r="1.7" fill="${INK}"/>
    <path d="M3 -99.5 L11 -98.5 M15.5 -98.5 L22 -100" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M18 -88 Q26 -88 24.5 -82.5 Q23 -79.5 18 -81" fill="#f4c7a1" ${OL}/>
    <path d="M9 -76.5 Q14 -74.5 19 -78" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <g id="vArmF">${noodle('M5 -68 Q10 -58 9 -50', '#a9d3ff', 5)}
      <path d="M3 -44 L5 -51 L11 -48 Z M14 -44 L18 -50 L21 -45 Z" fill="#8fe388" ${OLt}/>
      <rect x="-4" y="-45" width="28" height="19" rx="4" fill="#b8742f" ${OL}/>
      <path d="M-4 -38 H24" stroke="#8a5420" stroke-width="2"/>
      <text x="10" y="-30" text-anchor="middle" font-family="Inter Tight, sans-serif" font-weight="800" font-size="10" fill="#fff3c9">$10M</text>
      <path d="M2 -45 Q2 -51 9 -51 Q16 -51 16 -45" fill="none" stroke="${INK}" stroke-width="2.4"/>
      <circle cx="9" cy="-50" r="3.6" fill="#f4c7a1" ${OL}/></g>
  </g></g>`;
}

function machineSVG() {
  const rivets = (y) => Array.from({ length: 9 }, (_, i) => `<circle cx="${352 + i * 12}" cy="${y}" r="1.6" fill="#8a4f1c"/>`).join('');
  return `<g id="mShake">
    <path d="M356 234 L348 252 L368 252 L368 234 Z" fill="#6a6588" ${OL}/><path d="M432 234 L432 252 L452 252 L444 234 Z" fill="#6a6588" ${OL}/>
    <path d="M454 168 C492 168 468 202 494 206 C512 209 506 222 494 224" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <path id="mTube" d="M454 168 C492 168 468 202 494 206 C512 209 506 222 494 224" fill="none" stroke="#9dff6a" stroke-width="5.4" stroke-linecap="round"/>
    <rect x="474" y="215" width="38" height="8" rx="2" fill="#8b86a8" ${OL}/>
    <path d="M478 223 L508 223 L506 251 L480 251 Z" fill="#c8ff2e" fill-opacity=".85" ${OL}/>
    <circle class="mBub" cx="486" cy="244" r="2.6" fill="#f4ffd0"/><circle class="mBub" cx="495" cy="238" r="2" fill="#f4ffd0"/><circle class="mBub" cx="501" cy="246" r="2.4" fill="#f4ffd0"/>
    <g id="mLever"><path d="M334 172 L316 140" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M334 172 L316 140" stroke="#8b86a8" stroke-width="3.6" stroke-linecap="round"/><circle cx="316" cy="139" r="6.5" fill="#ff5d5d" ${OL}/></g>
    <rect x="328" y="162" width="16" height="22" rx="3" fill="#6a6588" ${OL}/>
    <rect x="423" y="70" width="15" height="22" fill="#6a6588" ${OL}/><rect x="419" y="64" width="23" height="7" rx="2" fill="#8b86a8" ${OL}/>
    <path d="M342 238 L342 128 Q342 80 400 78 Q458 80 458 128 L458 238 Q400 246 342 238 Z" fill="#35b3a0" ${OL}/>
    <path d="M433 86 Q457 98 457 128 L457 237 Q446 240 433 241 Z" fill="#26897a"/>
    <path d="M352 132 Q352 100 377 89" fill="none" stroke="#9af3e0" stroke-width="4" stroke-linecap="round"/>
    <path d="M342 116 Q400 110 458 116 L458 127 Q400 121 342 127 Z" fill="#e0913f" ${OL}/>${rivets(121)}
    <path d="M342 212 Q400 206 458 212 L458 223 Q400 217 342 223 Z" fill="#e0913f" ${OL}/>${rivets(217)}
    <g transform="rotate(-24 356 186)"><rect x="343" y="181" width="28" height="9" fill="#c3c0d4" ${OLt}/></g>
    <g transform="rotate(18 356 186)"><rect x="343" y="181" width="28" height="9" fill="#b3b0c6" ${OLt}/></g>
    <g transform="rotate(-8 381 98)"><rect x="361" y="92" width="42" height="11" rx="2" fill="#fff3c9" ${OLt}/>
      <text x="382" y="100.5" text-anchor="middle" font-family="Inter Tight, sans-serif" font-weight="800" font-size="7" fill="#c4553a">DO NOT KICK</text></g>
    <circle cx="443" cy="146" r="11" fill="#fff3c9" ${OL}/>
    <path d="M435 146 A8 8 0 0 1 451 146" fill="none" stroke="#ff5d5d" stroke-width="2"/>
    <path id="mNeedle" d="M443 146 L443 137" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><circle cx="443" cy="146" r="1.8" fill="${INK}"/>
    <path d="M440 178 h12 M440 184 h12 M440 190 h12" stroke="#1d6e62" stroke-width="2.4" stroke-linecap="round"/>
    <g transform="rotate(-28 366 84)"><path d="M352 86 Q366 68 380 86 Z" fill="#c9cedb" ${OL}/><path d="M366 80 L366 74" stroke="${INK}" stroke-width="2"/></g>
    <path d="M400 79 Q397 62 407 52 Q414 45 410 37" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
    <circle id="mBulbGlow" cx="410" cy="30" r="16" fill="#c8ff2e" opacity=".18"/>
    <circle id="mBulb" cx="410" cy="30" r="7" fill="#c8ff2e" ${OL}/>
    <path class="mSpark" d="M420 24 l7 -3 l-3 6 l8 -2" fill="none" stroke="#fff6a8" stroke-width="2.2" stroke-linecap="round" display="none"/>
    <path class="mSpark" d="M398 22 l-7 -4 l2 6 l-8 -1" fill="none" stroke="#fff6a8" stroke-width="2.2" stroke-linecap="round" display="none"/>
    <path class="mSpark" d="M462 120 l8 -2 l-4 6 l8 0" fill="none" stroke="#fff6a8" stroke-width="2.2" stroke-linecap="round" display="none"/>
    <rect x="372" y="132" width="56" height="108" rx="24" fill="url(#mInside)" ${OL}/>
    <g clip-path="url(#mDoorClip)"><g id="mSwirl">${[0, 2.1, 4.2].map((r0) => {
      const pts = Array.from({ length: 34 }, (_, i) => { const a = i / 34 * Math.PI * 2.6 + r0, r = 3 + i * 1.5; return `${f1(400 + Math.cos(a) * r)} ${f1(186 + Math.sin(a) * r * 1.5)}`; });
      return `<path d="M${pts.join(' L')}" fill="none" stroke="#fffbe0" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
    }).join('')}</g></g>
    <g id="vcInside"></g>
    <g id="mDoor"><rect x="372" y="132" width="56" height="108" rx="24" fill="#2a8c7b" ${OL}/>
      <path d="M380 150 Q380 140 390 137" fill="none" stroke="#5ccdb8" stroke-width="3" stroke-linecap="round"/>
      <circle id="mPort" cx="400" cy="164" r="13" fill="#c8ff2e"/><circle cx="400" cy="164" r="13" fill="none" stroke="#e0a84a" stroke-width="5"/>
      <circle cx="400" cy="164" r="15.6" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M394 158 Q397 155 401 155" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="414" cy="204" r="7.5" fill="none" stroke="${INK}" stroke-width="3.4"/><path d="M414 196.5 V211.5 M406.5 204 H421.5" stroke="${INK}" stroke-width="2.2"/>
      <circle cx="376.5" cy="152" r="2.2" fill="#e0913f" ${OLt}/><circle cx="376.5" cy="220" r="2.2" fill="#e0913f" ${OLt}/></g>
  </g>`;
}

/* ---------- the city ---------- */
function towerSVG([x, w, H, st, keys], i) {
  const y = GROUND - H;
  const [body, shade, lit, dark] = { b: ['#c4553a', '#973b28', '#ffd75e', '#6b2d2a'], c: ['#8b86a8', '#6a6588', '#ffe08a', '#4b4766'], g: ['#3ec6d4', '#2a93a3', '#f4ff9a', '#1f6f7d'] }[st];
  let s = `<g class="tw" data-i="${i}"><path d="${wob(x, y, w, H, i)}" fill="${body}" ${OL}/>`;
  s += `<path d="M${f1(x + w * 0.76)} ${y + 3} L${x + w - 1.6} ${y + 3} L${x + w - 1.6} ${GROUND} L${f1(x + w * 0.76)} ${GROUND} Z" fill="${shade}"/>`;
  const [cw, ch, ww, wh] = st === 'g' ? [11, 14, 6, 8] : st === 'b' ? [16, 20, 8, 11] : [13, 17, 7, 9];
  for (let wy = GROUND - 16; wy >= y + 10; wy -= ch) {
    for (let wx = x + 6; wx <= x + w * 0.74 - ww; wx += cw) {
      const on = rnd(i * 131 + wx * 7 + wy) < (st === 'g' ? 0.42 : 0.36);
      s += `<rect x="${f1(wx)}" y="${wy}" width="${ww}" height="${wh}" rx="${st === 'b' ? 3 : 1.5}" fill="${on ? lit : dark}" ${on ? OLt : ''}/>`;
    }
  }
  if (st === 'g') {
    s += `<path d="M${x + 6} ${y + 30} L${x + w * 0.6} ${y + 8} M${x + 6} ${y + 52} L${x + w * 0.7} ${y + 22}" stroke="#ffffff" stroke-width="3" opacity=".35" stroke-linecap="round"/>`;
    s += `<path d="M${x + w / 2} ${y - 1} V${y - 16}" stroke="${INK}" stroke-width="2.4"/><circle class="twLight" cx="${x + w / 2}" cy="${y - 18}" r="3" fill="#ff5d5d" ${OLt}/>`;
    if (keys.length > 1 && keys[0][1] === 0) { // a crane while it goes up
      const cx = x + w - 10;
      s += `<g class="crane"><path d="M${cx} ${y} V${y - 46} M${cx + 6} ${y} V${y - 46}" stroke="${INK}" stroke-width="4.4"/><path d="M${cx} ${y} V${y - 46} M${cx + 6} ${y} V${y - 46}" stroke="#ffc93c" stroke-width="2"/>
        ${Array.from({ length: 5 }, (_, k) => `<path d="M${cx} ${y - k * 9} L${cx + 6} ${y - k * 9 - 9}" stroke="#ffc93c" stroke-width="1.6"/>`).join('')}
        <rect x="${cx - 52}" y="${y - 52}" width="76" height="6" fill="#ffc93c" ${OL}/><rect x="${cx + 12}" y="${y - 47}" width="11" height="9" fill="#6a6588" ${OLt}/>
        <path d="M${cx - 40} ${y - 46} V${y - 26}" stroke="${INK}" stroke-width="1.4"/><rect x="${cx - 46}" y="${y - 26}" width="12" height="8" fill="#e0913f" ${OLt}/></g>`;
    }
  } else if (st === 'c' && H < 140) {
    s += `<g><path d="M${x + 12} ${y} L${x + 14} ${y - 10} M${x + 26} ${y} L${x + 24} ${y - 10}" stroke="${INK}" stroke-width="2.4"/><rect x="${x + 9}" y="${y - 26}" width="20" height="17" rx="3" fill="#a3734a" ${OL}/><path d="M${x + 7} ${y - 26} L${x + 19} ${y - 34} L${x + 31} ${y - 26} Z" fill="#7d5434" ${OL}/></g>`;
  }
  if (OLD_ROOF.includes(i)) s += era(2000, 2017, x + w / 2, y, `<g transform="rotate(-20 ${x + w - 18} ${y - 8})"><path d="M${x + w - 28} ${y - 8} Q${x + w - 18} ${y - 22} ${x + w - 8} ${y - 8} Z" fill="#e8e6f0" ${OL}/></g><path d="M${x + w - 18} ${y} V${y - 8}" stroke="${INK}" stroke-width="2.4"/>
    <path d="M${f1(x + w * 0.45)} ${y} V${y - 26} M${f1(x + w * 0.45 - 8)} ${y - 22} H${f1(x + w * 0.45 + 8)} M${f1(x + w * 0.45 - 6)} ${y - 16} H${f1(x + w * 0.45 + 6)}" stroke="${INK}" stroke-width="2"/>`);
  if (SOLAR.includes(i)) s += era(2019, 2100, x + w / 2, y, Array.from({ length: Math.floor((w - 10) / 16) }, (_, k) =>
    `<path d="M${x + 6 + k * 16} ${y - 1} L${x + 9 + k * 16} ${y - 10} L${x + 20 + k * 16} ${y - 10} L${x + 18 + k * 16} ${y - 1} Z" fill="#3561c4" ${OLt}/><path d="M${x + 11 + k * 16} ${y - 9} L${x + 10 + k * 16} ${y - 2}" stroke="#8fb4ff" stroke-width="1.2"/>`).join(''));
  if (i === BILLBOARD) {
    const bx = x - 2, by = y - 62, bw = w + 4, bh = 48, mid = bx + bw / 2;
    s += `<path d="M${bx + 18} ${by + bh} V${y} M${bx + bw - 18} ${by + bh} V${y}" stroke="${INK}" stroke-width="5"/><path d="M${bx + 18} ${by + bh} V${y} M${bx + bw - 18} ${by + bh} V${y}" stroke="#6a6588" stroke-width="2.4"/>`;
    s += era(2000, 2019, mid, by + bh, `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="#7d5434" ${OL}/><rect x="${bx + 5}" y="${by + 5}" width="${bw - 10}" height="${bh - 10}" fill="#f3e6c4" ${OLt}/>
      <path d="M${bx + 38} ${by + 5} V${by + bh - 5} M${bx + 74} ${by + 5} V${by + bh - 5}" stroke="#ddc9a0" stroke-width="1.4"/>
      <text id="bbPaper" x="${mid}" y="${by + 33}" text-anchor="middle" font-family="Inter Tight, sans-serif" font-weight="800" font-size="22" fill="#b43a2c" letter-spacing="-.5">MOBILE</text>
      <path d="M${bx + 14} ${by} L${bx + 18} ${by - 12} M${bx + bw - 14} ${by} L${bx + bw - 18} ${by - 12}" stroke="${INK}" stroke-width="2.4"/>
      <circle cx="${bx + 18}" cy="${by - 13}" r="4" fill="#ffd98a" ${OLt}/><circle cx="${bx + bw - 18}" cy="${by - 13}" r="4" fill="#ffd98a" ${OLt}/>
      <path d="M${bx + 14} ${by - 10} L${bx + 2} ${by + 20} L${bx + 40} ${by + 20} Z M${bx + bw - 14} ${by - 10} L${bx + bw - 2} ${by + 20} L${bx + bw - 40} ${by + 20} Z" fill="#ffe9a8" opacity=".22"/>`);
    s += era(2019, 2100, mid, by + bh, `<rect x="${bx - 4}" y="${by - 4}" width="${bw + 8}" height="${bh + 8}" rx="6" fill="#c8ff2e" opacity=".16"/>
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="#2e2a40" ${OL}/><rect x="${bx + 4}" y="${by + 4}" width="${bw - 8}" height="${bh - 8}" rx="2" fill="#0d0b16"/>
      <text id="bbLed" x="${mid}" y="${by + 32}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="20" fill="#c8ff2e">AGENTS</text>
      <path d="M${bx + 6} ${by + 10} H${bx + bw - 6}" stroke="#c8ff2e" stroke-width="1" opacity=".18"/>`);
  }
  return `${s}</g>`;
}

function streetSVG() {
  const lamp = (x) => `<path d="M${x} ${GROUND + 2} V${GROUND - 70} Q${x} ${GROUND - 84} ${x + 14} ${GROUND - 82}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <path d="M${x} ${GROUND + 2} V${GROUND - 70} Q${x} ${GROUND - 84} ${x + 14} ${GROUND - 82}" fill="none" stroke="#4b4766" stroke-width="2.6" stroke-linecap="round"/>
    ${era(2000, 2018, x + 16, GROUND - 76, `<circle cx="${x + 17}" cy="${GROUND - 74}" r="22" fill="url(#glowOld)"/><path d="M${x + 9} ${GROUND - 80} Q${x + 17} ${GROUND - 86} ${x + 25} ${GROUND - 80} L${x + 22} ${GROUND - 75} L${x + 12} ${GROUND - 75} Z" fill="#ff9a3c" ${OL}/>`)}
    ${era(2018, 2100, x + 16, GROUND - 76, `<circle cx="${x + 17}" cy="${GROUND - 74}" r="24" fill="url(#glowNew)"/><rect x="${x + 7}" y="${GROUND - 82}" width="21" height="6" rx="3" fill="#f2fbff" ${OL}/>`)}`;
  const wires = Array.from({ length: 3 }, (_, k) => `<path d="M${520} ${GROUND - 92 + k * 5} Q${605} ${GROUND - 80 + k * 5} ${684} ${GROUND - 92 + k * 5} Q${750} ${GROUND - 80 + k * 5} ${820} ${GROUND - 90 + k * 5}" fill="none" stroke="${INK}" stroke-width="1.4"/>`).join('');
  return `
  <rect x="-20" y="${GROUND}" width="840" height="16" fill="#4d4766" ${OL}/>
  ${Array.from({ length: 30 }, (_, k) => `<path d="M${k * 30 + 10} ${GROUND + 1} L${k * 30 + 6} ${GROUND + 15}" stroke="#3d3854" stroke-width="1.6"/>`).join('')}
  <rect x="-20" y="${GROUND + 16}" width="840" height="50" fill="#26223a"/>
  <path d="M-20 ${GROUND + 16.5} H820" stroke="${INK}" stroke-width="2.4"/>
  ${Array.from({ length: 22 }, (_, k) => `<rect x="${k * 40 - 6}" y="${GROUND + 33}" width="20" height="3.4" rx="1.7" fill="#e8d36a" opacity=".85"/>`).join('')}
  ${lamp(232)}${lamp(640)}
  ${era(2000, 2016, 690, GROUND, `<rect x="686" y="${GROUND - 110}" width="8" height="112" fill="#8a5a36" ${OL}/><rect x="672" y="${GROUND - 102}" width="36" height="6" fill="#8a5a36" ${OL}/>${wires}`)}
  ${era(2020, 2100, 690, GROUND, `<rect x="687" y="${GROUND - 96}" width="6" height="98" fill="#9a96b4" ${OL}/><rect x="680" y="${GROUND - 92}" width="8" height="20" rx="2" fill="#d8d6e6" ${OL}/><rect x="692" y="${GROUND - 92}" width="8" height="20" rx="2" fill="#d8d6e6" ${OL}/><circle class="g5" cx="690" cy="${GROUND - 100}" r="3.4" fill="#c8ff2e" ${OLt}/>`)}
  ${era(2000, 2015, 292, GROUND, `<rect x="289" y="${GROUND - 46}" width="7" height="48" fill="#6a6588" ${OL}/><rect x="278" y="${GROUND - 78}" width="30" height="36" rx="4" fill="#2f6fd1" ${OL}/>
    <rect x="283" y="${GROUND - 73}" width="20" height="8" rx="1" fill="#bfe0ff" ${OLt}/><text x="293" y="${GROUND - 67}" text-anchor="middle" font-family="Inter Tight, sans-serif" font-weight="800" font-size="6" fill="#2f6fd1">PHONE</text>
    <path d="M284 ${GROUND - 60} q-3 8 2 14" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><rect x="291" y="${GROUND - 60}" width="12" height="12" rx="2" fill="#24508f" ${OLt}/>`)}
  ${era(2018, 2100, 294, GROUND, `<rect x="282" y="${GROUND - 62}" width="24" height="64" rx="8" fill="#eef1f7" ${OL}/><rect x="287" y="${GROUND - 54}" width="14" height="12" rx="2" fill="#15121f"/>
    <path class="chg" d="M295 ${GROUND - 53} l-4 6 h4 l-2 5 l6 -7 h-4 l2 -4 z" fill="#c8ff2e"/><rect x="304" y="${GROUND - 36}" width="5" height="10" rx="2" fill="#6a6588" ${OLt}/>`)}
  ${era(2021, 2100, 590, GROUND, `<g id="robot"><rect x="566" y="${GROUND - 26}" width="30" height="20" rx="6" fill="#f5f6fb" ${OL}/><rect x="564" y="${GROUND - 30}" width="34" height="7" rx="3" fill="#d8d6e6" ${OL}/>
    <rect x="570" y="${GROUND - 22}" width="18" height="10" rx="3" fill="#15121f"/><circle cx="575" cy="${GROUND - 17}" r="2.2" fill="#c8ff2e"/><circle cx="583" cy="${GROUND - 17}" r="2.2" fill="#c8ff2e"/>
    ${[570, 581, 592].map((wx) => `<circle cx="${wx}" cy="${GROUND - 4}" r="4.2" fill="#3b3550" ${OLt}/>`).join('')}
    <path d="M594 ${GROUND - 30} V${GROUND - 52}" stroke="${INK}" stroke-width="1.8"/><path d="M594 ${GROUND - 52} L606 ${GROUND - 48} L594 ${GROUND - 44} Z" fill="#ff8a3d" ${OLt}/></g>`)}`;
}

function carsSVG() {
  const x = 150, y = 296;
  const wheel = (cx) => `<circle cx="${cx}" cy="${y - 7}" r="9" fill="#2a2638" ${OL}/><circle cx="${cx}" cy="${y - 7}" r="3.6" fill="#c9cedb"/>`;
  const taxi = `<g id="exhaust">${[0, 1, 2].map((k) => `<circle class="puff" cx="${x - 6}" cy="${y - 12}" r="5" fill="#b9b3c9" ${OLt}/>`).join('')}</g>
    <path d="M${x} ${y - 10} Q${x - 2} ${y - 26} ${x + 12} ${y - 28} L${x + 26} ${y - 30} Q${x + 34} ${y - 46} ${x + 52} ${y - 46} L${x + 72} ${y - 46} Q${x + 86} ${y - 44} ${x + 92} ${y - 30} L${x + 104} ${y - 27} Q${x + 112} ${y - 24} ${x + 110} ${y - 10} Z" fill="#ffd23f" ${OL}/>
    <path d="M${x + 33} ${y - 31} Q${x + 38} ${y - 42} ${x + 52} ${y - 42} L${x + 60} ${y - 42} L${x + 60} ${y - 31} Z M${x + 64} ${y - 42} L${x + 72} ${y - 42} Q${x + 82} ${y - 41} ${x + 87} ${y - 31} L${x + 64} ${y - 31} Z" fill="#7fd7ff" ${OLt}/>
    <path d="M${x + 4} ${y - 20} H${x + 106}" stroke="${INK}" stroke-width="1" stroke-dasharray="4 4" opacity=".5"/>
    <rect x="${x + 46}" y="${y - 55}" width="22" height="9" rx="2" fill="#fff6d0" ${OL}/><text x="${x + 57}" y="${y - 48.3}" text-anchor="middle" font-family="Inter Tight, sans-serif" font-weight="800" font-size="6.5" fill="${INK}">TAXI</text>
    <circle cx="${x + 106}" cy="${y - 22}" r="3.4" fill="#fff6c8" ${OLt}/>${wheel(x + 24)}${wheel(x + 88)}`;
  const ev = `<path d="M${x} ${y - 10} Q${x - 2} ${y - 24} ${x + 14} ${y - 27} Q${x + 34} ${y - 46} ${x + 62} ${y - 46} Q${x + 90} ${y - 44} ${x + 102} ${y - 28} Q${x + 112} ${y - 24} ${x + 110} ${y - 10} Z" fill="#e7ecf4" ${OL}/>
    <path d="M${x + 30} ${y - 30} Q${x + 42} ${y - 42} ${x + 62} ${y - 42} Q${x + 84} ${y - 41} ${x + 94} ${y - 30} Z" fill="#253049" ${OLt}/>
    <path d="M${x + 52} ${y - 25} l-5 8 h5 l-2 7 l8 -10 h-5 l3 -5 z" fill="#c8ff2e" ${OLt}/>
    <rect x="${x + 98}" y="${y - 25}" width="10" height="3" rx="1.5" fill="#7fe0ff"/>${wheel(x + 24)}${wheel(x + 88)}
    <path d="M${x + 110} ${y - 20} C${x + 130} ${y - 18} ${x + 128} ${GROUND - 40} ${x + 154} ${GROUND - 31}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M${x + 110} ${y - 20} C${x + 130} ${y - 18} ${x + 128} ${GROUND - 40} ${x + 154} ${GROUND - 31}" fill="none" stroke="#6a6588" stroke-width="1.8" stroke-linecap="round"/>`;
  const robo = `<path d="M${x} ${y - 10} Q${x - 2} ${y - 30} ${x + 18} ${y - 34} Q${x + 40} ${y - 50} ${x + 64} ${y - 50} Q${x + 92} ${y - 48} ${x + 104} ${y - 30} Q${x + 112} ${y - 24} ${x + 110} ${y - 10} Z" fill="#f5f7fb" ${OL}/>
    <path d="M${x + 26} ${y - 34} Q${x + 44} ${y - 46} ${x + 64} ${y - 46} Q${x + 86} ${y - 45} ${x + 96} ${y - 33} Z" fill="#2aa7b5" ${OLt}/>
    <rect x="${x + 52}" y="${y - 60}" width="22" height="11" rx="5.5" fill="#3b3550" ${OL}/><rect id="lidar" x="${x + 56}" y="${y - 57}" width="5" height="5" rx="1.5" fill="#7fe0ff"/>
    <text x="${x + 52}" y="${y - 17}" text-anchor="middle" font-family="Inter Tight, sans-serif" font-weight="800" font-size="8" fill="#2aa7b5">ROBO</text>
    <circle cx="${x + 101}" cy="${y - 23}" r="5.4" fill="#ffffff" ${OLt}/><circle id="roboEye" cx="${x + 102.5}" cy="${y - 23}" r="2" fill="${INK}"/>${wheel(x + 24)}${wheel(x + 88)}`;
  return era(2000, 2017, x + 55, y, taxi) + era(2017, 2023, x + 55, y, ev) + era(2023, 2100, x + 55, y, robo);
}

function skySVG() {
  const stars = Array.from({ length: 26 }, (_, i) => {
    const x = f1(rnd(i) * 800), y = f1(6 + rnd(i + 50) * 120), r = 1 + rnd(i + 90) * 1.4;
    return i % 4 ? `<circle cx="${x}" cy="${y}" r="${f1(r * 0.7)}" fill="#fff6dc" opacity=".8"/>`
      : `<path d="M${x} ${f1(y - r * 3)} Q${x} ${y} ${f1(x + r * 3)} ${y} Q${x} ${y} ${x} ${f1(y + r * 3)} Q${x} ${y} ${f1(x - r * 3)} ${y} Q${x} ${y} ${x} ${f1(y - r * 3)} Z" fill="#fff6dc"/>`;
  }).join('');
  const far = Array.from({ length: 22 }, (_, i) => { const x = i * 38 - 20, h = 50 + rnd(i + 300) * 70; return `<rect x="${x}" y="${f1(GROUND - h)}" width="${f1(30 + rnd(i + 400) * 16)}" height="${f1(h)}" rx="2"/>`; }).join('');
  const drone = (x, y, parcel, id) => `<g id="${id}"><path d="M${x - 16} ${y - 4} H${x + 16}" stroke="${INK}" stroke-width="3"/>
    <ellipse class="rotor" cx="${x - 16}" cy="${y - 7}" rx="9" ry="2" fill="#ffffff" opacity=".8"/><ellipse class="rotor" cx="${x + 16}" cy="${y - 7}" rx="9" ry="2" fill="#ffffff" opacity=".8"/>
    <ellipse cx="${x}" cy="${y}" rx="11" ry="7" fill="#ffc93c" ${OL}/><circle cx="${x + 3}" cy="${y - 1}" r="3.8" fill="#ffffff" ${OLt}/><circle cx="${x + 4.3}" cy="${y - 1}" r="1.5" fill="${INK}"/>
    ${parcel ? era(2021, 2100, x, y + 7, `<path d="M${x} ${y + 7} V${y + 14}" stroke="${INK}" stroke-width="1.4"/><rect x="${x - 7}" y="${y + 14}" width="14" height="11" rx="1.5" fill="#c98a4b" ${OL}/><path d="M${x} ${y + 14} V${y + 25}" stroke="#8a5a36" stroke-width="1.6"/>`) : ''}</g>`;
  return `
  <rect width="800" height="${GROUND}" fill="url(#skyOld)"/>
  <rect id="skyNew" width="800" height="${GROUND}" fill="url(#skyNew)" opacity="0"/>
  ${stars}
  <g><circle cx="110" cy="52" r="19" fill="#fff3c9" ${OL}/><circle cx="103" cy="46" r="4" fill="#efe0ad"/><circle cx="116" cy="58" r="3" fill="#efe0ad"/><circle cx="114" cy="44" r="2" fill="#efe0ad"/></g>
  <g fill="#3a2c5c" opacity=".75">${far}</g>
  ${era(2019, 2100, 250, 84, drone(250, 84, true, 'drone1'))}
  ${era(2024, 2100, 615, 58, drone(615, 58, true, 'drone2'))}
  ${era(2025, 2100, 400, 40, `<g id="airTaxi"><path d="M-30 4 H30" stroke="${INK}" stroke-width="3"/><ellipse class="rotor" cx="-30" cy="0" rx="12" ry="2.4" fill="#ffffff" opacity=".85"/><ellipse class="rotor" cx="30" cy="0" rx="12" ry="2.4" fill="#ffffff" opacity=".85"/>
    <path d="M-20 10 Q-20 0 -6 -1 L10 -1 Q24 0 26 12 Q24 20 10 20 L-12 20 Q-20 19 -20 10 Z" fill="#f5f6fb" ${OL}/><path d="M4 2 Q18 2 21 12 L4 12 Z" fill="#7fe0ff" ${OLt}/>
    <circle cx="-22" cy="14" r="2" fill="#ff5d5d"/><circle cx="27" cy="15" r="2" fill="#3ddc8f"/></g>`)}`;
}

function sceneSVG() {
  const vortex = [['#c8ff2e', 0], ['#ffb22e', 2.09], ['#b06bff', 4.19]].map(([c, r0]) => {
    const pts = Array.from({ length: 48 }, (_, i) => { const a = i / 48 * Math.PI * 3 + r0, r = 6 + i * 3.1; return `${f1(MX + Math.cos(a) * r)} ${f1(150 + Math.sin(a) * r * 0.8)}`; });
    return `<path d="M${pts.join(' L')}" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M${pts.join(' L')}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`;
  }).join('');
  const streaks = Array.from({ length: 12 }, (_, i) => {
    const y = f1(20 + rnd(i + 400) * 210), len = f1(40 + rnd(i + 500) * 110);
    return `<path class="streak" d="M0 ${y} H${len}" stroke="${i % 3 ? '#ffb22e' : '#c8ff2e'}" stroke-width="${f1(2 + rnd(i + 600) * 2)}" stroke-linecap="round"/>`;
  }).join('');
  return `<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="skyOld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22103a"/><stop offset=".55" stop-color="#5b2a63"/><stop offset=".85" stop-color="#c4555a"/><stop offset="1" stop-color="#f0844f"/></linearGradient>
    <linearGradient id="skyNew" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1640"/><stop offset=".55" stop-color="#213f86"/><stop offset=".85" stop-color="#2f8fb0"/><stop offset="1" stop-color="#4fe0c8"/></linearGradient>
    <radialGradient id="mInside" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#f6ffbf"/><stop offset=".45" stop-color="#c8ff2e"/><stop offset="1" stop-color="#ff9f2e"/></radialGradient>
    <radialGradient id="glowOld"><stop offset="0" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowNew"><stop offset="0" stop-color="#e8fbff" stop-opacity=".6"/><stop offset="1" stop-color="#e8fbff" stop-opacity="0"/></radialGradient>
    <clipPath id="cityClip"><rect x="-30" y="-60" width="860" height="${GROUND + 62}"/></clipPath>
    <clipPath id="mDoorClip"><rect x="372" y="132" width="56" height="108" rx="24"/></clipPath>
  </defs>
  ${skySVG()}
  <g clip-path="url(#cityClip)">${TOWERS.map(towerSVG).join('')}</g>
  <g id="vortex" opacity="0">${vortex}</g>
  ${streetSVG()}
  ${machineSVG()}
  <g id="vcOutside">${vcSVG()}</g>
  ${carsSVG()}
  <g id="streaks" opacity="0">${streaks}</g>
  </svg>`;
}

/* ---------- the year counter: four split-flap tiles ---------- */
let shownYear = '';
function setYear(y, flip = true) {
  const s = String(y), el = $('#tripYear');
  if (s === shownYear && el.children.length) return;
  if (el.children.length !== s.length) el.innerHTML = [...s].map(() => '<span class="flap"><b></b></span>').join('');
  [...s].forEach((d, i) => {
    const b = el.children[i].firstElementChild;
    if (b.textContent === d) return;
    b.textContent = d;
    if (flip && !REDUCED) b.animate([{ transform: 'rotateX(75deg)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 110, easing: 'ease-out' });
  });
  el.setAttribute('aria-label', s.includes('?') ? 'Somewhere in the past' : s);
  shownYear = s;
}

/* ---------- the trip ---------- */
let running = null;
export function skipTrip() { running?.skip(); }

// kind: 'out' (today → the deals' years) | 'home' (back to today). o: { fund, from, to, full }
export function runTrip(kind, o) {
  const stage = $('#tripStage');
  if (!stage.querySelector('svg')) stage.insertAdjacentHTML('afterbegin', sceneSVG());
  const svg = stage.querySelector('svg');
  const q = (s) => svg.querySelector(s), qa = (s) => [...svg.querySelectorAll(s)];
  const set = (el, k, v) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };

  const E = {
    vc: q('#vc'), inside: q('#vcInside'), outside: q('#vcOutside'), body: q('#vBody'), legF: q('#vLegF'), legB: q('#vLegB'), armF: q('#vArmF'), armB: q('#vArmB'),
    hair: q('#vHair'), zap: q('#vHairZap'), puff: q('#vPuff'), pupL: q('#vPupL'), pupR: q('#vPupR'),
    shake: q('#mShake'), door: q('#mDoor'), lever: q('#mLever'), needle: q('#mNeedle'), bulb: q('#mBulb'), bulbGlow: q('#mBulbGlow'), port: q('#mPort'), swirl: q('#mSwirl'),
    tube: q('#mTube'), bubbles: qa('.mBub'), sparks: qa('.mSpark'), vortex: q('#vortex'), streaks: q('#streaks'), streak: qa('.streak'),
    skyNew: q('#skyNew'), towers: qa('.tw'), bbPaper: q('#bbPaper'), bbLed: q('#bbLed'), rotors: qa('.rotor'), lights: qa('.twLight'),
    drone1: q('#drone1'), drone2: q('#drone2'), air: q('#airTaxi'), robot: q('#robot'), lidar: q('#lidar'), roboEye: q('#roboEye'), puffs: qa('.puff'), g5: q('.g5'),
    eras: qa('[data-from]').map((el) => ({ el, from: +el.dataset.from, to: +el.dataset.to, ax: +el.dataset.ax, ay: +el.dataset.ay, v: -1 })),
  };
  E.towers.forEach((el) => { el._t = TOWERS[+el.dataset.i]; el._crane = el.querySelector('.crane'); });

  const out = kind === 'out', full = o.full && !REDUCED;
  const Y0 = out ? o.to : o.from, Y1 = out ? o.from : o.to;
  const r = stage.getBoundingClientRect();
  const visW = r.width && r.height ? r.width / Math.max(r.width / 800, r.height / 300) : 800;
  const startX = Math.max(-60, MX - visW / 2 - 50), outX = 528;
  const P = full
    ? { T: 3000, walkIn: [0, 720], door: [[0, 1], [740, 1], [900, 0], [2150, 0], [2300, 1]], travel: [900, 2050], flash: 1980, walkOut: [2260, 2760], dizzy: [2200, 2800] }
    : { T: 1400, walkIn: null, door: [[0, 0], [950, 0], [1080, 1]], travel: [0, 850], flash: 800, walkOut: [1040, 1380], dizzy: [1000, 1400] };
  // One line per trip, on screen the whole time. No year in it: the deals come from many different years.
  // The counter doesn't name one either: the dial spins and lands on 20?? going back, on today coming home.
  $('#tripCap').innerHTML = out
    ? 'You have <em>$10M</em>. You’re going back in time.'
    : 'Back to today, to see how your bets landed.';
  $('#tripEyebrow').textContent = `${out ? 'Departure' : 'Return trip'} · ${o.fund}`;
  const flashEl = $('#tripFlash'), warpEl = $('#tripWarp');
  const PAST = '20??', TODAY = String(o.to);
  const [a, b] = P.travel;

  const draw = (t) => {
    const k = clamp01((t - a) / 200) * clamp01((b - t) / 250);
    const p = clamp01((t - a - 60) / (b - a - 200)), yr = Y0 + (Y1 - Y0) * ease(p);
    const e = clamp01((yr - 2012) / 14);

    // the world
    set(E.skyNew, 'opacity', e.toFixed(3));
    for (const el of E.towers) {
      const [, , H, , keys] = el._t, h = towerH(keys, yr);
      set(el, 'transform', h >= H ? '' : `translate(0 ${f1(H - h)})`);
      if (el._crane) set(el._crane, 'display', h > 0 && h < H - 0.5 ? 'inline' : 'none');
    }
    for (const it of E.eras) {
      const v = clamp01((yr - it.from + 0.35) / 0.7) * clamp01((it.to + 0.35 - yr) / 0.7);
      if (Math.abs(v - it.v) < 0.002) continue;
      it.v = v;
      if (v <= 0) { set(it.el, 'display', 'none'); continue; }
      set(it.el, 'display', 'inline'); set(it.el, 'opacity', v.toFixed(3));
      set(it.el, 'transform', v >= 1 ? '' : `translate(${it.ax} ${it.ay}) scale(${(0.5 + 0.5 * v).toFixed(3)}) translate(${-it.ax} ${-it.ay})`);
    }
    const word = (HYPE.filter(([y]) => Math.floor(yr + 1e-6) >= y).pop() || HYPE[0])[1];
    if (E.bbPaper.textContent !== word) { E.bbPaper.textContent = word; E.bbLed.textContent = word; }
    set(E.bbLed, 'opacity', Math.floor(t / 110) % 19 ? '1' : '.55');
    E.rotors.forEach((el, i) => set(el, 'rx', String(Math.floor(t / 45 + i) % 2 ? 9 : 4)));
    E.lights.forEach((el, i) => set(el, 'opacity', Math.floor(t / 520 + i * 0.37) % 2 ? '1' : '.3'));
    set(E.drone1, 'transform', `translate(${f1(6 * Math.sin(t / 700))} ${f1(3 * Math.sin(t / 260))})`);
    set(E.drone2, 'transform', `translate(${f1(5 * Math.sin(t / 600 + 2))} ${f1(3 * Math.sin(t / 300 + 1))})`);
    set(E.air, 'transform', `translate(${f1(-40 + ((t * 0.06 + 300) % 880))} 40)`);
    set(E.robot, 'transform', `translate(${f1((t * 0.02) % 50)} 0)`);
    set(E.lidar, 'x', f1(211 + 5 * Math.sin(t / 90)));
    set(E.roboEye, 'cx', f1(252.5 + 1.2 * Math.sin(t / 400)));
    E.puffs.forEach((el, i) => { const ph = ((t / 600) + i / 3) % 1; set(el, 'cx', f1(144 - ph * 26)); set(el, 'cy', f1(284 - ph * 14)); set(el, 'r', f1(3 + ph * 6)); set(el, 'opacity', (0.8 * (1 - ph)).toFixed(2)); });
    if (E.g5) set(E.g5, 'opacity', Math.floor(t / 600) % 2 ? '1' : '.35');

    // the machine
    const jit = Math.floor(t / 40);
    const sx = k > 0.05 ? f1((rnd(jit) - 0.5) * 6 * k) : 0, sy = k > 0.05 ? f1((rnd(jit + 99) - 0.5) * 3.5 * k) : 0;
    set(E.shake, 'transform', sx || sy ? `translate(${sx} ${sy})` : '');
    let door = P.door[0][1];
    for (let i = 1; i < P.door.length; i++) {
      const [t0, v0] = P.door[i - 1], [t1, v1] = P.door[i];
      if (t >= t1) door = v1; else { if (t > t0) door = v0 + (v1 - v0) * ease((t - t0) / (t1 - t0)); break; }
    }
    set(E.door, 'transform', door <= 0 ? '' : `translate(372 0) scale(${(1 - 0.9 * door).toFixed(3)} 1) translate(-372 0)`);
    const lv = clamp01((t - (a - 140)) / 140) * clamp01((b + 220 - t) / 220);
    set(E.lever, 'transform', `rotate(${f1(56 * lv)} 334 172)`);
    set(E.needle, 'transform', `rotate(${f1(-60 + 230 * k + (k > 0 ? 18 * Math.sin(t / 37) : 0))} 443 146)`);
    set(E.bulb, 'fill', k > 0 && Math.floor(t / 70) % 2 ? '#ffffff' : '#c8ff2e');
    set(E.bulbGlow, 'r', f1(16 + 14 * k)); set(E.bulbGlow, 'opacity', (0.18 + 0.4 * k).toFixed(2));
    set(E.port, 'fill', k > 0 ? (Math.floor(t / 90) % 2 ? '#f6ffbf' : '#c8ff2e') : '#c8ff2e');
    set(E.swirl, 'transform', `rotate(${f1((out ? -1 : 1) * t * (0.12 + 0.5 * k))} 400 186)`);
    set(E.tube, 'stroke', k > 0 && Math.floor(t / 120) % 2 ? '#e6ffb0' : '#9dff6a');
    E.bubbles.forEach((el, i) => set(el, 'cy', f1(249 - ((t * (0.02 + 0.06 * k) + i * 9) % 24))));
    E.sparks.forEach((el, i) => set(el, 'display', k > 0.3 && rnd(Math.floor(t / 70) * 3 + i) > 0.45 ? 'inline' : 'none'));
    set(E.vortex, 'opacity', (0.9 * k).toFixed(3));
    set(E.vortex, 'transform', `rotate(${f1((out ? -1 : 1) * t * 0.42)} ${MX} 150) translate(${MX} 150) scale(${(0.35 + 0.75 * k).toFixed(3)}) translate(${-MX} -150)`);
    set(E.streaks, 'opacity', (0.85 * k).toFixed(3));
    E.streak.forEach((el, i) => { const sp = 0.6 + rnd(i + 60) * 0.8, span = 1000, x = ((t * sp + rnd(i) * span) % span) - 150; set(el, 'transform', `translate(${f1(out ? 800 - x : x - 100)} 0)`); });

    // the VC: walk in, ride, stumble out a bit frazzled
    let x = MX, walking = false;
    if (P.walkIn && t < P.walkIn[1]) { x = startX + (MX - startX) * clamp01(t / P.walkIn[1]); walking = true; }
    else if (t >= P.walkOut[0]) { const qq = clamp01((t - P.walkOut[0]) / (P.walkOut[1] - P.walkOut[0])); x = MX + (outX - MX) * qq; walking = qq < 1; }
    const near = Math.abs(x - MX);
    const feet = GROUND + 2 - 13 * clamp01((34 - near) / 16); // steps up onto the machine's sill
    const host = near < 26 ? E.inside : E.outside;
    if (E.vc.parentNode !== host) host.appendChild(E.vc);
    const ph = t / 230 * Math.PI * 2, s = walking ? Math.sin(ph) : 0;
    set(E.vc, 'transform', `translate(${f1(x)} ${f1(feet)}) scale(.86)`); // inside, the machine's shake carries them
    set(E.body, 'transform', walking ? `translate(0 ${f1(-Math.abs(Math.cos(ph)) * 3)})` : '');
    set(E.legF, 'transform', `rotate(${f1(30 * s)} 2 -42)`);
    set(E.legB, 'transform', `rotate(${f1(-30 * s)} -3 -42)`);
    set(E.armF, 'transform', `rotate(${f1(-10 * s)} 5 -68)`);
    set(E.armB, 'transform', `rotate(${f1(24 * s)} -7 -68)`);
    const dz = t >= P.dizzy[0] && t < P.dizzy[1];
    set(E.hair, 'display', dz ? 'none' : 'inline'); set(E.zap, 'display', dz ? 'inline' : 'none');
    if (dz) { const dq = (t - P.dizzy[0]) / (P.dizzy[1] - P.dizzy[0]); set(E.puff, 'transform', `translate(0 ${f1(-10 * dq)})`); set(E.puff, 'opacity', (0.9 * (1 - dq)).toFixed(2)); }
    const spin = dz ? t / 70 : null;
    set(E.pupL, 'cx', f1(spin == null ? 9.6 : 8 + 2.6 * Math.cos(spin))); set(E.pupL, 'cy', f1(spin == null ? -91 : -91 + 2.6 * Math.sin(spin)));
    set(E.pupR, 'cx', f1(spin == null ? 19.8 : 18.5 + 2.4 * Math.cos(-spin))); set(E.pupR, 'cy', f1(spin == null ? -91 : -91 + 2.4 * Math.sin(-spin)));

    // overlays, the counter, the caption
    const fl = t < P.flash ? 0 : t < P.flash + 110 ? (t - P.flash) / 110 : clamp01(1 - (t - P.flash - 110) / 320);
    flashEl.style.opacity = fl.toFixed(3);
    warpEl.style.opacity = (0.85 * k).toFixed(3);
    // the dial: today or 20?? at rest, the last two digits spinning while the machine runs
    const spinning = t > a + 60 && t < b - 120;
    const roll = Math.floor(t / 75);
    setYear(spinning ? 2012 + Math.floor(rnd(roll) * (o.to - 2011)) : (p >= 1) === out ? PAST : TODAY, t > 0);
  };

  setYear(out ? TODAY : PAST, false);
  E.eras.forEach((it) => { it.v = -1; });
  return new Promise((resolve) => {
    let raf = 0, done = false;
    const start = performance.now();
    const finish = (pause) => {
      if (done) return;
      done = true; running = null; cancelAnimationFrame(raf); stage.onclick = null;
      draw(P.T); flashEl.style.opacity = '0'; warpEl.style.opacity = '0';
      setTimeout(resolve, pause);
    };
    const tick = (now) => {
      const t = Math.max(0, now - start); // a frame's timestamp can be a little before `start`
      if (t >= P.T) return finish(0);
      draw(t);
      raf = requestAnimationFrame(tick);
    };
    running = { skip: () => finish(80) };
    stage.onclick = () => running?.skip();
    $('#tripSkip').onclick = () => running?.skip();
    if (REDUCED) { draw(P.T); flashEl.style.opacity = '0'; warpEl.style.opacity = '0'; done = true; running = null; setTimeout(resolve, 900); return; }
    draw(0);
    raf = requestAnimationFrame(tick);
  });
}
