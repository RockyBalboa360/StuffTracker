// Start, Routing, Theme, Standort, Service Worker.
import * as store from './store.js';
import { t, setLang, getLang, resolveLang } from './i18n.js';
import { ui, icon, refreshSheets, actions, toast } from './ui.js';
import { renderHome, afterHome } from './views/home.js';
import { renderStock, refreshStock, afterStock } from './views/stock.js';
import { renderTransport } from './views/transport.js';
import { renderSettings } from './views/settings.js';
import './views/item.js';
import { isDaytime } from './sun.js';

const TABS = {
  home: { render: renderHome, after: afterHome, icon: 'home', color: '#EE352E' },
  stock: { render: renderStock, after: afterStock, icon: 'stock', color: '#00933C' },
  transport: { render: renderTransport, icon: 'transport', color: '#FCCC0A', dark: true },
  more: { render: renderSettings, icon: 'more', color: '#A7A9AC' },
};
const main = document.getElementById('main');
const nav = document.getElementById('nav');
let deferredInstall = null;

/* ---------- Rendering ---------- */
const tabFromHash = () => { const m = location.hash.match(/^#\/(\w+)/); return TABS[m?.[1]] ? m[1] : 'home'; };

function renderNav() {
  nav.innerHTML = Object.entries(TABS).map(([k, v]) =>
    `<a class="navbtn ${ui.tab === k ? 'on' : ''}" href="#/${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">
      <span class="navdot ${v.dark ? 'navdot--dark' : ''}" style="--bc:${v.color}">${icon(v.icon, 22)}</span><small>${t('tab.' + k)}</small></a>`).join('');
}
function render(keepScroll = true) {
  const top = keepScroll ? main.scrollTop : 0;
  document.documentElement.lang = getLang();
  main.innerHTML = TABS[ui.tab].render();
  main.dataset.tab = ui.tab;
  main.scrollTop = top;
  renderNav();
  const ib = document.getElementById('install-btn');
  if (ib && deferredInstall) ib.hidden = false;
  TABS[ui.tab].after?.();
}
let raf = 0;
function schedule() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    applyLang();
    applyTheme();
    if (!(ui.tab === 'stock' && refreshStock())) render();
    refreshSheets();
  });
}
window.addEventListener('st:render', () => render(false));
window.addEventListener('hashchange', () => { ui.tab = tabFromHash(); render(false); });

/* ---------- Sprache & Theme ---------- */
function applyLang() { setLang(resolveLang(store.settings().lang)); }
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const mode = store.settings().theme;
  let dark;
  if (mode === 'dark') dark = true;
  else if (mode === 'light') dark = false;
  else if (mode === 'system') dark = mq.matches;
  else {
    const p = store.place(store.currentPlaceId());
    const g = store.settings().lastGeo;
    dark = !isDaytime(new Date(), p?.lat ?? g?.lat, p?.lon ?? g?.lon);
  }
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#000000' : '#0b0b0c');
}
mq.addEventListener?.('change', applyTheme);
setInterval(applyTheme, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { applyTheme(); detect(); } });

/* ---------- Standort ---------- */
const rad = Math.PI / 180;
const dist = (a, b, c, d) => {
  const dLat = (c - a) * rad; const dLon = (d - b) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
};
function detect() {
  const s = store.settings();
  if (!navigator.geolocation) return;
  const located = store.places().filter((p) => p.lat != null);
  const wantPlace = s.placeMode !== 'manual' && located.length > 0;
  const wantSun = s.theme === 'auto';
  if (!wantPlace && !wantSun) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    store.setGeo(lat, lon);
    if (wantPlace) {
      let best = null;
      for (const p of located) {
        const d = dist(lat, lon, p.lat, p.lon);
        if (d <= 400 && (!best || d < best.d)) best = { p, d };
      }
      if (best) store.setDetectedPlace(best.p.id);
    }
    applyTheme();
  }, () => {}, { maximumAge: 300000, timeout: 10000 });
}
window.addEventListener('st:detect', detect);

/* ---------- Update / Installation ---------- */
function showUpdateBanner(worker) {
  if (document.getElementById('update-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'update-bar';
  bar.innerHTML = `<span>${t('updateReady')}</span><button type="button">${t('updateNow')}</button>`;
  bar.querySelector('button').onclick = () => worker.postMessage('SKIP_WAITING');
  document.body.appendChild(bar);
}
/** Bestätigung nach einem Update: gleiche Leiste wie „Update verfügbar“, mit Haken. */
function showUpdateDone() {
  if (document.getElementById('update-done')) return;
  const bar = document.createElement('div');
  bar.id = 'update-done';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>${icon('check', 20)} ${t('updateDone', { v: store.VERSION })}</span><button type="button">${t('ok')}</button>`;
  const close = () => bar.remove();
  bar.querySelector('button').onclick = close;
  document.body.appendChild(bar);
  setTimeout(close, 12000);
}
/** Merkt sich die zuletzt genutzte Version; ein Wechsel (oder eine Datenmigration) heißt: Update ist durch. */
function announceUpdate() {
  let changed = store.wasMigrated();
  try {
    const last = localStorage.getItem('st_lastver');
    if (last && last !== store.VERSION) changed = true;
    localStorage.setItem('st_lastver', store.VERSION);
  } catch { /* Speicher gesperrt */ }
  if (changed) showUpdateDone();
}
let swReg = null;
function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw);
      });
    });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
}
actions['check-update'] = async () => {
  if (!swReg) { toast(t('upToDate')); return; }
  try { await swReg.update(); } catch { /* offline */ }
  setTimeout(() => { if (!document.getElementById('update-bar')) toast(t('upToDate')); }, 1500);
};
actions['install-app'] = async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  render();
};
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; render(); });

/* ---------- Start ---------- */
(async function boot() {
  setLang(resolveLang('auto'));
  await store.load();
  if (!store.hasData()) store.init(getLang());
  applyLang();
  applyTheme();
  ui.tab = tabFromHash();
  render(false);
  store.subscribe(schedule);
  setupSW();
  announceUpdate();
  setTimeout(detect, 1500);
  document.getElementById('splash')?.remove();
  window.__st = { store, ui };
})();
