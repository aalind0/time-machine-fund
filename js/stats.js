// Anonymous, cookie-free counts with GoatCounter (goatcounter.com): page views, plus a few game events
// (a fund started, a fund finished and its tier, a share). Nothing about the player is sent: no fund names,
// no picks, no text. Off while CONFIG.goatcounter is empty; GoatCounter itself skips localhost and bots.
import { CONFIG } from './config.js';

export function initStats() {
  if (!CONFIG.goatcounter) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${CONFIG.goatcounter}.goatcounter.com/count`;
  document.head.appendChild(s);
}

// e.g. track('start/frontier', 'Fund started: Frontier tech'). Never lets counting break the game.
export function track(path, title) {
  try { window.goatcounter?.count?.({ path, title: title || path, event: true }); } catch { /* ignore */ }
}
